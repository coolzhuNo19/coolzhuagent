# 2026-05-19 Goal G1 契约持久化与任务窗口接入

## 背景

用户要求在记忆管理和工具治理后继续推进后端功能接入前端。`REQ-GOAL-001~009` 此前只有任务 / 授权 / Goals 窗口占位，本轮先按 TDD 推进最低风险的 G1：Goal 契约、状态与持久化。该阶段只做 CRUD/cancel 和列表展示，不启动自主 Goal Loop，不触发真实工具执行。

## 修改内容

1. 后端新增 Goal G1 HTTP API：
   - `GET /api/goals?limit=30`
   - `POST /api/goals`
   - `GET /api/goals/{goal_id}`
   - `POST /api/goals/{goal_id}/cancel`

2. SQLite schema 升级到 v4：
   - `goals`
   - `goal_phases`
   - `goal_events`
   - goal 按 `workspace_id` 隔离；`goal_phases` 与 `goal_events` 预留给后续 `REQ-GOAL-002/003/007`。

3. 数据契约：
   - `GoalDto`
   - `GoalPhaseDto`
   - `GoalEventDto`
   - `GoalListResponse`
   - `GoalDetailResponse`
   - `GoalMutationResponse`
   - 默认 `completion_condition` 为 `{ "type": "UserConfirm" }`。

4. 前端任务 / 授权 / Goals 窗口：
   - Goals 区从静态占位改为真实 `/api/goals` 列表。
   - 新增 create 输入框与按钮。
   - 新增 cancel 按钮；completed/cancelled 状态禁用。
   - workspace 切换时刷新 Goals 列表。
   - 修复接入后 Create 按钮被 grid 拉伸成竖条的问题。

5. TDD / 静态契约：
   - 新增 `goal_g1_sqlite_crud_is_workspace_scoped_and_cancelable`，验证 create/query/workspace 隔离/cancel/event。
   - 新增 `web_frontend_task_window_connects_goal_g1_api`，锁定 Goals DOM、`/api/goals`、cancel API、前端渲染函数与 CSS。

## 验证

执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-office-scene-validation.ps1
```

结果：

- `office-scene-cargo-fmt ok`
- `office-scene-node-check ok`
- `office-scene-d2-contract ok`
- `office-scene-web-console-tests ok`
- `office-scene-cargo-build ok`
- `office scene validation completed`

执行截图 / DOM 验证：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-goal-window-capture.ps1
```

结果：

- 截图：`tmp/web-ui-goal-window-1920x1080.png`
- `active=tasks`
- `apiGoalCount=0`
- `createInput=true`
- `createButton=true`
- `goalCountText=0`
- `hasGoalUiContent=true`

说明：为避免污染用户真实 workspace，CDP 截图只执行 `/api/goals` 只读查询和 DOM 确认；创建/取消闭环由临时 SQLite TDD 覆盖。

## 需求状态

- `REQ-GOAL-001`：`待开发` -> `测试中`
- `REQ-WEB-WIN-004`：保持 `测试中`，备注更新为 Goals 区已接真实列表与 create/cancel 入口。
- 下一步：继续 `REQ-GOAL-002` CompletionCondition DSL 与 `REQ-GOAL-003` GoalPlan / Phase DAG。

## 备份

- 修改前备份：`tmp/backups/goal-g1-crud-20260519-003714-pre`
- 修改后备份：`tmp/backups/goal-g1-crud-20260519-020113-post`
