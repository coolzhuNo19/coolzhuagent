# 2026-05-20 完全访问权限显式 TTL 开关

## 背景

按 P0 `REQ-TOOL-013` 推进。用户要求任务 / 授权窗口增加完全访问权限开启按钮，并明确提醒“该权限完全允许操作用户电脑文件，有一定风险”。该能力必须默认关闭、临时授权、可撤销、落审计，并且不绕过既有 runtime permission gate。

## 本次变更

- 新增 `GET /api/tools/full-access`：
  - 返回当前 workspace + active session 的 full access 状态。
  - 字段包含 `active`、`ttl_secs_remaining`、`expires_at_unix_ms`、`warning`。
- 新增 `POST /api/tools/full-access`：
  - 需要 `risk_acknowledged=true`。
  - 需要 `confirmed_twice=true`。
  - `ttl_secs` 默认 600 秒，最小 60 秒，最大 1800 秒。
  - 授权按 `workspace_id + session_id` 隔离。
  - 内部使用 existing `SessionGrants`，以 `*` 作为 full access grant key；后续同 session 的危险工具通过 `session_grant_view_for` 命中临时授权。
- 新增 `DELETE /api/tools/full-access`：
  - 撤销当前 workspace + active session 的 full access grant。
- 审计：
  - grant / revoke 均写入 `tool-audit.jsonl`。
  - 审计记录使用 `tool_name=full_access`，permission 为 `danger-full-access / allow-approved`，affected path 为 `<all-user-files>`。
- 前端任务 / 授权窗口：
  - Pending approvals 区新增 Full access 状态块。
  - 展示风险提示：`该权限完全允许操作用户电脑文件，有一定风险`。
  - 提供 `开启 10m` 和 `撤销` 按钮。
  - 开启前使用浏览器确认框二次提示风险。

## TDD 记录

1. RED
   - 命令：`cargo test -p coolzhu-web-console full_access_grant_requires_risk_ack_and_authorizes_all_tools_for_ttl`
   - 日志：`tmp/logs/tool-full-access.red.20260520.log`
   - 失败原因符合预期：`FullAccessGrantRequest` / `grant_full_access_for_session` / `revoke_full_access_for_session` 尚不存在。

2. GREEN
   - 命令：`cargo test -p coolzhu-web-console full_access_grant_requires_risk_ack_and_authorizes_all_tools_for_ttl`
   - 日志：`tmp/logs/tool-full-access.green.20260520.log`
   - 结果：1 passed。

3. 前端契约
   - 命令：`cargo test -p coolzhu-web-console web_frontend_task_window_has_full_access_toggle`
   - 日志：`tmp/logs/tool-full-access-ui.green.20260520.log`
   - 结果：1 passed。

## 完整验证

- 命令：`powershell -ExecutionPolicy Bypass -File tmp/run-office-scene-validation.ps1`
- 日志：`tmp/logs/office-scene-validation.tool-full-access.20260520.log`
- 结果：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`
  - `office-scene-cargo-build ok`

## 备份

- 变更前：`tmp/backups/tool-full-access-20260520-044300-pre`
- 变更后：`tmp/backups/tool-full-access-20260520-050000-post`

## 后续

1. 交互确认：在任务 / 授权窗口点 `开启 10m`，确认状态变为 `On Xm`，再点撤销回到 `Off`。
2. 与真实危险工具联调：确认 full access 不绕过工具审计，工具执行仍写入 `tool-audit.jsonl`。
3. 进入下一优先级：`REQ-GOAL-006/007/009` 或 `REQ-TOOL-014`，取决于是否先补 Goal Loop 真实分发。
