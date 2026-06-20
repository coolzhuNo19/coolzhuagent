# 2026-05-16 REQ-LLM-005 Custom Provider 后端/API 补强

## 时间

- 开始：2026-05-16 05:09 +08:00
- 完成：2026-05-16 05:25 +08:00

## 目标

按当前推进策略，先确保后端功能和 API 接口可用，前端界面布局后续统一设计。本轮收口 `REQ-LLM-005` 的 Custom provider 后端契约，使其能作为本地模型、未内置厂商和中转平台的通用 OpenAI-compatible 入口。

## 修改内容

- `modules/gui-web/packages/web-console/src/main.rs`
  - `agent_diagnostics()` / `agent_diagnostics_for_session()` 开始把 session 的 `base_url` 和 `endpoint` 传入诊断构建链路。
  - 新增 Custom provider 匹配规则：当用户选择 `Custom` 时，不再因为模型名像 `qwen` / `glm` 而误判 provider mismatch。
  - Custom provider 允许空 API Key，诊断结果返回 optional 提示，兼容本地 OpenAI-compatible 服务。
  - `base_url + endpoint` 统一拼接，Custom 未配置 `base_url` 时回退 `http://127.0.0.1:11434/v1`，仍保留 endpoint。
  - `provider_client_for_agent()` 对 Custom 优先走 `ProviderClient::from_custom_openai_compatible()`，避免落回固定 provider registry。
  - 新增 TDD：
    - `custom_provider_diagnostics_accepts_local_openai_compatible_without_key`
    - `custom_provider_base_url_uses_default_when_only_endpoint_is_configured`
- `modules/llm-adapter/packages/llm-adapter/src/client.rs`
  - 补齐测试请求中的 `reasoning_effort` 字段，保持 MessageRequest 构造契约一致。
- `modules/llm-adapter/packages/llm-adapter/src/providers/claw_provider.rs`
- `modules/llm-adapter/packages/llm-adapter/src/providers/openai_compat.rs`
- `modules/llm-adapter/packages/llm-adapter/tests/client_integration.rs`
- `modules/llm-adapter/packages/llm-adapter/tests/openai_compat_integration.rs`
  - 补齐测试样例的 `reasoning_effort: None`，修复适配层包编译漂移。
- `docs/requirements-management.md`
  - `REQ-LLM-005` 备注补充后端/API 已完成项。
  - 下一步计划调整为优先推进 `REQ-DESK-PET-003` 后端事件/API；`REQ-LLM-005` 保持测试中，等待真实本地/中转 endpoint 验证。
  - 追加 2026-05-16 变更记录。

## 验证

- TDD 红灯：
  - `tmp/logs/llm005-custom-provider-diagnostics-tdd-fail-20260516.log`
- TDD 绿灯：
  - `tmp/logs/llm005-custom-provider-diagnostics-green-20260516.log`
  - `tmp/logs/llm005-custom-provider-filter-20260516.log`
  - `tmp/logs/llm005-agent-diagnostics-filter-20260516.log`
  - `tmp/logs/llm005-custom-session-fields-filter-20260516.log`
- 格式化：
  - `tmp/logs/llm005-cargo-fmt-20260516.log`
  - `tmp/logs/llm005-cargo-fmt-2-20260516.log`
- 回归：
  - `tmp/logs/llm005-llm-adapter-tests-2c-20260516.out.log`
  - 结果：`coolzhu-llm-adapter` 全量通过；unit 60 passed，integration 5 + 5 + 4 + 4 passed，1 ignored live test。
  - `tmp/logs/llm005-web-console-full-20260516.out.log`
  - 结果：`coolzhu-web-console` 全量 `231 passed; 0 failed`。

## 备份

- 修改前备份：
  - `tmp/backups/llm005-custom-provider-20260516-050935-pre/`
  - `tmp/backups/llm005-adapter-tests-20260516-051714-pre/`
- 修改后备份：
  - `tmp/backups/llm005-custom-provider-20260516-0525-post/`

## 风险与后续

- 本轮没有继续调整三合一卡片视觉布局，只保证后端/API 与适配层契约稳定。
- 真实本地或中转 endpoint 的交互验证仍需后续提供可用 base_url/model 后执行。
- 下一步按需求表优先级推进 `REQ-DESK-PET-003`：先补桌宠状态联动的后端事件/API 与单测，再进入真实桌面交互验收。
