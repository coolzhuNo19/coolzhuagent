# 2026-05-16 REQ-WEB-CHAT-007 Phase D3c 自动 Handoff 投递

## 时间

- 2026-05-16 01:32 - 01:50

## 需求范围

- 需求：`REQ-WEB-CHAT-007` 聊天室多 agent 角色感知与消息流转。
- 本阶段：Phase D3c，将 D2 handoff parser 与 D3b 任务链持久化接入真实聊天发送路径。
- 目标：LLM 回复中出现 fenced `handoff` block 时，不再只停留在解析层，而是自动生成任务链记录，并向目标 Agent 写入 `handoff-inbound` 消息。

## 修改内容

- 新增 `AutoHandoffCandidate`，记录发起 Agent、assistant 消息 id 和 assistant 回复内容。
- 新增 `SessionStore::create_auto_handoffs_from_reply`：
  - 解析 assistant 回复中的 handoff directives。
  - `attach: last_assistant` 自动锚定当前 assistant message id，避免多 Agent 回复时附件错指最新 assistant。
  - 复用 `create_manual_handoff`，统一通过 D3a 防环闸门、D3b SQLite 任务链和 inbound 消息生成链路。
- 新增 `SessionStore::infer_auto_handoff_chain_position`：
  - 普通首跳使用当前聊天室最新 user message 作为 `originating_user_msg_id`。
  - 若当前 Agent 是已有 delivered handoff 的接收方，则沿用父 handoff 的 `originating_user_msg_id`，并使用 `depth+1`，确保 A -> B -> A 回环能继续被 D3a 拦截。
- 新增 `process_auto_handoff_candidates`：
  - 非流式和流式聊天持久化后统一处理自动 handoff。
  - invalid target / bad request 仅记录诊断并跳过，不让单个坏 handoff block 打断主聊天回复。
- 新增 `chat_message_dto_from_persisted`：
  - 自动 handoff 生成的 inbound 消息会回传给非流式响应，流式路径会额外发出一条 `message` SSE。

## TDD 与验证

- RED：
  - `tmp/logs/chat007-d3c-red-auto-handoff-20260516.log`
- GREEN：
  - `tmp/logs/chat007-d3c-green-auto-handoff-20260516.log`
  - `tmp/logs/chat007-d3c-green-auto-handoff-20260516-r2.log`
- 格式化：
  - `tmp/logs/chat007-d3c-cargo-fmt-20260516.log`
- 回归：
  - `tmp/logs/chat007-d3c-handoff-regression-20260516.log`
  - `tmp/logs/chat007-d3c-context-regression-20260516.log`
  - `tmp/logs/chat007-d3c-web-console-full-20260516.log`
- 全量结果：
  - `cargo test -p coolzhu-web-console --offline -- --test-threads=1`
  - `227 passed; 0 failed`

## 备份

- `tmp/backups/20260516-013200-chat007-d3c-auto-handoff/`

## 完成度

- D3c 已完成。
- `REQ-WEB-CHAT-007` 仍保持 `开发中`，剩余 D4/D5：
  - D4：前端成员条、任务链抽屉、手工转交入口和状态展示。
  - D5：`chat_handoff` 工具注册，接入 REQ-TOOL-007/008 执行、审批和审计链。

## 风险与备注

- 当前自动投递只负责落任务链和 inbound 消息，不做递归自动唤起目标 Agent 模型回复，避免无人值守下出现多 Agent 自激活循环。
- 流式 tool-loop 原有流程会先发出 round1 `message_done`，本阶段只保证最终持久化前同步 assistant message 内容并解析最终文本；后续 D4 前端可通过任务链抽屉显式展示 handoff 状态，降低主消息流 UI 的认知负担。
