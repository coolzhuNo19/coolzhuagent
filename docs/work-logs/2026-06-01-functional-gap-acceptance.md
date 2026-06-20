# Functional Gap Acceptance Log

Date: 2026-06-05

## Vision Window: UI-DETR BBox Selection To Safe Dry-Run

Implemented and verified the missing safe target-selection loop for realtime
perception:

1. Injected a UI-DETR-style frame through `POST /api/vision/realtime/frame` with
   two detections: `Start` and `Settings panel`.
2. Opened the Vision / Computer Use Lab window on fixed port `8765`.
3. Verified the injected detections appear both in the realtime element list and
   as bbox overlays on the screenshot.
4. Selected the `Start` detection. The UI updated:
   - selected label: `已选：Start`
   - selected bbox overlay count: `1`
   - selected list item count: `1`
   - Locate target input: `Start`
5. Clicked `选中 dry-run`.
6. Verified the result is a safe `computer.visual_action` plan:
   - backend: `computer.visual_action`
   - status excerpt: `visual-action-plan-ready`
   - target: `Start`
   - point: `(461, 269)`
   - bbox: `307, 211, 308x116`
   - real execution: disabled; dry-run only.

Verification commands:

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo fmt -p coolzhu-web-console --check
cargo test -p coolzhu-web-console web_frontend_vision_window -- --nocapture
cargo test -p coolzhu-web-console vision_realtime_frame_increments_processed_frame_count_for_injected_detections -- --nocapture
cargo build -p coolzhu-web-console
```

Runtime state:

- `coolzhu-web-console` listens on fixed port `8765`.
- `coolzhu-tauri-shell` follows the web-console service lifecycle.
- UI-DETR true backend service at `127.0.0.1:7860` was not running during this
  smoke; the acceptance used the same `/api/vision/realtime/frame` ingestion
  path that the real backend updates.

## Unified Realtime Session Smoke

Verified the unified realtime task card and task-chain UI on fixed port `8765`:

1. Started `/api/realtime/session/start` with `requested_mode=full_streaming`,
   `start_vision=true`, `start_audio=true`, and `auto_tts_reply=true`.
2. Confirmed runtime downgraded to `active_mode=half_duplex_guarded` because
   provider-native partial ASR, far-end reference AEC, and realtime model
   adapter gates are not ready.
3. Injected a UI-DETR-style frame through `/api/vision/realtime/frame`.
4. Injected one audio segment through `/api/audio/realtime/segment`.
5. Injected one partial ASR event through `/api/audio/realtime/partial` with
   `speech_ms=1800`, `tts_playing=true`, `echo_correlation=0.2`.
6. Confirmed BargeInGuard returned `decision=confirmed`,
   `should_interrupt=true`, and `audio_out_state=cancelled`.
7. Opened the task-card `任务链` popup in the frontend and verified it shows:
   - `state=listening`
   - `mode=half_duplex_guarded`
   - `vision=degraded`
   - `segments=1`
   - `bytes=8192`
   - `partial=1`
   - `partial_conf=0.82`
   - `barge=confirmed`
   - `frames=1`
   - `elements=2`
   - TTS health: `backend=piper`,
     `IndexTTS endpoint=(not configured)`,
     `next=Configure IndexTTS base_url`
   - readiness gates: `Provider-native partial ASR`,
     `Far-end reference AEC`, and `Realtime model adapter`.

Regression fixed during the smoke:

- When the real UI-DETR polling backend at `127.0.0.1:7860` is offline, a
  previous polling loop could overwrite the successful external detector-frame
  ingestion with `vision_state=error`.
- `/api/vision/realtime/frame` now aborts the stale polling loop before
  accepting an external frame, so the unified session reports
  `vision=degraded` with current `frames/elements` evidence instead of a stale
  backend error.

## Full-Streaming Capability Gate State

Implemented and verified the runtime capability path for full-streaming gates:

1. Added capability fields to the realtime start/config path:
   - `stt_transport`
   - `aec_mode`
   - `provider_adapter`
2. Kept default behavior conservative:
   - STT defaults to turn-based/segmented MediaRecorder status.
   - AEC defaults to browser constraint evidence.
   - provider adapter defaults to the local HTTP bridge.
3. Verified that a real capability report can turn all three gates ready:
   - `stt_transport=provider_native_streaming_asr`
   - `aec_mode=far_end_reference_aec`
   - `provider_adapter=realtime_provider_adapter`
4. Verified `/api/realtime/session/start` no longer downgrades
   `requested_mode=full_streaming` when all gates are reported ready.
5. Verified `/api/audio/realtime/partial` with
   `provider=provider_native_streaming_asr` updates the unified session risk
   state so the `Provider-native partial ASR` gate turns ready while the other
   gates remain guarded.
6. Opened the frontend task-card `任务链` popup and verified:
   - `mode=full_streaming`
   - `risk=ready`
   - `gates=3/3`
   - `100% · 3/3 full-streaming gates ready · running`
   - all three readiness gates show `ready / 已完成`.
7. Stopped the realtime session after the smoke and confirmed:
   - `running=false`
   - `main_state=idle`
   - `vision_state=off`
   - `audio_in_state=off`
   - `audio_out_state=idle`
   - `barge_in_state=quiet`.

Verification commands and runtime checks:

```powershell
cargo test -p coolzhu-web-console realtime_ -- --nocapture
cargo build -p coolzhu-web-console
POST http://127.0.0.1:8765/api/realtime/session/start
GET  http://127.0.0.1:8765/api/realtime/session/status
POST http://127.0.0.1:8765/api/audio/realtime/partial
POST http://127.0.0.1:8765/api/realtime/session/stop
```

Runtime restart:

- Stopped old `coolzhu-web-console` and `coolzhu-tauri-shell` processes before
  rebuilding because Windows locked `target/debug/coolzhu-web-console.exe`.
- Restarted the updated web-console on fixed port `8765`.
- Confirmed `coolzhu-tauri-shell` followed the web-console lifecycle and was
  running after restart.

## Realtime Audio Segment Payload Ingestion

Implemented and verified the first concrete step toward true realtime STT:
audio segments now carry real browser audio bytes into the backend instead of
only incrementing metadata counters.

1. Extended `/api/audio/realtime/segment` with optional `audio_base64`.
2. Kept old metadata-only callers compatible:
   - if no payload is supplied, `bytes` still updates the observability counter;
   - if payload is supplied, the backend uses the decoded payload size as the
     authoritative byte count.
3. Added payload evidence to audio and unified realtime status:
   - `audio_payload_chunks_received`
   - `last_audio_payload_bytes`
   - `last_audio_chunk_path`
4. Frontend `reportAudioRealtimeSegment(blob)` now reads the MediaRecorder blob
   as a data URL and sends it to `/api/audio/realtime/segment`.
5. Persisted realtime audio chunks under the configured data directory:
   `./.coolzhu/audio-realtime/chunks/*.webm` by default.
6. Verified HTTP smoke on fixed port `8765`:
   - request metadata deliberately sent `bytes=9999`;
   - backend decoded a 24-byte payload;
   - response reported `audio_bytes_received=24`,
     `audio_payload_received=true`, `audio_payload_bytes=24`,
     `audio_payload_chunks_received=1`;
   - the returned `.webm` file existed and was 24 bytes.
7. Verified frontend task-chain modal showed the payload evidence:
   - commander summary included `payload_chunks=1 / last_payload=22`;
   - Audio input loop detail showed
     `segments=1; bytes=22; payload_chunks=1; last_payload=22; partial=0`.
8. Stopped the realtime session after the smoke and confirmed it returned to
   idle/off states.

Verification commands and runtime checks:

```powershell
cargo test -p coolzhu-web-console audio_realtime_segment_persists_uploaded_audio_payload -- --nocapture
cargo test -p coolzhu-web-console realtime_ -- --nocapture
node --check modules/gui-web/packages/web-console/src/app.js
cargo fmt -p coolzhu-web-console --check
cargo build -p coolzhu-web-console
POST http://127.0.0.1:8765/api/realtime/session/start
POST http://127.0.0.1:8765/api/audio/realtime/segment
GET  http://127.0.0.1:8765/api/realtime/session/status
POST http://127.0.0.1:8765/api/realtime/session/stop
```

Important boundary:

- This does not yet perform realtime ASR. It opens the backend data path by
  persisting real audio chunks, so the next implementation can feed those chunks
  into a streaming ASR/provider adapter and emit `/api/audio/realtime/partial`
  events.

## Realtime Final Segment Local ASR Attempt

Implemented the next backend bridge from persisted realtime audio chunks into
the existing STT engine for final segments.

1. Added configurable `audio.realtime.segment_asr_mode`, defaulting to
   `final_segment_stt`; it can be set to `off` to keep segment ingestion as
   observe-only.
2. Extended `/api/audio/realtime/segment` responses with ASR attempt evidence:
   - `asr_attempted`
   - `asr_transcript_received`
   - `asr_text`
   - `asr_confidence`
   - `asr_provider`
   - `asr_error`
   - `asr_duration_ms`
3. When `final_segment=true` and a payload file exists, the backend now invokes
   `SttEngine` and reports the provider as `local_stt_final`.
4. Successful final transcripts are written back through the realtime
   partial/final state path, so task-card state can observe
   `last_partial_text`, `last_partial_is_final`, and `partial_asr_provider`.
5. Frontend stop-recording flow now sends the complete Blob as a final segment
   first. If that returns a transcript, it avoids the old `/api/audio/stt/data`
   and `/api/audio/stt/stop` fallback; otherwise it falls back to the old path.
6. `SttEngine` now preserves backend attempt details in failures instead of
   returning only `No STT backend available`.
7. Python whisper failures now parse JSON errors emitted on stdout, so invalid
   webm/audio failures surface as actionable messages such as `Invalid data`
   instead of an empty `Python error:`.

Verification commands:

```powershell
cargo test -p coolzhu-web-console audio_realtime_final_segment_reports_local_asr_attempt -- --nocapture
cargo test -p coolzhu-web-console web_audio_realtime_sends_final_segment_before_fallback_stt -- --nocapture
cargo test -p coolzhu-web-console realtime_ -- --nocapture
node --check modules/gui-web/packages/web-console/src/app.js
cargo fmt -p coolzhu-web-console --check
cargo build -p coolzhu-web-console
```

HTTP smoke on fixed port `8765`:

- Started `/api/realtime/session/start` with `start_audio=true` and
  `start_vision=false`.
- Posted an intentionally invalid final `audio/webm` payload to
  `/api/audio/realtime/segment`.
- Confirmed:
  - `audio_payload_received=true`
  - `audio_payload_bytes=16`
  - `asr_attempted=true`
  - `asr_transcript_received=false`
  - `asr_provider=local_stt_final`
  - `asr_error` includes `Attempts:`
  - invalid-audio smoke reports the Python whisper `Invalid data` detail
  - unified realtime `last_error` mirrors the backend attempt chain.
- Stopped the session and confirmed it returned to `running=false`,
  `main_state=idle`; transient unified realtime `last_error` is cleared during
  stop so the task card does not show stale ASR errors after the session ends.

Remaining boundary:

- The state-machine and backend invocation path are now wired. System Python
  reports `whisper`, `torch`, `av`, and `soundfile` as installed, so the local
  whisper script has the dependencies needed to handle browser `webm/opus`.
- The latest HTTP smoke intentionally used invalid webm bytes; the expected
  `Invalid data` error proves diagnostics are now accurate, not that valid
  microphone audio cannot be transcribed.
- Next real acceptance should record a valid front-end microphone Blob and
  confirm final transcript generation through `local_stt_final`. If the whisper
  model is not cached, add model download/resource guidance. Native Windows STT
  remains WAV-only unless an ffmpeg/decoder path is configured.

## Realtime Final Segment Valid WebM ASR Smoke

Closed the previous invalid-payload boundary with a valid browser-format audio
smoke on fixed port `8765`.

Implementation fixes made for this smoke:

1. Python whisper model selection now derives from the configured model path
   instead of hardcoding `medium`.
2. `tools/whisper_transcribe.py` now resamples decoded audio to 16 kHz before
   calling Whisper. PyAV decodes browser `webm/opus` as 48 kHz, and the missing
   resample step was the root cause of valid audio returning an empty transcript.
3. The frontend task-chain realtime rows now show `partial_provider` and
   `last_asr_text`, so final-segment ASR evidence is visible in the task card.

HTTP smoke on fixed port `8765`:

- Started `/api/realtime/session/start` with `start_audio=true`,
  `start_vision=false`, `auto_send_transcript=true`, and `auto_tts_reply=false`.
- Posted `output/realtime-audio-smoke/valid-speech-smoke.webm`, a valid
  PyAV/Opus `audio/webm` payload, to `/api/audio/realtime/segment` with
  `final_segment=true`.
- Confirmed:
  - `audio_payload_bytes=53992`
  - `asr_attempted=true`
  - `asr_transcript_received=true`
  - `asr_provider=local_stt_final`
  - `asr_error=null`
  - `asr_text=Could her real-time voice smoke test? Please transcribe this sentence.`
  - unified realtime status reported `partial_transcripts_received=1`,
    `last_partial_is_final=true`,
    `partial_asr_provider=local_stt_final`, and the same final transcript.
- Stopped the session and confirmed `running=false` and `last_error=null`.
- Frontend acceptance:
  - opened `http://127.0.0.1:8765/` in the Codex in-app browser;
  - verified the task card summary includes
    `partial_provider=local_stt_final` and the final transcript;
  - opened the `任务链` popup and verified the `Audio input loop` row shows
    `segments=1`, `payload_chunks=1`, `partial=1`,
    `partial_provider=local_stt_final`, and `last_asr_text=...`;
  - saved the screenshot evidence to
    `output/realtime-audio-smoke/frontend-task-card-local-stt-final-2026-06-05.png`.

Verification commands:

```powershell
cargo test -p coolzhu-web-console python_whisper_model_name_ -- --nocapture
cargo test -p coolzhu-web-console whisper_python_script_resamples_audio_to_whisper_rate -- --nocapture
cargo test -p coolzhu-web-console web_task_card_shows_realtime_asr_source_and_last_text -- --nocapture
cargo test -p coolzhu-web-console realtime_ -- --nocapture
node --check modules/gui-web/packages/web-console/src/app.js
cargo fmt -p coolzhu-web-console --check
cargo build -p coolzhu-web-console
POST http://127.0.0.1:8765/api/realtime/session/start
POST http://127.0.0.1:8765/api/audio/realtime/segment
GET  http://127.0.0.1:8765/api/realtime/session/status
POST http://127.0.0.1:8765/api/realtime/session/stop
```

Remaining boundary:

- This validates browser-format final-segment ASR, not provider-native
  streaming partial ASR. The next step is frontend interactive verification and
  then a real streaming ASR/provider adapter that emits partial/final transcript
  events without waiting for stop.

## Unified Realtime Frontend Child-Loop Ownership

Fixed the frontend ownership split for unified realtime sessions.

Root cause:

- `/api/realtime/session/start` already starts the backend audio and vision child
  loops.
- The frontend then called `/api/vision/realtime/start` again and called
  `audioRealtimeStart()` in a mode that POSTed `/api/audio/realtime/start` a
  second time.
- That made the unified session less authoritative and could overwrite child
  loop state/session identifiers during real interaction.

Fix:

- `realtimeSessionStart()` now uses `/api/realtime/session/start` as the single
  backend child-loop owner.
- `audioRealtimeStart({ backendStarted: true, status })` starts browser-side
  microphone capture and partial recognition without POSTing the child audio
  start endpoint again.
- Auto-resume after realtime TTS uses the same backend-managed path.
- Removed the frontend-only `realtimeSessionStartedVision` branch; unified
  session stop owns backend child-loop shutdown.

Verification:

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo test -p coolzhu-web-console web_realtime_session_frontend_uses_unified_child_loop_control -- --nocapture
cargo test -p coolzhu-web-console web_frontend_audio_realtime_auto_tts_only_speaks_final_replies -- --nocapture
cargo test -p coolzhu-web-console realtime_ -- --nocapture
cargo fmt -p coolzhu-web-console --check
cargo build -p coolzhu-web-console
```

Runtime smoke:

- Restarted `coolzhu-web-console` on fixed port `8765`, PID `27032`.
- Confirmed served `src/app.js` includes the new backend-managed
  `audioRealtimeStart({ backendStarted = false, status = null } = {})` path and
  no longer includes `realtimeSessionStartedVision`.
- Re-ran valid `audio/webm` final segment smoke:
  `asr_attempted=true`, `asr_transcript_received=true`,
  `asr_provider=local_stt_final`, unified status
  `partial_asr_provider=local_stt_final`, and stop returned
  `running=false`, `last_error=null`.

## Realtime Vision + Voice Composite Frontend Smoke

Ran a unified session smoke that combines the existing UI-DETR-compatible
external frame ingestion path with valid browser-format final-segment ASR.

Current real-model resource state:

- Port `7860` is not listening, so the local UI-DETR service is not currently
  running.
- No local `.pth`, `.pt`, `.safetensors`, or `.bin` UI-DETR/RF-DETR checkpoint
  was found under the checked user paths.
- The project does include
  `modules/vision/resources/uidetr/uidetr_service.py`; previous logs show the
  wrapper successfully served `/detect` on 2026-06-01 and 2026-06-03, but that
  process is not active now.

Composite smoke:

1. Started `/api/realtime/session/start` with `start_vision=true` and
   `start_audio=true`.
2. Injected a UI-DETR-style external detector frame through
   `/api/vision/realtime/frame` with three elements:
   `Realtime Start`, `Task Chain`, and `Message input`.
3. Sent the valid `audio/webm` final segment through
   `/api/audio/realtime/segment`.
4. Confirmed unified status:
   - `vision_state=degraded` because the real detector backend is offline;
   - `frames=1`;
   - `elements=3`;
   - `audio_segments=1`;
   - `audio_payload_chunks=1`;
   - `partials=1`;
   - `partial_provider=local_stt_final`;
   - `last_partial_is_final=true`;
   - `last_error=null`.
5. Opened the frontend task-card `任务链` popup and verified it shows both:
   - `Vision loop` with `frames=1; elements=3`;
   - `Audio input loop` with `partial_provider=local_stt_final` and the final
     transcript.
6. Saved screenshot evidence to
   `output/realtime-audio-smoke/frontend-task-chain-vision-audio-composite-2026-06-05.png`.
7. Stopped the realtime session and vision loop; fixed port `8765` stayed
   running.

Boundary:

- This proves the unified frontend/task-card flow for simultaneous visual
  element-table updates and final-segment ASR.
- It is not a live UI-DETR model acceptance because the actual `7860` detector
  service and checkpoint are not currently available.

## Remaining Acceptance Items

- Full-streaming gates now derive from runtime/config capability state instead
  of fixed strings. Remaining implementation work is the real adapters that
  should report those capabilities:
  - provider-native partial ASR adapter with interim/final transcript events;
  - far-end reference AEC or WebRTC/SpeexDSP audio processing path;
  - realtime model adapter that can consume live visual element tables and
    partial ASR without waiting for a turn-complete chat request.
- Project diff, media playback, terminal session, and browser proxy functional
  smokes before final visual layout pass.
