# 2026-05-19 Goal 角色 / 指挥官配置第一阶段

## 背景

用户要求继续推进后端功能接入前端，并补充：

- Goal 需求增加每会话角色配置、责任规则、指挥官配置。
- 指挥官负责阶段审视、子任务分发、角色在线心跳、卡住/超时判断和长任务风险管理。
- 新增完全访问权限开关、IndexTTS、OpenCLI 需求，先进入需求表并排期。
- 先保证后端功能和 API 可用，前端界面后续再统一精修。

## 当前窗口前端与后端接入状态

| 窗口 | 接入状态 | 备注 |
| --- | --- | --- |
| 工程目录 | 已接 `/api/project/tree`、`/api/project/file/meta`、`/api/project/file`、`/api/project/diff` | 本轮复查 fresh build 中目录树 DOM 正常纵向展示，文件预览 API 对文本文件返回可预览；用户截图中的“树散开/二进制”更像旧 WebView 缓存、旧进程或选中 `.coolzhu/attachments` 二进制附件 |
| 设置 | 已接会话/模型/Custom provider/视觉 Agent/工具配置；本轮新增 Goal role 配置 | 新增 Role、Responsibility、Commander、Heartbeat timeout、Task timeout 和 Heartbeat 操作 |
| 聊天室 | 已接聊天室、消息流、roster、handoff、附件、composer、TTS/STT 入口 | 进入测试中，后续统一视觉打磨 |
| 任务 / 授权 / Goals | 已接 pending approval、Protected rules、audit summary、Goal create/cancel/seed plan | 完全访问权限按钮未实现，已作为 `REQ-TOOL-013` P0 待开发 |
| 记忆 / 知识 | 已接 beads summary、prompt/context preview、bead 治理动作 | 进入测试中，后续补更完整的知识管理交互 |
| 多媒体 | 已接附件媒体库、预览播放和播放列表前端 | 进入测试中 |
| 视觉实验 | 已接 capture、grounding locate/verify、capabilities、profile/dry-run | 只保留内视觉 grounding / compute-use 与云端识图方向 |
| 诊断日志 | 已接 health、suggestions、audit summary，logs tail 仍是后续项 | 进入测试中 |
| 浏览器 | MVP 已接 URL/search/iframe fallback/外部打开 | 受 CSP/X-Frame 限制，不做跨域读取 |
| 终端 | MVP 已接 `/api/tools/runtime-execute` JSON 面板 | 真实执行仍走权限/审计 |
| 折叠态办公室 | 已接 `/api/office/scene`、背景和 robot sprite | 复查发现仅在所有窗口折叠时显示；展开窗口时隐藏属于当前设计行为 |

## 本轮实现

### 需求管理

- 更新 `docs/requirements-management.md` 日期为 `2026-05-19`。
- 新增/确认需求：
  - `REQ-GOAL-010`：指挥官配置、角色心跳与长任务风险管理。
  - `REQ-TOOL-013`：完全访问权限显式授权开关。
  - `REQ-AUDIO-002`：IndexTTS 本地 TTS Provider 集成。
  - `REQ-TOOL-014`：OpenCLI 工具集成。
- 状态更新：
  - `REQ-GOAL-004`：`待开发` -> `开发中`。
  - `REQ-GOAL-010`：`待开发` -> `开发中`。
- 需求统计更新为：
  - 已完成 66
  - 测试中 18
  - 待交互验证 0
  - 开发中 3
  - 待开发 13
  - 冻结 14
  - 合计 114

### 后端 / API

修改文件：`modules/gui-web/packages/web-console/src/main.rs`

- 新增 SQLite schema v5：`goal_role_configs`。
- 新增 API：
  - `GET /api/goals/roles`
  - `POST /api/goals/roles/{session_id}`
  - `POST /api/goals/roles/{session_id}/heartbeat`
- 新增数据模型：
  - `GoalRoleConfigUpdateRequest`
  - `GoalRoleHeartbeatRequest`
  - `GoalRoleConfigListResponse`
  - `GoalRoleConfigDto`
- 行为：
  - 支持每个 session 配置 role、responsibility、commander、heartbeat_timeout_ms、task_timeout_ms。
  - commander 标记保持唯一，设置一个 commander 会清掉其它 session 的 commander 标记。
  - heartbeat 更新 `last_heartbeat_at`，可标记 active task 起始时间。
  - 响应中计算 `online`、`stuck`、`risk_level`，供前端和后续任务窗口风险看板使用。

### 前端

修改文件：

- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/styles.css`

实现内容：

- 设置窗口新增 Goal role 配置区：
  - Role select
  - Responsibility input
  - Commander select
  - Heartbeat timeout
  - Task timeout
  - Heartbeat button
  - 当前在线 / 卡住 / 风险状态摘要
- `refreshAll()` 加载 sessions 后加载 goal roles。
- 切换/保存 session 时同步回显和保存 Goal role config。
- workspace 状态清理时重置 Goal role registry，避免旧目录状态残留。

## 验证

### TDD 红绿

- 后端 RED：新增 `goal_role_config_round_trips_and_reports_commander_health`，初次运行因缺少 API/函数失败。
- 前端 RED：新增 `web_frontend_settings_window_connects_goal_role_config_api`，初次运行因缺少 DOM/API 接线失败。
- GREEN 后验证：
  - `tmp/run-goal-role-validation.ps1`
  - 日志：`tmp/logs/goal-role-validation.20260519-074357.summary.log`
  - 结果：
    - `node --check modules/gui-web/packages/web-console/src/app.js` PASS
    - `goal_role_config_round_trips_and_reports_commander_health` PASS，1 passed
    - `web_frontend_settings_window_connects_goal_role_config_api` PASS，1 passed

### 全量验证

- 脚本：`tmp/run-office-scene-validation.ps1`
- 第一次失败原因：`target/debug/coolzhu-web-console.exe` 正在运行，Windows 拒绝覆盖目标 exe，非代码错误。
- 处理：停止本轮调试拉起的 `coolzhu-web-console.exe --open` 进程。
- 第二次结果：
  - `office-scene-cargo-fmt ok`
  - `office-scene-node-check ok`
  - `office-scene-d2-contract ok`
  - `office-scene-web-console-tests ok`，255 passed
  - `office-scene-cargo-build ok`

## 备份

- 修改前备份：`tmp/backups/goal-role-commander-20260519-025047-pre`
- 修改后备份：`tmp/backups/goal-role-commander-20260519-075059-post`

## 后续事项

1. `REQ-GOAL-004` 剩余：
   - 自动创建 `goal-<role>` session。
   - system prompt / role template 与普通会话配置合并。
   - 角色责任规则接入 phase 分发。
2. `REQ-GOAL-010` 剩余：
   - commander 对 phase 完成情况的审视逻辑。
   - stuck/offline/risk event 写入 `goal_events`。
   - 任务 / 授权窗口显示角色风险看板和暂停建议。
3. `REQ-TOOL-013`：
   - 完全访问权限按钮、风险提示、TTL、撤销和审计。
4. `REQ-TOOL-014`：
   - OpenCLI adapter/registry、探活、版本识别、参数白名单和 runtime 权限门禁。
5. `REQ-AUDIO-002`：
   - IndexTTS provider 配置、探活和 `/api/audio/tts/speak` 路由适配。
