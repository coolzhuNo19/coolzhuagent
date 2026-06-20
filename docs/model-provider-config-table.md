# LLM Provider 模型配置表

> 维护日期：2026-05-08
> 
> 本表是前端 Provider/Model 下拉和后端 llm-adapter 路由的唯一配置源。
> 所有 Provider、模型、base_url、endpoint 和思考程度选项均从此表读取。

## Provider 配置总表

| Provider 名称 | Slug | Base URL | Endpoint | API 类型 | 鉴权 Env |
|---|---|---|---|---|---|
| DeepSeek | deepseek | `https://api.deepseek.com` | `/chat/completions` | OpenAI-compatible | DEEPSEEK_API_KEY |
| 智谱 AI (Z.AI) | zhipu-z | `https://open.bigmodel.cn/api/paas/v4` | `/chat/completions` | OpenAI-compatible | ZAI_API_KEY |
| 智谱 AI | zhipu | `https://open.bigmodel.cn/api/paas/v4` | `/chat/completions` | OpenAI-compatible | ZAI_API_KEY / BIGMODEL_API_KEY |
| Moonshot AI | moonshot | `https://api.moonshot.cn/v1` | `/chat/completions` | OpenAI-compatible | MOONSHOT_API_KEY |
| OpenAI | openai | `https://api.openai.com/v1` | `/chat/completions` | OpenAI | OPENAI_API_KEY |
| Anthropic | anthropic | `https://api.anthropic.com/v1` | `/messages` | Anthropic Messages | ANTHROPIC_API_KEY |
| xAI (Grok) | xai | `https://api.x.ai/v1` | `/chat/completions` | OpenAI-compatible | XAI_API_KEY |
| 阿里百炼 | alibaba | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `/chat/completions` | OpenAI-compatible | DASHSCOPE_API_KEY |
| 火山方舟 | bytedance | `https://ark.cn-beijing.volces.com/api/v3` | `/chat/completions` | OpenAI-compatible | ARK_API_KEY |
| 百度千帆 | baidu | `https://qianfan.baidubce.com/v2` | `/chat/completions` | OpenAI-compatible | QIANFAN_API_KEY |
| Ollama (本地) | ollama | `http://127.0.0.1:11434/v1` | `/chat/completions` | OpenAI-compatible | (无需) |
| OpenAI-compatible (自定义) | custom | `http://127.0.0.1:8000/v1` | `/chat/completions` | OpenAI-compatible | CUSTOM_API_KEY |

## 模型列表（按 Provider 分组）

### DeepSeek
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| deepseek-v4-pro | DeepSeek V4 Pro | `low`, `medium`, `high` | 旗舰对话模型 |
| deepseek-v4-flash | DeepSeek V4 Flash | `low`, `medium` | 快速响应 |
| deepseek-chat | DeepSeek Chat | `low`, `medium` | 标准对话 |
| deepseek-reasoner | DeepSeek Reasoner | `medium`, `high` | 深度推理模型 |

### 智谱 AI (Z.AI)
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| glm-5 | GLM-5 | `low`, `medium`, `high` | 最新旗舰 |
| glm-4.7 | GLM-4.7 | `low`, `medium`, `high` | 平衡性能 |
| glm-4.7-flash | GLM-4.7 Flash | `low`, `medium` | 快速推理 |
| glm-4.6v-flash | GLM-4.6V Flash | `low`, `medium` | 视觉快速 |
| glm-free | GLM-Free | `medium` | 免费模型 |

### 智谱 AI
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| glm-4.7 | GLM-4.7 | `low`, `medium`, `high` | |
| glm-4.7-flash | GLM-4.7 Flash | `low`, `medium` | |
| glm-4.6 | GLM-4.6 | `low`, `medium` | 上一代旗舰 |
| glm-free | GLM-Free | `medium` | |

### Moonshot AI (Kimi)
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| kimi-k2-instruct | Kimi K2 Instruct | `low`, `medium`, `high` | 旗舰代码模型 |
| kimi-k2 | Kimi K2 | `low`, `medium` | 标准版本 |

### OpenAI
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| gpt-4.1 | GPT-4.1 | `low`, `medium`, `high`, `xhigh` | 最新旗舰 |
| gpt-4.1-mini | GPT-4.1 Mini | `low`, `medium`, `high` | 轻量快速 |
| gpt-4o-mini | GPT-4o Mini | `low`, `medium`, `high` | 多模态轻量 |

### Anthropic
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| claude-sonnet-4-6 | Claude Sonnet 4.6 | `low`, `medium`, `high` | 平衡性能 |
| claude-opus-4-6 | Claude Opus 4.6 | `low`, `medium`, `high` | 最强分析 |
| claude-haiku-4-5-20251213 | Claude Haiku 4.5 | `low`, `medium` | 最快响应 |

### xAI (Grok)
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| grok-3 | Grok 3 | `low`, `medium`, `high` | 旗舰推理 |
| grok-3-mini | Grok 3 Mini | `low`, `medium` | 快速推理 |

### 阿里百炼
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| qwen-plus | Qwen Plus | `low`, `medium`, `high` | 增强性能 |
| qwen-turbo | Qwen Turbo | `low`, `medium` | 快速经济 |
| qwen-max | Qwen Max | `low`, `medium`, `high` | 旗舰推理 |
| glm-5 | GLM-5 | `low`, `medium`, `high` | 智谱旗舰(百炼通道) |

### 火山方舟
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| doubao-1-5-pro-32k-250115 | Doubao 1.5 Pro 32K | `low`, `medium` | 专业版 |
| doubao-1-5-lite-32k-250115 | Doubao 1.5 Lite 32K | `low`, `medium` | 轻量版 |

### 百度千帆
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| ernie-4.5-turbo-128k | ERNIE 4.5 Turbo 128K | `low`, `medium` | 增强性能 |
| ernie-x1-turbo-32k | ERNIE X1 Turbo 32K | `medium` | 推理增强 |

### Ollama (本地)
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| (动态，需手动输入) | — | `medium` | 用户自行 `ollama pull` 的模型 |

### OpenAI-compatible (自定义)
| 模型 ID | 显示名称 | 思考程度选项 | 备注 |
|---|---|---|---|
| custom-model | 自定义模型 | `medium` | 默认保守策略 |

---

## 思考程度分级说明

| 级别 | 值 | 说明 | 支持该级别的典型模型 |
|---|---|---|---|
| 低 | `low` | 最小推理，最快响应 | GPT-4o-mini, GLM-free 不支持 |
| 中 | `medium` | 默认推理量 | **所有模型默认支持** |
| 高 | `high` | 增强推理，适合复杂任务 | GPT-4, Claude Opus/Sonnet, DeepSeek-V4-Pro/Reasoner, Grok-3, Kimi K2 |
| 超高 | `xhigh` | 最大推理量，耗时最长 | **仅 GPT-4.1 支持** |

## 使用方式

### 前端 app.js

```js
// 直接从 PROVIDER_MODELS 读取模型列表
const models = PROVIDER_MODELS[provider]; // → ["deepseek-v4-pro", ...]

// 直接从 REASONING_EFFORT_MATRIX 读取思考选项
const levels = REASONING_EFFORT_MATRIX[model]; // → ["low", "medium", "high"]
```

### 后端 llm-adapter

```rust
// 前端选择的 provider + model → 查表获取 base_url + endpoint
// provider_client_for_agent() → 匹配 ProviderKind → 路由到对应 API
```

### 后续新增 Provider/Model

1. 更新本表（此文件）
2. 同步更新 `app.js` 中的 `PROVIDER_MODELS` 和 `REASONING_EFFORT_MATRIX`
3. 同步更新 `llm-adapter/src/providers/` 中的 ProviderMetadata + openai_compat base URL 常量
4. 更新 `index.html` 中 Provider `<select>` 选项（如需）
