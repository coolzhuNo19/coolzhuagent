---
title: "Vision API 接口"
source:
  - "modules/vision/INTERFACE.md"
  - "docs/vision-tool-service-plan-2026-05-08.md"
  - "docs/showui-vision-agent-separation-plan-2026-05-12.md"
  - "docs/showui-vs-uidetr-realtime-vision-eval-2026-05-30.md"
  - "docs/realtime-vision-voice-completion-analysis-2026-06-04.md"
  - "docs/work-logs/2026-06-08-local-vision-stack-and-agnes-understanding.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Vision API 接口

## 职责边界

本地/远端 VLM、多模态请求、ShowUI grounding、视觉坐标解析和截图证据。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `vision::VisionBackend` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::VisionRequest` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::VisionResponse` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::LocalOpenAiVisionBackend` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::ZhipuVisionBackend` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::build_showui_grounding_request` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::parse_relative_point` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::relative_point_to_pixel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::default_local_vlm_install_root` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::local_vlm_health_url` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `vision::local_vlm_resource_launcher_hint` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
