# 2026-05-16 REQ-WEB-CHAT-007 Phase D4 Handoff 前端任务链 UI

## 时间

- 2026-05-16 01:52 - 02:10

## 需求范围

- 需求：`REQ-WEB-CHAT-007` 聊天室多 agent 角色感知与消息流转。
- 本阶段：Phase D4，前端展示 D1-D3c 已具备的 roster、handoff 任务链和手工转交能力。
- 状态：代码完成，涉及 Web GUI 布局，需要用户截图确认效果后再继续 D5。

## 修改内容

- `index.html`
  - 聊天室标题区新增“任务链”和“转交”按钮。
  - 聊天面板新增 `data-role="chat-roster"` 成员条。
  - 聊天面板新增 `data-role="handoff-drawer"` 任务链抽屉、状态计数和任务链列表。
- `src/app.js`
  - 新增 `refreshChatCollaboration`，统一刷新 `/api/chat/rooms/{room_id}/roster?me=` 和 `/handoffs?limit=20`。
  - 新增 `renderChatRoster`、`renderHandoffList`、`toggleHandoffDrawer`。
  - 新增 `manualHandoffSelectedMessages`，手工转交复用 `/handoffs/manual`：
    - 已选历史存在时使用 `attach=message_ids`。
    - 无已选历史时使用 `attach=last_assistant`。
    - 目标优先使用发送对象下拉中选中的 peer；否则按 roster 提示输入目标。
  - 发送完成、流式完成、切换聊天室后刷新任务链状态。
  - `handoff-inbound` 消息显示为任务链消息样式，避免被误认为普通用户输入。
- `src/styles.css`
  - 聊天面板 grid 增加成员条行。
  - 新增 `.chat-roster-strip`、`.chat-roster-chip`、`.handoff-drawer`、`.handoff-item` 样式。

## TDD 与验证

- RED：
  - `tmp/logs/chat007-d4-red-ui-contract-20260516.log`
- GREEN：
  - `tmp/logs/chat007-d4-green-ui-contract-20260516.log`
  - `tmp/logs/chat007-d4-ui-contract-after-fmt-20260516.log`
- 前端语法：
  - `tmp/logs/chat007-d4-node-check-app-20260516.log`
- 格式化：
  - `tmp/logs/chat007-d4-cargo-fmt-20260516.log`
- 回归：
  - `tmp/logs/chat007-d4-handoff-regression-20260516.log`
  - `tmp/logs/chat007-d4-web-console-full-20260516.log`
- 全量结果：
  - `cargo test -p coolzhu-web-console --offline -- --test-threads=1`
  - `228 passed; 0 failed`

## 备份

- `tmp/backups/20260516-015200-chat007-d4-ui/`

## 交互确认项

1. 打开 Web GUI 后，聊天室标题下方应出现 Agent 成员条。
2. 点击“任务链”应展开右侧任务链抽屉，不遮挡底部输入区。
3. 选择一条或多条历史消息后点击“转交”，输入任务意图，应生成一条 handoff 任务链记录。
4. 任务链抽屉中应显示 from -> to、状态、depth 和 intent。
5. 转交成功后聊天区应出现 `handoff-inbound` 类型的任务链消息。

## 后续计划

- 用户确认 D4 UI 效果后，继续 D5：
  - 注册 `chat_handoff` 工具。
  - 接入 REQ-TOOL-007/008 工具运行时、审批和审计链。
  - 补工具调用到 handoff 任务链的 TDD。
