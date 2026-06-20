# 2026-05-15 REQ-TOOL-011 真实多工具调用验收闭环

时间：2026-05-15 01:18 +08:00  
范围：`REQ-TOOL-011` Tool Loop 超时与并发控制  
备份：`tmp/backups/20260515-tool011-close/`

## 背景

`REQ-TOOL-011` 在 2026-05-13 Phase D 已完成代码主体：

- `[tool.execution] default_timeout_ms/max_concurrency`
- shell/PowerShell/REPL 默认 timeout 注入
- `invoke_through_runtime()` deadline 与 `runtime-timeout`
- 流式/非流式 Tool Loop 并发 dispatch，ToolResult 按原 tool_use 顺序回填

需求管理表中剩余项是“真实 LLM 多 tool_use 交互复核”。本轮在 `REQ-TOOL-008/009/010` 与 `REQ-CORE-TOOL-001` 闭环后继续执行。

## 自动回归

日志：`tmp/logs/tool011-tool-filter-regression-20260515.log`

命令：

```powershell
cargo test -p coolzhu-web-console --offline tool -- --test-threads=1
```

结果：38 passed。

覆盖范围包括：

- `tool_execution_policy_defaults_and_shell_timeout_injection`
- `run_model_tool_dispatch_sleep_respects_runtime_timeout`
- `dispatch_model_tool_calls_parallel_preserves_order`
- LLM tool_use 走 runtime 审计链的既有回归

## 真实 LLM 多 tool_use 验收

新增脚本：`tmp/tool011-real-llm-multi-tool-check.ps1`

运行日志：`tmp/logs/tool011-real-llm-multi-tool-20260515.log`

验收产物：

- Summary：`tmp/verification-runs/tool011-real-llm-20260515-011422/summary.md`
- Chat response：`tmp/verification-runs/tool011-real-llm-20260515-011422/chat-response.json`
- New audit slice：`tmp/verification-runs/tool011-real-llm-20260515-011422/new-audit.json`

脚本流程：

1. 读取 `/api/diagnostics/health`，确认 `real_llm=true`、`llm_tools=true`。
2. 读取 `/api/agents`，选择当前 active agent：`session-1778349983331`。
3. 创建临时聊天室 `tool011-real-llm-*`。
4. 发送验收提示，要求模型同一轮发起两个只读 tool_use：
   - `read_file {"path":"coolzhu.toml","limit":20}`
   - `glob_search {"pattern":"*.toml","path":"."}`
5. 检查 `/api/chat/send` 响应中至少出现两个工具消息，且包含 `read_file` 与 `glob_search`。
6. 检查 `/api/tools/audit` 新增记录中包含 `read_file` 与 `glob_search`。
7. 删除临时聊天室。

结果：

| Case | Status | Detail |
| --- | --- | --- |
| T011-PRE-001 | PASS | `real_llm=True`, `llm_tools=True` |
| T011-PRE-002 | PASS | 使用 active agent `session-1778349983331` |
| T011-PRE-003 | PASS | 临时聊天室创建成功 |
| T011-REAL-001 | PASS | 真实模型返回至少两个工具消息，包含 `read_file` 和 `glob_search` |
| T011-REAL-002 | PASS | 审计记录出现新增 `read_file` 和 `glob_search` |
| T011-CLEANUP-001 | PASS | 临时聊天室删除成功 |

## 需求状态

- `REQ-TOOL-011`：`测试中 -> 已完成`

需求统计同步更新：

- 已完成：63 -> 64
- 测试中：4 -> 3

## 下一步

工具安全主链目前已完成：`REQ-TOOL-007/008/009/010/011` + `REQ-CORE-TOOL-001`。下一优先级切到会话、记忆和多 Agent 协同：

- `REQ-WEB-SESSION-007`
- `REQ-WEB-CTX-001`
- `REQ-MEM-006`
- `REQ-WEB-CHAT-007`

其中 `REQ-WEB-SESSION-007` 已有 Phase A 代码和 TDD，下一步优先补事务化删除、前端确认弹窗和附件 GC。
