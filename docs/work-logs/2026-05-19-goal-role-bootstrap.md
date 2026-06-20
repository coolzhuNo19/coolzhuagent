# 2026-05-19 Goal Role Session Bootstrap

## 背景

继续推进 `REQ-GOAL-004`。上一轮已经完成 Goal role 配置、commander 标记、heartbeat 和风险看板，本轮补齐“首次使用可自动创建 `goal-<role>` session”的后端/API 与设置窗口入口。

## 设计决策

当前 `PersistedSession` 没有独立 `system_prompt` 字段，现有真实 LLM system prompt 注入路径是 `build_agent_system_prompt` + pinned memory beads。因此本轮不做 session schema 迁移，先通过 pinned `goal-role-template-*` memory bead 承载角色模板规则。这样能复用现有 prompt 组装链路，避免为了单个切片引入额外迁移风险。

## 实现内容

### 后端

修改文件：`modules/gui-web/packages/web-console/src/main.rs`

- 新增路由：`POST /api/goals/roles/bootstrap`。
- 新增请求/响应：
  - `GoalRoleBootstrapRequest { roles?: string[] }`
  - `GoalRoleBootstrapResponse { created, roles }`
- 新增 `SessionStore::ensure_goal_role_sessions(roles)`：
  - roles 为空时默认使用 planner、implementer、reviewer、designer、tester、releaser、documenter、verifier。
  - 指定角色时只创建缺失的对应 `goal-<role>` session。
  - 已存在同名 session 时保持幂等，不重复创建。
  - 新 session 克隆当前 active session 的 provider/model/base_url/endpoint/reasoning_effort/api_key_ref。
  - 新 session 写入 pinned `goal-role-template-<role>` memory bead，作为后续 system prompt 注入来源。
  - 如果 session 容量不足，返回明确错误，避免悄悄丢角色。

### 前端

修改文件：

- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/app.js`

实现内容：

- 设置窗口 Goal role 配置区新增 `Bootstrap role session` 按钮。
- 新增 `bootstrapGoalRoleSessions()`：
  - 若当前 Role select 有值，则只 bootstrap 当前角色。
  - 若当前 Role select 为空，则请求默认角色集。
  - 创建后刷新 sessions、goal role registry 和任务窗口 role risk 摘要。

## TDD

### RED

- `goal_role_bootstrap_creates_missing_role_sessions_with_template_memory`
  - 首次失败：`SessionStore` 缺少 `ensure_goal_role_sessions`。
  - 日志：`tmp/logs/goal-role-bootstrap-red-backend.log`、`tmp/logs/goal-role-bootstrap-red-backend.err.log`
- `web_frontend_settings_window_can_bootstrap_goal_role_sessions`
  - 首次失败同样卡在后端缺函数编译错误；测试意图为设置窗口必须有按钮、JS 函数和 `/api/goals/roles/bootstrap` 调用。
  - 日志：`tmp/logs/goal-role-bootstrap-red-frontend.log`、`tmp/logs/goal-role-bootstrap-red-frontend.err.log`

### GREEN

- 脚本：`tmp/run-goal-role-bootstrap-validation.ps1`
- 汇总日志：`tmp/logs/goal-role-bootstrap-validation.20260520-001138.summary.log`
- 结果：
  - `node --check modules/gui-web/packages/web-console/src/app.js` PASS
  - `goal_role_bootstrap_creates_missing_role_sessions_with_template_memory` PASS
  - `web_frontend_settings_window_can_bootstrap_goal_role_sessions` PASS

### 全量验证

- 脚本：`tmp/run-office-scene-validation.ps1`
- 结果：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`，259 passed
  - `office-scene-cargo-build ok`

## 备份

- 修改前备份：`tmp/backups/goal-role-bootstrap-20260519-224549-pre`

## 后续事项

1. `REQ-GOAL-004`：把 phase `assigned_role` 与 `goal-<role>` session 自动匹配，形成真正的 phase 分发目标。
2. `REQ-GOAL-010`：commander 审视 phase 完成情况，并基于 role risk 暂停或转派。
3. `REQ-GOAL-006/007`：开始 Goal Loop / 后台事件流前，需要先把权限边界与 `REQ-TOOL-013` 衔接好。
