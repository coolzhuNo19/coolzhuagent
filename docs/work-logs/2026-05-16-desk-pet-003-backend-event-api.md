# 2026-05-16 REQ-DESK-PET-003 桌宠状态联动后端/API

## 时间

- 开始：2026-05-16 21:28 +08:00
- 完成：2026-05-16 21:55 +08:00

## 目标

按当前策略，先确保后端功能和 API 接口可用，前端界面后续统一设计。本轮收口 `REQ-DESK-PET-003`：聊天发送、推理、工具执行成功/失败能够驱动桌宠状态，并提供可测试的后端状态 API 与 SSE 事件。

## 修改内容

- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增桌宠后端状态模型：
    - `PetStateSnapshot`
    - `PetStateResponse`
    - `PetEventRequest`
    - `PetEventResponse`
  - 新增 API：
    - `GET /api/pet/state`：返回最新桌宠状态、桌宠是否禁用、Tauri shell 路径。
    - `POST /api/pet/event`：后端或调试方可提交事件，统一映射为桌宠状态。
    - `GET /api/pet/events`：SSE 输出当前状态和后续 `pet-status` 事件。
  - 新增事件映射：
    - `chat.started` / `chat.reasoning` / `tool.*` 默认进入 `thinking`。
    - `chat.completed` / `tool.ok` 进入 `success`。
    - `chat.failed` / `tool.failed` / `tool.rejected` / `tool.timeout` 进入 `warning`。
    - `audio.*` 进入 `blink`。
    - 未知事件回落 `idle`。
  - 新增 Tauri 单实例触发参数生成：`--pet-state <state> --pet-message <message>`。
  - 非测试环境下，记录桌宠事件时会调用已存在的 `coolzhu-tauri-shell.exe` 单实例命令，把状态转发给桌宠窗口。
  - 接入非流式聊天：
    - 请求进入后触发 `chat.started`。
    - reasoning 消息出现时触发 `chat.reasoning`。
    - 响应持久化完成后触发 `chat.completed`。
  - 接入流式聊天：
    - 流启动触发 `chat.started`。
    - ThinkingDelta / InputJsonDelta / ToolUse 开始时触发 `chat.reasoning`。
    - 持久化失败或 handoff 失败触发 `chat.failed`。
    - 流完成触发 `chat.completed`。
  - 接入工具链路：
    - `/api/tools/runtime-execute`
    - LLM `invoke_through_runtime`
    - `chat_handoff`
    - `ToolOutcomeStatus::{Ok,DryRunOnly,Rejected,Failed,Timeout}` 均映射到桌宠事件。
  - 新增 TDD：
    - `backend_pet_status_maps_chat_and_tool_events`
    - `desktop_pet_action_args_are_stable`
    - `pet_event_api_updates_latest_state_and_broadcasts`
- `docs/requirements-management.md`
  - `REQ-DESK-PET-003` 状态从 `开发中` 更新为 `测试中`。
  - 需求统计更新为：已完成 67，测试中 3，开发中 0，待开发 24，暂停 1。
  - 下一步计划改为暂停新功能推进，先评估未实现需求保留/裁撤与统一界面布局。

## 验证

- TDD 红灯：
  - `tmp/logs/desk-pet-003-tdd-red-20260516.out.log`
- 格式化：
  - `tmp/logs/desk-pet-003-cargo-fmt-20260516.log`
- 定向测试：
  - `tmp/logs/desk-pet-003-pet-filter-20260516.out.log`
  - 结果：`3 passed; 0 failed`
- 全量回归：
  - `tmp/logs/desk-pet-003-web-console-full-20260516.out.log`
  - 结果：`234 passed; 0 failed`

## 备份

- 修改前备份：
  - `tmp/backups/desk-pet-003-backend-20260516-0528-pre/`
- 修改后备份：
  - `tmp/backups/desk-pet-003-backend-20260516-2155-post/`

## 待人工确认

- 真实 Tauri 桌宠窗口需要交互验证：
  - 浏览器或 WebView 发送普通聊天消息，桌宠进入 thinking，完成后进入 success。
  - 触发工具成功路径，桌宠进入 success。
  - 触发工具失败或需要审批路径，桌宠进入 warning。
  - 检查状态气泡是否仍保持单气泡、无空白气泡、动作帧锚点稳定。

## 后续

按用户最新要求，当前需求完成后停止继续推进新功能。下一步集中评估未实现需求中哪些不保留，以及 Web GUI 后续统一布局设计。
