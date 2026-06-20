---
title: "Diagnostics API 接口"
source:
  - "modules/diagnostics/INTERFACE.md"
  - "docs/harness-gap-analysis-2026-06-04.md"
  - "docs/harness-optimization-plan-2026-06-04.md"
  - "docs/plans/agent-diagnostic-event-dictionary-2026-06-14.md"
  - "docs/plans/agent-diagnostic-logging-plan-2026-06-14.md"
  - "docs/work-logs/2026-06-05-harness-batch3-and-scenario-verify.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Diagnostics API 接口

## 职责边界

诊断事件、日志字段、trace/span 追踪、错误上下文、GUI 实时日志窗口和健康检查。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `diagnostics::init` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::log_path` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::set_gui_callback` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::error/warn/info/debug/trace/emit` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::start_span` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::start_span_with_parent` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::current_context` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::current_trace_id` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::LogEntry` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `diagnostics::SpanContext` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
