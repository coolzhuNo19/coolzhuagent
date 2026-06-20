# 2026-05-20 Goal Phase 角色会话目标解析

## 背景

继续推进 `REQ-GOAL-004`。上一轮已完成 Goal role 配置、commander/heartbeat/risk、`goal-<role>` session bootstrap。本轮补齐 phase 层面的分发前置能力：GoalPlan 中的 `assigned_role` 需要能解析到确定性的 `goal-<role>` 会话，供后续 `REQ-GOAL-006` Goal Loop / handoff 投递复用。

## 本次变更

- `GoalPhaseDto` 增加：
  - `assigned_session_id`
  - `assigned_session_display_name`
  - `assigned_session_available`
- 后端查询 Goal phases 时读取 `sessions` 表中 `goal-%` 会话，并按 `assigned_role -> goal-<role>` 解析目标。
- 对已 bootstrap 的角色返回 `assigned_session_available=true` 和会话显示名。
- 对尚未 bootstrap 的角色仍返回确定性 `assigned_session_id`，但标记 `assigned_session_available=false`，便于任务窗口和 commander 发现缺口。
- 任务 / 授权窗口 Goal 列表新增 phase target 明细：
  - 显示 phase 标题、状态、角色目标。
  - ready/missing 用样式区分。
- `REQ-GOAL-004` 在需求管理文档中从 `开发中` 更新为 `测试中`；真实自动执行/投递仍归 `REQ-GOAL-006`。

## TDD 记录

1. RED
   - 命令：`cargo test -p coolzhu-web-console goal_plan_phases_resolve_assigned_role_to_bootstrapped_session`
   - 日志：`tmp/logs/goal-phase-role-resolution.red.20260520-continue.log`
   - 失败原因符合预期：`GoalPhaseDto` 缺少 `assigned_session_id` / `assigned_session_available` / `assigned_session_display_name` 字段。

2. GREEN
   - 命令：`cargo test -p coolzhu-web-console goal_plan_phases_resolve_assigned_role_to_bootstrapped_session`
   - 日志：`tmp/logs/goal-phase-role-resolution.green.20260520-continue.log`
   - 结果：1 passed。

3. 前端契约
   - 命令：`cargo test -p coolzhu-web-console web_frontend_task_window_shows_goal_phase_role_targets`
   - 日志：`tmp/logs/goal-phase-role-ui.green.20260520-continue.log`
   - 结果：1 passed。

## 完整验证

- 命令：`powershell -ExecutionPolicy Bypass -File tmp/run-office-scene-validation.ps1`
- 日志：`tmp/logs/office-scene-validation.goal-phase-role.20260520.log`
- 结果：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`
  - `office-scene-cargo-build ok`

## 备份

- 变更前：`tmp/backups/goal-phase-role-resolution-20260520-035917-pre`
- 变更后：`tmp/backups/goal-phase-role-resolution-20260520-042000-post`

## 后续

1. `REQ-GOAL-010`：commander phase 审视、暂停建议和分发策略。
2. `REQ-GOAL-006`：Goal Loop 引擎真实启动 phase，复用 `chat_handoff` / tool runtime / memory。
3. `REQ-TOOL-013`：完全访问权限显式 TTL 开关与高风险提示。
