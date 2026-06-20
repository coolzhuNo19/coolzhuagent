# Phase C-12 落地：Tool Loop 结构化 ToolResult 回灌（非流式）

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 T4 / `docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md` §2.4  
前置：Phase A / B / C-1 ~ C-11

关联需求：
- 推进：`REQ-TOOL-007`（85% → 92%，非流式 Tool Loop 首次按 Anthropic/OpenAI 规范回灌 ToolResult）
- 铺底：流式路径的 ToolResult 改造留到 Phase C-13（需要改 `model_tool_calls: BTreeMap<u32, (String, String)>` 为含 `tool_use_id` 的三元组，避免本轮改动面爆炸）
- 不动：并发 `join_all` 执行（Phase C-13）、bash/PowerShell 超时（REQ-TOOL-011）

## 1. 本轮范围（Phase C-12）

按 C-9 §2.4 的 Anthropic tool_use 标准协议切换**非流式 Tool Loop** 的 round 2 回灌格式：

- **新增** `model_tool_requests_from_blocks` 返回三元组 `(tool_use_id, name, input)` —— 之前只返回 `(name, input)` 丢失了 `tool_use_id`
- **新增** `agent_message_request_with_history(agent, stream, messages)` + 提取共用 `agent_message_request_build()` —— 支持把 round 0 user + round 1 assistant ToolUse + round 2 user ToolResult 作为完整历史送给模型
- **重写** `call_agent_model_with_tool_loop`：
  - Round 0：单条 `user_text` / `user_text_with_image_urls`（行为不变）
  - Round 1（收到 ToolUse）：构造 3 条 history —— `[user, assistant(ToolUse blocks), user(ToolResult blocks)]`，不再用 `"工具执行结果：..."` 文本拼接
  - Round 2：用 `agent_message_request_with_history` 携带完整历史请求模型
- **更新** `AgentModelResponse.tool_requests: Vec<(String, String, JsonValue)>` 类型（补 tool_use_id）
- **同步** 4 处 callsite（`model_tool_requests` / `all_tool_requests` / 流式 `for (_, (name, arguments))` 扫描等）
- 保留 `dispatch_plan_chat_summary(&dispatch)` 作为 ToolResult block 的 `Text { text }` 内容，前端 tool-summary 消息显示不变

### 关键决策

**为什么先只改非流式？**  
流式路径用 `model_tool_calls: BTreeMap<u32, (String, String)>`（`<index, (name, argsJson)>`），`OutputContentBlock::ToolUse { name, input, .. }` 解构时**丢弃了 id**。要保留 tool_use_id 必须改 BTreeMap 的 value 类型 + `ContentBlockStart` 解构点 + round 2 回灌，改动面大。Phase C-12 只改非流式 loop；流式 loop 沿用旧文本拼接，由 Phase C-13 处理。

**为什么保留 `dispatch_plan_chat_summary` 作为 ToolResult 文本？**  
这个函数已经把 `ToolDispatchResponse` 格式化成人类可读的 summary，里面包含 `execute_allowed / safety_gate / action_plan` 等 LLM 感知的关键字段。直接作为 `ToolResultContentBlock::Text` 送回即可，不需要重新造一套 JSON schema。

**为什么 `is_error` 字段只在 C-11 映射后的状态里标？**  
`run_model_tool_dispatch` 在 Phase C-11 后对 `dispatch.status` 用 `failed / rejected / timeout` 三个字串表达错误；这里直接 match 就行。Phase D 可以把 `ToolOutcomeStatus::is_error()` 暴露给 main.rs 复用。

**为什么不把 ToolResult 内容改成 JSON block？**  
`ToolResultContentBlock::Json { value }` 是我们自己的 `llm-adapter` 类型，但 Anthropic API 实际只接受 string；OpenAI/DeepSeek 也默认 string。保守用 `Text { text: summary }` 最兼容。Phase E 上 `tool_call.id` + 结构化 JSON 需要先在 llm-adapter 做 provider-specific 序列化。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` `use api::{...}` | 新增导入 `InputContentBlock`, `ToolResultContentBlock` |
| 同上 `model_tool_requests_from_blocks` | 返回 `Vec<(String, String, JsonValue)>`（tool_use_id 放第 0 位） |
| 同上 `AgentModelResponse.tool_requests` | 类型改为 `Vec<(String, String, JsonValue)>` |
| 同上 `call_agent_model_with_tool_loop` | 完整重写 round 0/1/2 逻辑，改用 ToolResult block 结构化回灌；保留 2 轮上限语义 |
| 同上 新增 `agent_message_request_with_history()` 和 `agent_message_request_build()` | 为 history 场景抽取公共构造，保留 round 0 的 `agent_message_request_with_images()` 接口不变 |
| 同上 4 处 callsite | 绑定从 `(name, input)` 改 `(_id, name, input)` / `for (_, name, input) in ...` |
| tests | 新增 2 个 TDD；修 1 个既有测试的元组索引断言 |

## 3. Tests

| 套件 | Phase C-11 | Phase C-12 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 182 | 2（保留 id + history builder） | **184 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-12 新增 / 修订用例：

1. `model_tool_requests_from_blocks_preserves_tool_use_id` — 两个 ToolUse 块 → 返回两个三元组，id/name/input 原样带出
2. `agent_message_request_with_history_preserves_tools_and_system` — `with_history` 请求发 3 条 messages 时 `tools=Some(Auto) / system=Some / model` 字段全保留
3. `non_stream_model_tool_use_is_extracted_from_output_blocks`（既有）— 元组索引从 `.0/.1` 改 `.0/.1/.2` 适配新签名

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c12-tool-result-block-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-11 | `Copy-Item tmp\backups\phase-c11-dispatch-runtime-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-10 | `tmp\backups\phase-c10-llm-tool-definitions-20260511-post\main.rs` |
| 回 Phase C-8 | `tmp\backups\phase-c6-audit-jsonl-20260511-post\main.rs` |
| 回 Phase C-6 ~ A | 依链回退 |

**运行时紧急回退**（不重编）：`coolzhu.toml [model] llm_tool_exposure = "dispatch-only"` → 模型只看到 `tools_semantic_dispatch` → 走 path A（legacy dispatch）→ 不再触发 ToolResult 回灌；等效于 Phase C-9 前行为。

## 5. 接口清单

### 对外（LLM 请求协议）

**Round 0**（无变化）：

```json
{
  "model": "glm-4.6",
  "messages": [{"role": "user", "content": [{"type": "text", "text": "..."}]}],
  "tools": [...], "tool_choice": "auto",
  "system": "...", "reasoning_effort": "medium"
}
```

**Round 1**（新）：

```json
{
  "model": "glm-4.6",
  "messages": [
    {"role": "user", "content": [{"type": "text", "text": "round-0 prompt"}]},
    {"role": "assistant", "content": [
      {"type": "tool_use", "id": "toolu_abc", "name": "read_file", "input": {...}}
    ]},
    {"role": "user", "content": [
      {"type": "tool_result", "tool_use_id": "toolu_abc",
       "content": [{"type": "text", "text": "..."}], "is_error": false}
    ]}
  ],
  "tools": [...], "tool_choice": "auto",
  ...
}
```

这是 Anthropic / OpenAI 都支持的标准 tool_use 流程；替代了之前 `{"role":"user","content":"工具执行结果:\n[tool]: result..."}` 的非标准拼接。

### 内部

| 函数 | 变化 |
| --- | --- |
| `model_tool_requests_from_blocks` | 返回类型 `Vec<(String, JsonValue)>` → `Vec<(String, String, JsonValue)>` |
| `AgentModelResponse.tool_requests` | 类型跟进 |
| `call_agent_model_with_tool_loop` | 行为变化：round 2 用结构化 ToolResult，不再文本拼接 |
| `agent_message_request_with_history`（新） | 支持完整 history |
| `agent_message_request_build`（新，私有） | 提取共用逻辑 |

## 6. 未落地（Phase C-13 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-007 收尾（流式） | `model_tool_calls: BTreeMap<u32, (String, String, String)>` 扩含 tool_use_id；流式 round 2 改 ToolResult blocks；`model_tool_calls_text_fallback` 可保留作降级 |
| REQ-TOOL-007 并发 | Round 1 dispatch 多个 ToolUse 时用 `futures::future::join_all` 并发；目前仍串行 |
| REQ-TOOL-011 超时 | `runtime_tool_execute` 实装 `tokio::time::timeout` + Semaphore；`ToolOutcomeStatus::Timeout` 路径启用 |
| 响应体 ToolResult Content | `is_error` 字段由 `ToolOutcomeStatus::is_error()` 复用（需 main.rs 导入） |

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- model_tool_requests_ agent_message_request_with_history non_stream_model_tool_use

# 全量回归（--test-threads=1 稳定）
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

**手工端到端验证**（配置 `enable_llm_tools = true`, `llm_tool_exposure = "whitelist"` 后）：
1. `/api/chat/send`（非流式）发"帮我读 README.md" → LLM 调 `read_file` → Round 1 request 含完整 3 条 messages
2. 前端工具调用记录卡片显示 `runtime-executed / read_file / ok / allow-auto`
3. LLM round 2 收到 ToolResult 后能正常回复文件内容摘要（而非"工具执行结果: ..."的文字拼接）

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| provider 不支持 ToolResult block（老版本 DeepSeek）| 中 | llm-adapter 已在 `types.rs` 原生支持 ToolResult；若发送失败，应在 llm-adapter 内降级为文本（当前无降级路径，属于 Phase D） |
| Round 1 response 中混入 Text + ToolUse 时，只保留 ToolUse，丢失 reasoning 文本 | 低 | `reasoning_text(&response.content)` 已单独提取并存入 `all_reasoning`；回灌不丢 reasoning |
| Agent 设置 `enable_llm_tools = false` 但调用了新路径 | 低 | `agent_message_request_with_history` 的 `tool_choice` 条件与原 `with_images` 一致，工具禁用时自动置 None |
| 流式路径 vs 非流式路径行为不一致（一个用 ToolResult, 一个用文本）| 中 | Phase C-13 收敛；当前仅非流式场景能享受结构化回灌，流式路径保持 C-11 的 dispatch_plan 文本拼接 |

## 9. 下一步（Phase C-13）

1. `model_tool_calls` 类型升级为 `BTreeMap<u32, (String, String, String)>`（含 tool_use_id）
2. 流式 `ContentBlockStart(OutputContentBlock::ToolUse)` 解构时保留 `id`
3. 流式 round 2 改用 `stream_agent_model_with_history` 新函数（参照 C-12 非流式）+ 发 ToolResult blocks
4. Round 1 dispatch 多个 ToolUse 时用 `futures::future::join_all` 并发
5. 预期 web-console 189 passed（+5 新 TDD）

## 10. 给下一任 agent 的提醒

1. **非流式 Tool Loop 已切，不要再改**：`call_agent_model_with_tool_loop` 现在用 `with_history` 三段式，Phase C-13 做流式同构时参考本轮代码结构。
2. **`agent_message_request_with_images` 保留**：作为 round 0 的便捷构造器不动；新路径用 `agent_message_request_with_history(vec![...])`。
3. **`AgentModelResponse.tool_requests` 新三元组**：如果要持久化这个字段（目前 tasks/memory_beads 里没落），落盘时注意 tool_use_id 也要写。
4. **`OutputContentBlock::ToolUse { id, name, input }` 不再解构 `..`**：避免漏掉 `id` 字段。
5. **`is_error` 规则**：`dispatch.status == "failed" | "rejected" | "timeout"` 时为 true；与 ToolOutcomeStatus::is_error() 保持语义一致，Phase D 可以让 main.rs 直接 call runtime 的 helper。
