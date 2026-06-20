# 2026-05-05 REQ-WEB-CHAT-003 引用与转发落地方案

## 范围

本轮按依赖关系继续推进第一梯队 `REQ-WEB-CHAT-003`，依赖上轮 `REQ-MEM-002/004/005` 已提供的 beads query 与 prompt preview 基础。

## 当前状态

- 前端已支持点击消息选中，并把 `selected_message_ids` 随发送请求提交。
- 后端已能从聊天室或 session 历史中按 ID 找到选中消息，并拼接进用户消息。
- 缺口是引用/转发语义不够结构化：前端只有“几条已选历史”，后端只把引用当文本拼接，没有单独沉淀引用/转发记忆。

## 技术方案

1. 后端结构化引用上下文：
   - 新增 `ChatReferenceContext`，包含 selected IDs、实际命中的历史消息、引用摘要、转发提示。
   - `compose_user_message_content` 使用统一摘要，明确引用消息 ID、作者、目标、类型和片段。
   - 如果选中了历史消息并向多个 agent 发送，生成“转发到目标 agent”的结构化记忆 bead。
2. 记忆沉淀：
   - 发送成功后，对每个目标 agent 写入 `kind=chat-room`、`source=chat-room:reference-forward` 的 bead。
   - bead 内容包含聊天室、目标 agent、引用数量和用户意图摘要，后续可被 prompt preview/query 召回。
3. 前端引用预览：
   - 选中消息时在发送框上方显示引用 chip/预览。
   - 提供清除引用按钮，避免与富文本点击冲突。
   - 保持现有点击消息选中机制，不改变富文本链接/图片/视频点击行为。

## 自动化验收

- 后端单测验证：
  - 引用内容包含 message id、作者和片段。
  - 多 agent 目标会生成转发记忆摘要。
  - 只选中历史不输入文本也可通过校验。
- 前端先做 `node --check`，交互视觉效果后续跟 Web-GUI 卡片回归一起看。

## 风险

- 跨聊天室引用暂不开放，只允许当前聊天室或已迁移 session 历史 ID 被后端查到。
- 复杂的“选中文本局部引用”不在本轮做，避免再次影响富文本点击/选中冲突。
