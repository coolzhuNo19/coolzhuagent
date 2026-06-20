---
title: "COOLZHU vault 根目录 API 接口"
source:
  - "docs/interface-contracts.md"
  - "docs/README.md"
  - "docs/repository-structure.md"
  - "docs/development-standard.md"
  - "docs/requirements-management.md"
  - "docs/module-completion-status.md"
  - "docs/change-and-requirement-workflow.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# COOLZHU 跨模块接口索引

## 职责边界

根目录记录跨模块接口审查口径，各模块 API 细节进入 `modules/<module>/API接口.md`。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `modules/core-runtime/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/llm-adapter/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/tooling/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/vision/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/computer-use/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/gui-web/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/gui-desktop/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/cli/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/diagnostics/INTERFACE.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
