# 2026-05-13 REQ-CORE-TOOL-001 MCP Runtime Bridge

时间：2026-05-13 20:18:59 +08:00

## 背景

`REQ-CORE-TOOL-001` 已完成 Web / LLM / CLI 入口统一到 `runtime_tool_execute`，剩余缺口是 MCP stdio manager 的 `tools/call` 仍可绕过统一权限闸门。按当前优先级，本轮收口 MCP 入口，让 MCP 工具调用也以 `ToolInvoke(caller=Mcp)` 进入 runtime。

## 修改范围

- `modules/core-runtime/packages/core-runtime/src/mcp_stdio.rs`
  - 新增 `McpServerManager::call_tool_through_runtime`。
  - 强制 MCP 调用来源写为 `ToolCaller::Mcp`。
  - MCP 调用先经过 `runtime_tool_execute`，只有 `ToolOutcomeStatus::Ok` 才继续调用原 `call_tool` / `tools/call`。
  - MCP JSON-RPC result / error 统一转换为 `ToolOutcome`，保留 runtime 生成的 `permission_gate`。
  - 保留原 `call_tool` 作为低层协议能力，避免破坏既有 MCP client 测试。

## TDD 记录

先补红灯测试：

- `manager_call_tool_through_runtime_runs_allowed_mcp_tool`
  - ReadOnly MCP 调用通过 runtime 后真实发出 `tools/call`，并把 MCP `structuredContent` 映射到 `ToolOutcome.output`。
- `manager_call_tool_through_runtime_blocks_mcp_workspace_write_before_call`
  - WorkspaceWrite 越界时返回 `DryRunOnly` / `RequireApproval`，日志只出现 `initialize` 和 `tools/list`，不出现 `tools/call`。

红灯日志：

- `tmp/logs/core-runtime-mcp-runtime-tdd-red-20260513.log`

## 验证

- `cargo fmt --all`
  - 日志：`tmp/logs/cargo-fmt-core-tool-mcp-20260513.log`
- `cargo test -p coolzhu-core-runtime manager_call_tool_through_runtime --offline`
  - 2 passed
  - 日志：`tmp/logs/core-runtime-mcp-runtime-target-20260513.log`
- `cargo test -p coolzhu-core-runtime mcp_stdio --offline`
  - 日志：`tmp/logs/core-runtime-mcp-stdio-group-20260513.log`
- `cargo test -p coolzhu-core-runtime runtime_tool_execute --offline`
  - 日志：`tmp/logs/core-runtime-tool-execute-group-after-mcp-20260513.log`
- `cargo test -p coolzhu-core-runtime --offline`
  - 123 passed
  - 日志：`tmp/logs/core-runtime-full-after-mcp-runtime-20260513.log`

## 需求状态

- `REQ-CORE-TOOL-001`：`开发中 -> 测试中`。
- 需求统计同步调整：
  - `测试中 8 -> 9`
  - `开发中 3 -> 2`

## 备份

- 预备份：`tmp/backups/core-tool-mcp-runtime-20260513-2019-pre/`
- 修改后备份：`tmp/backups/core-tool-mcp-runtime-20260513-2019-post/`

## 后续

- MCP 真实外部 server 工具仍需在集成交互阶段抽样复核。
- 下一优先级转入会话 / workspace 数据边界：`REQ-WEB-PROJECT-003`、`REQ-WEB-SESSION-007`、`REQ-WEB-CTX-001`。
