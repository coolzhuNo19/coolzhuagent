# Realtime Vision Voice Session Design

## Goal

把 UI-DETR 实时视觉、语音输入、模型推理、工具调用和最终回复 TTS 收敛到一个统一的 realtime session 状态机。首版目标是让前端可以用一个实时交互入口观察和控制整体状态，并把回声、背景声和用户真实打断的判定策略固化为可配置、可测试的数据结构。

## Sources And Constraints

- WebRTC / browser media capture supports audio constraints such as `echoCancellation`, `noiseSuppression`, and `autoGainControl`.
- WebRTC Audio Processing Module, SpeexDSP, and PipeWire echo-cancel all rely on the same engineering principle: acoustic echo cancellation needs near-end microphone input plus far-end playback reference.
- Current COOLZHU implementation already has:
  - UI-DETR realtime perception routes: `/api/vision/realtime/*`.
  - Half-realtime audio routes: `/api/audio/realtime/*`.
  - STT as record-then-transcribe, not true streaming.
  - TTS route `/api/audio/tts/speak`, with `auto_play` support and browser-controlled playback through returned audio URLs.
- Do not hardcode local paths or environment-only switches.
- Realtime mode must play only final model replies through TTS, not reasoning, tool calls, or goal flow content.

## Architecture

Create a thin `RealtimeSession` orchestration layer in web-console. It does not replace the existing audio or vision APIs; it coordinates them and exposes a single state snapshot.

```text
RealtimeSession
├─ VisionLoop: UI-DETR realtime perception status and element table
├─ AudioInputLoop: microphone capture, browser AEC/NS/AGC constraints, STT bridge
├─ ReasoningLoop: current chat session/model turn
├─ ToolLoop: computer-use/showUI/file tools when the model asks for action
├─ AudioOutputLoop: final reply TTS only
└─ BargeInGuard: echo/background/interruption classification policy
```

The first implementation phase keeps the existing push-to-talk STT transport. It adds the unified state machine, browser audio constraints, policy payloads, and UI visibility. True streaming STT, far-end reference AEC, and continuous barge-in cancellation are separate phases built on the same state model.

## State Machine

Primary state:

```text
Idle -> Starting -> WarmingVision -> Listening -> UserSpeaking
     -> Endpointing -> Thinking -> Tooling -> Speaking -> Listening
```

Any state can move through:

```text
Interrupted -> Pausing -> Stopping -> Error -> Recovering
```

Parallel substates:

```text
vision: off | warming | running | degraded | error
audio_in: off | listening | speaking_detected | endpointing | transcribing | error
reasoning: idle | building_context | streaming | tool_wait | stopped | error
audio_out: idle | queued | speaking | cancelled | error
barge_in: disabled | quiet | echo_detected | candidate | confirmed | ignored_background
resource: normal | gpu_busy | cpu_busy | degraded
```

## Barge-In And Echo Policy

VAD alone is not enough. It only says "there is sound", not "the user is interrupting". The system should combine these signals:

- TTS playback state.
- Microphone VAD activity.
- ASR partial text and confidence.
- Strong interrupt keyword match.
- Sustained speech duration.
- Echo correlation between microphone audio and TTS playback audio when far-end reference is available.

Default policy:

```json
{
  "enabled": true,
  "browser_echo_cancellation": true,
  "noise_suppression": true,
  "auto_gain_control": true,
  "strong_interrupt_min_ms": 300,
  "sustained_speech_min_ms": 1600,
  "semantic_confirmation_after_ms": 900,
  "echo_correlation_threshold": 0.72,
  "interrupt_keywords": ["停", "停止", "暂停", "等一下", "先别说", "不对", "打断一下"]
}
```

Decision rules:

- If TTS is playing and mic audio correlates strongly with TTS reference, classify as `echo_detected` and ignore.
- If a strong interrupt keyword appears with enough ASR confidence, classify as `confirmed` quickly.
- If speech continues past `sustained_speech_min_ms` and the ASR text looks like a user turn, classify as `confirmed`.
- If VAD fires but ASR confidence is low or no user-directed text appears, classify as `candidate` first, then downgrade to `ignored_background`.
- Manual stop/interruption buttons bypass the guard and emit `confirmed`.

## Frontend Behavior

- Chat composer keeps existing send, dictation, read-aloud controls.
- Realtime controls live in the multimedia/audio or vision window, not as extra chat send buttons.
- A unified realtime status panel shows:
  - main state
  - vision state and frame/element counts
  - audio input state
  - audio output state
  - barge-in state
  - echo policy flags
- Starting realtime should:
  - start the unified realtime session.
  - start UI-DETR realtime perception when requested.
  - start current audio realtime flow with `auto_send_transcript=true` and `auto_tts_reply=true`.
  - request microphone with browser AEC/NS/AGC constraints.
- Stopping realtime should:
  - stop recording if active.
  - stop audio realtime state.
  - optionally stop UI-DETR realtime if the unified session started it.
  - mark session as stopped without killing web-console or ShowUI incorrectly.

## Error Handling

- Missing microphone: state becomes `audio_in:error`, vision can keep running.
- Missing UI-DETR backend: state becomes `vision:degraded`, audio can keep running.
- TTS unavailable: state becomes `audio_out:error`, final text still appears in chat.
- Echo/AEC unavailable: fall back to browser constraints plus half-duplex guard. TTS playback raises interruption thresholds.
- Long-running tool call: state becomes `Tooling`; task card can show progress without causing TTS to speak tool details.

## Testing

Static Rust tests should verify:

- Unified `/api/realtime/session/*` routes exist.
- Realtime status payload includes primary state, audio/vision subtates, and barge-in policy.
- Audio realtime status still exposes `auto_tts_reply`.
- Frontend uses browser audio constraints with `echoCancellation`, `noiseSuppression`, and `autoGainControl`.
- Frontend auto-TTS filter still excludes reasoning/tool/goal messages.

Frontend verification should restart web-console on fixed port `8765` and check:

- `/api/realtime/session/status` returns `main_state`.
- Starting realtime updates unified state.
- UI-DETR realtime status remains visible and does not regress.
- Audio realtime start still preserves final-reply-only auto TTS.

## Out Of Scope For First Implementation

- Native WebRTC APM / SpeexDSP far-end reference AEC integration.
- Native true streaming STT provider output and provider-generated partial ASR confidence.
- Continuous barge-in cancellation of an actively streaming remote LLM response.
- LiveKit/Pipecat/OpenAI/Gemini realtime provider adapters.

These are intentionally left for the next implementation phase, after the unified state machine and policy shape are stable.

## Implementation Status 2026-06-02

Implemented and verified:

- `/api/realtime/session/start` now coordinates the existing audio realtime and UI-DETR realtime child loops instead of only updating a status bridge.
- `/api/realtime/session/stop` stops audio and vision child loops while keeping web-console and ShowUI alive.
- ShowUI/Tauri unexpected exit no longer calls `std::process::exit(0)` on web-console; the monitor clears ShowUI state and leaves port `8765` running.
- The frontend realtime start button requests browser microphone AEC/NS/AGC constraints and shows audio, vision, and task-card state linkage.
- Audio realtime now resumes listening after final-reply TTS when the unified realtime session is still running.
- Barge-in evaluation is wired to frontend cancellation: a confirmed interruption clears pending auto-TTS/resume state and aborts the active model stream through the existing chat abort controller.
- Final-reply TTS can now be generated without server-side playback. The backend returns a registered `/api/audio/tts/files/{file_id}` URL, and the frontend plays it through a browser audio controller that can be stopped by realtime stop, audio stop, or confirmed barge-in.
- Realtime session vision status now ignores stale frame counters after session stop, so the task card returns to `vision_state=off` instead of showing a misleading degraded state.
- Unified realtime session status now exposes audio health fields: `stt_available`, `tts_available`, `tts_backend`, `index_tts_base_url`, and `index_tts_available`. The task card runtime summary includes `tts=available` or `tts=missing`, so final-reply TTS readiness is visible in the same place as the realtime session task.
- ShowUI unexpected process exit now preserves the user's enabled intent while clearing only the running process. The overview toggle uses actual running state, so `ShowUI stopped` shows a `启动` button instead of a misleading `停止` button.
- Unified realtime session status now exposes a `streaming_risk` guard summary. It marks the current transport as turn-based `MediaRecorder`, browser-constraint AEC, and local HTTP provider bridge; the task card includes `risk=guarded`/`risk=degraded` so the realtime mode's technical risk is visible without opening logs.
- `streaming_risk` now includes explicit full-streaming readiness gates. Current gates are `provider_native_partial_asr`, `far_end_reference_aec`, and `realtime_model_adapter`; `full_streaming_ready` is derived from those gates plus TTS health instead of being a standalone constant. The task card summarizes the current readiness as `gates=0/3`.
- Realtime start can now declare `requested_mode=full_streaming`. Because true streaming STT, far-end reference AEC, and realtime provider adapters are not all ready yet, the backend records `active_mode=half_duplex_guarded`, exposes `mode_downgrade_reason`, and links the task card summary to `mode=half_duplex_guarded`.
- Audio realtime now exposes segmented `MediaRecorder` input observability through `/api/audio/realtime/segment`. Each browser chunk can report bytes/duration metadata, and unified realtime status mirrors `active_stt_transport=segmented_mediarecorder`, `audio_segments_received`, and `audio_bytes_received` into the task card.
- Audio realtime now accepts real partial ASR events through `/api/audio/realtime/partial`. The browser adapter uses `SpeechRecognition`/`webkitSpeechRecognition` when available and mirrors `partial_transcripts_received`, `last_partial_text`, `last_partial_confidence`, `last_partial_is_final`, and `partial_asr_provider` into unified realtime status and the task card.
- Partial ASR events now drive the same BargeInGuard used by the manual test endpoint. The browser reports an estimated partial speech duration plus current TTS playback state; confirmed interruption text updates `barge_in_state=confirmed`, marks audio output as `cancelled`, stops browser TTS/model streaming through the existing frontend cancellation path, and shows `barge=confirmed` in the task card.
- `/api/vision/realtime/frame` can now accept an external UI-DETR detector frame feed and updates the same unified realtime state path used by the polling loop. Injected detections increment `frames_processed`, populate the element table, clear stale waiting errors, and release pending loop flags so the task card can show `frames=N` and `elements=N` without depending on a running model download.
- A real UI-DETR backend has been verified through the wrapper contract at `http://127.0.0.1:7860`: `/api/vision/realtime/start` captured the desktop, called the loaded RF-DETR/UI-DETR service, advanced `frames_processed`, populated real element detections, and surfaced the same `frames=N`/`elements=N` evidence in the task card.
- Realtime session start now clears stale audio observability state before starting child loops. A vision-only session no longer inherits previous `segments`, `bytes`, `partial`, partial confidence, provider, or barge-in state from an earlier voice test.
- `/api/audio/voices`, `/api/audio/realtime/status`, and `/api/realtime/session/status` now expose `index_tts_available` from a real IndexTTS HTTP health probe. The frontend distinguishes `未配置`, `已配置，未连接`, and `可用 <backend>` instead of treating a configured base URL as availability.
- The task card todo list now expands realtime `readiness_gates` into visible full-streaming gate rows. Users can see `Provider-native partial ASR`, `Far-end reference AEC`, and `Realtime model adapter` as pending rows with the backend reason, instead of only seeing the compact `gates=0/3` summary.
- The task card header now has a `任务链` button. When a goal is active it opens the existing goal phase chain; when the active item is the realtime runtime task it opens a runtime chain modal with the realtime commander, vision loop, audio input loop, audio output loop, barge-in guard, and full-streaming readiness gates.
- Goal task-card selection now treats backend `planning` goals as open work. This keeps a newly created goal with an accepted phase plan visible in the task card and lets the `任务链` button open the planner/implementer/verifier phase chain instead of falling through to the idle runtime chain.
- Chinese realtime interruption text and keyword JSON were verified through Node `fetch` as valid UTF-8 (`等一下 不对`, `停`, `停止`, `暂停`, etc.). Mojibake seen through PowerShell `Invoke-RestMethod | ConvertTo-Json` is a console rendering path issue, not the browser/API payload.
- The realtime runtime task chain now expands the Vision loop detail with UI-DETR detector health: `Detector backend`, `Detection model`, `Detection endpoint`, and `Vision resource switch`. Values come from unified realtime status when present and fall back to the vision realtime status cache, so the task chain remains useful while the backend status contracts evolve.
- Frontend smoke now verifies both ShowUI states through the same user-facing control path: when ShowUI follows web-console startup the button shows `停止`, and after manual stop the web UI stays alive with the button changed to `启动`.
- Verification screenshots:
  - `output/playwright/realtime-session-real-loop-2026-06-02.png`
  - `output/playwright/realtime-session-fake-mic-loop-2026-06-02.png`
  - `output/playwright/realtime-barge-cancel-wired-2026-06-02.png`
  - `output/playwright/realtime-tts-browser-control-2026-06-02.png`
  - `output/playwright/realtime-barge-in-abort-tts-2026-06-02.png`
  - `output/playwright/realtime-task-card-uidetr-running-2026-06-02.png`
  - `output/playwright/realtime-tts-health-task-card-2026-06-02.png`
  - `output/playwright/realtime-full-streaming-downgrade-task-card-2026-06-03.png`
  - `output/playwright/realtime-segmented-input-task-card-2026-06-03.png`
  - `output/playwright/realtime-partial-asr-task-card-2026-06-03.png`
  - `output/playwright/realtime-partial-barge-in-task-card-2026-06-03.png`
  - `output/playwright/realtime-vision-voice-unified-task-card-2026-06-03.png`
  - `output/playwright/uidetr-real-backend-task-card-2026-06-03.png`
  - `output/playwright/goal-task-chain-modal-2026-06-03.png`

Fresh verification:

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo test -p coolzhu-web-console web_frontend_ -- --nocapture`
- `cargo test -p coolzhu-web-console web_realtime_session_routes_and_barge_in_policy_are_wired -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_barge_in -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_session_vision_state_ignores_stale_frames_after_stop -- --nocapture`
- `cargo test -p coolzhu-web-console web_realtime_session_exposes_tts_health_for_task_card -- --nocapture`
- `cargo test -p coolzhu-web-console web_realtime_session_exposes_streaming_risk_guard -- --nocapture`
- `cargo test -p coolzhu-web-console web_task_card_expands_realtime_readiness_gates_as_todo_items -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_task_card_connects_goal_progress_api -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_task_card_prefers_latest_goal_over_stale_pending -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_runtime_task_chain_shows_uidetr_detector_health -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_ -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_streaming_risk_lists_full_streaming_readiness_gates -- --nocapture`
- `cargo test -p coolzhu-web-console web_realtime_session_downgrades_full_streaming_request_visibly -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_mode_resolution_downgrades_full_streaming_when_prereqs_are_missing -- --nocapture`
- `cargo test -p coolzhu-web-console web_audio_realtime_reports_segmented_mediarecorder_input -- --nocapture`
- `cargo test -p coolzhu-web-console audio_realtime_segment_updates_audio_and_unified_session_counters -- --nocapture`
- `cargo test -p coolzhu-web-console web_audio_realtime_accepts_partial_asr_events -- --nocapture`
- `cargo test -p coolzhu-web-console audio_realtime_partial_updates_audio_and_unified_session_state -- --nocapture`
- `cargo test -p coolzhu-web-console audio_realtime_partial_drives_barge_in_guard_when_tts_is_playing -- --nocapture`
- `cargo test -p coolzhu-web-console vision_realtime_frame_increments_processed_frame_count_for_injected_detections -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_session_start_clears_stale_audio_observability_when_audio_is_disabled -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_audio_realtime_and_indextts_are_wired -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_overview_card_can_toggle_showui_service -- --nocapture`
- `cargo fmt --check -p coolzhu-web-console`
- `cargo build -p coolzhu-web-console`
- HTTP `/api/audio/voices`, `/api/audio/realtime/status`, and `/api/realtime/session/status` smokes on fixed port `8765`: current fallback state is `backend=piper`, `tts_available=true`, `index_tts_base_url=null`, and `index_tts_available=false`.
- Node `fetch` UTF-8 smoke on fixed port `8765` for `/api/realtime/session/status`: realtime interruption text and keyword arrays decode correctly in JavaScript/browser-compatible clients.
- HTTP start/stop smoke on fixed port `8765`
- Frontend fake microphone smoke with Playwright
- Browser smoke for TTS URL generation and barge-in triggered model abort plus TTS stop
- UI-DETR realtime smoke on fixed port `8765`: `detection_backend=uidetr1`, `detection_model=UI-DETR-1`, frames processed, elements detected, and final stopped status returns `vision_state=off`
- Browser smoke for realtime TTS health, segmented audio metadata, partial ASR metadata, BargeInGuard linkage, `streaming_risk`, `mode_downgrade_reason`, task-card `mode=half_duplex_guarded`/`segments=1`/`bytes=4096`/`partial=1`/`partial_conf=0.82`/`barge=confirmed`/`risk=guarded`/`gates=0/3`, and ShowUI running/stop/start button state
- Goal task-chain frontend smoke on fixed port `8765`: created a temporary `planning` goal, persisted planner/implementer/verifier phases, verified the task card displayed the goal instead of `空闲`, and confirmed clicking the task-card `任务链` button opened the goal phase modal with planner/implementer/verifier roles.
- Unified frontend smoke on fixed port `8765` for realtime vision + voice: requested `full_streaming`, backend visibly downgraded to `half_duplex_guarded`, ShowUI stayed running, external UI-DETR detections produced `frames=2`/`elements=2`, audio segment metadata produced `segments=1`/`bytes=8192`, partial ASR produced `partial=1`/`partial_conf=0.82`, BargeInGuard produced `barge=confirmed`, full-streaming readiness remained visible as `gates=0/3`, the task todo list expanded all three readiness gates with their pending reasons, clicking the task-card `任务链` button opened the realtime runtime chain modal, and the modal showed `Detector backend=uidetr1`, `Detection model=UI-DETR-1`, `Detection endpoint=http://127.0.0.1:7860`, plus `Vision resource switch`.
- Real UI-DETR backend frontend smoke on fixed port `8765`: started a fresh vision-only unified realtime session, verified `detection_base_url=http://127.0.0.1:7860`, observed real detector output from `desktop-latest.png`, saw `frames=2`/`elements=8` on the task card in the latest run, verified the new session did not inherit old voice counters with `segments=0`/`bytes=0`/`partial=0`, and confirmed the same full-streaming gate rows remain visible during real detector operation.
- Real desktop vision voice acceptance on fixed port `8765`: `realtime_desktop_vision_voice_e2e.js` captured the current desktop through `/api/capture`, uploaded the PNG as a normal `image` attachment through `/api/pet/drop-upload`, selected the vision-capable `glm视觉 (glm-4.6v-flash)` chat target, sent `说一下当前桌面上你看到有哪些东西` through `/api/chat/send/stream`, received a grounded desktop description, normalized `CoolZhu` pronunciation to `酷猪`, and verified browser TTS playback resolved. Evidence: `output/playwright/2026-06-06-real-desktop-vision-voice-v1.webm`, final screenshot, desktop capture, and JSON summary.

Remaining risks and next work:

- TTS playback is now browser-controlled for realtime auto replies and realtime status exposes backend health, but the local TTS fallback can still produce very short placeholder wav files when no full TTS backend is available. Next step: finish the IndexTTS/provider adapter path and make backend health actionable in the task chain.
- STT no longer blocks partial transcript visibility or semantic interruption at the orchestration boundary: `/api/audio/realtime/partial` can ingest real interim/final ASR text and confidence from the browser or a future provider, then run BargeInGuard against current TTS playback state. `full_streaming` still explicitly downgrades to `half_duplex_guarded` until a reliable provider-native streaming STT adapter, far-end reference AEC, and realtime model adapter are all available.
- Echo correlation is currently policy-level input/simulation; true far-end reference AEC still needs WebRTC APM/SpeexDSP or browser audio graph integration before full-duplex mode can be enabled.
- UI-DETR smokes now cover the polling-loop state path, the external detector-frame ingestion path, and one real backend run against `http://127.0.0.1:7860`. Remaining work is no longer basic connectivity; it is production hardening: tune frame cadence/resource backoff, expose detector health in the task chain, keep ShowUI/UI-DETR memory pressure visible, and add OCR/semantic target selection over the detected element table.
- Realtime final-reply TTS now has an interruptible segmented playback path. The backend accepts `segment=true`, uses the shared TTS text segmentation helper, returns `audio_urls` plus per-segment metadata while retaining `audio_url` compatibility, and the frontend plays those URLs as a browser-controlled queue. Session stop, manual stop, and confirmed barge-in invalidate the queue before later segments can play.
- TTS text segmentation now respects multibyte character boundaries, so long Chinese replies can be split safely before synthesis.
- Barge-in is now scoped to active output. While the realtime session is only listening, browser partial ASR is treated as `user_turn/quiet` and does not mark `Audio output loop` as `cancelled`. Confirmed interruption still works when TTS/model output is active or when a manual stop is requested.
- A real STT/TTS frontend regression recorder now complements the repeatable fake-microphone recorder. It synthesizes a source wav through `/api/audio/tts/speak`, transcribes it through `/api/audio/stt/stop` and realtime final segment STT, sends the transcript through the real frontend composer to the currently selected chat target, waits for a non-tool assistant reply, strips the context footer, and verifies browser `Audio.play()` resolves for reply TTS. This recorder intentionally avoids fake browser media flags, fake mic fixtures, `/api/audio/realtime/partial` injection, and readiness-gate-only proofs.
- A real voice interruption scenario recorder now covers the first barge-in acceptance story: the user asks the model to briefly introduce itself, the assistant response starts frontend TTS playback, a second real TTS/STT utterance interrupts with a CoolZhu Agent feature request, BargeInGuard confirms the interruption, the existing frontend handler clears active audio/model output, and the final assistant response switches to CoolZhu Agent capabilities.
- A real desktop vision voice recorder now covers the first screenshot-grounded spoken answer story. It verifies real desktop capture, real attachment upload, vision-capable model routing, frontend stream rendering, and final-answer TTS playback without fake browser media flags or readiness-gate-only proof. Physical microphone capture remains hardware-dependent and is not claimed by this recorder; the software STT API path remains covered by the real STT/TTS recorder.
