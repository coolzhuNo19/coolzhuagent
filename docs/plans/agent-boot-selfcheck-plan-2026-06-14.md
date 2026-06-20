# Agent 开机自检（Boot Self-Check）实施方案

- 日期：2026-06-14
- 需求编号：`CUR-SELFCHECK-001`
- 状态：方案待执行，执行顺序 **#3**（前置：`CUR-DIAG-LOG-001` 补日志、`CUR-MEM-ARCH-001` 记忆架构；之后：`CUR-SOAK-MONKEY-001`、`CUR-LOCAL-LLM-001`）
- 关联：`docs/plans/agent-soak-monkey-test-plan-2026-06-14.md`（同批，共享诊断日志底座）
- 底座：`modules/diagnostics`（结构化 JSONL + span/trace，已就绪）

> 目的：agent 启动时，按依赖顺序对**会话链路 / 上下文自动压缩 / 记忆加载与检索 / 视觉确认 / 工具调用 / computer-use** 等基础能力做探测，**全部关键项通过后才进入可服务状态**；任一关键项失败则阻断或降级，并打印明确、可追溯的错误。

---

## 1. 设计原则

1. **依赖顺序探测**：基础设施 → 会话链路 → 上层能力，前序失败短路后序。
2. **关键 vs 非关键**：关键项（blocking）失败 → 阻断进入服务；非关键项（degrade）失败 → 标记降级、记录原因、继续。
3. **复用 diagnostics**：每个 probe 跑在 `start_span("selfcheck.<item>", "selfcheck")` 内，结果用 `info/warn/error(module, event, msg, fields)` 落 JSONL，附 `trace_id` 可回溯。
4. **结构化报告**：汇总成 `SelfCheckReport`（JSON）+ 推 GUI 健康面板。
5. **只读/无副作用优先**：探测尽量用只读或 dry-run（尤其 computer-use 绝不实际点击）。
6. **可跳过**：环境开关（headless/CI）按需跳过视觉、computer-use 等强环境依赖项。

---

## 2. 探测项清单

| 阶段 | 探测项 | 探测内容 | 通过判据 | 失败处理 | 接入点 |
|---|---|---|---|---|---|
| P0 基础设施 | 日志 | `diagnostics::init(app)` 成功、log dir 可写 | 返回路径且能写一条 | **阻断** | `diagnostics::init` / `log_path` |
| P0 | 配置 | `llm-adapter::load_config()` + `.coolzhu/config.json` 解析 | 无解析错误 | **阻断** | `config.rs::load_config` |
| P0 | 存储 | `.coolzhu/web-sessions.sqlite` 可打开、`PRAGMA user_version` 可读、迁移到位 | 连接成功且版本符合 | **阻断** | sqlite 初始化（main.rs 迁移段） |
| P1 会话链路 | Provider 连通 | 对配置的 base_url 探活（本地 `/v1/models`，远端按 provider） | HTTP 2xx / 模型列表非空 | **阻断**（无可用模型无法服务） | `OpenAiCompatClient` |
| P1 | 最小一轮 | （可选）极短 prompt dry-run，校验流式管线 | 收到首个 token 事件 | degrade（标记"仅离线"） | 会话 handler |
| P2 上下文压缩 | 自动压缩 | 构造超 `auto_compact_percent` 阈值的上下文 → 触发 compact | 摘要生成且 token 降至阈值下 | degrade（长会话风险） | `auto_compact_percent` 等（main.rs:3266+） |
| P3 记忆 | 读取 | `query_memory_beads` 对样本返回；sqlite `memory_beads` 可查 | 查询无错、计数一致 | degrade | `memory.rs::query_memory_beads` |
| P3 | 检索后端 | （记忆架构落地后）embedder `/v1/embeddings` 可达 + `dim` 与索引一致 | 维度匹配、返回向量 | degrade（回退关键词） | `Embedder`（CUR-MEM-ARCH-001 A） |
| P4 视觉 | 截屏 | `modules/vision` 截一帧 | 返回非空图像 | degrade（关视觉确认） | vision-service |
| P4 | 视觉模型 | （可选）视觉模型探活 | 可达 | degrade | vision-service |
| P5 工具调用 | 注册表 | `tool-registry` 注册项非空 | count > 0 | **阻断** | tooling/tool-registry |
| P5 | 安全只读工具 | 跑一个只读工具（如 grep dry / echo） | 返回预期结果 | degrade | tool-registry |
| P6 computer-use | 初始化 | `modules/computer-use` 可初始化、`cursor_position` 只读读取、分辨率映射可得 | 返回坐标/分辨率 | degrade（关 compute use） | computer-use |

> **computer-use 自检只做只读探测**（读光标位置/分辨率），**不移动鼠标、不点击**。

---

## 3. 编排与数据结构

```rust
enum CheckStatus { Pass, Warn, Fail }
struct CheckItem {
    name: String, status: CheckStatus, blocking: bool,
    detail: String, duration_ms: u64, trace_id: String,
}
struct SelfCheckReport {
    overall: CheckStatus,            // 任一 blocking Fail → Fail；有 Warn → Warn
    started_at: u128, finished_at: u128,
    items: Vec<CheckItem>,
}
```
- 顺序执行；blocking 项 Fail 后短路并 `overall=Fail`。
- 报告落 JSONL（`event="selfcheck.report"`）+ 写 `.coolzhu/selfcheck-last.json` + 推 GUI（`set_gui_callback`）。

---

## 4. 接入点

- **新增模块**：`core-runtime/src/self_check.rs`，定义 `Probe` trait（`fn name()/blocking()/run() -> CheckItem`）与编排器 `run_self_check() -> SelfCheckReport`。
- **各模块暴露 probe**：vision / tooling / computer-use / llm-adapter / memory 各提供一个轻量只读 `probe()`，由编排器调用（避免编排器反向依赖重模块——用回调/trait 注入）。
- **启动序列接入**：
  - web-console `main`：HTTP 服务 bind 前跑 `run_self_check()`；blocking Fail → 打印报告并以非零码退出（或进入"维护页"）。
  - gui-desktop 启动：同样前置自检，结果喂桌面 UI。
- **GUI**：health 面板展示各项 pass/warn/fail + 失败 detail + trace_id（点开跳日志）。

---

## 5. 降级矩阵（非关键项失败时）

| 失败项 | 降级行为 |
|---|---|
| 上下文压缩 | 提示"长会话可能溢出"，仍可服务 |
| 记忆检索后端 | 回退关键词检索（记忆架构 A 的 BruteForce/关键词） |
| 视觉 | 关闭"视觉确认"，相关动作提示不可用 |
| computer-use | 关闭 compute use 能力 |
| 安全只读工具 | 标记该工具不可用，其余工具正常 |

---

## 6. 全局约束（CLAUDE.md 对齐）

- 探测**只读优先**、computer-use 绝不实际操作。
- 中文日志/注释/回复。
- 测试：`cargo test -p coolzhu-core-runtime --offline`；改全局态用 `config_test_guard()`；保留 `module_linkage_smoke`。
- 离线：自检本身不引新依赖；provider 探活在离线/无网时应判为 degrade 而非崩溃。
- 大文件：启动序列改动落在 web-console `main.rs`（1.36MB），Read 分段、改前确认、先备份。

---

## 7. 里程碑

| 里程碑 | 交付 | 验收 |
|---|---|---|
| S1 | self_check 框架 + P0/P1（日志/配置/存储/provider） | 缺配置或库锁定时启动给出明确 blocking 报告 |
| S2 | P2–P5（压缩/记忆/视觉/工具） | 各项可单测；degrade 路径生效 |
| S3 | P6 computer-use + GUI 健康面板 + 报告落盘 | 全链路自检报告可视、可追溯 trace_id |

---

## 8. 下一步

1. 建 `core-runtime/src/self_check.rs` + `Probe` trait + 编排器（先 P0/P1，零依赖）。
2. 各模块加只读 `probe()`。
3. web-console 启动前接入 + 报告落盘 + GUI 面板。
4. 与 soak/monkey 方案共享同一套 diagnostic 事件命名（见配套文档 §3 命名约定）。
