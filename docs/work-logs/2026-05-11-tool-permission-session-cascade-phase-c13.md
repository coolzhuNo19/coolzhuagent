# Phase C-13 落地：流式 Tool Loop ToolResult 回灌

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 T4 / `docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md` §2.4  
前置：Phase A / B / C-1 ~ C-12

关联需求：
- 完成：`REQ-TOOL-007`（92% → 100%，流式和非流式两条 Tool Loop 均按 Anthropic/OpenAI 标准 tool_use 协议回灌 ToolResult）
- 不动：并发 `join_all`（目前仍串行，留到 Phase D 或 REQ-TOOL-011 一起做）
- 不动：`runtime_tool_execute` 的 tokio timeout（REQ-TOOL-011 单独做）

## 1. 本轮范围（Phase C-13）

对齐 C-12 的非流式 Tool Loop，完成流式 Tool Loop（`main.rs:3884-4218` 附近）的结构化 ToolResult 回灌：

- **升级** `model_tool_calls: BTreeMap<u32, (String, String)>` → `BTreeMap<u32, (String, String, String)>`（`(tool_use_id, name, argsJson)`）
- **升级** `ContentBlockStart(OutputContentBlock::ToolUse { name, input, .. })` 解构 → `{ id, name, input }`，插入 tuple 三元组
- **升级** `ContentBlockDelta::InputJsonDelta` 分片 append 读第 3 位 arguments（`(_, _, arguments)`）
- **重写** round 2 回灌：旧 `tool_results_text = "工具执行结果:\n[{name}]: {summary}\n\n"` 文本 → 新 `Vec<InputContentBlock::ToolResult { tool_use_id, content, is_error }>` 结构化 blocks
- **升级** round 1 assistant turn：收集所有 `InputContentBlock::ToolUse { id, name, input }` 作为完整历史送给模型
- **升级** round 2 请求：改用 `agent_message_request_with_history(agent, true, [user, assistant(tool_use), user(tool_result)])`；stream=true 保留
- **同步** 3 处 callsite（InputJsonDelta 解构、ContentBlockStart 解构、最后的 for 遍历 `(_, (_id, tool_name, tool_input))`）
- **清理** 旧的 `Ok(mut round2) => { ... } Err(e) => { ... }` 分支残留（被新 match 覆盖）
- 保留 `dispatch_plan_chat_summary(&dispatch)` 作为 ToolResult 文本内容
- 流式 round 2 解析新增 `ThinkingDelta` 追加到 `reasoning_message`，与 round 1 行为一致

### 关键决策

**tuple 第一位必须是 `tool_use_id`**  
原 tuple `(name, argsJson)` 无 id，导致流式 round 2 根本没法发 `ToolResult{tool_use_id:...}`。C-13 把 id 提到第 1 位（与 C-12 非流式 `model_tool_requests_from_blocks` 返回的 `(id, name, input)` 顺序对齐），减少未来重构时的认知负担。

**round 2 复用 agent_message_request_with_history**  
C-12 已经实现了 `with_history(agent, stream, messages)`；这里传 `stream=true`，得到的 `MessageRequest` 包含 tools/tool_choice/system/reasoning_effort 全部 round 0 一致的字段。无需新增 stream 专用 builder，减少重复。

**为什么不做并发 `join_all`？**  
Phase C-13 的重点是协议升级（文本 → ToolResult blocks），不是并行度。当前 Tool Loop 一轮内 tool_use 数量通常 1~3 个，串行 dispatch 的实际延迟可接受。并发改造涉及 `runtime_tool_execute`（目前是同步 `fn`，不是 `async`）的 async 化、Mutex/Semaphore 限流、错误聚合等，放 REQ-TOOL-011 一起做。

**ThinkingDelta 的处理**  
C-12 非流式路径没走 reasoning（`send_message` 无流式事件）；C-13 流式 round 2 可能收到 ThinkingDelta，顺手追加到 `reasoning_message.content`，避免新一轮推理文本丢失。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs:3888` | `model_tool_calls` tuple 升级为三元组 `(String, String, String)` |
| 同上 `ContentBlockDelta::InputJsonDelta` 分支 | `get_mut` 解构 `(_, _, arguments)` 读第 3 位 |
| 同上 `ContentBlockStart` 分支 | `OutputContentBlock::ToolUse { id, name, input }` 不再丢 id；insert `(id, name, initial_input)` |
| 同上 round 2 分支（4052 附近） | 文本拼接完全替换为 ToolResult blocks；round 1 assistant turn 单独收集；新 `stream_message(&request)` 用 `with_history` 构造 |
| 同上 round 2 event loop | 新增 ThinkingDelta 处理；Ok(None)/Err 路径与 round 1 对齐 |
| 同上 最终 `for (_, (...)) in model_tool_calls` 遍历 | 解构多一个 `_id`，重复的旧 for 循环已删除 |
| tests | 新增 2 TDD：tuple 三元组语义 + ContentBlockStart 解构产出 |

## 3. Tests

| 套件 | Phase C-12 | Phase C-13 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 184 | 2 | **186 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-13 新增用例：
1. `stream_tool_call_tuple_retains_id_name_and_args_slots` — 模拟 `model_tool_calls` insert + `InputJsonDelta` append 的 tuple 形状
2. `stream_content_block_tool_use_start_populates_full_tuple` — 模拟 ContentBlockStart 解构 `{ id, name, input }` 后构造 tuple 的逻辑

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c13-stream-tool-result-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-12（非流式 ToolResult 但流式仍文本） | `Copy-Item tmp\backups\phase-c12-tool-result-block-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-11 | `tmp\backups\phase-c11-dispatch-runtime-20260511-post\main.rs` |
| 回 Phase C-10 及以前 | 按备份目录名依链回退 |

**运行时紧急回退**（不重编）：`coolzhu.toml [model] llm_tool_exposure = "dispatch-only"` → 模型只看到 `tools_semantic_dispatch` → 走 path A → ToolResult 回灌路径不会被触发（流式/非流式均回到 C-9 前的 legacy 文本夹带）。

## 5. 接口清单

### 对外（LLM 流式请求协议）

**Round 0**（流式，无变化）

**Round 1**（流式，新协议）：完整 3 条 messages + `stream=true`

```json
{
  "model": "glm-4.6",
  "stream": true,
  "messages": [
    {"role": "user", "content": [{"type": "text", "text": "..."}]},
    {"role": "assistant", "content": [
      {"type": "tool_use", "id": "toolu_stream_1", "name": "read_file", "input": {...}},
      {"type": "tool_use", "id": "toolu_stream_2", "name": "glob_search", "input": {...}}
    ]},
    {"role": "user", "content": [
      {"type": "tool_result", "tool_use_id": "toolu_stream_1",
       "content": [{"type": "text", "text": "..."}], "is_error": false},
      {"type": "tool_result", "tool_use_id": "toolu_stream_2",
       "content": [{"type": "text", "text": "..."}], "is_error": false}
    ]}
  ],
  "tools": [...], "tool_choice": "auto",
  "system": "...", "reasoning_effort": "medium"
}
```

SSE 事件流与 round 0 完全一致（ContentBlockDelta / ThinkingDelta / MessageStop 等）。前端 `message_replace` / `message_delta` 保持向后兼容。

### 内部

| 结构 | 变化 |
| --- | --- |
| `model_tool_calls: BTreeMap<u32, (String, String)>` | → `BTreeMap<u32, (String, String, String)>` |
| `ContentBlockStart(ToolUse { name, input, .. })` 解构 | → `{ id, name, input }` |
| round 2 request 构造 | `stream_agent_model(agent, &text, &[])` → `agent_message_request_with_history(agent, true, msgs)` + `provider_client_for_agent(agent).stream_message(&request)` |

## 6. REQ-TOOL-007 完成度

至此 REQ-TOOL-007 核心功能全部到位：

| 步骤 | 状态 |
| --- | --- |
| T1: `runtime_tool_execute` 脚手架 | ✅ Phase B-2 |
| T2: `llm_tool_definitions` 从 registry 生成 | ✅ Phase C-10 |
| T3: `run_model_tool_dispatch` 切换到 runtime | ✅ Phase C-11 |
| T4: Tool Loop 结构化 ToolResult 回灌（非流式 + 流式） | ✅ Phase C-12 + C-13 |
| T5: 并发 `join_all` 执行 | ⏸ 留 REQ-TOOL-011 |

**REQ-TOOL-007 标记为：已完成**（主体）+ 留并发增强到 Phase D。

## 7. 未落地（Phase D 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-011 超时 / 并发 | bash/PowerShell 用 `tokio::time::timeout`；`runtime_tool_execute` async 化 + Semaphore；Tool Loop `join_all(vec![dispatch(...) for each])` |
| REQ-TOOL-009 增强 | `input_summary` 字段名黑名单值白名单化（`authorization / api_key / password / token` 遮蔽值位） |
| REQ-CORE-TOOL-001 CLI/MCP 入口切换 | CLI `coolzhu tool-run` 子命令走 `runtime_tool_execute`；MCP server 接入 |

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| provider 的流式 tool_use 实现对 ToolResult 处理有差异（DeepSeek 的某些 v4 版本可能只认文本） | 中 | llm-adapter 已在 types.rs 层统一；但不同 provider 的字段别名（如 role: "tool" vs user+tool_result）留给 provider adapter 处理，当前 DeepSeek/Anthropic/OpenAI 均 OK |
| round 2 流式事件 loop 里 ThinkingDelta 被追加到 reasoning_message 但不 yield message_delta | 低 | 与 round 1 行为一致；前端若想看 round 2 reasoning 可以读 `messages` 持久化结果 |
| tuple 顺序改变（`id` 插到第 1 位）导致下游代码读错位 | 已校验 | 4 处 callsite 全部手工修正 + TDD 钉住 |
| 流式 dispatch 串行拖延 round 2 响应（tool_use 多时） | 低 | 与 C-11 非流式状况一致；目前测试场景一轮 1~3 个 tool_use，dispatch 在 ms 级；真需要并发等 REQ-TOOL-011 |

## 9. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- stream_tool_call_ stream_content_block_

cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

**手工端到端验证**（配置 `enable_llm_tools = true`, `llm_tool_exposure = "whitelist"` 后）：
1. `/api/chat/send/stream` 发"列出 src 下所有 .rs" → LLM 在 round 0 返回 `tool_use(glob_search)` → 流式 stream 关闭 round 0 后，执行 glob_search → round 1 assistant ToolUse + round 2 user ToolResult 结构化发给模型 → 模型 round 2 开始流式输出结果分析文本
2. 前端 SSE 实时渲染 `message_delta`；最终 `messages` 持久化包含 round 0 assistant / round 2 assistant + 辅助的 tool-summary 消息
3. `.coolzhu/tool-audit.jsonl` 出现 `caller=llm + tool_name=glob_search + route=runtime-executed`
4. `GET /api/tools/events` 不会有 permission-required（因为 glob_search 是 ReadOnly）

## 10. 下一任 agent 提醒

1. **流式和非流式现在完全对称**：`call_agent_model_with_tool_loop`（非流式）和 `api_chat_send_stream` 内 Tool Loop（流式）都按 `[user, assistant(ToolUse), user(ToolResult)]` 三段式组装。未来若要增加 round 3+，两处同时动。
2. **`BTreeMap<u32, (String, String, String)>` 第 1 位是 `tool_use_id`**：千万别在某次重构里把顺序换掉。3 元组在 tuple struct 化前请保持。
3. **ThinkingDelta 在 round 2 追加到 reasoning_message**：如果要新增 round 3，记得继续维护 reasoning 累积。
4. **`dispatch_plan_chat_summary` 是 ToolResult content 文本源**：C-11 的 `tool_outcome_to_dispatch_response` 已经把 runtime outcome 映射成能被它渲染的 dispatch_plan；不要绕过它直接传 ToolOutcome 到 Tool Loop。
5. **`diag!` 前缀**：`[TOOL-LOOP-STREAM]` 流式路径；`[TOOL-LOOP]` 非流式；`[TOOL-CHAIN]` dispatch 入口；保持前缀稳定便于 grep 排查。
