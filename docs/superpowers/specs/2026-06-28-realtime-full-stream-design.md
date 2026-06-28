# Realtime Full Stream 完整闭环设计

## 目标

把当前名义上的 `full_streaming` 从“具备四个独立 readiness gate、但实际按轮停止录音并等待完整回复后朗读”的半双工流程，补齐为同一语音 turn 内可验证的连续流水线：

```text
持续麦克风采集
  -> partial/final ASR
  -> 单次用户 turn 提交
  -> 模型 message_delta
  -> 增量短句切分
  -> 流式 TTS chunk
  -> 浏览器边收边播
```

## 已确认的现状

- 浏览器已经具备 `MediaRecorder`、浏览器 partial ASR、后端最终 ASR、SSE 模型流和 TTS chunk 播放队列。
- 后端已经维护 `provider_native_partial_asr`、`far_end_reference_aec`、`realtime_model_adapter`、`streaming_tts_output` 四个 gate。
- 当前 `sttFinishDictation()` 在提交实时语音前调用 `stopAudioRealtimeState()`；监听会停止。
- 当前自动 TTS 只在 `message_done` 调用 `maybeAutoSpeakRealtimeReply()`；模型生成期间不会开始朗读。
- 当前探活和 gate 能分别证明组件工作，但不能证明四个组件属于同一 turn 的真实 Full Stream 闭环。

## 核心状态模型

前端增加单一 `RealtimeTurnController` 状态，字段至少包括：

- `turnId`：每次最终 ASR 产生的新 turn 标识。
- `generationId`：当前模型/TTS 输出代次；barge-in 后立即递增，使旧事件失效。
- `messageId`：当前 assistant 流消息。
- `committedText`：已经提交 TTS 的文本。
- `pendingText`：尚未形成稳定短句的 delta。
- `ttsRequests`：按顺序运行的增量 TTS 请求。
- `modelAbortController`：当前模型流取消句柄。
- `listening`、`reasoning`、`speaking`、`interrupted`：可观察状态。

任何异步回调在修改 UI 或播放前都必须校验 `turnId + generationId`，防止 barge-in 后旧音频继续播放。

## 数据流

### 1. 输入侧

- 实时会话启动后保持麦克风录制和 partial ASR 运行。
- 浏览器 partial 继续用于即时字幕和 barge-in；若后端配置 provider-native ASR，则以后端事件作为 readiness 证据。
- 最终 ASR 只提交一次用户消息。必须使用去重键避免浏览器 final 与后端 final 同时触发两个模型请求。
- Full Stream 模式不再为了发送消息而调用完整的音频 stop；只旋转当前录音分段或暂停提交，底层采集保持工作。

### 2. 模型侧

- `message_start` 绑定当前 assistant `messageId`。
- 每个 `message_delta` 附着到当前 turn，同时进入短句切分器。
- 切分优先使用中文/英文句末标点；无标点时使用受控长度和最大等待时间，防止首段语音长期不开始。
- `message_done` 只冲刷剩余文本和结束 turn，不再重复朗读完整消息。

### 3. TTS 侧

- 每个已经承诺的短句通过现有 `/api/audio/tts/stream` 提交，后端继续把真实音频 chunk 发布到 realtime SSE。
- 前端 TTS 队列按 turn 和 segment 排序，边收到 chunk 边播放。
- 同一短句失败时允许回落到现有分段 `/api/audio/tts/speak`；回落必须在状态和报告中可见，且不能把 gate 标记为完整流式成功。

### 4. Barge-in

确认打断时统一执行：

- 中止当前模型 fetch。
- 递增 `generationId`。
- 清空尚未提交和正在等待的 TTS 请求。
- 停止当前音频和 chunk 队列。
- 丢弃旧 turn 的后续 SSE 事件。
- 保持或恢复麦克风监听，创建新的用户 turn。

## Readiness 语义

`full_streaming_ready` 不能只依赖历史全局布尔值。完整运行证据必须满足：

- 四个 gate 都来自当前 realtime session。
- 模型 delta 与 TTS chunk 至少一次通过同一个 `turn_id` 关联。
- TTS chunk 确实进入播放队列；仅探针或仅合成成功不能冒充闭环。
- AEC 参考来自当前播放音频，barge-in 后旧参考被清理。

配置或硬件不足时，系统必须显式降级到 `half_duplex_guarded`，展示具体原因，并继续提供现有可用流程。

## 错误处理

- 麦克风权限、设备缺失、ASR/TTS 上游不可用和自动播放策略拒绝分别显示独立错误。
- 单个增量 TTS 失败不应破坏模型文本显示；允许降级朗读或仅文本完成。
- 超时、取消和用户打断使用不同状态，便于报告真实原因。
- SSE 断线后不得重放旧 turn 音频；恢复只允许从新 turn 开始。

## 测试与验收

代码测试保持最小、行为导向：

- delta 在 `message_done` 前触发首个 TTS 请求。
- `message_done` 不重复朗读已经提交的文本。
- final ASR 去重，单个用户 turn 只发送一次。
- barge-in 后旧 generation 的 TTS chunk 不播放。
- 缺少 streaming TTS、provider ASR 或当前 turn 证据时正确降级。

真实前端验收：

- 通过浏览器麦克风说一句至少两段的话，观察 partial/final、模型 delta、首个 TTS chunk 和播放时间。
- 在模型朗读中途说出强打断词，确认模型请求与音频都停止，并能继续下一轮。
- 记录首个 ASR、首个模型 delta、首个 TTS chunk、首音播放和总完成时间。
- 若真实 TTS/ASR 服务或硬件不可用，必须记录为未完成，不以探针替代。
