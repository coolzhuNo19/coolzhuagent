# 2026-05-20 Goal ready phase dispatch

## 时间

- 开始：2026-05-20 05:31 +08:00
- 完成：2026-05-20 06:20 +08:00

## 需求

- `REQ-GOAL-006` Goal Loop 引擎：先落地最小可审计派发闭环。
- 关联 `REQ-GOAL-010` commander review：派发前复用指挥官审视结果，避免绕过 role 心跳/风险判断。
- 关联 `REQ-WEB-WIN-004` 任务 / 授权 / Goals 窗口：提供人工触发 Dispatch 入口。

## 修改内容

- 后端新增 `POST /api/goals/{goal_id}/dispatch-ready`。
- 新增 `GoalDispatchReadyResponse` 与 `GoalPhaseDispatchDto`，返回已派发、跳过、阻塞原因和本次 commander review。
- `SessionStore::dispatch_ready_goal_phases` 复用 `review_goal_commander_sqlite`：
  - 若 `pause_recommended=true`，不派发，只返回 skipped 与 blocking reasons。
  - 只派发 action 为 `ready_to_dispatch` 的 phase。
  - 使用 commander session 作为 handoff 发起方，目标为 phase 的 `assigned_session_id`。
  - 复用既有 `create_manual_handoff`，保留 handoff gate、inbound message 和 chat handoff 持久化。
  - 派发成功后 phase 状态更新为 `running`，并写入 `goal-phase-dispatched` 事件。
  - `running` / `dispatched` phase 在 commander review 中转为 `monitor_running`，避免重复派发。
- 任务窗口新增 `Dispatch` 按钮：
  - 调用 `/api/goals/{goal_id}/dispatch-ready`。
  - 成功后刷新 goals 与 handoff 摘要。
  - 在聊天区追加 `Goal dispatch` 摘要消息。

## TDD 与验证

- RED：
  - `goal_dispatch_ready_phase_creates_handoff_and_goal_event` 先失败于缺少 `dispatch_ready_goal_phases`。
  - `web_frontend_task_window_can_dispatch_ready_goal_phases` 先约束前端入口。
- GREEN：
  - `cargo test --manifest-path modules/gui-web/packages/web-console/Cargo.toml goal_dispatch_ready_phase_creates_handoff_and_goal_event`
  - `cargo test --manifest-path modules/gui-web/packages/web-console/Cargo.toml web_frontend_task_window_can_dispatch_ready_goal_phases`
- 完整验证：
  - `tmp/run-office-scene-validation.ps1`
  - 结果：`office-scene-cargo-fmt ok`、`office-scene-node-check ok`、`office-scene-d2-contract ok`、`office-scene-web-console-tests ok`、`office-scene-cargo-build ok`。

## 验证备注

- 首次完整验证在沙箱内失败于 semantic dispatch / safe action 测试派生 `powershell.exe`，同一用例非沙箱复跑通过，确认是沙箱对子进程截图 dry-run 的限制。
- 完整验证最终在非沙箱环境通过。
- cargo build 首轮失败于旧 UI 进程占用 `target/debug/coolzhu-web-console.exe`，已停止旧进程后重跑通过。

## 未完成项

- `REQ-GOAL-006` 尚未完成自动 plan -> execute -> verify 循环。
- max_iterations、token 预算、失败/Pause 状态机和 verify 回收仍待后续切片。
- `REQ-GOAL-007` 后台 Goal 与事件流、`REQ-GOAL-009` 诊断/回滚开关仍待开发。
