# 2026-05-13 REQ-TOOL-011 Phase D：Tool Loop 超时与并发控制

时间：2026-05-13 07:32:17 +08:00  
范围：`REQ-TOOL-011`、`REQ-TOOL-007` Phase C 后续稳定性收口  
前置日志：`docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c13.md`、`docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md`  
备份：`tmp/backups/tool011-phase-d-20260513-0712-pre/`

## 背景

Phase C-13 已完成 LLM ToolResult 结构化回灌，但明确留下三项 Phase D 缺口：

- 多 `tool_use` 仍串行 dispatch。
- `runtime_tool_execute` 路径没有统一 deadline，慢工具可能拖住整轮 Tool Loop。
- shell 类工具的 `timeout` 仍是 schema 可选项，模型漏填时缺少统一默认值。

## 代码变更

- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增 `[tool.execution]` 配置结构：
    - `default_timeout_ms`，默认 `30000`
    - `max_concurrency`，默认 `4`
  - 新增 `tool_execution_policy()`，对 timeout 和并发上限做运行时 clamp。
  - 新增 `runtime_tool_input_with_defaults()`：
    - `bash` / `PowerShell` 缺省注入 `timeout`
    - `REPL` 缺省注入 `timeout_ms`
  - `invoke_through_runtime()` 改为 `spawn_blocking + tokio::time::timeout`，超时映射为 `ToolOutcomeStatus::Timeout`，上层 route 为 `runtime-timeout`。
  - 新增 `dispatch_model_tool_calls_parallel()`：
    - 使用 `tokio::task::JoinSet` + `Semaphore` 控制并发。
    - 流式和非流式 Tool Loop 都通过该函数 dispatch。
    - ToolResult 输出按原 `tool_use` 请求顺序回填，避免并发完成顺序影响模型配对。

## TDD / 验证

日志均位于 `tmp/logs/`：

- `cargo fmt --all`
  - `cargo-fmt-tool011-20260513.log`
- 新增/定向测试
  - `web-console-tool011-policy-test-20260513.log`：policy 默认值与 shell timeout 注入通过
  - `web-console-tool011-timeout-test-20260513.log`：`Sleep` 超时映射 `runtime-timeout` 通过
  - `web-console-tool011-parallel-test-20260513.log`：并发 dispatch 保序通过
- 工具链回归
  - `web-console-tool011-tool-group-20260513.log`：34 passed
  - `core-runtime-tool011-20260513.log`：121 passed
  - `tool-registry-tool011-20260513.log`：34 passed

说明：PowerShell 会把 cargo warning 写入 error stream，部分 shell exit 显示为 1；日志内 `test result: ok` 为准。

## 状态

- `REQ-TOOL-011`：`开发中 -> 测试中`
- 需求统计同步：`测试中 6 -> 7`，`开发中 4 -> 3`

## 剩余验证

- 真实 LLM 多工具调用交互：打开 `enable_llm_tools=true`，让模型同一轮返回两个 ReadOnly 工具（如 `glob_search` + `read_file`），确认 round 2 ToolResult 块数量、顺序和审计记录。
- 前端工具审计表交互刷新：确认 timeout / ok / dry-run-only 三类状态都可读、脱敏摘要无原始 secret。
- CLI/MCP 入口统一到 runtime 仍属于 `REQ-CORE-TOOL-001` 后续项，本轮不展开。
