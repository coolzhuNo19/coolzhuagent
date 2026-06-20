# Gemma 4 12B 本地部署实施方案（押后执行）

- 日期：2026-06-14
- 需求编号：`CUR-LOCAL-LLM-001`
- 状态：方案待执行，**优先级低于** `CUR-MEM-ARCH-001`（记忆架构）
- 前置：建议先完成记忆架构 P1（语义检索）——其 embedder 是小模型，与本重型部署解耦
- 关联：`docs/plans/agent-memory-architecture-plan-2026-06-14.md`

> 本方案把 Gemma 4 12B 作为**本地生成模型**接入现有 `llm-adapter`。因其占用较多硬件资源，单列文档并给出**启动前的资源释放清单**。

---

## 0. 为什么押后

- 12B 重型模型对 8GB 显存是"勉强可跑"，需混合卸载，且会与 agent 其它占资源功能（桌宠 / 3D / 视觉 / 多会话）争用显存与内存。
- 记忆架构所需的 **embedder 是独立小模型（~0.5–1GB）**，不依赖本部署。**先做记忆、后上 12B** 是更稳的顺序。

---

## 1. 设备前提

| 部件 | 规格 | 约束 |
|---|---|---|
| GPU | RTX 3070 Ti Laptop **8GB** | 可用显存约 6.5GB（扣桌面） |
| 内存 | 16GB | 混合卸载上限；12B Q4≈7.7GB 可装入 |
| CPU | i9-12900H 14C/20T | 卸载层由 CPU 承担 |

---

## 2. 量化与显存预算（12B GGUF）

| 量化 | 体积 | 8GB 可行性 |
|---|---|---|
| Q4_K_M | 7.66GB | 需混合卸载（KV 会挤爆） |
| **IQ4_XS** | **6.78GB** | ✅ 近全 GPU，留 KV 空间（推荐） |
| Q3_K_XL | 6.90GB | ✅ 类似 |
| IQ2_M/S | 4.7–4.9GB | 极限低 bit，质量降 |

---

## 3. 部署方案（二选一）

### 方案 A — Ollama（最省事，llm-adapter 默认端口已指向）
```powershell
ollama pull gemma4:12b        # 默认 Q4_K_M，自动 GPU/CPU 混合卸载
ollama pull bge-m3            # 记忆架构 A 的 embedder（小）
ollama serve                  # 127.0.0.1:11434，自带 /v1 OpenAI 兼容
```

### 方案 B — llama.cpp TurboQuant fork（要 KV 压缩 + 精细控显存）
```powershell
.\llama-server -hf bartowski/gemma-4-12B-it-GGUF:IQ4_XS `
  -ngl 99 -ctk turbo3 -ctv turbo3 -fa on -c 16384 `
  --host 127.0.0.1 --port 11434 --api-key ollama
```
- OOM → 降 `-ngl`（40→30→26），`nvidia-smi` 观察显存。
- `turbo3` = 3bit KV（~4.3× 压缩），换更长上下文。

---

## 4. 接入 llm-adapter（写配置，零改码）

`%USERPROFILE%\.coolzhu\config.json`（路径见 `llm-adapter/.../config.rs:60-65`）：
```json
{
  "providers": {
    "local": { "base_url": "http://127.0.0.1:11434/v1", "api_key_env": "CUSTOM_API_KEY" }
  },
  "models": {
    "gemma4-12b":  { "provider": "local", "api_model_id": "gemma4:12b" },
    "local-embed": { "provider": "local", "api_model_id": "bge-m3" }
  }
}
```
```powershell
setx CUSTOM_API_KEY ollama   # Ollama 不校验，但客户端需非空 key
```
> `custom` provider 默认 base_url 已是 `127.0.0.1:11434/v1`（`openai_compat.rs:24`）。

---

## 5. 启动 12B 前的资源释放清单（关键）

8GB 显存 + 16GB 内存下，跑 12B 需先腾资源。**建议在 web-console 增加一个"端侧大模型模式"开关**，开启时按下表降载：

| 占用源 | 释放动作 | 省下 |
|---|---|---|
| 桌宠 / Tauri 桌面壳（gui-desktop） | 关闭或最小化 | 显存 + 内存 |
| web-console 3D（three.js / 飞船舰桥等） | 停渲染 / 切 2D 轻量皮肤 | 显存 + GPU |
| 视觉模型（modules/vision 截图理解） | 暂停常驻视觉，仅按需调用 | 显存 |
| 并发会话 / 自动 Goal 循环 | 限并发为 1，暂停后台阶段调度 | 内存 + 算力 |
| 浏览器多标签 / 其它 GPU 占用程序 | 提示用户关闭 | 显存 1–2GB |
| KV 上下文 | `-c` 调小 + `turbo3` 压缩 | 显存 |

> 落地建议：把上述开关做成 `local_llm_mode`，启用即广播给 gui-desktop / vision / goal 调度器降载；关闭即恢复。具体接线点待开工时定位。

---

## 6. 多模态对接（与现有模块打通）

- Gemma 4 12B 原生支持图像/音频输入。
- 接 `modules/vision`（截图理解）、`modules/computer-use`（界面坐标）：截图 → 12B 多模态 → 决策。
- 与记忆架构 A 的多模态记忆（未来）共用同一本地栈。

---

## 7. 验证

```powershell
curl http://127.0.0.1:11434/v1/models
curl http://127.0.0.1:11434/v1/chat/completions -H "Content-Type: application/json" `
  -d '{"model":"gemma4:12b","messages":[{"role":"user","content":"你好"}]}'
```
- 经 llm-adapter 走一轮真实会话，确认流式正常、中文不乱码。

---

## 8. 现实预期与回退

| 配置 | 速度 | 备注 |
|---|---|---|
| 12B IQ4_XS 混合卸载 | ~10–20 tok/s | 资源释放后较稳 |
| **Gemma 4 E4B 全 GPU** | **30+ tok/s** | **回退首选**，质量略降但流畅、无需大幅降载 |

> 风险：12B 在本机始终是"勉强跑"。若体验不佳，回退 E4B；重活交远端 provider（llm-adapter 已支持），12B 仅做离线/隐私场景。

---

## 9. 执行顺序

1. （前置）记忆架构 P1 完成，`bge-m3` embedder 已用起来。
2. 选方案 A/B 起 12B 服务。
3. 写 `config.json` + `CUSTOM_API_KEY`，接 llm-adapter。
4. 实现 `local_llm_mode` 资源释放开关。
5. 验证 + 决定 12B 常驻 or E4B 回退。
