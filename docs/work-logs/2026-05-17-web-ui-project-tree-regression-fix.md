# 2026-05-17 Web UI 工程目录树回归修复

## 时间

- 2026-05-17 22:05:17 +08:00

## 背景

用户反馈新 D2 工程目录窗口中目录树显示不正确：目录、文件图标和文件名不再按树状行展示，而是在左侧浏览区域内出现横向散点式错位。

## 原因

排查确认有两个叠加问题：

- `refreshState()` 仍调用旧版 `renderProjectTree(state.project_entries || [])`，在新版 `/api/project/tree` 树渲染完成后，会被旧版扁平列表覆盖。
- 旧版 CSS `.project-tree li { display:flex }` 优先级高于新版 `.project-tree-item { display:grid }`，导致带 children 的树节点被横向 flex 展开，表现为目录层级和文件节点向右散开。

## 修改

- `modules/gui-web/packages/web-console/src/app.js`
  - 移除 `refreshState()` 对 `state.project_entries` 的旧树覆盖。
  - 移除 workspace 保存后的旧树立即渲染，统一由 `refreshWorkspaceBoundState()` 中的 `loadProjectTree()` 重新加载真实 API 树。
  - 将旧 `renderProjectTree(entries)` 入口改为先归一化 legacy entries，再复用 `renderProjectApiTree()`，避免后续误调用再次输出裸 `li`。
- `modules/gui-web/packages/web-console/src/styles.css`
  - 将树节点样式提升为 `.ui-redesign .project-tree .project-tree-item`，确保新版树节点保持纵向 grid 布局。
- `modules/gui-web/packages/web-console/src/main.rs`
  - 补充 `web_frontend_d2_project_window_uses_project_api` 回归断言，防止 `/api/state` 再次覆盖工程树。

## 验证

- `node --check modules\gui-web\packages\web-console\src\app.js`：通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File tmp\check-web-ui-d2-inner-contract.ps1`：通过。
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`：243 passed。
- 重启本地 UI 服务：`http://127.0.0.1:8765/`。
- Edge CDP 截图复核：`tmp/web-ui-project-tree-fixed-1920x1080.png`。
- CDP 布局指标：`.project-tree-item` computed display 均为 `grid`，工程目录节点纵向排列。

## 备份

- 本轮修复完成后创建时间戳备份：`tmp/backups/web-ui-project-tree-fix-20260517-2205-post`。

## 后续

- `REQ-WEB-WIN-001` 仍处于 `测试中`，等待用户对工程目录窗口整体 IDE 布局、文件预览和 Diff View 交互继续确认。
