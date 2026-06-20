# 2026-05-16 REQ-WEB-CHAT-007 Phase D5 chat_handoff 工具闭环

## 时间

- 开始：2026-05-16 04:52 +08:00
- 完成：2026-05-16 05:04 +08:00

## 目标

根据当前推进策略，先确保后端功能和 API 接口可用，前端布局与视觉设计后续统一处理。本轮收口 `REQ-WEB-CHAT-007` Phase D5：让真实 LLM tool_use 能直接调用 `chat_handoff`，把任务交给同聊天室 peer agent，并复用已有 handoff 任务链、入站消息和审计链路。

## 修改内容

- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增 `chat_handoff_tool_definition()`，在 LLM tool registry 的 `whitelist` 与 `all` 模式下暴露 `chat_handoff`。
  - `run_model_tool_dispatch()` 增加 `chat_handoff` / `chat.handoff` 分支，避免被当成未知 runtime 工具。
  - 新增 `run_chat_handoff_tool_dispatch()`、`create_chat_handoff_from_tool_input()` 和专用 dispatch response 映射：
    - 支持参数：`to`、`intent`、`chat_room_id`、`room_id`、`from_agent_id`、`from`、`attach`、`attach_message_ids`、`originating_user_msg_id`、`originating_message_id`、`depth`。
    - 默认使用当前 active chat room 与 active agent session。
    - 复用 `SessionStore::create_manual_handoff()`，因此继承 self-loop、depth、cycle、quota、dedup 防环逻辑。
    - 成功时写入 SQLite `chat_handoffs`，并向目标 Agent 生成 `handoff-inbound` 聊天消息。
    - 每次 LLM 调用追加 `tool-audit.jsonl`，`caller=llm`、`tool_name=chat_handoff`。
  - 新增 TDD：
    - LLM registry 默认 whitelist 必含 `chat_handoff`。
    - all 模式工具数量包含 `semantic_dispatch + chat_handoff + mvp registry`。
    - `run_model_tool_dispatch_chat_handoff_creates_record_and_audit` 验证 tool_use 能创建 handoff 记录并落审计。

- `docs/requirements-management.md`
  - `REQ-WEB-CHAT-007` 状态更新为 `测试中`。
  - Phase D5 标记为已完成，说明后端/API/tool 已闭环，前端布局效果后续统一设计与交互确认。
  - 下一步计划调整为优先推进 `REQ-LLM-005` 的后端/adapter/API 能力。

## 验证

- TDD 红灯：
  - `tmp/logs/chat-handoff-tool-defs-tdd-fail-20260516.log`
  - `tmp/logs/chat-handoff-tool-dispatch-tdd-fail-20260516.log`
- TDD 绿灯：
  - `tmp/logs/chat-handoff-tool-defs-green-20260516.log`
  - `tmp/logs/chat-handoff-tool-dispatch-green-20260516.log`
- 格式化：
  - `tmp/logs/chat-handoff-tool-cargo-fmt-20260516.log`
- 全量回归：
  - `tmp/logs/chat-handoff-tool-web-console-full-20260516.log`
  - 结果：`229 passed; 0 failed`

## 备份

- 修改前备份：`tmp/backups/chat-handoff-tool-20260516-045243/`
- 修改后备份：`tmp/backups/chat-handoff-tool-20260516-050502-post/`

## 风险与后续

- `chat_handoff` 当前定位为内部协作工具，权限审计使用 `workspace-write + allow-auto`，不触发人工审批；外部文件、键鼠、插件脚本仍走原 runtime permission gate。
- 前端成员条、任务链抽屉和手工转交入口已有最小代码和静态契约测试，但用户已要求后续统一前端布局，因此本轮不继续做视觉调整。
- 下一步按需求表优先级推进 `REQ-LLM-005`，先补后端 provider/adapter/API 的 Custom OpenAI-compatible 能力，UI 布局后置。
