---
title: "LLM Adapter work-log"
source:
  - "modules/llm-adapter/INTERFACE.md"
  - "docs/model-provider-config-table.md"
  - "docs/model-capability-table-verified-2026-05-31.md"
  - "docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md"
  - "docs/gemma4-12b-local-deploy-2026-06-15.md"
  - "docs/coolzhu-model-finetune-plan-2026-06-16.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# LLM Adapter work-log

## 迁移工作记录

- 真实 provider、流式输出、reasoning effort、model_type、图文输入已可用，但自定义 OpenAI-compatible 表单和协议矩阵仍需收口。
- 上下文 compact 与模型能力表方案明确：根据模型 context window 动态预算，超长历史摘要化为 bead。
- 本地 Gemma/微调方案文档已沉淀，模型资源下载和训练不属于本次 vault 任务。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。

## 2026-06-19 GLM5.2 协议链路检查与修复

- **目的**：校验 GLM5.2 经阿里百炼的 API 协议正确性，规避百炼 Anthropic 协议"思考模式强制检查"冲突，默认思考强度最高。
- **链路结论**：会话 provider="阿里百炼"→`ProviderKind::AlibabaBailian`→`OpenAiCompatClient`→`resolver` 判定 `OpenAiChatCompletions`→`compatible-mode/v1/chat/completions`，**非** Anthropic 协议，方向正确。
- **修复（涉及模块：llm-adapter）**：
  1. `providers/openai_compat.rs` 新增 `normalize_openai_reasoning_effort()`：下发前把内部 5 档钳到协议合法值（low/high；xhigh/max/超高/最高→high；其余→medium），根治"xhigh/max 非法取值致服务端 400 协议冲突"。
  2. `registry.rs register_alibaba_models()` 补注册 `glm-5.2` + 别名，消除与 `providers/mod.rs` 双注册表不一致。
- **验证**：`cargo build -p coolzhu-llm-adapter --offline` OK；`cargo test -p coolzhu-llm-adapter --lib --offline` → 73 passed/0 failed（含新增 `reasoning_effort_above_protocol_max_is_clamped_to_high`）。
- **会话侧建议**：provider=阿里百炼、model=glm-5.2、base_url 留空、reasoning_effort=max（协议层安全钳到 high）。**勿**把 provider 设为 anthropic/claw。
- **残留**：DashScope 原生深思考可能用 `enable_thinking`(+thinking_budget)，需联网+DASHSCOPE_API_KEY 现场核验；详见 `tmp/glm5.2-protocol-link-check.txt`。
- 接口审查：`reasoning_effort` 字段语义未变（仅在 OpenAI 兼容下发处做协议合法化），无破坏性接口变更。

## 2026-06-19 修复平台并发缺陷 #6（HTTP 客户端无超时）

- **现象**：监督 GLM5.2 自主开发时，一个 reasoning_effort=max 的长回合（多轮工具+深思考）使整个 web-console 无响应（health/state 全超时），强杀后端口残留无法重启。
- **根因**：`providers/openai_compat.rs` 与 `providers/claw_provider.rs` 的 `reqwest::Client::new()` **无任何请求超时** → 慢/挂起的上游调用使 `send_message().await` 可无限期阻塞，单回合拖到 600s+ 且不自恢复。
- **修复**：两个 provider 新增 `build_http_client()`：`connect_timeout=20s` + `timeout=600s`，给每次 LLM 调用硬上界 → 任何调用（及其可能持有的锁）在超时后必释放，服务器自恢复。
- **验证**：`cargo test -p coolzhu-llm-adapter --lib --offline` 73 passed；web-console 重编译发布后，真实 GLM5.2 回合进行中并发探活 health 7/7 HTTP200（69–108ms）——回合不再卡死全局。
- **残留**：`spawn_detached` 派生子进程继承 HTTP 监听 socket 句柄，致父进程被强杀后端口数分钟不释放（已定位，缓解=有超时后无需中途强杀；彻底修需设 socket 句柄不可继承）。详见 `tmp/glm52-supervision-findings.txt`。
