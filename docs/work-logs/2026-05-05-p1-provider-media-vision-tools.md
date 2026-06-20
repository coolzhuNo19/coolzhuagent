# 2026-05-05 P1 Provider, Media, Vision Tools

## Scope

继续推进可自动化验证的 P1 项，避开真实鼠标、麦克风和 WebView 人工视觉确认场景。

## Implemented

- Provider diagnostics:
  - 扩展 agent diagnostics 和 `/api/diagnostics/health` 的 provider 字段。
  - 返回 selected/detected provider kind、provider_match、provider slug、canonical model、base_url 默认值/env 来源、key 来源和 provider_issue。
  - 修正 LLM 健康检查，不再把“存在 env key 名称”误判为“已经配置 key”。
- Composer file button:
  - 消息发送卡片增加附件选择按钮和附件 chip 预览。
  - 支持多文件选择、移除、object URL 回收，以及附件元数据随流式/非流式发送 payload 进入聊天室。
  - 当前阶段只传递本地 object URL 和元数据，不做二进制落盘上传。
- `vision.describe_screen`:
  - 新增 `/api/vision/describe-screen`。
  - 将工具卡片 `vision.describe_screen` dry-run 从占位改为结构化只读输出。
  - 默认 `use_model=false`，返回截图尺寸、路径、字节数、hash 和工具调用 prompt 的 metadata-only 描述。
  - `use_model=true` 时复用本地 OpenAI-compatible VLM 配置，返回模型描述和 backend trace；后端不可达时不阻断 dry-run，返回 `model-backend-error` 和启发式描述。

## Verification

Passed:

- `rustfmt --edition 2021 modules\gui-web\packages\web-console\src\main.rs`
- `cargo check -p coolzhu-web-console --offline -q`
- `node --check modules\gui-web\packages\web-console\src\app.js`
- `cargo test -p coolzhu-web-console screen_description_metadata_mentions_dimensions_hash_and_prompt --offline -- --nocapture`
- `cargo test -p coolzhu-web-console tools_catalog_exposes_core_plugins_skills_and_safe_actions --offline -- --nocapture`
- `cargo test -p coolzhu-web-console agent_diagnostics_warns_when_provider_does_not_match_model --offline -- --nocapture`
- `cargo test -p coolzhu-web-console llm_health_check_does_not_count_env_key_names_as_configured --offline -- --nocapture`

## Remaining Risk

- 附件按钮尚未实现本地文件二进制上传、持久化存储和跨设备迁移。
- `vision.describe_screen use_model=true` 需要本地 VLM 服务实测；当前自动化只覆盖 metadata-only 和 catalog dry-run 协议。
- Provider 诊断还需要更多真实 provider 组合做矩阵回归。
