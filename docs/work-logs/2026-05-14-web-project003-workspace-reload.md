# 2026-05-14 REQ-WEB-PROJECT-003 Workspace Reload

时间：2026-05-14 00:16:18 +08:00

## 背景

当前需求优先级进入会话 / workspace 数据边界组。`REQ-WEB-PROJECT-003` 的缺口是工程目录切换后，workspace config、session store、附件目录、审计路径需要同步随动，避免不同 workspace 的会话和数据串用。

## 初始修改范围

- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增 `POST /api/workspace/reload`。
  - 新增 `reload_workspace_scope(workspace)`，在同一入口内重载 workspace config 并替换 active `SessionStore`。
  - 新增 `WorkspaceScopePaths` 和 `workspace_scope_paths_for`，统一派生 session sqlite、legacy json、附件目录、工具审计日志路径。
  - 新增 `SessionStore::load_for_workspace`，按目标 workspace + config 加载独立 store。
  - `default_session_sqlite_path`、`default_session_store_path`、`attachment_store_dir`、`tool_audit_log_path` 改走统一 scope path 派生，保留测试环境变量覆盖。

## 初始 TDD 记录

新增测试：

- `workspace_scope_paths_follow_workspace_and_config`
  - 验证相对配置路径会落到目标 workspace 下。
  - 验证 audit path 随 session db 所在目录派生。
- `session_store_load_for_workspace_keeps_workspaces_isolated`
  - 在 ws-A 写入会话后，ws-B 加载不到该会话。
  - 验证两个 store 的 sqlite path 分别位于各自 workspace。

红灯日志：

- `tmp/logs/web-project003-tdd-red-20260513.log`

## 初始验证

- `cargo fmt --all`
  - 日志：`tmp/logs/cargo-fmt-web-project003-20260514.log`
- `cargo test -p coolzhu-web-console workspace_scope_paths_follow_workspace_and_config --offline`
  - 日志：`tmp/logs/web-project003-scope-paths-test-20260514.log`
- `cargo test -p coolzhu-web-console session_store_load_for_workspace_keeps_workspaces_isolated --offline`
  - 日志：`tmp/logs/web-project003-session-isolation-test-20260514.log`
- `cargo test -p coolzhu-web-console workspace --offline`
  - 日志：`tmp/logs/web-project003-workspace-group-20260514.log`
- `cargo test -p coolzhu-web-console attachment_store_dir --offline`
  - 日志：`tmp/logs/web-project003-attachment-group-20260514.log`
- `cargo test -p coolzhu-web-console tool_audit --offline`
  - 日志：`tmp/logs/web-project003-audit-group-20260514.log`
- `cargo test -p coolzhu-web-console --offline`
  - `198 passed`
  - 日志：`tmp/logs/web-project003-web-console-full-20260514.log`

## 交互复测反馈修复

时间：2026-05-14 00:47:30 +08:00

用户复测确认工程目录显示正常、会话配置保存后显示正常，但发现两个前端状态未随 workspace 切换：

- 消息发送选择对象仍保留旧目录下的会话配置。
- 聊天室聊天内容仍显示旧目录下的聊天记录。

修复范围：

- `modules/gui-web/packages/web-console/src/app.js`
  - 新增 `refreshWorkspaceBoundState(workspace)`，在工程目录保存成功后统一刷新 workspace-bound 前端状态。
  - 新增 `resetWorkspaceBoundUiState(workspace)`，切目录时先清空旧 `agentRegistry`、`sessionRegistry`、`chatRoomRegistry`、`activeSessionId`、`activeChatRoomId`、选中历史、附件和消息 DOM。
  - 切目录后重新拉取 `loadSessions()`、`loadAgents()`、`loadChatRooms()`、`loadToolsCatalog()`、`refreshToolAudit()`，确保发送对象、聊天室列表和聊天内容来自新 workspace。
  - 新增 `clearChatMessagesUi()`，无聊天室或刷新前先清空旧聊天记录和分页状态。
  - `composerDraftKey` 加入 `composerDraftWorkspaceKey(workspace)`，避免相同 room id 在不同 workspace 间串用草稿。
  - `setSessionForm(null)` 现在会清空旧表单值，避免新 workspace 暂无会话时仍显示旧会话字段。
- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增 `web_frontend_refreshes_workspace_bound_state_after_workspace_switch` 前端静态契约测试。

TDD / 验证记录：

- 红灯：`tmp/logs/web-project003-frontend-refresh-tdd-red-20260514.log`
- JS 语法：`tmp/logs/web-project003-frontend-refresh-node-check-20260514.log`
- 契约绿灯：`tmp/logs/web-project003-frontend-refresh-tdd-green-20260514.log`
- 格式化：`tmp/logs/web-project003-frontend-refresh-cargo-fmt-20260514.log`
- Scope path：`tmp/logs/web-project003-frontend-refresh-scope-paths-20260514.log`
- Session isolation：`tmp/logs/web-project003-frontend-refresh-session-isolation-20260514.log`
- Chat room 分组：`tmp/logs/web-project003-frontend-refresh-chat-room-group-20260514.log`
- Session store 分组：`tmp/logs/web-project003-frontend-refresh-session-store-group-20260514.log`
- Web frontend 分组：`tmp/logs/web-project003-frontend-refresh-web-frontend-group-20260514.log`
- 全量：`tmp/logs/web-project003-frontend-refresh-full-20260514.log`，`199 passed`

## 需求状态

- `REQ-WEB-PROJECT-003`：`开发中 -> 待交互验证`。
- 交互反馈修复后继续保持 `待交互验证`，等待用户确认发送对象和聊天室内容是否已跟随 workspace 切换刷新。

## 备份

- 预备份：`tmp/backups/web-project003-workspace-reload-20260513-2030-pre/`
- 初始修改后备份：`tmp/backups/web-project003-workspace-reload-20260514-0018-post/`
- 交互反馈修复前备份：`tmp/backups/web-project003-frontend-refresh-20260514-0040-pre/`

## 待人工确认

1. 在 Web-GUI 工程目录卡片中切换到新 workspace。
2. 确认工程目录卡片显示为新路径，目录树刷新。
3. 确认底部“发送给”选择对象只显示新 workspace 下的会话配置。
4. 确认中间聊天室聊天内容只显示新 workspace 下的聊天记录。
5. 新建或保存一个 Agent 会话后，确认发送对象下拉同步刷新。
6. 切回旧 workspace，确认旧 workspace 的会话和聊天记录仍在，且没有混入新 workspace 内容。

## 人工复测结果

时间：2026-05-14 01:10:00 +08:00

用户确认测试 PASS：

- 工程目录切换显示正常。
- 会话配置保存后显示正常。
- 消息发送选择对象已随当前 workspace 刷新。
- 聊天室聊天内容已随当前 workspace 刷新。

结论：

- `REQ-WEB-PROJECT-003` 从 `待交互验证` 更新为 `已完成`。
