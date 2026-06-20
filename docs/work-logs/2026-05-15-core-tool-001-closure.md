# 2026-05-15 REQ-CORE-TOOL-001 工具调用编排闭环

时间：2026-05-15 00:57 +08:00  
范围：`REQ-CORE-TOOL-001` Web / LLM / CLI / MCP 统一 runtime 工具调用编排  
备份：`tmp/backups/20260515-core-tool-001-close/`

## 背景

`REQ-CORE-TOOL-001` 此前已经完成三段落地：

- Web / LLM：`runtime_tool_execute`、权限评估、审批 pending/SSE、审计 jsonl、ToolResult 回灌已接入。
- CLI：`CliToolExecutor` 已通过 `ToolInvoke(caller=Cli)` 走 runtime 闸门。
- MCP：`McpServerManager::call_tool_through_runtime` 已通过 `ToolInvoke(caller=Mcp)` 在 `tools/call` 前执行权限闸门。

剩余缺口是需求管理表里保留的“真实 MCP 工具交互复核”。本轮在完成 `REQ-TOOL-008/009/010` 后，继续复核 MCP 真实 stdio server 进程交互。

## 验证内容

### MCP runtime bridge

命令日志：`tmp/logs/core-tool-mcp-runtime-acceptance-20260515.log`

执行：

```powershell
cargo test -p coolzhu-core-runtime --offline manager_call_tool_through_runtime -- --test-threads=1
```

结果：

- `manager_call_tool_through_runtime_runs_allowed_mcp_tool`：PASS
  - 启动 fake MCP stdio server 进程。
  - ReadOnly MCP 工具先通过 runtime，再真实发出 MCP `tools/call`。
  - MCP `structuredContent` 映射为 `ToolOutcome.output`。
- `manager_call_tool_through_runtime_blocks_mcp_workspace_write_before_call`：PASS
  - 同样启动 fake MCP stdio server。
  - WorkspaceWrite 越界路径在 runtime 闸门返回 `dry-run-only`。
  - server 端调用序列没有出现 `tools/call`，证明拦截发生在 MCP 调用前。

### Core runtime 全量回归

命令日志：`tmp/logs/core-runtime-full-after-tool-core-serial-20260515.log`

执行：

```powershell
cargo test -p coolzhu-core-runtime --offline --lib -- --test-threads=1
```

结果：123 passed。

说明：先前未加 `--test-threads=1` 的并行全量出现 `config::tests::parses_plugin_config` 偶发失败，定向 `parses_plugin_config` 2 passed，串行全量 123 passed。该失败判断为测试间环境变量共享竞态，不影响本轮 MCP runtime bridge 功能结论；后续若整理测试基础设施，可单独把配置相关环境变量测试串行化或改为 scoped env helper。

### Tool loop 稳定性回归

命令日志：`tmp/logs/tool011-tool-filter-regression-20260515.log`

执行：

```powershell
cargo test -p coolzhu-web-console --offline tool -- --test-threads=1
```

结果：38 passed。

覆盖 `REQ-TOOL-011` 已落地的自动化部分，包括工具默认 timeout 注入、runtime timeout 映射和并发 dispatch 保序。但真实 LLM 多 tool_use 仍受 `coolzhu.toml [model].enable_real_llm` 与模型实际 tool_use 行为影响，本轮不将 `REQ-TOOL-011` 标为完成。

## 需求状态

- `REQ-CORE-TOOL-001`：`测试中 -> 已完成`
- `REQ-TOOL-011`：保持 `测试中`

需求统计同步更新：

- 已完成：62 -> 63
- 测试中：5 -> 4

## 下一步

当前工具安全链路仅剩 `REQ-TOOL-011` 的真实 LLM 多 tool_use 复核。若真实模型开关暂不开启，可先记录为外部条件项，并切到会话/记忆/协同组：

- `REQ-WEB-SESSION-007`
- `REQ-WEB-CTX-001`
- `REQ-MEM-006`
- `REQ-WEB-CHAT-007`
