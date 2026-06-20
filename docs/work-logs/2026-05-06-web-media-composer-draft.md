# 2026-05-06 消息输入草稿恢复

记录时间：2026-05-06 07:40:02 +08:00

## 关联需求

- `REQ-WEB-MEDIA-003`：富文本输入与上传。

## 目标

补齐消息输入卡片的草稿恢复能力，避免用户刷新页面或切换聊天室时丢失未发送文本。

## TDD 过程

红灯：

- 新增 `web_frontend_persists_composer_drafts_per_chat_room` 单测。
- 要求前端具备 `composerDraftKey`、`saveComposerDraft`、`restoreComposerDraft`、`clearComposerDraft`，并使用 `localStorage.setItem`。
- 初始失败日志：`tmp/composer_draft_tdd_red.log`。

绿灯：

- 输入框 `input` 事件自动保存草稿。
- 草稿 key 按聊天室隔离，格式为 `coolzhu.composer.draft.<room_id>`。
- 切换聊天室前保存当前草稿，加载目标聊天室消息后恢复对应草稿。
- 发送成功后清理当前聊天室草稿。

## 修改文件

- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/main.rs`
- `docs/requirements-management.md`

## 验证

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo fmt -p coolzhu-web-console`
- `cargo check -p coolzhu-web-console --offline`
- `cargo test -p coolzhu-web-console --offline`

结果：

- JS 语法检查通过，日志：`tmp/composer_draft_node_check.log`。
- `cargo check` 通过，日志：`tmp/composer_draft_check.log`。
- `cargo test` 通过，114 项测试全部成功，日志：`tmp/composer_draft_test.log`。

## 后续

- `REQ-WEB-MEDIA-003` 仍需补粘贴图片、更加完整的富文本编辑体验。
- `REQ-WEB-MEDIA-005` 仍需继续二进制附件持久化，当前 object URL 只适合当前页面会话内预览。

## 备份

- 本次备份路径：`tmp/backups/web-media-composer-draft-20260506-074038`。
