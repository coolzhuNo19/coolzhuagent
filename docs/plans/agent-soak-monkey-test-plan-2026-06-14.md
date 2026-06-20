# Agent 长时间随机能力测试（Soak / Monkey）实施方案

- 日期：2026-06-14
- 需求编号：`CUR-SOAK-MONKEY-001`
- 状态：方案待执行，执行顺序 **#4**（前置：`CUR-DIAG-LOG-001` 补日志、`CUR-SELFCHECK-001` 自检；之后：`CUR-LOCAL-LLM-001`）
- 关联：`docs/plans/agent-boot-selfcheck-plan-2026-06-14.md`
- 底座：`modules/diagnostics`（结构化 JSONL + span/trace）

> 目的：用随机动作长时间（数小时/过夜）驱动 agent 各能力（类 monkey 测试），**前提是先补足各模块诊断日志**；运行后能通过日志**追踪到"没有走到功能预期"的位置并搜集错误信息**，供后续分析改进。

---

## 1. 两件事（补日志已前置独立）

> **补诊断日志已拆为独立的第一步** `CUR-DIAG-LOG-001`，是本方案前置。本方案聚焦：

1. **随机驱动器**（monkey driver）：可复现、有护栏地随机触发各能力。
2. **离线分析**：从 JSONL 聚合"未达预期 + 错误"，按 `trace_id` 回溯到具体动作序列。

---

## 2. "未达预期" 判据（机判信号）

instrumentation 约定（事件命名 `<module>.<action>.<phase>`、`outcome` 写入、字段/级别规范）统一在 **`CUR-DIAG-LOG-001`（补日志方案）** 定义，本方案直接消费其产出。soak 分析据以下信号判定"是否走到功能预期"：

| 信号 | 判据 | 含义 |
|---|---|---|
| outcome 缺失/≠ok | `SpanClosed.attributes["outcome"]` 不是 `ok` | 没走到成功路径 |
| ERROR/WARN | level ≤ Warn 的 LogEntry | 显式错误/异常 |
| 孤儿 begin | 有 `*.begin` 无对应 `*.ok/*.error`（同 span_id） | 卡死/中断 |
| 超时 | `SpanClosed.duration_ms` > 模块阈值 | 疑似 hang |
| panic 兜底 | driver `catch_unwind` 捕获 → `*.panic` 事件 | 崩溃 |

> 详见 `docs/plans/agent-diagnostic-logging-plan-2026-06-14.md` §2–§3。

---

## 3. 各模块诊断日志

各模块需补的事件清单（会话链路/上下文压缩/记忆/视觉/工具/computer-use/Goal/权限）已统一移入 **`CUR-DIAG-LOG-001` §4**，作为本方案前置交付。soak 运行时这些日志须已就绪。

---

## 4. Monkey 驱动器

- **动作池（带权重、可配）**：发消息（语料库随机）、撑大上下文触发压缩、记忆增/查/删、视觉截屏、调用安全子集工具、computer-use 安全动作。
- **可复现**：固定随机种子（记录到日志 `soak.seed`），失败可重放该序列。
- **节流/并发**：动作间隔、并发会话数可配，避免资源打满。
- **每动作一 trace**：driver 在动作外层 `start_span("monkey.<action>", "monkey")`，向下贯穿 `trace_id`，使一次随机动作的全链路日志可串联。
- **崩溃续跑**：每动作 `catch_unwind`；agent 进程崩溃则 driver 自动重启并续跑，记 `soak.restart`。

---

## 5. 安全护栏（重点，尤其 computer-use）

| 风险 | 护栏 |
|---|---|
| computer-use 乱点系统/危险目标 | **限定沙箱窗口/区域**；动作白名单（move/screenshot/读光标），**默认禁实际点击**（或仅在指定 sandbox app 内点） |
| 误触金融/发送类操作 | 禁止下单/转账/发送类动作（硬编码黑名单） |
| 工具破坏性副作用 | monkey 只允许**只读/可逆**工具子集；写类工具走 dry-run |
| 资源耗尽 | 内存/显存/CPU 上限 + 周期快照 `soak.resource`，超限暂停 |
| 失控 | 全局 kill-switch（热键/文件信号）立即停 |

---

## 6. 运行控制

- 时长（如 8h/过夜）或最大迭代数；起止、种子、配置写入日志。
- 周期性资源快照（内存/显存/CPU）→ `soak.resource` 事件。
- 日志默认 `COOLZHU_LOG_LEVEL=debug` 落 `~/.coolzhu/logs/<app>.jsonl`（span 关闭事件需 Debug 级）。

---

## 7. 离线分析与产物

- **分析脚本**（放 `tmp/`，CLAUDE.md 约定；或做成 `diagnostics` 的一个 bin）读取 JSONL：
  1. 按 `module/event` 聚合 `outcome=ok/incomplete/error` 计数与失败率。
  2. 列出 **incomplete（孤儿 begin / 无 outcome=ok）** span，带 `trace_id`。
  3. Top 错误类别（`err_kind`）、最慢 span（`duration_ms` Top-N）。
  4. 崩溃/重启时间线（`soak.panic` / `soak.restart`）。
- **回溯**：对任一异常 `trace_id`，过滤同 `trace_id` 全部 LogEntry → 还原该次动作的完整调用链与上下文。
- **报告**：输出 `tmp/analysis-soak-<日期>.md`：异常清单 + 按模块的健康度 + 可复现种子/动作序列，直接喂后续修复。

---

## 8. 与开机自检的关系

- soak 启动**先跑 `run_self_check()`**：基础项不过不开跑（避免在坏环境刷无效日志）。
- 二者**共享事件命名与 JSONL 底座**，分析脚本同一套。

---

## 9. 全局约束（CLAUDE.md 对齐）

- instrumentation 不引新依赖（复用 diagnostics）；分析脚本/日志产物落 `tmp/`。
- 中文日志/注释/回复。
- computer-use monkey **默认不实际操作真实目标**，护栏先行。
- 测试：模块补日志后 `cargo build/test -p <crate> --offline` 全绿；改全局态 `config_test_guard()`。
- 大文件：会话链路补日志落在 web-console `main.rs`，分段改、先备份。

---

## 10. 里程碑

| 里程碑 | 交付 | 验收 |
|---|---|---|
| K1 | instrumentation 约定 + 各模块补 `begin/ok/incomplete/error` + `outcome` | 单轮动作日志可判定是否达预期 |
| K2 | monkey driver（动作池/种子/护栏/续跑） | 可定时长随机运行，computer-use 护栏生效 |
| K3 | 离线分析脚本 + 报告 | 过夜跑后产出异常清单，trace_id 可回溯到动作序列 |

---

## 11. 下一步

1. 落 §2 instrumentation 约定（先在 `memory` + `会话链路` 两个模块示范）。
2. 按 §3 清单逐模块补日志。
3. 实现 monkey driver（先小动作池 + 强护栏）。
4. 写离线分析脚本（`tmp/` 或 diagnostics bin）。
