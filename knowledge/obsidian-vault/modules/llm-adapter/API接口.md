---
title: "LLM Adapter API 接口"
source:
  - "modules/llm-adapter/INTERFACE.md"
  - "docs/model-provider-config-table.md"
  - "docs/model-capability-table-verified-2026-05-31.md"
  - "docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md"
  - "docs/gemma4-12b-local-deploy-2026-06-15.md"
  - "docs/coolzhu-model-finetune-plan-2026-06-16.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# LLM Adapter API 接口

## 职责边界

统一智谱、阿里、百度、字节、DeepSeek、OpenAI-compatible、本地模型等 provider 的请求、响应、流式事件和工具调用格式。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `api::ProviderClient` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::MessageRequest` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::MessageResponse` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::InputContentBlock` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::OutputContentBlock` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ToolDefinition` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::StreamEvent` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ProviderKind` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ProviderInfo` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ModelRegistry` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ResolvedModel` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::AdapterConfig` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ProviderConfig` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::ModelConfig` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `api::resolve_model_alias` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
