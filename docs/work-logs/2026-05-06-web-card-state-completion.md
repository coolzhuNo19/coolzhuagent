# 2026-05-06 Web-GUI 主卡片状态补齐

记录时间：2026-05-06 07:32:40 +08:00

## 关联需求

- `REQ-WEB-API-001`：卡片未接后端 API 补齐。

## 目标

继续推进 `/api/web/cards` 审计发现的前端状态缺口，让主卡片具备明确 endpoint、loading、error、empty 状态。

## TDD 过程

红灯：

- 新增 `web_frontend_marks_external_vision_and_voice_monitor_states`，要求外视觉和语音监听卡片有 loading/error 文案。
- 新增 `web_frontend_handles_session_agent_load_errors`，要求会话/Agent 加载失败时有前端降级状态。
- 初始失败日志：`tmp/web_card_state_tdd_red.log`、`tmp/web_session_agent_state_tdd_red.log`。

绿灯：

- 外视觉卡片加载前显示 `加载中`，接口失败时显示 `加载失败` 并写入系统消息。
- 语音监听卡片加载前显示 `检测中`，音频状态接口失败时禁用按钮并显示 `音频状态不可用`。
- 会话和 Agent 加载失败时，相关字段显示 `加载失败`，不会中断后续卡片加载。
- `/api/web/cards` 审计更新为 10 张主卡片全部 `ready`，`missing_state=0`。

## 修改文件

- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/main.rs`
- `docs/requirements-management.md`

## 验证

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo fmt -p coolzhu-web-console`
- `cargo check -p coolzhu-web-console --offline`
- `cargo test -p coolzhu-web-console --offline`

结果：

- JS 语法检查通过，日志：`tmp/web_card_state_node_check.log`。
- `cargo check` 通过，日志：`tmp/web_card_state_check.log`。
- `cargo test` 通过，112 项测试全部成功，日志：`tmp/web_card_state_test.log`。

## 状态

- `REQ-WEB-API-001` 从 `开发中` 推进到 `测试中`。
- 后续可在浏览器/Tauri WebView 中做交互观感确认，但当前自动化已经覆盖主卡片 endpoint 与三态契约。

## 备份

- 本次备份路径：`tmp/backups/web-card-state-completion-20260506-073317`。
