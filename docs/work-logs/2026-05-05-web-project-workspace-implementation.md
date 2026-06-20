# 2026-05-05 REQ-WEB-PROJECT-001 工程目录路径切换实现日志

## 完成内容

- 后端新增 `/api/workspace`：
  - `GET /api/workspace` 返回当前 workspace、目录项、允许根目录、可写状态、边界状态和提示信息。
  - `POST /api/workspace` 设置当前 workspace。
- 安全边界：
  - 默认允许当前 codex workspace、桌面 `deepseek/master-project`、桌面 `opencode/master-project`。
  - 支持 `COOLZHU_ALLOWED_WORKSPACES` 追加允许根目录，使用 `;` 分隔。
  - 设置路径必须存在、是目录，并且 canonical 路径必须落在 allowed root 内。
- `/api/state` 改为读取 active workspace，并返回对应目录树。
- 前端工程目录卡片：
  - 双击路径进入编辑。
  - Enter 保存，Esc 或 blur 取消。
  - 保存后刷新目录树，并在聊天室中给出结果提示。
- 目录扫描继续隐藏点目录和 `target`。

## 修改文件

- `modules/gui-web/packages/web-console/src/main.rs`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/styles.css`
- `docs/requirements-management.md`

## 验证

- `cargo test -p coolzhu-web-console project_entry --offline`
- `cargo test -p coolzhu-web-console workspace --offline`
- `cargo check -p coolzhu-web-console --offline -q`
- `node --check modules/gui-web/packages/web-console/src/app.js`

## 后续

- 工具真实执行仍保持独立安全闸门，不随 workspace 切换自动放开。
- 会话、记忆、附件数据的 workspace 归属迁移/隔离仍需下一阶段设计。
- 后续 `REQ-DIAG-002` 可把 workspace 越权、不可写、路径不存在等提示接入诊断修复建议。
