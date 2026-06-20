---
title: "GUI Desktop / 桌宠 API 接口"
source:
  - "modules/gui-desktop/INTERFACE.md"
  - "docs/desktop-pet-clawd-integration-and-new-features-2026-05-31.md"
  - "docs/desktop-pet-review-and-filedrop-2026-06-04.md"
  - "docs/clawd-on-desk-port-analysis-2026-05-31.md"
  - "docs/work-logs/2026-06-18-pet-settings-session-protocol-agent-reach.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# GUI Desktop / 桌宠 API 接口

## 职责边界

Windows 桌面壳、Tauri WebView、透明置顶桌宠、托盘和桌面入口。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `package: coolzhu-desktop-console` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `tauri-shell --pet` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `internal: app.rs / service.rs / desktop_agent.rs / desktop_capture.rs / input_backend.rs` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `pet routes consumed from gui-web: /api/pet/state, /api/pet/event, /api/pet/events` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
