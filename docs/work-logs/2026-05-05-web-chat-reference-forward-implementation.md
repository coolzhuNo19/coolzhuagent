# 2026-05-05 REQ-WEB-CHAT-003 引用与转发实现日志

## 完成内容

- 后端新增结构化引用上下文：
  - 发送请求中的 `selected_message_ids` 会解析为 `ChatReferenceContext`。
  - 用户 prompt 中加入 `[引用历史消息]` 块，包含 requested/resolved、聊天室、目标 agent、message id、作者、角色、目标、类型和片段。
  - 未命中的历史消息会在引用块中给出 warning，便于排查跨聊天室或过期 ID。
- 后端新增引用/转发记忆沉淀：
  - 发送成功后为每个目标 agent 写入 `source=chat-room:reference-forward`、`kind=chat-room`、`layer=L2` 的 bead。
  - 多目标发送会标记为转发语境，后续可通过 `REQ-MEM` 的 query/prompt preview 被召回。
- 前端新增引用预览：
  - 选中历史消息时，发送框上方展示引用 chip。
  - 新增清除引用按钮。
  - 发送成功、切换聊天室或清除按钮会同步移除选中状态。

## 修改文件

- `modules/gui-web/packages/web-console/src/main.rs`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/styles.css`
- `modules/gui-web/packages/web-console/index.html`
- `docs/requirements-management.md`

## 验证

- `cargo test -p coolzhu-web-console chat --offline`
- `cargo test -p coolzhu-web-console memory --offline`
- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo check -p coolzhu-web-console --offline -q`

## 后续

- 在浏览器 Web-GUI 中手动确认引用 chip 布局、清除按钮和富文本点击互不冲突。
- 后续可补“局部文本引用”和“转发目标选择确认”，但这类交互暂不进入本轮自动化范围。
