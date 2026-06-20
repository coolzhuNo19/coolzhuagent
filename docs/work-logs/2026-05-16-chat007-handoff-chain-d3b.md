# 2026-05-16 REQ-WEB-CHAT-007 Phase D3b Handoff 任务链持久化

## 时间

- 2026-05-16 01:07 - 01:30

## 需求范围

- 需求：`REQ-WEB-CHAT-007` 聊天室多 agent 角色感知与消息流转。
- 本阶段：Phase D3b，补齐 handoff 任务链持久化、手工投递 API、目标 Agent inbound 消息和查询接口。
- 前置阶段：D1 roster API、D2 roster prompt + handoff parser、D3a 防环闸门均已完成。

## 修改内容

- 新增 HTTP API：
  - `GET /api/chat/rooms/{room_id}/handoffs?limit=&since=`：按聊天室查询 handoff 任务链，默认取最近记录。
  - `POST /api/chat/rooms/{room_id}/handoffs/manual`：手工把任务从当前 Agent 转交给同聊天室 peer。
- 新增数据结构：
  - `HandoffQuery`
  - `ManualHandoffRequest`
  - `ChatHandoffListResponse`
  - `ManualHandoffResponse`
- 新增 `SessionStore` 行为：
  - `list_chat_handoffs`
  - `create_manual_handoff`
  - 自动校验聊天室存在、from agent 存在、target 可由 id/name/display_name 解析。
  - 复用 D3a `validate_handoff_gate`，覆盖 self-loop、depth、cycle、quota、dedup。
  - handoff 成功后生成 `handoff-inbound` 聊天消息，目标 Agent 后续可以在同一聊天室上下文中接收转交意图和附件上下文。
- 新增 SQLite schema v3：
  - `chat_handoffs`
  - `idx_chat_handoffs_room_created`
  - `idx_chat_handoffs_chain`
- 修复 session 全量保存对任务链的影响：
  - `save_session_state_to_sqlite` 在重写 rooms/messages 前读取现有 handoff 记录。
  - 重写完成后仅恢复当前 workspace 内仍存在聊天室的 handoff，避免 FK cascade 误删有效任务链。

## TDD 与验证

- RED：
  - `tmp/logs/chat007-d3b-red-manual-handoff-20260516.log`
- GREEN：
  - `tmp/logs/chat007-d3b-green-manual-handoff-20260516.log`
  - `tmp/logs/chat007-d3b-green-handoff-list-20260516.log`
  - `tmp/logs/chat007-d3b-handoff-all-20260516.log`
- 格式化：
  - `tmp/logs/chat007-d3b-cargo-fmt-20260516.log`
- 回归：
  - `tmp/logs/chat007-d3b-handoff-all-after-fmt-20260516.log`
  - `tmp/logs/chat007-d3b-context-regression-20260516.log`
  - `tmp/logs/chat007-d3b-web-console-full-20260516.log`
- 全量结果：
  - `cargo test -p coolzhu-web-console --offline -- --test-threads=1`
  - `225 passed; 0 failed`

## 备份

- `tmp/backups/20260516-010716-chat007-d3b-chain-api/`

## 完成度

- D3b 已完成。
- `REQ-WEB-CHAT-007` 仍保持 `开发中`，因为自动投递、前端任务链抽屉和 `chat_handoff` 工具尚未完成。

## 后续计划

1. D3c：把 D2 parser 识别出的 handoff directive 接入真实 LLM 回复处理链，自动创建任务链记录和 inbound 消息。
2. D4：前端增加成员条、任务链抽屉、手工转交入口和状态展示。
3. D5：注册 `chat_handoff` 工具，接入 REQ-TOOL-007/008 的执行和审批链，并补审计记录。
