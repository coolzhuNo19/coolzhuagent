---
title: "GUI Web 控制台 API 接口"
source:
  - "modules/gui-web/INTERFACE.md"
  - "docs/agent-roadmap-chat-memory-vision.md"
  - "docs/requirements-management.md"
  - "docs/chatroom-richtext-media-analysis-2026-06-04.md"
  - "docs/web-ui-window-d2-implementation-plan-2026-05-17.md"
  - "docs/work-logs/2026-06-11-mario-3d-ui-redesign.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# GUI Web 控制台 API 接口

## 职责边界

Web 主控制台、聊天室、会话/记忆窗口、工具/视觉/诊断窗口和本地 HTTP API 聚合层。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `GET /api/state` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET /api/web/cards` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET/POST /api/workspace` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET/POST/PUT/DELETE /api/sessions*` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET/POST /api/chat/rooms*` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/chat/send` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/chat/send/stream` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET/POST /api/attachments*` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET /api/tools/catalog` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/tools/dispatch` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/vision/describe-screen` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/vision/find-target` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/computer-use/profile` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `POST /api/computer-use/closed-loop` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `GET /api/diagnostics/health` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 定时 loop 接口增量（2026-06-19）

| 接口/命令 | 用途 |
| --- | --- |
| `GET /api/task-schedules` | 列出定时任务（task 现含 `task_kind`/`goal_id`/`last_error` 等字段）。 |
| `POST /api/task-schedules` | 创建定时任务。新增可选字段 `task_kind`(poll\|goal，默认 poll)、`goal_id`(goal 模式必填且须存在，否则 404)。 |
| `DELETE /api/task-schedules/{id}` | 删除定时任务。 |
| `POST /api/task-schedules/run-due` | 手动执行到期任务（后台调度器每 30s 亦自动执行）。 |

- 轮询型：到点把 `content` 发给 `target_session_id`，完成后内容不变、按 schedule_kind/interval 重排。
- Goal 推进型：到点推进绑定 `goal_id` 一个阶段，`content` 回写为进度摘要；整体目标完成 → `status=completed`（停止触发）。
- 新增字段均可选带默认，兼容旧前端/旧 coolzhu.toml，无破坏性变更。

## 接力式群发接口（2026-06-19，已取消广播）

| 接口/命令 | 用途 |
| --- | --- |
| `POST /api/chat/send`（多目标） | **群发已统一走接力**（取消广播）：targets>1 时后者见前者回复。单目标保持原逻辑。 |
| `POST /api/chat/send/stream`（多目标） | 同上，接力流式：逐会话完成即 yield 整条消息。 |
| `POST /api/chat/send/relay` | 显式接力端点（与多目标 /api/chat/send 等价，保留为别名）。 |
| `GET/POST /api/chat/relay-config` | 读/写接力单会话超时 `relay_timeout_ms`（接受 relay_timeout_seconds，持久化 coolzhu.toml，钳 [5s,600s]）。 |

- 接力语义：按 `target_agent_ids` 配置顺序逐个作答，每个会话提示 = 原文 + 前序所有会话回复 + 位次 → 可报数/接龙/分工。实测 test3/test5/test6 报数 → **1/2/3**。
- 超时与重试：每会话调用超时取 `config.session.relay_timeout_ms`（默认 120s，钳 [5s,600s]，定时任务面板可设）；超时跳过入重试队列，后续会话完成后各**重试一次**，仍超时则结束（每会话至多一次重试）。
- R3 持久化：接力**每步完成即增量落盘**（先落盘用户消息），中途崩不丢已完成回复。
- 实现：`relay_dispatch`/`relay_run_and_persist_step`/`relay_run_one`/`build_relay_prompt`/`persist_relay_step`（main.rs），复用 `prepare_chat_dispatch`/`persist_chat_dispatch`，未改 `SendMessageRequest`。

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
