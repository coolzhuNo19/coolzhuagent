# 2026-05-20 Goal diagnostics runtime switch

## 时间

- 开始：2026-05-20 07:46 +08:00
- 完成：2026-05-20 08:04 +08:00

## 需求

- `REQ-GOAL-009` Goal 审计、诊断与回滚开关。
- 目标：先落地 `[goal].enabled=false` 禁用执行但保留历史，以及 diagnostics 提示入口；真实自动 loop 和统一审计视图后续继续推进。

## 修改内容

- `WorkspaceConfig` 新增 `[goal]` 配置段：
  - `enabled = true` 默认开启。
  - `enabled = false` 表示禁用 Goal Loop 派发。
- 新增 API：
  - `GET /api/goals/runtime`
  - `POST /api/goals/runtime`
- 新增 `GoalRuntimeConfigResponse` / `GoalRuntimeConfigRequest` / `GoalRuntimeDiagnosticDto`。
- diagnostics health 新增 `goal.runtime` 检查：
  - enabled 时 `ok`。
  - `[goal].enabled=false` 时 `warn`，修复建议提示重新启用。
- `dispatch-ready` 增加运行时熔断：
  - disabled 时不调用 commander review，不创建 chat handoff。
  - 返回 `pause_recommended=true` 和 skipped phase。
  - 写入 `goal-runtime-disabled` 事件，payload 包含 `caller=goal-loop`。
- `goal-phase-dispatched` 和 `goal-commander-review` 事件 payload 补 `caller=goal-loop`，为后续统一审计视图打基础。

## TDD 与验证

- RED：
  - `goal_runtime_config_disabled_warns_and_round_trips` 先失败于缺少 `ConfigGoal`、runtime API helper 和 diagnostics helper。
  - `goal_dispatch_is_blocked_when_goal_runtime_disabled` 先失败于 `WorkspaceConfig` 无 `goal` 字段且 Dispatch 未检查 disabled。
- GREEN：
  - `tmp/run-goal-diagnostics-switch-tests.ps1 -TimeoutSeconds 240`
  - 结果：2 个目标用例均通过。

## 未完成项

- `REQ-GOAL-009` 仍需统一 Goal 审计视图，把 goal 内工具调用、handoff、phase 状态变化与 ToolAudit/GoalEvent 关联展示。
- `REQ-GOAL-006` 自动 loop 尚未落地；当前只保护手动 `dispatch-ready` 入口。
