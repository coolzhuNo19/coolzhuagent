# 2026-05-06 消息输入粘贴图片附件

记录时间：2026-05-06 07:42:49 +08:00

## 关联需求

- `REQ-WEB-MEDIA-003`：富文本输入与上传。
- `REQ-WEB-MEDIA-005`：消息发送文件按钮。

## 目标

让用户可以直接在消息输入框中粘贴剪贴板图片，并作为待发送附件进入现有附件 chip 和消息发送元数据链路。

## TDD 过程

红灯：

- 新增 `web_frontend_accepts_pasted_image_attachments` 单测。
- 要求前端存在 `onComposerPaste`、读取 `event.clipboardData`、标记 `pasted-image` 来源，并复用 `attachmentFromFile`。
- 初始失败日志：`tmp/composer_paste_image_tdd_red.log`。

绿灯：

- 输入框监听 `paste` 事件。
- 从剪贴板 `DataTransferItem` 中筛选 `image/*` 文件。
- 生成 `pasted-image-<timestamp>-<index>.<ext>` 名称和 object URL 附件。
- 复用附件 chip 展示和发送 payload 元数据。

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

- JS 语法检查通过，日志：`tmp/composer_paste_image_node_check.log`。
- `cargo check` 通过，日志：`tmp/composer_paste_image_check.log`。
- `cargo test` 通过，115 项测试全部成功，日志：`tmp/composer_paste_image_test.log`。

## 后续

- 当前粘贴图片仍使用 object URL，刷新后不会保留二进制内容。
- 下一步应推进 `REQ-WEB-MEDIA-005` 的附件二进制持久化：上传到本地附件目录并返回稳定 URL。

## 备份

- 本次备份路径：`tmp/backups/web-media-paste-image-20260506-074325`。
