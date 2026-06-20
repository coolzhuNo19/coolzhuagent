# 2026-05-17 Web UI D2 P0 工程目录与聊天室窗口落地

## 时间

- 开始：2026-05-17 10:25
- 更新：2026-05-17 15:38

## 关联需求

- `REQ-WEB-UI-010` Web GUI 16:9 多窗口重构
- `REQ-WEB-WIN-001` 工程目录 / IDE 独立窗口
- `REQ-WEB-WIN-003` 聊天室独立窗口

## 本次变更

1. 工程目录后端只读 API
   - 新增 `GET /api/project/tree`
   - 新增 `GET /api/project/file/meta`
   - 新增 `GET /api/project/file`
   - 新增 `GET /api/project/diff`
   - 路径均受当前 workspace 限制，拒绝 `..`、根路径、盘符和 workspace 越界。
   - 文件预览限制大小并区分二进制，diff 使用受限 git 命令、超时和输出截断。

2. 工程目录窗口前端接入
   - `project` 窗口接入真实目录树、文件预览、worktree diff。
   - 目录点击可切换树根，文件点击可加载文本预览。
   - workspace 切换时清空工程目录选中文件状态。

3. 聊天室窗口
   - 消息列表增加独立 `data-role="chat-message-list"`。
   - 一次加载保留 80 条消息，窗口契约锁定至少 50 行可读区域。
   - composer 固定在窗口底部，消息区独立滚动。

4. 视觉回归修复
   - 移除展开窗口内部重复的竖向标题条。
   - 只保留左侧 dock 作为窗口标题栏，避免中间出现黄色竖状“聊天室”条。
   - 标题文本改为从左到右水平显示，禁止 `writing-mode: vertical-rl` 回归。

## 修改文件

- `modules/gui-web/packages/web-console/src/main.rs`
- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/styles.css`
- `docs/requirements-management.md`

## 验证

- `node --check modules/gui-web/packages/web-console/src/app.js`：通过
- `cargo fmt -p coolzhu-web-console --check`：通过
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`：243 passed
- API smoke：
  - `GET /api/project/tree?depth=3&limit=200`：200
  - 基于当前 workspace 返回的首个文件调用 `GET /api/project/file/meta?path=...`：200
- 运行预览：
  - `http://127.0.0.1:8765/`
  - 截图：`tmp/web-win-remove-inner-title-1920x1080.png`

## 备份

- 预修改备份：`tmp/backups/web-ui-d2-chat-p0-20260517-1025-pre`
- 标题方向修复前备份：`tmp/backups/web-ui-d2-title-direction-20260517-1038-pre`
- 移除内部竖标题前备份：`tmp/backups/web-ui-d2-remove-inner-title-20260517-1445-pre`
- 修改后备份：`tmp/backups/web-ui-d2-p0-project-chat-20260517-1538-post`

## 当前状态

- `REQ-WEB-WIN-001`：测试中
- `REQ-WEB-WIN-003`：测试中
- `REQ-WEB-UI-010`：开发中

## 待人工确认

1. 下区左侧 dock 标题是否符合当前设计图节奏。
2. 聊天室窗口移除内部竖标题条后，是否满足视觉确认。
3. 工程目录窗口点击文件、预览文本、查看 diff 的交互手感是否满足后续 IDE 化设计预期。
