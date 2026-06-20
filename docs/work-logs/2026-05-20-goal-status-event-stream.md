# 2026-05-20 Goal status controls and event stream

## 时间

- 开始：2026-05-20 06:40 +08:00
- 完成：2026-05-20 07:09 +08:00

## 需求

- `REQ-GOAL-007` 后台 Goal 与事件流：补齐 status / pause / resume 控制面，并建立独立 Goal SSE 事件通道。
- 关联 `REQ-WEB-WIN-004` 任务 / 授权 / Goals 窗口：给人工验证和下一阶段 Goal Loop 提供手动状态控制入口。

## 修改内容

- 后端新增 API：
  - `GET /api/goals/{goal_id}/status`
  - `POST /api/goals/{goal_id}/pause`
  - `POST /api/goals/{goal_id}/resume`
  - `GET /api/goals/{goal_id}/events`
- 新增 `GoalStatusResponse` 与 `GoalPhaseStatusCounts`，返回 goal 当前状态、phase 计数、最新事件和 pause/resume/cancel 可用性。
- `pause_goal_sqlite` / `resume_goal_sqlite` 写入 `goal-paused` / `goal-resumed` 事件；resume 会按 phase 状态恢复为 `running` 或 `planning`。
- `insert_goal_event_connection` 在 SQLite 落库成功后广播到独立 `goal_event_bus`，避免混入 ToolEvent。
- Goal SSE 首包发送 `hello` 和最近事件，随后按 `goal_id` 过滤推送新事件；lagged 时推送 `lagged` 事件。
- 任务窗口 Goals 区新增 `Status`、`Pause`、`Resume` 按钮。
- 前端为当前列表内的 goal 建立 EventSource：`/api/goals/{goal_id}/events`，收到 goal 事件后 debounce 刷新 Goals 列表。
- 工作区切换时关闭旧 Goal EventSource，避免跨 workspace 残留订阅。

## TDD 与验证

- RED：
  - `goal_status_pause_resume_round_trips_and_writes_events` 先失败于缺少 `goal_status_sqlite` / `pause_goal_sqlite` / `resume_goal_sqlite`。
  - `goal_event_bus_broadcasts_goal_events_on_insert` 先失败于缺少 `subscribe_goal_events`。
  - 前端静态契约测试先约束 Status/Pause/Resume 和 EventSource 入口。
- GREEN：
  - `tmp/run-goal-status-controls-tests.ps1 -TimeoutSeconds 240`
  - 结果：4 个目标用例均通过。

## 未完成项

- `REQ-GOAL-007` 仍需等 `REQ-GOAL-006` 自动 loop 落地后补充运行期事件：`phase-started`、`phase-completed`、`failed`、`completed`、`iteration`。
- `REQ-GOAL-009` 仍需将 goal 内工具调用、handoff、phase 状态变更整理为统一审计视图与禁用开关。
