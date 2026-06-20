# 2026-05-06 REQ-WEB-MEDIA-003/005 附件持久化完成

## 时间

- 记录时间：2026-05-06 07:56:45 +08:00
- 需求状态：`REQ-WEB-MEDIA-003`、`REQ-WEB-MEDIA-005` 更新为已完成

## 本次目标

- 继续推进 `REQ-WEB-MEDIA-003` 富文本输入与上传。
- 继续推进 `REQ-WEB-MEDIA-005` 消息发送文件按钮。
- 补齐此前遗留的二进制附件持久化，使文件选择和粘贴图片不再只依赖浏览器 object URL。

## 修改内容

- 后端新增 `POST /api/attachments/upload`，接收 multipart 表单中的 `file`、`name`、`kind`、`mime_type` 等字段。
- 后端新增 `GET /api/attachments/files/{file_name}`，仅服务上传接口生成的安全文件名。
- 上传文件默认保存到 `.coolzhu/attachments`，也可通过 `COOLZHU_WEB_ATTACHMENT_STORE` 覆盖存储目录。
- 单文件上传上限设为 32 MiB；文件名会去除路径片段并转为安全文件名，消息展示名保留原始文件名。
- 前端发送消息前会先执行 `uploadComposerAttachments()`，将本地选择文件和剪贴板图片上传为稳定附件 URL。
- 消息 payload 只携带后端返回的附件 DTO，不再把 `File`、`object URL`、`source` 等浏览器本地字段写入消息。
- 静态文件 Content-Type 补充 `mp3`、`wav`、`ogg`、`m4a`，便于持久化音频附件预览。
- 更新 `docs/requirements-management.md` 和 `modules/gui-web/INTERFACE.md`。

## TDD 记录

- Red：`tmp/web_media_attachment_tdd_red.log`，先新增测试并确认缺少附件文件名清洗、上传响应构造和前端上传链路。
- Green：`tmp/web_media_attachment_test_1.log`，实现上传/持久化后测试通过。
- Final：`tmp/web_media_attachment_node_check_final.log`、`tmp/web_media_attachment_check_final.log`、`tmp/web_media_attachment_test_final.log`。

## 自动验证

- `node --check modules\gui-web\packages\web-console\src\app.js`：通过。
- `cargo fmt -p coolzhu-web-console`：通过。
- `cargo check -p coolzhu-web-console --offline`：通过。
- `cargo test -p coolzhu-web-console --offline`：118 passed。

## 风险与后续人工确认

- 当前上传实现会在后端一次性读取单文件，32 MiB 以上文件会拒绝；如后续要支持大文件，需要改为流式写入和分片进度。
- 本轮未启动浏览器做真实文件选择/粘贴交互截图；人工确认可启动 Web 控制台，选择一个图片和一个音频文件发送，刷新后点击消息附件，确认 URL 仍可访问且附件索引可检索。
