# 2026-05-15 REQ-WEB-SESSION-007 Phase B：聊天室删除/重命名与附件 GC

时间：2026-05-15 01:26-02:08  
范围：`REQ-WEB-SESSION-007`、`REQ-MEM-006`  
备份：
- `tmp/backups/20260515-012637-session-cascade-phase-b/`
- `tmp/backups/20260515-014027-session-delete-frontend/`

## 本轮目标

优先闭环会话/记忆数据边界中最容易导致数据漂移的部分：

- `memory_beads.origin_message_id / origin_table / token_count` 必须真实落 SQLite。
- `attachment_refs` 必须随消息落库，作为附件 GC 的可靠索引。
- 聊天室删除从 in-memory retain + 全表重写，切换为 SQL transaction `DELETE`。
- Web UI 同时补齐聊天室删除和重命名入口；删除前必须显示影响范围确认。

## 修改内容

### 后端

- `modules/gui-web/packages/web-console/src/main.rs`
  - `save_session_state_to_sqlite` 写入 `memory_beads` 的 origin/token 新列。
  - 新增 `persist_attachment_refs`，对本地 `/api/attachments/files/*` 附件建立 `attachment_refs` 记录。
  - 新增 `attachment_file_name_from_url`，只接受本地附件 API 生成的安全文件名。
  - `delete_chat_room`、`delete_chat_room_message`、`delete_session_message` 改为先同步 SQLite，再执行事务级 SQL `DELETE`；由 FK/trigger 级联删除消息与衍生 beads。
  - 新增附件 GC：删除消息前收集候选附件名，删引用后只移除无剩余引用的文件。
  - `/api/chat/rooms/{room_id}` 新增 `PATCH`，支持聊天室重命名。
  - `/api/chat/rooms/{room_id}/impact` 增加 `affected_attachments`。

### 前端

- `modules/gui-web/packages/web-console/index.html`
  - 聊天室工具区新增 `重命名聊天室`、`删除聊天室`。
- `modules/gui-web/packages/web-console/src/app.js`
  - 新增 `renameSelectedChatRoom()`：`PATCH /api/chat/rooms/{room_id}` 后刷新当前聊天室标题和下拉项。
  - 新增 `deleteSelectedChatRoom()`：先 `GET /impact`，用确认框展示消息、衍生记忆、附件影响范围，再 `DELETE /api/chat/rooms/{room_id}` 并刷新房间列表和消息区。
  - 新增 `deleteSelectedMessages()`：删除已选历史消息前确认，逐条调用 `DELETE /api/chat/rooms/{room_id}/messages/{message_id}`，删除后刷新消息区与 beads。
  - 新增 `renderMemoryBeadList()` / `onMemoryBeadListClick()`：在会话卡片展示最多 4 条显式 beads，单条删除前确认，调用 `DELETE /api/sessions/{session_id}/beads/{bead_id}`。
- `modules/gui-web/packages/web-console/src/styles.css`
  - 新增 `memory-bead-list` / `memory-bead-item` 紧凑样式，避免会话卡片内文字溢出。

## TDD 与验证

- RED：`tmp/logs/session-cascade-red-origin-attachment-20260515.log`
  - 证明 SQLite 往返后 `origin_message_id` 丢失。
- GREEN：
  - `tmp/logs/session-cascade-green-origin-attachment-20260515.log`
  - `tmp/logs/session-room-management-targeted-20260515.log`
  - `tmp/logs/session-cascade-sql-gc-tests-20260515-r2.log`
  - `tmp/logs/session-room-frontend-contract-20260515.log`
  - `tmp/logs/session-cascade-origin-attachment-retain-20260515-r2.log`
- 格式和脚本检查：
  - `tmp/logs/session-room-management-cargo-fmt-20260515.log`
  - `tmp/logs/session-room-management-node-check-20260515.log`
  - `tmp/logs/session-message-delete-cargo-fmt-20260515.log`
  - `tmp/logs/session-bead-delete-node-check-after-20260515.log`
- 全量回归：
  - `tmp/logs/session-room-management-web-console-full-20260515.log`
  - `tmp/logs/session-management-web-console-full-r3-20260515.log`
  - `cargo test -p coolzhu-web-console --offline -- --test-threads=1`：211 passed

## 需求状态

- `REQ-MEM-006`：已完成。
- `REQ-WEB-SESSION-007`：已完成。
  - 已完成：origin/token 持久化、事务化聊天室/消息删除、trigger 级联、附件 GC、聊天室删除确认、聊天室重命名、所选消息删除确认、bead 单条删除确认。
  - 仍建议后续真实 UI 走查：在浏览器中确认原生 prompt/confirm 能被 Tauri WebView 正常弹出。

## 风险与注意

- 附件 GC 只处理由 `/api/attachments/files/*` 管理的本地附件 URL，外部 URL 不会进入引用索引，也不会被删除。
- 删除报告中的 `deleted_attachments` 表示实际从文件系统删除的无引用附件数，不等同于删除消息中出现过的附件引用数。
- 当前 UI 使用浏览器原生 `prompt/confirm` 做最小闭环；后续可以替换为像素风一致的自定义 dialog，但不阻塞数据安全闭环。
