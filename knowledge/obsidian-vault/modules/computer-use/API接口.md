---
title: "Computer Use API 接口"
source:
  - "modules/computer-use/INTERFACE.md"
  - "docs/precise-click-grounding-plan-2026-05-10.md"
  - "docs/grounding-router-verification-plan.md"
  - "docs/work-logs/2026-06-19-computer-use-plugin-fix.md"
  - "docs/work-logs/2026-05-10-verified-click-pipeline.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Computer Use API 接口

## 职责边界

桌面操作闭环、分辨率矩阵、语义锚点、物理坐标映射、鼠标键盘输入和输入后端预检。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `computer_use::ResolutionCase` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::MouseActionKind` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::UiTargetKind` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::RelativeAnchor` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::anchor_to_physical_pixel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::preflight_report` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::click_point` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::mouse_button_action_point` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::move_mouse_relative` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::scroll_wheel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::type_text` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `computer_use::input::press_virtual_key` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `bin: coolzhu-computer-use-check preflight/click/mouse-action` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
