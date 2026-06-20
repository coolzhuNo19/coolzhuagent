# 2026-06-05 UI-DETR Resource Health + Task Card Fix

## What changed

- `GET /api/vision/realtime/status` now exposes detector resource health:
  - `detection_model_path`
  - `detection_model_path_exists`
  - `detection_service_reachable`
  - `detection_service_health_url`
  - `detection_launcher_hint`
- The task-chain popup now includes detector health details:
  - Detection backend/model/endpoint
  - Detection service online/offline
  - Detection model path existence
  - Local launcher hint
- The task card now creates a lightweight `Realtime vision detector` runtime task when the detector backend has an actionable resource issue, so stale open goals no longer hide the current UI-DETR acceptance blocker.
- `/api/realtime/session/status` now exposes the same detector health fields, backed by a short detector-health cache, so the unified realtime session no longer depends on the frontend refreshing the vision window first.

## Verification

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo test -p coolzhu-web-console web_frontend_runtime_task_chain_shows_uidetr_detector_health -- --nocapture`
- `cargo test -p coolzhu-web-console web_frontend_task_todo_list_combines_goal_phases_and_runtime_lifecycle_tasks -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
- `cargo build -p coolzhu-web-console`
- Restarted fixed-port web console on `127.0.0.1:8765`, latest verified PID `29548`.

Frontend verification screenshot:

`C:\Users\zhupu\Desktop\codex\output\playwright\uidetr-health-task-chain-2026-06-05-fixed.png`

Unified realtime detector-health screenshot:

`C:\Users\zhupu\Desktop\codex\output\playwright\realtime-unified-detector-health-2026-06-05.png`

The task-chain popup now shows:

- `Realtime vision detector`
- `Detection service=offline`
- `Detection model path=(not configured); exists=no`
- `Detection launcher=python modules/vision/resources/uidetr/uidetr_service.py --model "<path-to-ui-detr-checkpoint>" --host 127.0.0.1 --port 7860`

## Current blocker

The local detector service is not currently reachable:

- `detection_base_url=http://127.0.0.1:7860`
- `detection_service_health_url=http://127.0.0.1:7860/health`
- `detection_service_reachable=false`

No UI-DETR/RF-DETR checkpoint was found under the checked local paths:

- `C:\Users\zhupu\Downloads`
- `C:\Users\zhupu\Desktop\codex`
- `C:\Users\zhupu\coolzhuagent`
- `C:\Users\zhupu\.cache`
- `C:\Users\zhupu\.modelscope`
- `C:\Users\zhupu\.cache\huggingface`

Only Whisper `medium.pt` was found in the model-like file scan. A large `codex_0512.zip` archive was found, but it is unrelated.

## Next step

Acquire or configure the UI-DETR/RF-DETR checkpoint path, then start:

```powershell
python modules/vision/resources/uidetr/uidetr_service.py --model "C:\path\to\model.pth" --host 127.0.0.1 --port 7860
```

After the wrapper is listening, rerun the realtime session smoke and verify `frames > 0` and `elements > 0` in the task card and task-chain popup.

## 2026-06-06 Resource Download And Real Backend Smoke

Downloaded the required `racineai/UI-DETR-1` model resource:

- Model file: `C:\Users\zhupu\Desktop\codex\models\uidetr\UI-DETR-1\model.pth`
- Size: `534747653` bytes
- SHA256: `7199C4BC8FA51AD08D401F4572FADF58BE6CC5A482B042CA2A9C774B709C285C`

Updated active workspace config:

- `C:\Users\zhupu\coolzhuagent\coolzhu.toml`
- `[vision.router.detection].model_path = "C:/Users/zhupu/Desktop/codex/models/uidetr/UI-DETR-1/model.pth"`

Started the local UI-DETR/RF-DETR wrapper:

- `http://127.0.0.1:7860/health`
- PID verified during this run: `5492`
- Health result: `ok=true`, `loaded=true`, `import_error=null`

Restarted web-console on fixed port:

- `http://127.0.0.1:8765`
- PID verified during this run: `22044`

Real backend smoke result:

- `POST /api/vision/realtime/start` entered `running_realtime_perception`.
- Polling reached `frames_processed=16`, `element_count=59` with no error.
- Frontend task-chain verification reached `frames=33`, `elements=67`, `Detection service=reachable`, `model_path=exists`.
- Before stopping the polling loop, latest status reached `frames_processed=52`, `element_count=70`.
- Stopped the realtime polling loop to avoid continuous CPU work; left the `7860` model service running for follow-up tests.

Verification screenshot:

`C:\Users\zhupu\Desktop\codex\output\playwright\uidetr-real-backend-downloaded-running-2026-06-06.png`

## 2026-06-06 Realtime Vision + Voice + Model + TTS E2E Recorder

Added a repeatable frontend acceptance recorder:

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\tools\realtime_e2e_record.js`
- Usage: `node modules/gui-web/packages/web-console/tools/realtime_e2e_record.js`

The recorder drives the real web-console UI on fixed port `8765`:

- starts unified realtime session from the frontend control,
- uses Chromium fake microphone through `getUserMedia` + `MediaRecorder`,
- waits for UI-DETR realtime frames and element detections,
- posts one browser-side partial ASR event,
- sends one model turn through the composer,
- observes browser TTS playback through `HTMLMediaElement.play`,
- writes `.webm`, running screenshot, final screenshot, TTS wav, and JSON summary under `output/playwright/`.

Latest E2E evidence:

- Video: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-repeatable-realtime-vision-voice-model-tts-v2.webm`
- Running screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-repeatable-realtime-vision-voice-model-tts-v2-running.png`
- Final screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-repeatable-realtime-vision-voice-model-tts-v2-final.png`
- Summary JSON: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-repeatable-realtime-vision-voice-model-tts-v2.json`
- TTS wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-repeatable-realtime-vision-voice-model-tts-v2.wav`

Observed values from the run:

- live realtime checkpoint: `frames=2`, `elements=58`, `audio_segments=53`, `audio_bytes=54833`
- final backend status after stop: `frames=4`, `elements=47`, `audio_segments=124`, `audio_bytes=119331`, `partial_transcripts_received=15`
- TTS playback hook: `audio.play()` resolved and downloaded a `827436` byte wav artifact.
- The fake microphone fixture now emits a short tone followed by silence, so the recorder no longer causes its own TTS barge-in; the final task-chain screenshot shows `Audio output loop idle`.

Boundary:

- The microphone source is Chromium fake audio for repeatability.
- The ASR text is injected through the browser-compatible partial ASR API because unattended desktop automation cannot guarantee a physical human voice and browser speech recognition result.
- Model reply and TTS playback are real frontend paths.

## 2026-06-06 Segmented TTS Queue And Listening-Turn Barge-In Guard

Implemented the next realtime voice landing step:

- `/api/audio/tts/speak` now accepts `segment=true` and returns both the legacy `audio_url` and a new `audio_urls` queue with `segments` metadata.
- Realtime auto-TTS requests segmented synthesis and plays returned URLs through an interruptible browser queue.
- `stopActiveTtsPlayback`, realtime session stop, and confirmed barge-in invalidate the active playback id, so later TTS segments do not continue after interruption.
- `audio::segment_text` now cuts by character boundary instead of raw byte index, preventing long Chinese replies from panicking during TTS segmentation.
- Barge-in policy now treats long ASR while no output is playing as `user_turn/quiet` instead of `confirmed/cancelled`; listening-mode user speech no longer marks `Audio output loop` as cancelled.

Fresh verification:

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo test -p coolzhu-web-console realtime_auto_tts_uses_segmented_interruptible_browser_queue -- --nocapture`
- `cargo test -p coolzhu-web-console audio::tests::test_segment_text_handles_multibyte_boundaries -- --nocapture`
- `cargo test -p coolzhu-web-console audio::tests::test_segment_text -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_barge_in_user_turn_without_output_does_not_interrupt -- --nocapture`
- `cargo test -p coolzhu-web-console audio_realtime_partial_keeps_listening_turn_from_cancelling_idle_output -- --nocapture`
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture` -> `38 passed`
- `cargo fmt --package coolzhu-web-console --check`
- `cargo build -p coolzhu-web-console`

Latest fixed-port frontend E2E evidence after restarting web-console on `127.0.0.1:8765`:

- Video: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-realtime-voice-user-turn-no-false-cancel.webm`
- Running screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-realtime-voice-user-turn-no-false-cancel-running.png`
- Final screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-realtime-voice-user-turn-no-false-cancel-final.png`
- Summary JSON: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-realtime-voice-user-turn-no-false-cancel.json`
- TTS wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-realtime-voice-user-turn-no-false-cancel.wav`

Observed values:

- `ok=true`
- partial ASR decision: `user_turn`, `barge_in_state=quiet`, `should_interrupt=false`
- TTS playback hook: `audio.play()` observed once, `audioErrors=0`
- playback observation status: `audio_out_state=idle`, `barge_in_state=quiet`
- final stopped status: `running=false`, `frames=5`, `elements=64`, `audio_segments=151`

Remaining next steps:

- Add a provider-native partial ASR adapter so full streaming can eventually pass the `provider_native_partial_asr` readiness gate.
- Add far-end reference AEC before enabling true full-duplex mode.
- Add a realtime model adapter so model tokens, audio output state, and interruption cancellation are driven by one provider-native session instead of the current guarded local HTTP bridge.

## 2026-06-06 Real STT/TTS Frontend Regression

Added a separate real-backend speech regression recorder:

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\tools\realtime_real_speech_e2e.js`
- Usage:
  `node modules/gui-web/packages/web-console/tools/realtime_real_speech_e2e.js`

Boundary for this recorder:

- Does not use Chromium fake microphone flags.
- Does not use fake mic wav fixtures.
- Does not inject `/api/audio/realtime/partial`.
- Does not treat full-streaming readiness gates as proof of STT/TTS.
- Uses the fixed web-console port `8765`.

Validated flow:

- `/api/audio/status` confirmed real STT and TTS availability.
- `/api/audio/tts/speak` synthesized the source phrase to a real wav.
- `/api/audio/stt/stop` transcribed that wav as `Hello Code who real-time voice regression test.`
- `/api/audio/realtime/segment` transcribed the same wav through the realtime final segment path.
- The frontend selected the current checked chat target `test5`.
- The frontend sent the STT transcript through the real composer.
- The recorder waited for a non-tool assistant reply, so `tool-summary` cards cannot pass as a model reply.
- The recorder stripped the remote context footer before browser playback and verified `HTMLMediaElement.play()` resolved.

Latest evidence after restarting web-console on `127.0.0.1:8765`:

- Video: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4.webm`
- Running screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4-running.png`
- Final screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4-final.png`
- Summary JSON: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4.json`
- Source TTS wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4-source-tts.wav`
- Reply TTS wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-stt-tts-regression-v4-reply-tts.wav`

Observed values:

- selected agent: `session-1779459149988` / `test5`
- backend STT text: `Hello Code who real-time voice regression test.`
- realtime segment STT text: `Hello Code who real-time voice regression test.`
- assistant reply was not a tool summary.
- browser audio playback status: `resolved`
- audio errors: `0`
- source wav bytes: `169758`
- reply wav bytes: `500424`

## 2026-06-06 Real Voice Interruption Scenario

Added a small acceptance scenario recorder:

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\tools\realtime_voice_interrupt_scenario_e2e.js`
- Usage:
  `node modules/gui-web/packages/web-console/tools/realtime_voice_interrupt_scenario_e2e.js`

Scenario:

- First real TTS utterance: `Please briefly introduce yourself in two short English sentences.`
- Real STT transcript: `Please briefly introduce yourself in two short English sentences.`
- The selected frontend target receives the first prompt and renders an assistant self-introduction reply.
- The frontend starts browser TTS playback for that first reply through the existing `ttsSpeakText` path.
- Second real TTS utterance: `Please introduce CoolZhu Agent features.`
- Real STT / realtime final segment transcript: `Please introduce KUOzu agent features.`
- The script records that `CoolZhu` is currently recognized by local English STT as the approximate brand sound `KUOzu`, then normalizes that into the CoolZhu Agent task prompt.
- The realtime barge-in path receives the real STT interrupt text through provider `real_stt_interrupt`, confirms interruption, and calls the existing frontend `handleRealtimeBargeInDecision` handler.
- The current frontend TTS output is cleared through that handler.
- The selected frontend target receives the interrupted task and answers with CoolZhu Agent feature/capability content.

Latest evidence after restarting web-console on `127.0.0.1:8765`:

- Video: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4.webm`
- Before-interrupt screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4-before-interrupt.png`
- Final screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4-final.png`
- Summary JSON: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4.json`
- First prompt wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4-first-prompt.wav`
- Interrupt prompt wav: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-voice-interrupt-self-to-coolzhu-v4-interrupt-prompt.wav`

Observed values:

- first STT: `Please briefly introduce yourself in two short English sentences.`
- interrupt STT: `Please introduce KUOzu agent features.`
- interrupt realtime STT: `Please introduce KUOzu agent features.`
- barge-in decision: `confirmed`
- `should_interrupt=true`
- frontend handler result: `handled=true`
- active frontend audio after handler: `false`
- final reply: `CoolZhu Agent is a multi-agent platform with vision, voice, and desktop computer-use capabilities. It orchestrates specialized agents through goal-mode planning to automate complex workflows.`
- capability terms matched: `capabil`, `vision`, `voice`, `computer-use`, `desktop`, `goal-mode`, `automate`, `workflow`, `orchestrate`, `multi-agent`

## 2026-06-06 Real Desktop Vision Voice Acceptance

Added a real frontend recorder for the acceptance prompt `说一下当前桌面上你看到有哪些东西`:

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\tools\realtime_desktop_vision_voice_e2e.js`
- Usage:
  `node modules/gui-web/packages/web-console/tools/realtime_desktop_vision_voice_e2e.js`

Validated flow:

- `/api/audio/status` reported `stt_available=true` and `tts_available=true`.
- `/api/capture` created a real desktop PNG and `/api/capture/latest/image` returned 681776 bytes.
- `/api/pet/drop-upload` registered that screenshot as an `image` attachment under `/api/attachments/files/...`.
- The frontend selected the vision-capable chat target `glm视觉 (glm-4.6v-flash)`.
- The screenshot attachment was sent through `/api/chat/send/stream`.
- The frontend rendered a grounded vision reply describing desktop icons, File Explorer, and a code/editor window.
- The final reply text was passed to browser TTS; `HTMLMediaElement.play()` resolved.
- `CoolZhu` pronunciation is normalized to `酷猪` before TTS playback.

Latest evidence after restarting web-console on `127.0.0.1:8765`:

- Video: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-desktop-vision-voice-v1.webm`
- Final screenshot: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-desktop-vision-voice-v1-final.png`
- Desktop capture: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-desktop-vision-voice-v1-desktop-capture.png`
- Summary JSON: `C:\Users\zhupu\Desktop\codex\output\playwright\2026-06-06-real-desktop-vision-voice-v1.json`

Observed values:

- selected agent: `mario-demo` / `glm视觉 (glm-4.6v-flash)`
- image attachment: `/api/attachments/files/2026-06-06-real-desktop-vision-voice-v1-desktop-capture.png`
- model reply: `基于附件截图，当前桌面有多个应用程序图标（如UU加速器、回收站、暴雪战网、360压缩等），左侧显示文件资源管理器窗口，右侧打开一个代码编辑器窗口，内容涉及TTS测试相关文字。`
- remote context usage: `44.5% (89076/200000 input tokens; source=remote)`
- chain status: desktop capture `ok`, attachment upload `ok`, vision reply `ok`, TTS playback `ok`

Current not-yet-complete items in the real chain:

- Physical microphone capture has not been verified by this recorder. It remains a hardware-dependent acceptance item, while the software STT API path is already verified by the real STT/TTS recorder.
- True full-duplex/full-streaming mode is still not complete. `provider_native_partial_asr`, `far_end_reference_aec`, and `realtime_model_adapter` remain the explicit readiness blockers.
- The current end-to-end path is a guarded half-duplex realtime architecture with real STT/TTS/vision pieces, not a readiness-gate-only proof.
