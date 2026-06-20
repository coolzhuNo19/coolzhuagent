# Gemma 4 12B 本地部署方案（llama.cpp CUDA，2026-06-15）

> 网络现状：本机外网/CDN 均 ~12 KB/s（HF、ModelScope、阿里云、清华皆然，非沙箱、无代理），
> 我这边无法下 7GB 级文件。**模型请手动下载**（用下载工具/IDM/更快网络），路径放好后按本文命令启动。

## 1. 硬件与构建（已验证）

- GPU：RTX 3070 Ti Laptop，**8 GB 显存**（空闲 ~7.1 GB），驱动 596.36。
- **用 CUDA 12.4 构建**：`llama-b9637-bin-win-cuda-12.4-x64`（已 `--list-devices` 实测识别到 CUDA0）。
  - ⚠️ `cuda-13.3` 构建 `--list-devices` 为空（驱动 596 对 13.3 偏旧，不识别）→ 不用。

## 2. 模型选型（8 GB 显存）

Gemma 4 12B 为**多模态**（text/image/audio/video）。GGUF + mmproj：

| 量化 | 大小 | 适用 |
|---|---|---|
| **Q4_K_M** | 7.38 GB | 推荐，质量好；需部分 offload（-ngl ~30） |
| Q3_K_M | 6.09 GB | 更省显存→可多放 GPU 层（更快），质量略降 |
| Q4_K_S | 7.17 GB | 介于两者 |
| mmproj-F16 | 0.12 GB | 视觉投影（要图像理解时加） |

## 3. 下载地址（手动下载）

**ModelScope（国内优先，`Abiray/gemma-4-12b-it-GGUF`）**
- 页面：https://modelscope.cn/models/Abiray/gemma-4-12b-it-GGUF
- Q4_K_M：https://modelscope.cn/models/Abiray/gemma-4-12b-it-GGUF/resolve/master/gemma-4-12b-it-Q4_K_M.gguf
- Q3_K_M：https://modelscope.cn/models/Abiray/gemma-4-12b-it-GGUF/resolve/master/gemma-4-12b-it-Q3_K_M.gguf
- mmproj：https://modelscope.cn/models/Abiray/gemma-4-12b-it-GGUF/resolve/master/mmproj-F16.gguf
- CLI（更稳，断点续传）：`pip install modelscope` 后
  `modelscope download --model Abiray/gemma-4-12b-it-GGUF gemma-4-12b-it-Q4_K_M.gguf --local_dir C:\Users\zhupu\llama.cpp\models`

**HuggingFace（官方社区 `ggml-org`，备选）**
- 页面：https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF
- Q4_K_M：https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf
- mmproj：https://huggingface.co/ggml-org/gemma-4-12B-it-GGUF/resolve/main/mmproj-gemma-4-12B-it-bf16.gguf

**放置路径**（已建好 `models` 目录）：`C:\Users\zhupu\llama.cpp\models\gemma-4-12b-it-Q4_K_M.gguf`

## 4. 启动命令（下载完成后）

```powershell
& "C:\Users\zhupu\llama.cpp\llama-b9637-bin-win-cuda-12.4-x64\llama-server.exe" `
  -m "C:\Users\zhupu\llama.cpp\models\gemma-4-12b-it-Q4_K_M.gguf" `
  --host 127.0.0.1 --port 8082 `
  -ngl 30 -c 4096 --jinja
```
- 视觉（多模态）再加：`--mmproj "C:\Users\zhupu\llama.cpp\models\mmproj-F16.gguf"`
- 验证：`curl http://127.0.0.1:8082/v1/models`；OpenAI 兼容 `/v1/chat/completions`。

## 5. `-ngl` 调优（8 GB 关键）

Q4_K_M 权重 7.38 GB > 7.1 GB 空闲 → **不能全量 offload**，须部分：
- **实测最优（2026-06-16，Q4_K_M + mmproj 视觉，8GB）**：**`-ngl 33`** → VRAM 7465/8192（余 ~553M 稳定）、生成 **7.66 tok/s**。
  - 对比 `-ngl 28`：5.67 tok/s（余 1346M，偏保守）→ 33 提速约 **+35%**。
  - `-ngl 36`：余量仅 157M、warmup 卡死/不可用。**33 是 8GB + 视觉的安全上限**。
- 不带视觉（去掉 `--mmproj`）可再多放几层（省 ~600M）；换 **Q3_K_M**（6 GB）可 `-ngl 40+` 更快。
- 调参后看启动日志 `offloaded N/M layers` + `nvidia-smi`，留 ≥400M 余量防 OOM。
- 上下文 `-c`：8 GB 下建议 4096；KV cache 占显存，调大需相应降 `-ngl`。

## 6. 接入 coolzhu

llama-server 是 OpenAI 兼容端点。在 Web 控制台新建/改一个会话：
- provider=`Custom`，base_url=`http://127.0.0.1:8082/v1`，model=`gemma-4-12b-it`（名字随意），api_key 任意。
- 之后该会话/角色（含 goal 的 commander/planner/implementer/verifier）即走本地 Gemma。

## 7. 资源协调（重要）

8 GB 显存：Gemma 12B Q4 占 ~7 GB，**无法与重型视觉模型（UI-DETR / ShowUI）同时常驻**。
- `coolzhu.toml` 已是 `[vision.router.resource_switch] mode=single_active_model`；跑 Gemma 时确保视觉模型按需加载/释放。
- 语义记忆嵌入 bge-m3（8081）仅 ~0.6 GB，可与 Gemma 共存。
