# 2026-05-05 P1 LLM Tool Calling Selector

## Scope

推进 `REQ-LLM-003` / `REQ-TOOL-001` 的可自动化部分：真实模型可以请求工具，但当前只转换为 dry-run dispatch，不开放真实键鼠、文件写入或插件执行。

## Implemented

- 非流式真实模型返回路径不再依赖 reasoning 文本前缀解析 tool call。
- 新增 `model_tool_requests_from_blocks`，直接从 `OutputContentBlock::ToolUse` 提取 `(name, input)`。
- `AgentModelResponse` 增加 `tool_requests`，让 `agent_chat_response` 能识别“只有 tool_use、没有文本回复”的有效模型输出。
- 流式路径在只有 tool call 或 reasoning、没有正文时不再回退成本地回复。
- 继续限制模型工具白名单：只接受 `tools_semantic_dispatch` / `tools.semantic_dispatch`，并转成 `/api/tools/dispatch` dry-run。
- dispatch 结果继续输出 `execute_allowed=false` 和 `safety_gate`。

## Verification

Passed:

- `rustfmt --edition 2021 modules\gui-web\packages\web-console\src\main.rs`
- `cargo check -p coolzhu-web-console --offline -q`
- `cargo test -p coolzhu-web-console non_stream_model_tool_use_is_extracted_from_output_blocks --offline -- --nocapture`
- `cargo test -p coolzhu-web-console model_tool_use_converts_to_semantic_dispatch_dry_run --offline -- --nocapture`
- `cargo test -p coolzhu-web-console dispatch_summary_exposes_llm_tool_call_contract --offline -- --nocapture`
- `cargo test -p coolzhu-web-console semantic_dispatch_returns_structured_dry_run_plan --offline -- --nocapture`

## Remaining Risk

- 真实 `agent-test001/002` 模型是否稳定触发 OpenAI-compatible tool calls 仍需联调。
- 当前未实现 tool result 回灌给模型继续第二轮生成；第一阶段只在聊天室追加 `tool-summary`。
- 真实 execute gate、人工确认、审计日志仍属后续安全执行需求。
