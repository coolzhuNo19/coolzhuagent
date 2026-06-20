---
title: "Tooling / MCP / 插件 API 接口"
source:
  - "modules/tooling/INTERFACE.md"
  - "docs/tool-calling-permission-plan-2026-05-10.md"
  - "docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md"
  - "docs/mcp-cli-terminal-analysis-2026-05-30.md"
  - "docs/plans/mcp-preinstall/00-总纲.md"
  - "docs/plans/mcp-preinstall/05-笔记类软件.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Tooling / MCP / 插件 API 接口

## 职责边界

工具注册、插件系统、slash command、兼容性抽取、MCP server 接入和 CLI Anything 工具扩展入口。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `tools::GlobalToolRegistry` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `plugins::PluginManager` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `plugins::PluginHooks` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `commands::SlashCommand` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `commands::slash_command_specs` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `MCP config: mcpServers stdio/sse/ws` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `mcp_tool_name(server, tool)` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime_tool_execute(ToolInvoke) as target unification` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
