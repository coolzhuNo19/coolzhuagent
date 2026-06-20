# 实时视觉语音交互：代码完成度 + 下一步计划（2026-06-04）

> 用户任务3：分析当前实时视觉语音交互功能的代码完成度，以及下一步推荐完成计划。

## 一、已实现的（完成度比文档描述高很多）

### 编排层（设计完整）
`RealtimeSessionState`（main.rs）是一个**多通道实时编排状态机**：
- 通道状态：`vision_state` / `audio_in_state` / `reasoning_state` / `audio_out_state` / `barge_in_state` / `resource_state`。
- 模式：`requested_mode`/`active_mode`（`half_duplex_guarded` 半双工守护）+ `mode_downgrade_reason`（自动降级）。
- 指标：`audio_segments_received` / `audio_bytes_received` / `partial_transcripts_received` / `last_partial_*`。
- barge-in：`RealtimeBargeInPolicy` + `/api/realtime/session/barge-in/evaluate`（打断策略评估）。
- 路由齐全：`/api/realtime/session/{status,start,stop}`、`/api/audio/realtime/{status,start,stop,segment,partial}`、
  `/api/vision/realtime/{status,elements,events,start,stop,frame}`。

### 音频输入（真实录音链路 ✅）
- 前端 `audioRealtimeStart()`：`getUserMedia` 拿麦克风 → `MediaRecorder`(opus/webm) →
  `sttRecorder.start(250)` 每 250ms 分片 → `ondataavailable` → `reportAudioRealtimeSegment(blob)`。
- **真实浏览器录音 + 分段上报**，不是骨架。

### 视觉（UI-DETR 实时感知，已建管线）
- `/api/vision/realtime/*`：start/stop 轮询、元素表、SSE events、frame 接收（见 showui-vs-uidetr 文档 06-03 记录）。
- 默认无检测后端时返回 `waiting_for_detection_backend`，不空转。

### 前端 UI（真实可见入口）
- index.html：实时开始/停止、barge-in 场景选择+评估、语音开始/停止、状态 `<pre>` 展示。
- app.js：完整事件绑定 + 状态轮询 + SSE 订阅。

## 二、核心缺口（关键完成度短板）

### 🔴 缺口1：音频分段"收了但没转写"
`api_audio_realtime_segment`（main.rs:29763）的真相：
```rust
let bytes = request.bytes.unwrap_or(0);          // 只收"字节数"
let _duration_ms = request.duration_ms...;        // 收了不用
let _mime_type = request.mime_type...;            // 收了不用
let _final_segment = request.final_segment...;    // 收了不用
// → 只做 audio_segments_received += 1, audio_bytes_received += bytes
```
**前端录了真实音频 blob，但 segment 端点只上报/累加字节计数，不接收音频内容、不转写。**
真正的转写仍走 **turn-based** 的 `/api/audio/stt/data`（stop 后整段 whisper 转）。
→ 即"实时分段 STT"是**空壳**：有分段循环和计数，但没有"分段音频→增量转写文本"。

### 🟡 缺口2：partial 转写靠外部喂
`/api/audio/realtime/partial` 接收 partial 文本（`last_partial_text`），但**没有内部 ASR 产生 partial**，
`partial_asr_provider` 默认 "none"——partial 要靠外部流式 ASR 喂进来，当前无本地流式 ASR。

### 🟡 缺口3：视觉真实检测后端未接
UI-DETR 实时感知管线齐全，但**无真实检测权重/服务**（需用户起 `/detect` 服务并配 base_url）。
当前 vision 实时环是"等待检测后端"状态。

### 🟡 缺口4：TTS 回复非流式
`audio_out_state` 编排已有，但 TTS 仍是整段合成（Piper/IndexTTS HTTP），未分片流式播放。

## 三、完成度总评

| 子系统 | 完成度 | 说明 |
| --- | --- | --- |
| 实时编排状态机 | ✅ 90% | 多通道状态/模式降级/barge-in 策略齐全 |
| 音频录音上报 | ✅ 80% | 真实 getUserMedia+MediaRecorder 分段；但只报字节数不传音频 |
| **分段实时 STT** | 🔴 20% | **只计数不转写**，真转写仍 turn-based |
| partial 流式转写 | 🔴 15% | 端点在，但无本地流式 ASR 产生 partial |
| 视觉实时检测 | 🟡 60% | 管线/解析/SSE 齐全，缺真实检测后端 |
| TTS 流式回复 | 🟡 40% | 编排有，合成非流式 |
| 前端 UI | ✅ 85% | 入口/状态/barge-in 评估都在 |

**一句话**：实时语音是"**编排骨架 + 真实录音 + 真实 UI 都到位，但分段 STT/partial 转写这一最关键的实时环是空的**"——
当前实际能跑通的是 **turn-based push-to-talk**（录一段→stop→whisper 转→发给 agent），不是真流式。

## 四、下一步推荐完成计划（按价值/成本排序）

### P0：打通"分段音频 → 增量转写"（让实时 STT 名副其实）
1. **前端**：`reportAudioRealtimeSegment` 改为真正上传**音频 blob**（multipart/二进制），而非只报字节数。
2. **后端 `api_audio_realtime_segment`**：接收音频分段 → 落临时文件 → 喂 whisper.cpp（whisper-cli 支持流式/分段）
   → 产生增量转写 → 更新 `last_partial_text` / `partial_transcripts_received` → SSE 推前端。
   - whisper.cpp 有 stream 模式可考虑；或对滑动窗口的累积音频做重转写（简单但重）。
3. **VAD 切分**：用静音检测（前端 Web Audio AnalyserNode 或后端能量阈值）决定"一句话结束"→ final segment → 自动发给 agent。
4. 验证：说话 → 实时看到 partial 文本滚动 → 停顿后自动成句发送。

#### 2026-06-05 进展

- P0 的第一段数据通路已落地：前端 `reportAudioRealtimeSegment(blob)` 会把 MediaRecorder blob 读成 data URL 并发送给 `/api/audio/realtime/segment`。
- 后端 segment 端点已支持 `audio_base64`，解码后写入 `./.coolzhu/audio-realtime/chunks/*.webm`，并在 audio/realtime/unified session 状态中暴露 `audio_payload_chunks_received`、`last_audio_payload_bytes`、`last_audio_chunk_path`。
- 任务卡 `任务链` 中的 Audio input loop 已显示 `payload_chunks` 和 `last_payload`，可以确认真实音频片段已经进入后端。
- Final segment 已接入本地 STT 尝试：`final_segment=true` 且存在 payload 文件时，后端会调用 `SttEngine`，并把结果作为 `local_stt_final` 回灌到 realtime partial/final 状态；前端停止录音时会先发送完整 Blob 的 final segment，若拿到 `asr_text` 就跳过旧 `/api/audio/stt/data` + `/api/audio/stt/stop` 回退路径。
- HTTP smoke（固定端口 `8765`）确认 final segment 会返回 `asr_attempted=true`、`asr_provider=local_stt_final`；无效 webm payload 会把 Python whisper 的 `Invalid data` 诊断准确写入 unified realtime status。
- 2026-06-05 有效音频验收：使用 Windows TTS 生成真实语音 WAV，再用 PyAV/Opus 转成浏览器同类 `audio/webm`；POST 到 `/api/audio/realtime/segment` 后，后端返回 `asr_attempted=true`、`asr_transcript_received=true`、`asr_provider=local_stt_final`，并把 `last_partial_text` 写入 unified realtime session。
- Python whisper 路径已修复两点根因：模型名不再硬编码为 `medium`，而是从配置模型路径推导；`webm/opus` 解码后的 48kHz audio 会重采样到 Whisper 需要的 16kHz，避免有效浏览器音频被空转写。
- Windows native STT 仍只接受 WAV；当前 PATH 和 Codex bundled native bin 均未发现 `ffmpeg`，所以 native fallback 不能直接处理浏览器 webm。当前可用路径是系统 Python + whisper/PyAV final segment，本地真流式 partial ASR 仍待接入 provider/native streaming adapter。

### P1：TTS 分片流式回复
- 复用已有 `TtsStreamResult` + `DEFAULT_TTS_MAX_SEGMENT_CHARS` 分段，把"整段 wav"改为"分句合成→边到边播"，
  前端用 MediaSource/队列播放。配合 barge-in：用户插话 → 停当前 TTS。

### P2：视觉实时检测接真实后端
- 用户本机/远端起 UI-DETR `/detect` 服务，配 `vision.router.detection.base_url` → 实时元素表真实流动。
- 与语音环整合：关键帧元素表 + 语音意图 → 大模型决策（双环架构，见 showui-vs-uidetr 文档）。

### P3：端到端实时助手模式
- listening / transcribing / thinking / speaking 状态机闭环 + barge-in 实战 + 视觉上下文注入。

## 五、结论
- 实时交互的**架构和编排是完整且设计良好的**（多通道状态机 + barge-in + 模式降级），前端录音和 UI 也是真的。
- **最该补的是 P0**：把 segment 端点从"只计数"升级为"真接收音频 + whisper 增量转写"，
  这一步打通后，实时语音就从"伪装的 turn-based"变成"真流式"。成本中等（前端改上传 + 后端接 whisper 分段），价值最高。
