# 2026-05-20 Goal Commander Review 与暂停建议

## 背景

继续推进 P0 `REQ-GOAL-010`。上一轮已经完成 commander 配置、角色心跳、online/stuck 风险识别和 Role risks 摘要；`REQ-GOAL-004` 也已补齐 phase `assigned_role -> goal-<role>` 会话目标解析。本轮目标是让 commander 能对一个 Goal 的 phase 状态做后端审视，输出暂停建议和可审计事件，但不启动自动 Goal Loop。

## 本次变更

- 新增 `POST /api/goals/{goal_id}/commander/review`。
- 新增 `GoalCommanderReviewResponse`：
  - `commander_session_id`
  - `pause_recommended`
  - `blocking_reasons`
  - `phase_reviews`
  - `generated_at`
- 每个 phase review 输出：
  - phase id/title/status
  - assigned role
  - assigned `goal-<role>` session id
  - target session available
  - role risk level
  - action / reason
- 规则：
  - 缺少 commander 配置：建议暂停。
  - phase 已完成：`review_completed`。
  - phase 目标 `goal-<role>` 会话缺失：`blocked_missing_role_session`，建议暂停。
  - role risk 为 `stuck`：`blocked_role_stuck`，建议暂停或转派。
  - role risk 为 `offline`：`blocked_role_offline`，建议暂停确认心跳。
  - 依赖 phase 未完成：`wait_dependency`，不作为风险阻塞。
  - 其余 pending phase：`ready_to_dispatch`。
- 每次 review 写入 `goal_events`：
  - event_type: `goal-commander-review`
  - payload 包含 pause flag、blocking reasons 和 phase reviews。
- 任务 / 授权窗口 Goal 卡片新增 `Review` 按钮，调用 commander review API，并把摘要写入聊天消息流。

## TDD 记录

1. RED
   - 命令：`cargo test -p coolzhu-web-console goal_commander_review_recommends_pause_for_missing_or_risky_phase_targets`
   - 日志：`tmp/logs/goal-commander-review.red.20260520.log`
   - 失败原因符合预期：`review_goal_commander_sqlite` 尚不存在。

2. GREEN
   - 命令：`cargo test -p coolzhu-web-console goal_commander_review_recommends_pause_for_missing_or_risky_phase_targets`
   - 日志：`tmp/logs/goal-commander-review.green.20260520.log`
   - 结果：1 passed。

3. 前端契约
   - 命令：`cargo test -p coolzhu-web-console web_frontend_task_window_can_request_goal_commander_review`
   - 日志：`tmp/logs/goal-commander-review-ui.green.20260520.log`
   - 结果：1 passed。

## 完整验证

- 命令：`powershell -ExecutionPolicy Bypass -File tmp/run-office-scene-validation.ps1`
- 日志：`tmp/logs/office-scene-validation.goal-commander-review.20260520.log`
- 结果：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`
  - `office-scene-cargo-build ok`

## 备份

- 变更前：`tmp/backups/goal-commander-review-20260520-042500-pre`
- 变更后：`tmp/backups/goal-commander-review-20260520-043600-post`

## 后续

1. `REQ-GOAL-006`：根据 commander review 的 `ready_to_dispatch` phase 通过 `chat_handoff` 或后续 goal-loop executor 真正投递。
2. `REQ-GOAL-010`：补自动暂停状态写入和重新分配建议策略。
3. `REQ-TOOL-013`：完全访问权限显式 TTL 开关。
