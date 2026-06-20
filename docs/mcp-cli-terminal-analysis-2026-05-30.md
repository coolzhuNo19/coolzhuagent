# MCP / CLI 接入与终端 PowerShell 梳理（2026-05-30）

> 任务11：梳理 MCP 和 CLI 接入代码框架，对比业界，设计前端呈现方式，打通终端 PowerShell。

## 一、MCP 现状

### 代码框架
- **仅有配置解析层**：`core-runtime/src/config.rs` 定义了完整的 MCP server 配置模型：
  - `McpConfigCollection` / `ScopedMcpServerConfig`
  - `McpServerConfig` 枚举：`McpStdioServerConfig` / `McpRemoteServerConfig` / `McpWebSocketServerConfig` / `McpSdkServerConfig` / `McpManagedProxyServerConfig`
  - `McpOAuthConfig`、`McpTransport`、`merge_mcp_servers`（从 `mcpServers` 字段合并）
- **缺口**：
  - **无 MCP 客户端运行时**（grep 未发现 connect/spawn/list_tools/调用实现）——只能解析配置，不能真正连接 MCP server 拉取工具。
  - **web-console 完全未接入**（main.rs 中 `mcp` 命中 0）——前端无任何 MCP 入口。

### 与业界对比
| 维度 | 业界（Claude Code / Cline / Cursor） | 本项目 |
| --- | --- | --- |
| 配置 | `mcpServers` JSON（stdio/sse/ws） | ✅ 已有等价配置模型 |
| 客户端 | 启动 server 进程、握手、`tools/list`、`tools/call` | ❌ 未实现 |
| 工具融合 | MCP 工具与内置工具统一进 tool registry | ❌ 未接 |
| UI | 列出 server、连接状态、工具清单、开关 | ❌ 无 |

## 二、CLI 现状

### 代码框架
- 独立 crate `modules/cli/packages/command-line`（`main.rs` ≈5347 行 + `app.rs/args.rs/init.rs/input.rs/render.rs`）。
- 自带 REPL/agent 循环、参数解析、渲染——是一个**独立终端 agent**，与 web-console 各跑各的。
- **缺口**：CLI 能力（聊天、记忆、工具）未与 web 对齐，web 也无"以 CLI 形式接入/调用"的入口。

### 与业界对比
- 业界 code agent 通常 **CLI 与 GUI 共享同一 agent core**（同一会话/工具/记忆后端）。本项目 CLI 与 web 是两套入口，存在能力漂移风险（docs 也提到 cli 完成度仅 35%）。

## 三、终端 PowerShell（已打通）

### 现状链路（已验证可用）
- 前端终端窗口 `terminalWindowRunPowerShell()`（app.js:4121）→ `POST /api/tools/runtime-execute` `{tool_name:"PowerShell", input:{command, timeout}}`。
- 后端 `api_tools_runtime_execute`（main.rs:2271）→ tool-registry `execute_powershell`（lib.rs:3064）→ 真实 `powershell.exe`/`pwsh`。
- **本轮修复**：tool-registry 的 stdout/stderr 解码改为 `decode_console_output`（GB18030 回退），中文命令输出不再乱码。
- 单命令执行、超时控制、权限闸门已具备；**无 PTY/xterm**（不是交互式 shell，是单命令面板）。

### 前端呈现建议（MCP/CLI/终端统一到"终端 + 接入"窗口）
1. **终端窗口**：保留单命令 PowerShell 面板（已打通）；后续可选接 PTY（node-pty/conpty）实现真正交互式 xterm.js。
2. **MCP 面板**（设置或终端窗口内新增 tab）：
   - 列出 `coolzhu.toml` / settings 里的 mcpServers（已可解析），显示 transport(stdio/sse/ws) 与状态灯（未连接/已连接/错误）。
   - "连接"按钮 → 后端新增 MCP 客户端运行时（启动进程/握手/`tools/list`），把工具并入 tool registry。
   - 显示每个 server 暴露的工具清单 + 开关。
3. **CLI 面板**：把 CLI 的常用子命令做成按钮/命令模板，复用 `/api/tools/runtime-execute` 执行 `coolzhu-cli ...`，输出回终端窗口。

## 四、落地优先级
- **P0（已完成）**：终端 PowerShell 打通 + 中文输出修复。
- **P1**：MCP 客户端运行时（stdio 优先）+ `/api/mcp/servers`、`/api/mcp/connect`、`/api/mcp/tools` 路由 + 前端 MCP 面板。把 MCP 工具并入现有 tool registry/审计链路。
- **P2**：CLI 与 web 共享 agent core（统一会话/记忆/工具后端），消除双入口能力漂移。
- **P3**：终端 PTY/xterm 交互式 shell（需安全策略评估）。
