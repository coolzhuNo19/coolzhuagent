---
title: "modules 一级目录 API 接口"
source:
  - "docs/module-completion-status.md"
  - "docs/interface-contracts.md"
  - "docs/repository-structure.md"
  - "docs/requirements-management.md"
  - "modules/gui-web/INTERFACE.md"
  - "modules/gui-desktop/INTERFACE.md"
  - "modules/computer-use/INTERFACE.md"
  - "modules/vision/INTERFACE.md"
  - "modules/llm-adapter/INTERFACE.md"
  - "modules/tooling/INTERFACE.md"
  - "modules/core-runtime/INTERFACE.md"
  - "modules/diagnostics/INTERFACE.md"
  - "modules/cli/INTERFACE.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# modules 聚合 API 接口

## 职责边界

本页是二级模块 API 的索引。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `modules/gui-web/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/gui-desktop/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/computer-use/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/vision/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/llm-adapter/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/tooling/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/core-runtime/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/diagnostics/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `modules/cli/API接口.md` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
