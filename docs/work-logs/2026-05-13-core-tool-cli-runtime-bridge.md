# 2026-05-13 REQ-CORE-TOOL-001 CLI Runtime Bridge

## 背景

`REQ-CORE-TOOL-001` 在 Web/LLM 侧已经完成 `runtime_tool_execute`、审批、审计、ToolResult、超时与并发控制，剩余缺口集中在 CLI/MCP 入口。根据当前优先级，本轮先推进低风险 CLI 入口，让 CLI 模型工具调用也通过统一 runtime 协议；MCP 入口继续作为后续独立项处理。

## 修改范围

- `modules/cli/packages/command-line/src/main.rs`
  - `CliToolExecutor` 新增 `permission_mode` 字段。
  - `build_runtime` 创建 `CliToolExecutor` 时透传当前 permission mode。
  - 新增 `CliRegistryInvocationExecutor`，实现 `runtime::ToolInvocationExecutor`，内部仍委托 `GlobalToolRegistry::execute`。
  - 新增 `execute_cli_tool_through_runtime`：
    - 构造 `ToolInvoke { caller: ToolCaller::Cli }`。
    - 通过 `tools::path_effect::extractor_for` 抽取路径影响。
    - 使用 `default_protected_rules` 与 `RuntimeToolContext`。
    - 调用 `runtime_tool_execute` 后再把 `ToolOutcome` 映射回旧 `ToolExecutor` 的 `Result<String, ToolError>`。
  - 新增 `required_permission_for_cli_tool` 和 `cli_runtime_grant`。
  - 新增两条 TDD：
    - `cli_tool_executor_routes_read_file_through_runtime`
    - `cli_tool_executor_uses_runtime_gate_for_workspace_write_outside`
- `docs/requirements-management.md`
  - `REQ-CORE-TOOL-001` 备注更新为 CLI runtime bridge 已落代码，MCP 与依赖编译验证仍待收口。
  - 新增变更记录。

## 验证记录

- `tmp/logs/cargo-fmt-core-tool-cli-20260513.log`
  - `cargo fmt --all` 通过。
- `tmp/logs/core-tool-cli-red-readonly-20260513.log`
  - `--offline` 首次验证失败：本地缺 `crossterm v0.28.1`。
- `tmp/logs/core-tool-cli-red-readonly-online-20260513.log`
  - 在线 cargo 开始下载 `pulldown-cmark v0.13.3`、`rustyline v15.0.0`，之后下载过程明显卡住并触发工具超时。
- `tmp/logs/core-tool-cli-test-offline-20260513.log`
  - 复测 `--offline` 仍失败：本地缺 `onig_sys v69.9.1`。
- `tmp/logs/core-runtime-runtime-tool-execute-regression-20260513.log`
  - core-runtime 统一 runtime 工具入口回归：5 passed。
- `tmp/logs/core-tool-cli-test-offline-after-message-request-20260513.log`
  - CLI runtime bridge 定向测试：2 passed。
- `tmp/logs/core-tool-cli-full-test-offline-20260513.log`
  - `coolzhu-command-line` 全量测试：77 passed。

## 状态与风险

- `REQ-CORE-TOOL-001`：保持 `开发中`。
- CLI runtime bridge 代码已落且全量验证通过。期间发现 TUNA registry cache 存在两个 hash 目录，用户手动补包后将 `onig_sys/quick-xml/radix_trie/syntect/unicode-width/winapi` 从 `e791a3f93f26854f` 同步到 `4dc01642fd091eda` 后，`cargo test -p coolzhu-command-line --offline -- --test-threads=1` 通过。
- 同步补齐 CLI `MessageRequest` 初始化的 `reasoning_effort: None`，兼容 llm-adapter 请求结构演进。
- MCP 入口仍未接入 runtime，需要后续单独设计 stdio/MCP server 调用点与测试矩阵。

## 备份

- 修改前备份：`tmp/backups/core-tool-cli-runtime-20260513-2118-pre`
- 修改后快照：`tmp/backups/core-tool-cli-runtime-20260513-2118-pre/post`
