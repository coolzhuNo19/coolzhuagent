# TTS + STT 现状梳理与 IndexTTS 自定义音色方案（2026-05-30）

> 任务15：梳理 TTS+STT 代码现状，制定前端页面显示方案，评估加入 IndexTTS 实现音色自定义配置。

## 一、当前代码现状（`web-console/src/audio.rs` ≈1770 行 + 路由 in main.rs）

### STT（语音转文字）
- 后端 `SttConfig { whisper_cpp_path: "whisper-cli", ... }`：基于 **whisper.cpp**（`whisper-cli`）。
- 流程：录音会话 `SessionManager`/`RecordingSession`（start/stop/data）→ whisper 转写 → `SttResult`。
- 路由：`POST /api/audio/stt/start`、`/stt/stop`、`/stt/data`。
- 常量：`DEFAULT_STT_TIMEOUT_SECS = 120`。
- 形态：**单段录音→转写**（非流式实时）。

### TTS（文字转语音）
- 后端 `TtsConfig { piper_path: "piper", voice_configs: builtin_voices(), ... }`：基于 **Piper**。
- `VoiceConfig`（内置音色，`from_name` 查找）；`TtsResult` / `TtsStreamResult`（已有分段流式骨架）。
- 路由：`POST /api/audio/tts/speak`。
- 常量：`DEFAULT_TTS_TIMEOUT_SECS = 30`、`DEFAULT_TTS_MAX_SEGMENT_CHARS = 480`（长文本分段）。
- 形态：Piper 固定预训练音色，**不支持音色克隆/自定义**。

### 状态与监控
- `AudioStatus { stt_available, tts_available, stt_model, tts_model, stt_device, tts_device, voice_monitor_* }`。
- 语音监控：`/api/audio/voice-monitor/status`、`/toggle`（唤醒词/常听模式骨架）。
- 诊断：`audio_health_check` 已接入健康检查。

### 小结
能力已较完整（STT=whisper.cpp，TTS=piper，含状态/监控/分段流式骨架），**最大缺口 = 自定义音色（克隆）**，这正是 IndexTTS 要补的。

## 二、IndexTTS 评估（来自调研）
- IndexTTS（B 站开源）：GPT 式神经 TTS，**零样本音色克隆**（给一段参考 wav + 文本 → 用参考音色合成），中英俱佳、自然度高；IndexTTS2 增强克隆 + 情感/时长控制。
- 与 Piper 对比：Piper 轻量快、固定音色、**不能克隆**；IndexTTS 偏重（倾向 GPU）、**支持自定义音色克隆**。
- 运行：本地 PyTorch，提供 Python 推理 API / Web UI。

→ **结论**：IndexTTS 适合作为"高质量 + 自定义音色"的 TTS 后端，与 Piper 并存（Piper 走快速/低配，IndexTTS 走高质量/克隆）。

## 三、接入方案（与现有架构对齐，最小改动）

### 后端：TTS 后端抽象 + IndexTTS 适配
1. 在 audio.rs 引入 `TtsBackend` 概念（枚举 `Piper | IndexTts`），`TtsConfig` 增加 `backend` 字段 + `index_tts` 子配置（可执行/服务地址、参考音色目录）。
2. IndexTTS 以**本地 HTTP 服务**形态接入（与本地 VLM 同模式：起一个 Python 服务，Rust 侧 HTTP 调用），避免把 Python 依赖塞进 Rust 进程。
   - 新增 `synthesize_with_indextts(text, voice_ref_wav)`：POST 到 IndexTTS 服务 → 返回 wav。
3. **音色自定义**：`VoiceConfig` 扩展 `kind: builtin | cloned`、`reference_audio_path`（克隆音色的参考 wav）；新增"注册自定义音色"= 上传参考 wav + 命名 → 存入 voice 目录。
4. 复用现有 `DEFAULT_TTS_MAX_SEGMENT_CHARS` 分段 + `TtsStreamResult` 流式骨架。

### 新增/调整路由
- `GET /api/audio/voices`：列出全部音色（builtin + cloned），含来源与可用性。
- `POST /api/audio/voices`（multipart）：上传参考 wav + 名称 → 注册克隆音色（IndexTTS）。
- `DELETE /api/audio/voices/{name}`：删除自定义音色。
- `POST /api/audio/tts/speak` 扩展：入参可选 `voice`（音色名）、`backend`。

### 前端页面方案（音频/语音设置面板）
建议在「设置」窗口或独立「语音」面板内分三区：
1. **STT 区**：麦克风选择、whisper 模型/设备状态灯、录音→转写按钮、转写结果框；唤醒词/常听开关（voice-monitor）。
2. **TTS 区**：后端选择（Piper 快速 / IndexTTS 高质量克隆）、音色下拉（builtin + cloned）、试听按钮、语速/情感（IndexTTS2）滑杆。
3. **自定义音色区**（IndexTTS）：上传参考音频（拖拽 wav）+ 命名 → "创建音色"；音色卡片列表（试听/删除）；状态：克隆中/可用/失败。
- 状态来源：`/api/audio/status` + `/api/audio/voices`，用红/绿/灰状态灯（与项目既有风格一致）。

## 四、落地优先级
- **P0**：`GET /api/audio/voices` + 前端音色下拉与状态展示（先把现有 Piper 音色暴露出来，打通"音色可选"UI）。
- **P1**：IndexTTS 本地 HTTP 服务适配 + `TtsBackend` 抽象 + speak 走 IndexTTS。
- **P2**：自定义音色上传/注册/删除（克隆）全链路 + 前端自定义音色区。
- **P3**：STT/TTS 流式实时化（配合任务14 的实时窗口助手：流式 whisper + 流式 IndexTTS）。

## 五、风险/前置
- IndexTTS 需 Python + 可能 GPU；要像本地 VLM 那样提供"资源安装/启动"引导与健康检查（复用 `local_vlm_resource_launcher_hint` 模式）。
- 克隆音色涉及声音版权/合规，UI 上应加使用提示。
- 参考音频质量直接影响克隆效果，需在上传区给出时长/采样率建议。

## 六、2026-05-31 实时语音交互补充设计

### 推荐形态
- **第一阶段：半实时 push-to-talk**。前端点击“实时语音开始”后开始浏览器录音；点击“停止语音”后上传录音、调用现有 STT、把转写文本送入聊天室并发送给当前会话对象。这一阶段不要求连续流式，但用户能完成“说一句 → 发送给 Agent → 得到回复”的真实交互闭环。
- **第二阶段：IndexTTS HTTP 后端**。Rust 不嵌 Python，`coolzhu.toml [audio.index_tts] base_url` 指向本地 IndexTTS/IndexTTS2 服务；`/api/audio/tts/speak` 可通过 `backend = "indextts"` 调用服务并返回 wav。
- **第三阶段：全流式**。把录音分片从“stop 后转写”升级为 VAD/分片 STT，把 TTS 从整段 wav 升级为分片播放，并在前端显示 listening / transcribing / thinking / speaking 状态。

### 当前落地边界
- 已新增前端“实时语音开始 / 停止”入口和 `/api/audio/realtime/*` 状态桥。
- 已新增 `/api/audio/voices` 暴露 Piper 内置音色和后续 IndexTTS 克隆音色。
- 已新增 IndexTTS HTTP 适配层：默认 endpoint 为 `<base_url>/tts`，也接受显式 `/tts`、`/synthesize`、`/api/tts`、`/api/synthesize`。
- 当前默认 `coolzhu.toml` 未配置 IndexTTS 服务时仍走 Piper/Windows TTS 回退，不阻塞 STT/TTS 基础能力。

## 七、2026-06-03 健康状态落地

- `/api/audio/voices` 现在返回 `index_tts_available`，语义为真实 IndexTTS HTTP 服务可探活，而不是仅判断是否配置了 `base_url`。
- 前端音频状态区区分三种状态：
  - `未配置`：没有 IndexTTS base URL。
  - `已配置，未连接`：有 base URL，但健康检查不可用。
  - `可用 <backend>`：IndexTTS 健康检查通过。
- 统一 realtime 状态 JSON 继续暴露 `tts_available`、`tts_backend`、`index_tts_base_url`，并在 `/api/audio/realtime/status` 与 `/api/realtime/session/status` 中带上 `index_tts_available`，用于后续任务链判断是否允许启用高质量克隆音色。
- 当前本机验证结果：`backend=piper`、`index_tts_base_url=null`、`index_tts_available=false`，符合“未配置但 Piper fallback 可用”的预期。
