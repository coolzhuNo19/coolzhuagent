---
title: "总体架构 API 接口"
source:
  - "docs/interface-contracts.md"
  - "docs/README.md"
  - "docs/repository-structure.md"
  - "docs/development-standard.md"
  - "docs/requirements-management.md"
  - "docs/module-completion-status.md"
  - "docs/change-and-requirement-workflow.md"
  - "docs/agent-roadmap-chat-memory-vision.md"
  - "docs/hard-requirements-implementation-plan-2026-05-10.md"
  - "docs/current-issues-and-unfinished-requirements-2026-05-31.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# 总体架构 API 接口

## 职责边界

本页保留跨模块契约矩阵；具体字段和类型以各模块 `INTERFACE.md` 与 vault 模块页为准。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `core-runtime: Session / ConversationMessage / ToolExecutor / ConfigLoader` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `llm-adapter: ProviderClient / MessageRequest / StreamEvent / ToolDefinition` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `tooling: GlobalToolRegistry / PluginManager / SlashCommand / MCP tools` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision: VisionRequest / VisionResponse / relative_point_to_pixel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer-use: input actions / preflight / anchor_to_physical_pixel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `gui-web: /api/* HTTP API` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `gui-desktop: Tauri shell / pet event consumer` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics: emit / span / health` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `cli: coolzhu-cli` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
