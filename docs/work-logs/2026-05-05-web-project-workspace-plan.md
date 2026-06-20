# 2026-05-05 REQ-WEB-PROJECT-001 工程目录路径切换方案

## 范围

继续推进第一梯队 `REQ-WEB-PROJECT-001`，目标是让工程目录卡片可设置 workspace，并为后续记忆、聊天室和工具权限隔离打基础。

## 当前状态

- 工程目录卡片当前只从 `/api/state` 读取 `workspace` 和 `project_entries`。
- 后端 workspace 使用进程当前目录，不能由 Web-GUI 设置。
- 工具执行、记忆归属和聊天室数据目前没有显式 workspace 边界。

## 本轮技术方案

1. 新增后端 workspace 状态：
   - 提供 `GET /api/workspace` 返回当前 workspace、候选根目录、目录项、权限边界和诊断信息。
   - 提供 `POST /api/workspace` 设置 workspace。
2. 安全边界：
   - 默认允许当前 codex 根目录、桌面 `deepseek/master-project`、桌面 `opencode/master-project`。
   - 可通过 `COOLZHU_ALLOWED_WORKSPACES` 追加允许目录，使用 `;` 分隔。
   - 路径必须存在且是目录，解析后必须落在 allowed root 内。
3. 前端工程目录卡片：
   - 卡片路径可双击进入编辑。
   - Enter 保存，Esc 取消。
   - 保存后刷新目录树和 `/api/state`。
4. 非目标：
   - 本轮不启用真实工具 execute。
   - 本轮不迁移已有会话/记忆数据，只在 API 中暴露 workspace boundary，为后续隔离做准备。

## 自动化验收

- 后端单测覆盖 allowed root 判定、越权路径拒绝、目录扫描。
- `node --check` 验证前端语法。
- `cargo check -p coolzhu-web-console --offline -q`。

## 风险

- Windows 路径 canonicalize 对不存在路径会失败，因此设置路径必须先存在。
- 如果用户后续要允许任意路径，需要交互确认权限策略；默认不放开全盘。
