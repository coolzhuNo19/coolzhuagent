# 2026-05-18 任务 / 授权窗口 Protected Rules 接入

## 时间

- 开始：2026-05-18 08:12
- 闭环：2026-05-18 08:20

## 关联需求

- `REQ-WEB-WIN-004`：任务 / 授权 / Goals 独立窗口
- `REQ-TOOL-008`：工具权限分级审批
- `REQ-TOOL-010`：Protected 路径规则表

## 修改内容

- 任务 / 授权窗口新增 `Protected rules` 区域。
- 前端接入 `GET /api/tools/protected-paths`，显示当前生效规则：
  - rule id
  - glob
  - access
- Pending approval 列表新增 `match` 字段，展示 `permission.protected_match`，便于用户判断审批触发原因。
- workspace 切换刷新流程补充 Protected rules 刷新。
- 新增静态契约测试：
  - `web_frontend_task_window_shows_protected_path_rules`
- 新增 Edge CDP 截图脚本：
  - `tmp/capture-task-window-cdp.mjs`
  - `tmp/run-task-window-capture.ps1`

## 验证结果

- `tmp/run-office-scene-validation.ps1`：通过
  - `cargo fmt --package coolzhu-web-console`
  - `node --check modules\gui-web\packages\web-console\src\app.js`
  - `tmp\check-web-ui-d2-inner-contract.ps1`
  - `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`
  - `cargo build -p coolzhu-web-console --offline`
- UI 启动：`tmp/start-office-scene-ui.ps1`，PID `2596`
- Edge CDP 截图：`tmp/web-ui-task-window-1920x1080.png`
- 截图采集指标：
  - active window = `tasks`
  - protectedCount = `5`
  - firstRule = `coolzhu-config / **/coolzhu.toml / any`

## 备份

- 修改前备份：`tmp/backups/web-task-protected-rules-20260518-081230-pre`
- 修改后备份：`tmp/backups/web-task-protected-rules-20260518-082648-post`
