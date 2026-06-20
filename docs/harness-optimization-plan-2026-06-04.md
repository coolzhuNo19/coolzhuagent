# coolzhu code agent —— Harness 优化方案计划（2026-06-04）

> 配套分析见 `harness-gap-analysis-2026-06-04.md`。本文把 gap 转为**可执行方案**：每项含 现状 / 目标 / 落点 / 步骤 / 工作量(S≤0.5d, M≈1-2d, L≥3d) / 验证 / 风险。聚焦本项目定位（coding + workflow agent）。

## 总览与批次 roadmap

| # | 优化项 | 优先级 | 工作量 | 批次 |
|---|---|---|---|---|
| 1 | goal 失败回退闭环（CUR-GOAL-LOOP-001） | P0 | L | 批次一 |
| 2 | 主循环结构化进度注入 | P1 | M | 批次一 |
| 3 | 确定性验证门控（build/test/lint 硬门 + 错误回流） | P1 | M | 批次一 |
| 4 | 工具 ACI 增强 + Poka-Yoke 防错 | P1 | S | 批次二 |
| 5 | 双模监管 L1/L2（空转/无进展/跑偏） | P1 | M | 批次二 |
| 6 | 用户请求级幂等（弱网去重） | P1 | S | 批次二 |
| 7 | 长期记忆语义向量检索 | P2 | L | 批次三 |
| 8 | 规则文件分层加载 | P2 | M | 批次三 |
| 9 | harness 效果指标体系 | P2 | M | 批次三 |
| 10 | 动态子 agent（R-SUBAGENT） | P2 | L | 批次三 |

**实施主线**：批次一闭环化反馈（P0+核心 P1）→ 批次二补可观测/可监管/防错 → 批次三架构增强。批次一三项强协同，建议合并设计、分步落地。

---

## 批次一：反馈闭环 + 确定性门控（coding 可靠性命门）

### 方案 1：goal 失败回退闭环（P0 / L）
- **现状**：plan→execute→verify 单向；verifier 不通过、implementer 受阻都无回退（`HandoffRecord` 已有 `rejected_reason` 字段但未驱动重试）。
- **目标**：verifier 拒绝 → 带原因/证据回 implementer 重改；implementer 自报 blocked → 回 planner 重规划；各环节 `retry_count` 上限（默认 3），超限标 goal `failed` 并通知。
- **落点**：
  - 后端 `web-console/main.rs`：`run_goal_phase_once`、`next_runnable_goal_phase_id`、`dispatch_ready_goal_phases`、`*_goal_*_sqlite`。
  - goal phase 表新增列：`retry_count`、`parent_phase_id`、`reject_reason`、`reject_evidence`。
  - 阶段角色 verifier 产出结构化结论 `{pass: bool, reason, evidence[]}`；planner/implementer 消费 reject 上下文。
  - 前端 `app.js`：`refreshOpenGoalTaskChain`、`syncTaskCardFromGoals`、`taskRenderHandoffSummary` 展示回退链与重试计数。
- **步骤**：① 定义 verifier 结构化输出协议（fenced ```verdict``` 块，复用 `parse_handoff_directives` 同款解析）→ ② SQLite 加列 + 迁移 → ③ `dispatch` 增加回退分支（fail→implementer / blocked→planner，附 reason/evidence + retry++）→ ④ 上限熔断 + 事件通知 → ⑤ 前端回退链可视化。
- **验证**：构造"首次实现有 bug→verifier 跑测试失败→回 implementer 修复→二次通过"的端到端用例；retry 超限用例标 failed；`cargo test -p coolzhu-web-console`。
- **风险**：状态机复杂度上升、死循环（靠 retry 上限 + 无进展监管#5 兜底）。

### 方案 2：主循环结构化进度注入（P1 / M）
- **现状**：`call_agent_model_with_tool_loop` 每轮仅追加 ToolResult，模型靠历史推断进度。
- **目标**：每轮注入结构化"任务状态块"：当前阶段 / 本轮已改文件 / 已跑命令 / 验证结果 / 未完成项，模型不靠猜。
- **落点**：`build_context_assembly`（注入 system 后、history 前的一段结构化 status），数据来源 `tool_audit`（已记录工具调用）+ goal phase 状态。
- **步骤**：① 设计 status 块模板（紧凑、token 友好）→ ② 从 tool_audit 聚合"已改文件/已跑命令/验证"→ ③ tool loop 每轮重算注入 → ④ 与 #1 的回退 reason 合并展示。
- **验证**：多轮任务中断点续跑，确认模型读到结构化进度；快照测试 status 块内容。
- **风险**：占 token 预算（控制在 output_reserve 之外、可配置开关）。

### 方案 3：确定性验证门控（P1 / M）
- **现状**：verify 偏模型自评，未把真实 `cargo build/test`、lint 作为硬门。
- **目标**：verifier 阶段执行真实门（build→test→lint），任一 error 即 fail；失败输出**结构化回流**（错误信息即下一轮 prompt），驱动方案 #1 回退。
- **落点**：verifier phase 的工具执行 + 结果解析；输出已有 `decode_console_output`（GBK/UTF-8 兜底）保证中文不乱码。
- **步骤**：① 约定项目验证命令矩阵（可在 CLAUDE.md/配置声明，如 `cargo build -p X --offline` + `cargo test`）→ ② verifier 执行并解析 pass/fail + 摘要错误 → ③ 结构化结论喂给 #1 → ④ "error 非 warn" 原则：warning 不阻断、error 阻断。
- **验证**：故意引入编译错→verifier 判 fail 且错误摘要正确回流；通过用例 verifier 判 pass。
- **风险**：验证命令因项目而异（用配置矩阵解耦）；耗时（可设超时，复用 `tool_execution_policy`）。

---

## 批次二：可观测 / 可监管 / 防错

### 方案 4：工具 ACI 增强 + Poka-Yoke（P1 / S，最高性价比）
- **现状**：工具 `description` 简短（如 "Read a text file from the workspace."），缺示例/边界/防错。
- **目标**：为高频工具补**示例、边界、与相似工具差异、防错约束**；参数设计使模型难犯错。
- **落点**：`tool-registry/lib.rs` 各 `*_tool_description()` + `input_schema`。
- **要点**：
  - `edit`：描述强调"必须先 read 该文件、old_string 唯一且含足够上下文"；schema 字段补 description。
  - `write`：警示"覆盖已存在文件前应先确认"。
  - `bash`/`powershell`：示例 + "避免用于 find/grep/cat（改用专用工具）"（与本仓 CLAUDE.md 约定一致）。
  - 路径类：边界说明"workspace 内、优先绝对路径"。
- **步骤**：逐工具重写 description（贴近自然文本、含 1 例）→ schema 字段补 description → tool 列表回归测试。
- **验证**：`cargo check -p coolzhu-tool-registry`；人工抽查模型对 edit/write 的误用率下降。
- **风险**：极低（纯文案/schema）。

### 方案 5：双模监管 L1/L2（P1 / M）
- **现状**：无后台空转/无进展/跑偏监控。
- **目标**：
  - **L1（循环内，轻量）**：tool loop 检测"同 name+input 连续失败 N 次""连续多轮无文件改动"→ 注入纠偏提示（软介入）。
  - **L2（goal 编排级）**：连续 N 个 phase 无验证推进 / 越权路径尝试 → 软介入或熔断（硬停 + 通知）。
- **落点**：`call_agent_model_with_tool_loop`（L1）、goal `dispatch_ready_goal_phases`（L2）；进展信号取自 `tool_audit` + verifier 结论。
- **步骤**：① 定义"进展"度量（文件改动数 / 验证状态变化）→ ② L1 重复失败检测 + 纠偏注入 → ③ L2 无进展计数 + 熔断 → ④ 介入事件落审计 + 前端提示。
- **验证**：构造死循环/空转用例，确认 L1 软介入、L2 熔断生效。
- **风险**：误判（阈值可配 + 仅软介入优先，硬停留给明确上限）。

### 方案 6：用户请求级幂等（P1 / S）
- **现状**：`dedup_window` 仅用于 handoff 交接；用户弱网重复提交同一指令无请求级幂等。
- **目标**：按 `(session_id, normalize(text+attachments), 时间窗)` 幂等键，窗口内重复提交→复用结果/拒绝，避免重复执行。
- **落点**：发消息入口 handler（`api_send_message` 系列）；复用 `HandoffGateOptions` 的 dedup 思路抽公共函数。
- **步骤**：① 规范化指令（trim/去空白/小写化键）→ ② 内存 LRU（session→最近指纹+时间戳）→ ③ 命中窗口内返回幂等响应 → ④ 可配窗口（默认 30-60s）。
- **验证**：模拟 2s 内重复提交同一消息，仅执行一次；不同消息不误杀。
- **风险**：误杀合法重复（窗口短 + 仅同指纹）。

---

## 批次三：架构增强（分阶段）

### 方案 7：长期记忆语义向量检索（P2 / L）
- **现状**：beads `memory_bead_matches_query` 为关键词召回。
- **目标**：关键词 + 语义混合召回。先轻量：复用 provider embedding（或本地小模型）算 bead 向量，余弦/HNSW 召回 top-k。
- **落点**：`core-runtime/memory.rs` + 存储（SQLite 存向量 blob，量小可暴力余弦）。
- **步骤**：① bead 入库时算 embedding → ② 检索 = 关键词预筛 + 向量重排 → ③ 与现有 `select_prompt_memory_beads` 融合。
- **验证**：语义相近但不同词的查询能召回相关 bead；离线脚本评测召回质量。
- **风险**：embedding 成本/依赖（先做开关 + 小规模）。

### 方案 8：规则文件分层加载（P2 / M）
- **现状**：CLAUDE.md 单一注入。
- **目标**：规则支持 `always_apply` / `agent_requested`（按相关性/角色）/ `manual` 三级，省 context。
- **落点**：prompt/上下文装配；规则文件加 frontmatter。
- **步骤**：① 规则 frontmatter 解析 → ② 按当前 agent 角色/任务关键词选择性注入 → ③ 预算感知（超预算降级到摘要）。
- **验证**：不同角色注入不同规则子集；context 占用下降。
- **风险**：相关性判定（先简单关键词/角色映射）。

### 方案 9：harness 效果指标体系（P2 / M）
- **目标**：沉淀任务完成率、goal 回退次数、平均重试、验证耗时占比、工具失败率等。
- **落点**：SQLite 指标表 + 控制台诊断面板（`diagnostics`）。
- **步骤**：① 在 #1/#3/#5 的关键节点埋点 → ② 聚合查询 API → ③ 前端面板。
- **验证**：跑若干 goal 后面板数据正确。
- **风险**：低（只读观测）。

### 方案 10：动态子 agent（P2 / L，R-SUBAGENT）
- **目标**：implementer 对可隔离子任务按需 spawn 受限子 agent（深度/权限/预算上限），复用 `HandoffGate`（max_depth=4 已具雏形）。
- **落点**：`core-runtime/remote.rs` + goal 编排 + HandoffGate。
- **步骤**：① 子 agent 生命周期 + 权限继承收敛 → ② 结果回收并入父 phase → ③ 深度/预算熔断。
- **验证**：父任务委派子任务、回收结果、超深度被拒。
- **风险**：状态共享/成本（严格上限 + 沙盒）。

---

## 建议起步

- **先做批次一的方案 1+3+2（合并设计）**：这是把现有单向流水线升级为"PEV 闭环 + 确定性门控 + 进度可见"，直击本项目最大短板，且复用已有 goal 模式与 handoff 基建，ROI 最高。
- **方案 4（ACI 增强）可作为穿插的低成本快赢**，随时可做。
- 批次二/三按资源排期。

> 实施任一方案前建议走一次 EnterPlanMode 细化到函数级改动清单，再编码。
