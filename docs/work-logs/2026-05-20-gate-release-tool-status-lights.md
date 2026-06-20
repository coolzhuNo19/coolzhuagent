# 2026-05-20 Gate Release 与工具状态灯

## 背景

- 用户确认：功能开发完成后，调试/回滚类闸口拦截不能沉淀进正式前后端功能。
- 工具调用细节不再写入聊天回复框；工具窗口用状态灯表达调用状态：
  - 灰色：未调用
  - 红色：执行中
  - 绿色：执行完成

## 需求更新

- `REQ-GOAL-006`：补充“功能完成后不得保留调试性执行拦截闸口”。
- `REQ-GOAL-009`：从“审计、诊断与回滚开关”调整为“审计与关键步骤诊断”。
- `REQ-WEB-WIN-008`：诊断日志窗口只展示关键步骤诊断，不承载禁用执行类开关。
- 新增并推进 `REQ-TOOL-015` 到测试中：工具调用状态灯与聊天降噪。

## 代码变更

- 后端移除 Goal runtime 调试闸口：
  - 删除 `/api/goals/runtime` 路由。
  - 删除 `ConfigGoal` / `[goal].enabled` 正式配置字段。
  - 删除 `config_goal_enabled()` 派发拦截。
  - 删除 `goal-runtime-disabled` 事件和禁用响应分支。
  - 保留 `goal-phase-dispatched`、`goal-commander-review` 中的 `caller=goal-loop` 诊断锚点。
- 前端工具窗口：
  - 新增 `data-role="tool-status-strip"` 状态灯条。
  - 新增 `toolCallStatuses`、`setToolCallStatus()`、`syncToolCallStatusUi()`。
  - 工具目录条目显示状态灯。
  - semantic dispatch dry-run 开始时置红，结束/失败后置绿，未调用保持灰。
  - 移除 `Tool governance` 详细结果写入聊天室消息流。
- 测试稳定性：
  - Web Console 测试态默认截图路径调整到仓库 `tmp/test-captures`。
  - `capture_desktop` 在 `cfg(test)` 下写入固定尺寸 PNG 头，避免全量测试依赖交互桌面截图权限；生产运行仍走真实 Windows 截图逻辑。

## TDD 记录

- RED：
  - `goal_runtime_has_no_debug_dispatch_gate` 首次失败，命中 `/api/goals/runtime` 仍存在。
  - `web_frontend_tool_dispatch_uses_status_lights_without_chat_detail` 首次失败，命中缺少 `tool-status-strip`。
  - 日志：`tmp/logs/gate-release-target-tests.20260520-205807.log`
- GREEN：
  - 两条定向测试通过。
  - 日志：`tmp/logs/gate-release-target-tests.20260520-213127.log`

## 验证

- `node --check modules/gui-web/packages/web-console/src/app.js`：通过。
- `tmp/run-gate-release-target-tests.ps1`：通过。
- `tmp/run-office-scene-validation.ps1`：通过。
  - cargo fmt ok
  - node check ok
  - D2 contract ok
  - web-console tests ok
  - cargo build ok

## 备份

- 变更前：`tmp/backups/gate-release-tool-status-20260520-192918-pre`
- 变更后：`tmp/backups/gate-release-tool-status-20260520-220846-post`

## 后续

- `REQ-TOOL-015` 后续扩展范围：
  - LLM tool_use 的状态灯接入。
  - `/api/tools/runtime-execute` 的状态灯接入。
  - tool approval SSE 与审计事件联动状态灯。
