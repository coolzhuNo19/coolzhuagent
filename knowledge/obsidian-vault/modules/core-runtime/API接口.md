---
title: "Core Runtime API 接口"
source:
  - "modules/core-runtime/INTERFACE.md"
  - "docs/session-memory-workspace-integration-plan-2026-05-10.md"
  - "docs/context-management-analysis-2026-05-30.md"
  - "docs/context-compaction-threshold-benchmark-2026-05-31.md"
  - "docs/code-audit-context-tools-goal-2026-05-31.md"
  - "docs/work-logs/2026-06-07-video-multiround-memory.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Core Runtime API 接口

## 职责边界

会话、上下文、权限、配置、Agent 执行状态、MCP 客户端运行时和会话 HTTP 服务的业务核心。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `runtime::Session` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime::ConversationMessage` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime::ToolExecutor` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime::ConfigLoader` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `server::app` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `server::AppState` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime::McpClientBootstrap` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `runtime::spawn_mcp_stdio_process` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `JsonRpcRequest/Response/Error/Id` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
