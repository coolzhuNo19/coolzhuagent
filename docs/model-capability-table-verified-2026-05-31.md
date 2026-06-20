# 模型能力总表（联网核实版，2026-05-31）

> 用户要求：联网搜索确认各模型上下文容量 + thinking 程度，为 models 总表做准备。
> 本表数据来源 = WebSearch 联网核实（已附来源链接），用于校正代码 `MODEL_TOKEN_LIMITS`
> (`modules/llm-adapter/packages/llm-adapter/src/providers/mod.rs`) 与思考档矩阵。
> ⚠️ 仅排查与登记，**不在本轮改代码**（用户指定只做规划）。

## 一、联网核实结果 vs 代码现值（context_tokens）

| 模型 | 代码现值 | 官网真实值(联网) | 偏差 | max_output(官网) | 来源 |
| --- | ---: | ---: | --- | ---: | --- |
| deepseek-v4-pro | **1_000_000**✅(本轮已修) | 1,048,576 (≈1M) | 已修对 | 384,000 | OpenRouter/HF/NVIDIA |
| deepseek-v4-flash | **1_000_000**✅(本轮已修) | ≈1M(同系列) | 已修对 | 待确认 | 同上 |
| deepseek-chat | 64_000 | ≈1M(V4 系列) | ❌ 偏小 | — | 同上 |
| deepseek-reasoner | 64_000 | ≈1M(V4 系列，Think Max 建议≥384K) | ❌ 偏小 | — | 同上 |
| glm-5 | 128_000 | **200,000** | ❌ 偏小 | — | glm5.net/arxiv |
| glm-5.1 | 128_000 | 200,000(同代) | ❌ 偏小 | — | 同上 |
| glm-4.7 | 128_000 | **200,000** | ❌ 偏小 | 128,000 | aicybr/macaron |
| glm-4.7-flash | 128_000 | 200,000(同代) | ❌ 偏小 | — | 同上 |
| glm-4.6v-flash | 128_000 | 200,000(GLM-4.6 系) | ❌ 偏小 | — | intuitionlabs |
| qwen-max / qwen3.7-max | 128_000 | **1,000,000** | ❌ 严重偏小 | 65,536 | Qwen 官方/OpenRouter |
| qwen-plus / qwen-turbo | 128_000 | 1,000,000(3.x 代) | ❌ 偏小 | 65,536 | 同上 |
| claude-opus-4-6/4-7 | 200_000 | **1,000,000**(Claude Code 计划) / 500K(普通) | ❌ 偏小 | 64,000 | Claude 官方 |
| claude-sonnet-4-6 | 200_000 | 1,000,000(Claude Code) | ❌ 偏小 | — | 同上 |
| grok-3 | 128_000 | **1,000,000** | ❌ 严重偏小 | — | x.ai 官方 |
| grok-3-mini | 128_000 | 1,000,000(同代) | ❌ 偏小 | — | 同上 |
| gpt-4.1 / gpt-4.1-mini | 1_000_000✅ | 1,000,000 | 对 | 32,768 | OpenAI 官方 |
| gpt-4o-mini | 128_000✅ | 128,000 | 对 | 16,384 | OpenAI |
| ernie-4.5-turbo-128k | 128_000✅ | 131,072 | 基本对 | 12,000 | Baidu/OpenRouter |
| doubao-1-5-pro-32k | 32_000✅ | 32K~256K(此型号 32K) | 对(该型号) | — | 火山引擎 |

**结论**：代码表**大面积偏小**——deepseek/qwen/grok 实际 1M、glm 实际 200K、claude 实际可达 1M，
代码却多按 64K/128K/200K 登记。这会让长会话历史预算（×55%）被严重低估，浪费大窗口模型能力。

## 二、思考程度（thinking/reasoning）核实

| 模型族 | 是否支持显式思考档 | 备注 |
| --- | --- | --- |
| deepseek-reasoner / deepseek-v4(Think Max) | ✅ | DeepSeek 有 "Think Max" 推理模式，reasoning trace 占上下文 |
| glm-4.7 / glm-5 | ✅ | "thinks before acting，可按请求控制 thinking 速度/精度" |
| qwen3.7-max | ✅ | "reasoning agent model" |
| claude-opus/sonnet | ✅ | 原生 extended thinking |
| grok-3 | ✅ | "Age of Reasoning Agents"，有 think 模式 |
| doubao-1.5-pro | ✅ | "Deep Thinking 模式" |
| ernie-4.5 | 部分 | 有 Thinking 变体(ERNIE-4.5-21B-A3B-Thinking) |
| gpt-4o-mini / 纯指令模型 | ❌ | 无显式思考档 |

→ 当前 web 侧 `model_reasoning_options`（字符串匹配 glm-5/deepseek/claude/grok/qwen→全档）**方向对但维护散乱**，
应并入 model 总表统一管理（见任务 R-MODELTAB-01 / 任务#23）。

## 三、建议的总表结构（下轮实施 R-MODELTAB-01）

把 `ModelTokenLimit` 扩展为统一 `ModelCapability`，从一处取所有参数：
```rust
struct ModelCapability {
    model: &'static str,
    context_tokens: u32,        // 上下文容量（按本表官网值）
    max_output_tokens: u32,     // 最大输出
    reasoning: ReasoningSupport // None | Levels(&[低/中/高/xhigh/max])
}
```
- web 的 `model_reasoning_options`、`/api/models/capabilities`、`context_build_options_for_agent`
  全部改为查 `ModelCapability`，消除字符串匹配与多处硬编码。
- 容量按本表逐条更正（deepseek-chat/reasoner→1M、glm→200K、qwen→1M、claude→1M、grok→1M）。

## 四、待办（登记需求 R-MODELTAB-01 / 任务#22 #23）
1. 按本表更正 `MODEL_TOKEN_LIMITS` 全部容量（本轮只规划，不改）。
2. 把 thinking 档并入总表，各处查表（任务#23）。
3. max_output 也按本表登记（deepseek 384K、qwen 65K、gpt-4.1 32K 等）。
4. 自定义模型仍走会话级可配（用户上轮提的"会话配置可设上下文容量"）兜底。

## 来源链接（联网核实）
- DeepSeek V4 Pro：[OpenRouter](https://openrouter.ai/deepseek/deepseek-v4-pro)、[HF blog](https://huggingface.co/blog/deepseekv4)
- GLM-4.7/5：[aicybr](https://aicybr.com/blog/glm-4-7-deep-dive)、[glm5.net](https://glm5.net/)
- Qwen3.7-Max：[OpenRouter](https://openrouter.ai/qwen/qwen3-max)、[MarkTechPost](https://www.marktechpost.com/2026/05/21/qwen-introduces-qwen3-7-max-a-reasoning-agent-model-with-a-1m-token-context-window/)
- Claude：[Claude 官方](https://support.claude.com/en/articles/8606394-how-large-is-the-context-window-on-paid-claude-plans)
- Grok 3：[x.ai](https://x.ai/news/grok-3)
- GPT-4.1：[OpenAI](https://openai.com/index/gpt-4-1/)
- Doubao/ERNIE：[XRoute](https://xroute.ai/techblog/doubao-1-5-pro-256k-250115-full-review-performance-analysis/)、[OpenRouter ERNIE](https://openrouter.ai/baidu/ernie-4.5-300b-a47b)
