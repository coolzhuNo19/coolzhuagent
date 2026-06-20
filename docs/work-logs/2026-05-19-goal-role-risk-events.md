# 2026-05-19 Goal 角色风险事件与任务窗口摘要

## 背景

上一轮已完成 Goal role / commander / heartbeat 第一阶段：每个会话可配置角色、责任规则、指挥官标记、心跳超时和任务超时。本轮继续推进 `REQ-GOAL-010`，目标是让角色在线/卡住状态不只停留在设置窗口，而是进入 Goal 审计事件和任务 / 授权窗口。

## 实现内容

### 后端

修改文件：`modules/gui-web/packages/web-console/src/main.rs`

- 新增 `assess_goal_role_risks_sqlite(path, workspace_id, sessions)`。
- `/api/goals/roles`、`POST /api/goals/roles/{session_id}`、`POST /api/goals/roles/{session_id}/heartbeat` 改为调用风险评估函数。
- 当 role `risk_level != normal` 时：
  - 查询当前 workspace 下非终态 Goal。
  - 向 `goal_events` 写入 `event_type = goal-role-risk`。
  - payload 包含 `session_id`、`display_name`、`role`、`risk_level`、`online`、`stuck`、timeout 和建议动作。
  - 同一个 goal / session / risk_level 只写入一条事件，避免前端刷新导致事件刷屏。

### 前端

修改文件：

- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/styles.css`

实现内容：

- 任务 / 授权窗口右侧新增 `Role risks` 摘要卡片。
- 新增 `taskRenderGoalRoleRisks()`，从 `/api/goals/roles` 响应中过滤 `risk_level != normal` 的角色。
- `taskRefreshWindow()` 会刷新 role risks。
- `loadGoalRoles()` 同步刷新设置窗口表单和任务窗口风险摘要。
- workspace 切换时清空 role risk UI，避免旧 workspace 状态残留。

## TDD

### RED

- `goal_role_risk_assessment_writes_deduped_goal_event`
  - 首次运行失败：缺少 `assess_goal_role_risks_sqlite`。
  - 日志：`tmp/logs/goal-role-risk-red-backend.log`、`tmp/logs/goal-role-risk-red-backend.err.log`
- `web_frontend_task_window_shows_goal_role_risk_summary`
  - 受后端缺失函数影响，编译阶段失败；测试意图为任务窗口必须包含 role risk list、渲染函数和 CSS。
  - 日志：`tmp/logs/goal-role-risk-red-frontend.log`、`tmp/logs/goal-role-risk-red-frontend.err.log`

### GREEN

- 脚本：`tmp/run-goal-role-risk-validation.ps1`
- 汇总日志：`tmp/logs/goal-role-risk-validation.20260519-082054.summary.log`
- 结果：
  - `node --check modules/gui-web/packages/web-console/src/app.js` PASS
  - `goal_role_risk_assessment_writes_deduped_goal_event` PASS
  - `web_frontend_task_window_shows_goal_role_risk_summary` PASS

### 全量验证

- 脚本：`tmp/run-office-scene-validation.ps1`
- 第一次 `cargo build` 因调试 UI 占用 `target/debug/coolzhu-web-console.exe` 失败，错误为 Windows 拒绝覆盖 exe，非代码错误。
- 停止本轮调试进程后重跑通过：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`，257 passed
  - `office-scene-cargo-build ok`

## 备份

- 修改前备份：`tmp/backups/goal-role-risk-events-20260519-075950-pre`

## 后续事项

1. `REQ-GOAL-004`：自动创建 `goal-<role>` session，补 system prompt / role template。
2. `REQ-GOAL-010`：commander 审视 phase 完成情况、根据 role risk 暂停/转派 phase。
3. `REQ-TOOL-013`：完全访问权限显式授权开关，含风险提示、TTL、撤销和审计。
