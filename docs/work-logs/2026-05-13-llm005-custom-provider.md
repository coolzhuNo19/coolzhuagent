# 2026-05-13 REQ-LLM-005 Custom Provider 收口

## 背景

用户要求 `REQ-LLM-005` 调整为在 Provider 内新增 `Custom` 自定义厂商入口，可接本地模型、未知厂商模型和中转平台；三合一卡片布局保持紧凑，`base_url` 与 `endpoint` 仅在 `provider=Custom` 时显示配置。打包迁移类需求冻结，不做联网注册机制。

## 修改范围

- `modules/gui-web/packages/web-console/index.html`
  - Provider 下拉新增 `Custom`。
  - 新增 Custom 专用 `session-custom-model`、`session-base-url`、`session-endpoint` 输入项，默认隐藏。
- `modules/gui-web/packages/web-console/src/app.js`
  - 新增 `isCustomProvider`、`sessionModelValueFromForm`、`updateCustomProviderFields`。
  - Provider 切换时联动模型选项、Custom 字段显隐、reasoning effort 与 model_type。
  - `sessionPayloadFromForm` 在 Custom 时保存自定义模型、Base URL、Endpoint；普通 provider 保存空 URL/Endpoint，避免隐藏旧配置继续生效。
  - `setSessionForm` 支持 Custom 字段回显。
- `modules/gui-web/packages/web-console/src/styles.css`
  - 补充 `.custom-provider-field[hidden]` 隐藏规则，避免卡片 CSS 覆盖 `hidden` 属性。
- `modules/gui-web/packages/web-console/src/main.rs`
  - 新增 `is_custom_provider_label` 与 `custom_provider_urls`。
  - `create_session` 仅在 Custom provider 下持久化 `base_url`/`endpoint`。
  - `update_session` 切换到普通 provider 时清空旧 Custom URL/Endpoint。
  - 新增前端静态验收与后端存储行为 TDD。
- `docs/requirements-management.md`
  - `REQ-LLM-005` 状态从 `开发中` 更新为 `测试中`。
  - 需求统计同步：测试中 8，开发中 3。
  - 变更记录补充本轮实现说明。

## TDD 与验证

红灯记录：

- `tmp/logs/web-console-llm005-red-static-20260513.log`
  - 失败点：前端未包含 `Custom` provider 与 custom URL 字段。
- `tmp/logs/web-console-llm005-red-backend-20260513.log`
  - 失败点：会话从 Custom 切回 `DeepSeek` 后旧 `base_url` 未清空。

绿灯记录：

- `tmp/logs/cargo-fmt-llm005-20260513.log`
- `tmp/logs/node-check-app-llm005-20260513.log`
- `tmp/logs/web-console-llm005-static-test-20260513.log`
  - `web_frontend_exposes_custom_openai_compatible_session_fields` passed。
- `tmp/logs/web-console-llm005-backend-test-20260513.log`
  - `session_store_keeps_custom_urls_only_for_custom_provider` passed。
- `tmp/logs/web-console-llm005-web-frontend-group-20260513.log`
  - web_frontend 组 8 passed。
- `tmp/logs/web-console-llm005-session-store-group-20260513.log`
  - session_store 组 3 passed。
- `tmp/logs/web-console-llm005-provider-client-20260513.log`
  - filter 下 0 tests，编译通过。

说明：PowerShell 会把 cargo warning 计入错误流，部分命令 shell exit code 显示为 1；以日志内 `test result: ok` 为准。

## 备份

- 修改前备份：`tmp/backups/llm005-custom-provider-20260513-2045-pre`
- 修改后快照：`tmp/backups/llm005-custom-provider-20260513-2045-pre/post`

## 状态

- `REQ-LLM-005`：代码完成，进入测试中。
- 待交互验证：
  - 在 Web UI 三合一卡片选择 `Custom` 后确认 Custom Model/Base URL/Endpoint 显示并可保存。
  - 保存本地 OpenAI-compatible endpoint 后切换回普通 provider，确认 URL/Endpoint 被隐藏且不会继续影响普通 provider 调用。
