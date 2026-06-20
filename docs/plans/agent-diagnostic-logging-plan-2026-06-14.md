# Agent 诊断日志补全方案（第一步）

- 日期：2026-06-14
- 需求编号：`CUR-DIAG-LOG-001`
- 状态：方案待执行，**全局第一步**（先于记忆架构 / 自检 / soak / Gemma 4）
- 底座：`modules/diagnostics`（结构化 JSONL + span/trace，已就绪）
- 下游依赖本方案：`CUR-MEM-ARCH-001`（可观测）、`CUR-SELFCHECK-001`（复用事件判定）、`CUR-SOAK-MONKEY-001`（消费日志做分析）

> 目的：在动任何功能之前，先给各能力模块补齐**统一、可机判的诊断日志**，使后续每一步都能被观测、被验证、被追溯。

## 执行顺序（全局）
| 序 | 阶段 | 编号 |
|---|---|---|
| **1** | **补日志（本文）** | `CUR-DIAG-LOG-001` |
| 2 | 记忆架构 A–H | `CUR-MEM-ARCH-001` |
| 3 | 开机自检 | `CUR-SELFCHECK-001` |
| 4 | 长时间随机测试 | `CUR-SOAK-MONKEY-001` |
| 5 | Gemma 4 12B 部署 | `CUR-LOCAL-LLM-001` |

---

## 1. 为什么是第一步

- **记忆架构改造（#2）** 需要在改造前后对比召回/写入行为 → 必须先有日志。
- **开机自检（#3）** 直接复用这里定义的事件名做 pass/fail 判定。
- **长时间随机测试（#4）** 的全部分析建立在"未达预期"信号之上 → 信号由本方案定义。
- 底座 `diagnostics` 已具备 `start_span / info·warn·error / LogEntry{trace_id,span_id,event,fields} / SpanClosed{duration_ms,attributes,events}`，**只需补"打点"，不需造轮子、不引新依赖**。

---

## 2. 统一 instrumentation 约定

### 2.1 事件命名
`<module>.<action>.<phase>`，phase ∈ `begin | ok | incomplete | error`。
- 例：`memory.recall.begin` / `memory.recall.ok` / `memory.recall.incomplete` / `memory.recall.error`。

### 2.2 span 用法（一次动作一个 span，必写 outcome）
```rust
let mut sp = start_span("memory.recall", "memory");
info("memory", "recall.begin", "开始召回", &[("query", snip(q))]);
// 成功：
sp.record("outcome", "ok");
info("memory", "recall.ok", "召回完成", &[("hit_count", n.to_string()), ("strategy", "semantic")]);
// 逻辑未达预期（非异常）：
sp.record("outcome", "incomplete"); warn("memory", "recall.incomplete", "无召回", &[("query", snip(q))]);
// 异常：
sp.record("outcome", "error"); error("memory", "recall.error", &e.to_string(), &[("err_kind", kind)]);
```

### 2.3 字段规范
- 文本字段统一截断（如 `snip(s, 240)`），避免日志膨胀。
- 错误必带 `err_kind`（分类：`network/parse/timeout/permission/io/logic/...`），便于聚合。
- 计量字段：`latency_ms / tokens_in / tokens_out / token_before / token_after / hit_count` 等。
- **`code_site`（失败定位必带）**：`error`/`incomplete` 事件必带代码位置，据此可**直接跳到失败代码行**。
  - Rust：`("code_site", concat!(file!(), ":", line!()))`（建议封装 `here!()` 宏）。
  - 前端 JS：`code_site = "app.js:<函数名>"`（无行号则用稳定「函数名+动作名」）。

### 2.4 级别约定
| phase | 级别 |
|---|---|
| begin | Info |
| ok | Info（高频可降 Debug） |
| incomplete | **Warn** |
| error | **Error** |
| span 关闭(`SpanClosed`) | Debug（soak 需 `COOLZHU_LOG_LEVEL=debug`） |

---

## 3. "未达预期" 判据（机判信号，下游契约）

这是日志必须满足的契约：让自检与 soak 能**自动判定某次动作是否走到功能预期**。

| 信号 | 判据 | 含义 |
|---|---|---|
| outcome 缺失/≠ok | `SpanClosed.attributes["outcome"]` 非 `ok` | 没走到成功路径 |
| ERROR/WARN | level ≤ Warn 的 LogEntry | 显式错误/异常 |
| 孤儿 begin | 有 `*.begin` 无同 span_id 的 `*.ok/*.error` | 卡死/中断 |
| 超时 | `SpanClosed.duration_ms` > 模块阈值 | 疑似 hang |
| panic 兜底 | 上层 `catch_unwind` → `*.panic` 事件 | 崩溃 |

> `SpanClosed` 已自带 `duration_ms / attributes / events / trace_id / parent_id`，因此只要各模块补 `begin/ok/incomplete/error` + `outcome`，上述信号即可全部机判。

---

## 4. 逐模块补日志清单（rollout）

| 模块 | 需补事件（begin / 期望成功 / 失败） | 关键字段 | 接入位置（参考） |
|---|---|---|---|
| 会话链路 | `session.turn.begin` / `llm.request.begin` / `llm.stream.first_token` / `session.turn.ok` / `.error` | model, tokens_in/out, latency_ms | web-console 会话 handler、llm-adapter client |
| 上下文压缩 | `context.compact.begin` / `.ok` / `.skip` | token_before/after, msgs_dropped | main.rs:3266+（`auto_compact_percent` 等） |
| 记忆 加载/检索 | `memory.recall.begin/ok/incomplete` / `memory.write.begin/ok/dedup` | query, hit_count, strategy | `memory.rs`、`select_context_memory_beads`、`persist_auto_memory_beads` |
| 视觉确认 | `vision.capture.begin/ok/error` / `vision.infer.ok/error` | frame_size, infer_ms | modules/vision |
| 工具调用 | `tool.invoke.begin/ok/error`（按工具名）/ `tool.registry.miss` | tool, args_snip, exit | tooling/tool-registry |
| computer-use | `cu.action.begin/ok/error`（按动作）/ `cu.safety.blocked` | action, target_region | modules/computer-use |
| Goal 循环 | `goal.phase.begin/ok/error`（commander/planner/implementer/verifier） | phase, retry | main.rs goal 系列 |
| 权限/沙箱 | `perm.check.ok/denied` | rule, decision | core-runtime permission/sandbox |
| **UI 按键** | `ui.<area>.<action>.begin/ok/error`（每个 `[data-action]`/按钮点击） | action, target, client_trace, **code_site** | app.js 统一点击委托 → `POST /api/ui/log`（见 §10） |

> 记忆模块此刻先打点**现有能力**（关键词召回/写入/去重）；记忆架构 #2 新增的 `memory.embed.*` / `memory.recall(strategy=semantic)` 等，按本约定**随功能一起补**。

---

## 5. Rollout 顺序与示范

1. **先示范两个模块**：`memory` + `会话链路`（覆盖最高频路径，验证约定可用）。
2. 再按 §4 逐模块铺开。
3. 每补一个模块：`cargo build/test -p <crate> --offline` 通过，并人工看一条 JSONL 确认字段齐全。

---

## 6. 与下游的衔接

- **#2 记忆架构**：新能力按本约定补事件，使 A–H 每步可对比验证。
- **#3 开机自检**：probe 直接判定 `*.ok` 是否出现、`outcome` 是否 ok。
- **#4 soak**：分析脚本消费 §3 信号，按 `trace_id` 回溯动作序列。

---

## 7. 全局约束（CLAUDE.md 对齐）

- 复用 `diagnostics`，**不引新依赖**。
- 中文日志/注释/回复。
- 文本字段截断；中文 Windows 子进程输出仍走 `decode_console_output`（GB18030 回退），日志里不要再塞未解码的乱码字节。
- 测试：`cargo test -p <crate> --offline`；改全局态 `config_test_guard()`；保留 `module_linkage_smoke`。
- 大文件：会话链路/压缩/记忆打点落在 web-console `main.rs`（1.36MB），Read 分段、改前确认、先备份。

---

## 8. 里程碑与下一步

| 里程碑 | 交付 | 验收 |
|---|---|---|
| L1 | 约定文档化 + `memory`/会话链路示范打点 | 单次动作日志含 begin/ok/outcome，trace_id 串联 |
| L2 | §4 全模块补齐 | 各模块均可被 §3 信号机判 |
| L3 | 一份"事件字典"（所有 `<module>.<action>.<phase>` 清单） | 自检/soak 直接据此实现判定 |

**下一步**：落 §2 约定 + 在 `memory` 与会话链路两处示范打点（L1），零新依赖、可编译、带测试。

---

## 9. 实施进展

### L1（2026-06-14，已完成）
- **发现（与原方案假设不符）**：web-console 此前用 `tracing` + `diag!`→`err.log`（freeform 字符串），**并未接入** `coolzhu-diagnostics`；全文仅 3 处 tracing，结构化动作日志为空白。本方案"底座现成"指 crate 已就绪，但主程序尚未接线——L1 即完成接线。
- **改动（web-console，仅 `main.rs` + `Cargo.toml`）**：
  - `Cargo.toml` 加 `diagnostics.workspace = true`（内部 workspace crate，零外部依赖）；`main()` 加 `diagnostics::init("coolzhu-web-console")`。
  - `select_context_memory_beads`：`memory.recall` span + `recall.begin/ok/incomplete` + `outcome`（字段 query/limit/hit_count/strategy/used_tokens）。
  - `build_context_assembly_with_roster`：`session.context_build` span + `context_build.begin/ok` + `outcome`；压缩点加 `context.compact.ok`（dropped/summary_len）。二者为父子 span（共享 trace_id），示范层级链路。
- **验证**：`cargo test -p coolzhu-web-console --offline --no-run` Finished；478 测试通过；9 失败均为**既有漂移**（6× 前端 `include_str!` 内容、1× prompt 文案 "overrides older memory/history" 已改、audio、tool-def），与本次无关。`build` 仅因运行中实例占用 `coolzhu-web-console.exe` 而无法替换二进制（非编译错误）。
- **输出**：事件落 `~/.coolzhu/logs/coolzhu-web-console.jsonl`（含 trace_id/span_id/outcome/duration_ms）。**需重启 app + 重新 build 才会写新事件**（旧 exe 被运行实例占用）。
- **待续**：async 会话链路（`agent_chat_response`）的 span 因 `coolzhu-diagnostics` 上下文是 thread-local、不跨 `.await`，留 **L2** 用显式 trace 字段处理；L2 铺开 §4 全模块；L3 出事件字典。

### L2（2026-06-14，进行中）
- **会话链路**（`agent_chat_response`，async）：用显式 `trace` 字段 + 手测延迟，打 `session.turn.begin/ok/incomplete/error`，覆盖三条返回路径（真模型成功 / 模型错误回退 / 本地回退）。字段 provider/model/used_real_model/answer_len/tool_requests/latency_ms/reason/hint。
- **工具调用**（`run_model_tool_use_message`，async）：`tool.invoke.begin/ok/error`（trace/tool/latency_ms/err_kind/hint）。
- **记忆写入**（`persist_auto_memory_beads`，sync span）：`memory.write.begin/ok`（messages/written）。
- **验证**：`cargo test --offline --no-run` Finished；测试 478 通过 / 9 失败（均既有：前端 `include_str!` 内容、prompt 文案漂移、tool-def；其中 1 个音频临时文件测试为并行竞争 flaky，串行 `--test-threads=1` 下通过）。无新增回归。
- **已落地事件清单**：`memory.recall.*`、`memory.write.*`、`session.context_build.*`、`session.turn.*`、`context.compact.ok`、`tool.invoke.*`。
- **全模块铺开（2026-06-14，已完成，web-console 调用侧）**：
  - `goal.phase.begin/ok`（`run_goal_phase_once`）、`perm.check`（`invoke_through_runtime_for_session`，decision/required/requires_ui/status）、`vision.locate.*`/`vision.describe.*`（`run_vision_find_target`/`run_vision_describe_screen`）、`cu.action.begin/ok/error`（`run_computer_use_profile` 的 `execute_mouse_action`）。
- **端到端 trace 贯穿（2026-06-14，已完成）**：`tokio::task_local!(TURN_TRACE)` + `current_turn_trace()`；`agent_chat_response` 用 `TURN_TRACE.scope(...)` 包裹 `call_agent_model*`，使回合内 context/memory/tool/perm 子事件共享回合 `trace`，按 trace 可还原整回合链路。
- **事件字典（L3，已完成）**：`docs/plans/agent-diagnostic-event-dictionary-2026-06-14.md`。
- **验证**：`cargo test --offline --no-run` Finished；测试 478 通过 / 9 失败（全既有：前端内容/prompt 文案漂移/tool-def + 音频并行 flaky）；无新增回归。
- **生效条件**：事件写入 `~/.coolzhu/logs/coolzhu-web-console.jsonl`，**需重启 app + 重新 `cargo build`**（旧 exe 被运行实例占用，未触发 `diagnostics::init`）。
- **待续**：vision/cu 的显式 error/incomplete 事件、goal role（commander/planner/implementer/verifier）字段、跨 crate（vision-service/computer-use-core 内部）打点、soak driver 的 `*.panic`/`soak.*`。

---

## 10. UI 按键 + 会话回复 + 工具调用 全链路日志（失败可直接定位）

> 需求补充（2026-06-17，`CUR-DIAG-LOG-001` 扩展）：**所有 UI 界面按键、会话回复、工具调用都要有 log 痕迹**；log 必须含**成功/失败**与**具体失败的代码执行点（`code_site`）**，使后续能据 log 直接定位失败原因。本节并入本方案，作为 §4 之上的「端到端可定位」补充。

### 10.1 三层覆盖
| 层 | 事件 | 成功/失败 | 失败定位字段 |
|---|---|---|---|
| UI 按键 | `ui.<area>.<action>.begin/ok/error`（每个按钮点击） | `outcome` | `code_site`(JS 函数) + `client_trace` |
| 会话回复 | `session.turn.*` + `llm.request.*`（已落地，补 `code_site`） | `outcome` | `code_site` + `err_kind` |
| 工具调用 | `tool.invoke.*`（已落地，补 `code_site`/`exit`） | `outcome` | `code_site` + `err_kind` + `exit` |

### 10.2 前后端 trace 贯通（一次用户操作 = 一条链）
1. 前端点击即生成 `client_trace`(uuid)，随后续 API 请求带请求头 `X-Coolzhu-Trace: <client_trace>`。
2. 后端入口读该头作为本次 span 的 `trace`（无则自生成），与 `TURN_TRACE` 统一 → **UI 点击 → API → 会话 → 工具** 同一 `trace`。
3. 失败时：据 `trace` 串起整链、据 `code_site` 跳到代码行、据 `err_kind` 聚合归因。

### 10.3 落地清单
**前端（`app.js`/`index.html`，`include_str!` → 改后必重编）**
- 新增 `logUiEvent(area, action, phase, fields)`：`POST /api/ui/log`（body：area/action/phase/outcome/client_trace/code_site/ts）。失败静默，不阻塞 UI。
- 在统一点击委托（`actionButtons` 接线处）包一层：点击即 `ui.*.begin`；处理函数 `try→ui.*.ok` / `catch→ui.*.error`（`code_site`=函数名、`err`=message）。
- 关键交互逐一接入：新建/保存/删除会话、发送消息、工具「详情」、本地模型开关、视觉理解选择。

**后端（web-console `main.rs`）**
- 新增 `POST /api/ui/log` handler → 校验/截断 → 写入同一 JSONL：`diagnostics::{info|warn|error}("ui","<area>.<action>.<phase>",…,&[("client_trace",…),("code_site",…),("outcome",…)])`。
- 入口读取 `X-Coolzhu-Trace` 注入 span `trace`/`TURN_TRACE`，贯通前后端。
- 给已有 `session.turn.*` / `tool.invoke.*` 及各 `*.error` 事件补 `code_site`（`concat!(file!(),":",line!())`）。

**工具调用（`tool-registry` / `runtime_tool_execute`）**
- 每工具 begin/ok/error + `code_site` + `exit`/`err_kind`；注册未命中 `tool.registry.miss`。

### 10.4 失败可定位契约（验收）
- 任一 `*.error`/`*.incomplete` 日志**必含** `{trace, code_site, err_kind}` 三字段。
- 验收：制造一次 UI 按键失败（如断网点「发送」）→ JSONL 中据 `trace` 可见 `ui.chat.send.begin → llm.request.error`，且 `code_site` 指到具体代码行/函数 → 直接定位。
- #3 自检 / #4 soak 消费本节 `ui.*` 事件，覆盖「按键无响应 / 点击后无后续动作」类问题（孤儿 `begin`）。

### 10.5 里程碑
| 里程碑 | 交付 |
|---|---|
| L4-a | `/api/ui/log` + `logUiEvent` + 点击委托接线（全部 `[data-action]`） |
| L4-b | `X-Coolzhu-Trace` 前后端贯通 + 已有事件补 `code_site` |
| L4-c | 工具调用逐工具 `code_site`/`exit`；§10.4 失败定位契约验收 |
