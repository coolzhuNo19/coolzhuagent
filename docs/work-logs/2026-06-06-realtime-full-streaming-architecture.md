# Realtime full-duplex/full-streaming architecture checkpoint - 2026-06-06

## Plan alignment

Reference plan: `docs/plans/实时视觉语音交互功能方案计划书-2026-06-06.md`.

The existing realtime implementation already has independent STT, TTS, vision, and desktop-action scaffolding. The main architecture gap was not a missing subsystem, but the lack of one observable realtime session event spine and an overly optimistic full-streaming readiness signal.

## Adjustments made

- Added a unified realtime session SSE stream at `GET /api/realtime/session/events`.
- Broadcast session lifecycle, audio segment, partial/final transcript, and vision frame events through the unified stream.
- Broadcast assistant generation, tool/action step, and TTS synthesis events through the unified stream.
- Wired the frontend to subscribe to the unified realtime session event stream and fold events into the realtime task/status model.
- Wired browser-side TTS playback start/segment/end/stop events into the same frontend realtime status reducer.
- Changed full-streaming readiness so capability names alone do not satisfy full-streaming gates. Runtime gates now require adapter/health evidence.
- Provider-native partial ASR can satisfy the partial-ASR gate only after actual partial-ASR runtime evidence is observed.
- Added an explicit `streaming_tts_output` readiness gate so segmented TTS synthesis/playback is not misreported as true chunk-level streaming TTS.
- Added `POST /api/audio/tts/chunk` as the runtime bridge for true streaming TTS backends/wrappers. It requires a real `audio_base64` payload or `audio_url`, persists base64 chunks as registered TTS audio files, emits `tts_chunk`, and lets that event satisfy the `streaming_tts_output` gate.
- Wired frontend `tts_chunk` events into a browser playback queue so chunk events with `audio_url` are played sequentially and remain interruptible by existing barge-in/stop controls.

## Current behavior

- Requesting `full_streaming` without confirmed adapter health still downgrades to `half_duplex_guarded`.
- This is intentional. It prevents tests or UI state from reporting full-streaming success when the software only has a guarded segmented pipeline.
- Full-duplex/full-streaming should become active only when these runtime confirmations exist:
  - provider-native partial ASR or equivalent real streaming STT
  - far-end reference AEC or confirmed echo-control path
  - realtime LLM/model adapter capable of streaming response and cancellation
  - streaming TTS output with chunk-level runtime evidence

## Verification

- `node --check modules/gui-web/packages/web-console/src/app.js`
- `cargo fmt --package coolzhu-web-console --check`
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
  - Result: 45 passed.
- `cargo test -p coolzhu-web-console tts_chunk -- --nocapture`
  - Result: 3 passed.
- Fixed-port runtime smoke on `127.0.0.1:8765`:
  - connected `GET /api/realtime/session/events`
  - posted `POST /api/realtime/session/start` with `requested_mode=full_streaming`
  - posted `POST /api/audio/realtime/partial`
  - posted `POST /api/realtime/session/stop`
  - observed SSE events: `hello`, `session_started`, `final_transcript`, `session_stopped`
- Fixed-port runtime TTS smoke on `127.0.0.1:8765`:
  - posted `POST /api/audio/tts/speak` with real piper backend and `auto_play=false`
  - observed SSE events: `tts_synthesis_started`, `tts_synthesis_ready`
  - response returned a real `/api/audio/tts/files/{id}` audio URL
- Fixed-port real model stream smoke on `127.0.0.1:8765`:
  - started a realtime session with `requested_mode=full_streaming` and `provider_adapter=realtime_provider_adapter`
  - sent a real `/api/chat/send/stream` request to the configured `test5(qwen3.7-max)` session
  - observed real model `message_delta` events and unified session `assistant_text` events
  - verified the `realtime_model_adapter` readiness gate changed to `ready`
- Fixed-port barge-in event smoke on `127.0.0.1:8765`:
  - connected `GET /api/realtime/session/events`
  - posted `POST /api/realtime/session/start` with `requested_mode=full_streaming` and `provider_adapter=realtime_provider_adapter`
  - posted `POST /api/realtime/session/barge-in/evaluate` with escaped UTF-8 text for `等一下 不对`
  - observed SSE event `barge_in_decision`
  - verified `should_interrupt=true`, `recommended_action=cancel_tts_and_model_output`, and status `barge_in_state=confirmed`, `audio_out_state=cancelled`
- Fixed-port TTS readiness gate smoke on `127.0.0.1:8765`:
  - confirmed idle status exposes `tts_transport=segmented_tts_queue`
  - confirmed readiness gates include `streaming_tts_output`
  - posted `POST /api/realtime/session/start` with self-reported `stt_transport=provider_native_streaming_asr`, `aec_mode=far_end_reference_aec`, `provider_adapter=realtime_provider_adapter`, and `tts_transport=chunked_tts_stream`
  - verified the session still downgraded to `half_duplex_guarded` because no runtime adapter health evidence was observed
- Fixed-port TTS chunk bridge smoke on `127.0.0.1:8765`:
  - connected `GET /api/realtime/session/events`
  - started a realtime session with `tts_transport=chunked_tts_stream`
  - posted `POST /api/audio/tts/chunk` with a valid WAV `audio_base64` chunk
  - observed SSE event `tts_chunk`
  - verified the returned `/api/audio/tts/files/{id}` URL was readable as `audio/wav`
  - verified the `streaming_tts_output` readiness gate changed to `ready`

## Remaining implementation work

- Implement a real streaming model adapter health probe that confirms response streaming and cancellation support.
- Configure or connect a production streaming TTS backend/wrapper. The bridge, HTTP stream adapter, and frontend playback queue are now in place.
- Add far-end reference echo cancellation confirmation instead of using browser-constraint-only AEC as a full-streaming proof.
- Add HTTP/WebRTC provider-native streaming STT when a provider is configured; keep local segmented STT as guarded fallback.
- Add end-to-end frontend recording validation for the full scenario: user speech, visual frame, model reply, TTS playback, and barge-in.

## 2026-06-07 update - HTTP streaming TTS adapter

### Changes

- Added `POST /api/audio/tts/stream` as a generic HTTP streaming TTS adapter.
- Added `audio.realtime.streaming_tts_url` and `audio.realtime.streaming_tts_timeout_seconds` config fields.
- The adapter accepts a request-level `upstream_url` or falls back to `audio.realtime.streaming_tts_url`.
- The adapter posts generic JSON to the upstream TTS service and reads the HTTP response as real byte chunks.
- Each non-empty upstream chunk is persisted as a registered `/api/audio/tts/files/{id}` file and emitted as the existing `tts_chunk` realtime SSE event.
- The adapter buffers one chunk behind so the final emitted chunk can carry `final_chunk=true` and `chunk_count`.
- Frontend realtime auto-TTS now prefers `/api/audio/tts/stream` when the active realtime session uses `tts_transport=chunked_tts_stream`; manual TTS still uses `/api/audio/tts/speak`.
- If `/api/audio/tts/stream` fails because no streaming backend is configured or the upstream fails, frontend realtime auto-TTS falls back to the existing segmented browser queue. That fallback does not emit `tts_chunk`, so it does not falsely satisfy the `streaming_tts_output` gate.

### Verification

- `node --check modules/gui-web/packages/web-console/src/app.js`
  - Result: passed.
- `cargo test -p coolzhu-web-console tts_stream -- --nocapture`
  - Result: 1 passed.
- `cargo test -p coolzhu-web-console tts_chunk -- --nocapture`
  - Result: 4 passed.
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
  - Result: 45 passed.
- `cargo build -p coolzhu-web-console`
  - Result: passed. Warnings are existing dead-code warnings.
- Fixed-port runtime smoke on `127.0.0.1:8765` after restarting web-console:
  - web-console PID: `26192`
  - started a local temporary HTTP chunked TTS upstream
  - connected `GET /api/realtime/session/events`
  - posted `POST /api/realtime/session/start` with `requested_mode=full_streaming` and `tts_transport=chunked_tts_stream`
  - posted `POST /api/audio/tts/stream` with `upstream_url` pointing to the local chunked upstream
  - response: `chunk_count=2`, `bytes=48`, `ok=true`
  - observed SSE `tts_chunk` events: `2`
  - observed `final_chunk=true`
  - fetched returned `/api/audio/tts/files/{id}` URL and read audio bytes successfully
  - verified `streaming_tts_output` readiness gate changed to `ready`

### Notes

- This validates the streaming adapter with a real HTTP chunked byte stream. It does not claim a production IndexTTS/Piper streaming backend is configured yet.
- Workspace-level `cargo fmt --check` is currently noisy because rustfmt reports broad pre-existing diffs in other modules and older style sections. I did not auto-format unrelated files.

## 2026-06-07 update - streaming TTS config observability

### Changes

- Exposed realtime streaming TTS config status from both audio realtime status and unified realtime session status:
  - `streaming_tts_url`
  - `streaming_tts_url_configured`
  - `streaming_tts_timeout_seconds`
- Updated the frontend realtime status JSON and task-chain details to show:
  - `Streaming TTS endpoint=...`
  - `Streaming TTS timeout=...`
  - `streaming_tts=configured/not-configured`
- Tightened frontend realtime auto-TTS selection:
  - it now prefers `/api/audio/tts/stream` only when the active session uses `tts_transport=chunked_tts_stream` and a streaming TTS URL is configured
  - without a configured production streaming URL, it stays on the existing segmented `/api/audio/tts/speak` fallback and does not repeatedly trigger avoidable stream errors
- Added a unified status note when `chunked_tts_stream` is requested without `audio.realtime.streaming_tts_url`, so the task card/chain can show the missing production backend instead of silently falling back.

### Verification

- `cargo test -p coolzhu-web-console web_realtime_session_exposes_tts_health_for_task_card -- --nocapture`
  - Result: 1 passed.
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
  - Result: 45 passed.
- `cargo test -p coolzhu-web-console tts_chunk -- --nocapture`
  - Result: 4 passed.
- `cargo test -p coolzhu-web-console tts_stream -- --nocapture`
  - Result: 1 passed.
- `node --check modules/gui-web/packages/web-console/src/app.js`
  - Result: passed.
- `cargo build -p coolzhu-web-console`
  - Result: passed. Warnings are existing dead-code warnings.
- Fixed-port runtime status smoke on `127.0.0.1:8765` after restarting web-console:
  - web-console PID: `14344`
  - `GET /api/realtime/session/status` returned `streaming_tts_url_configured=false`, `streaming_tts_url=null`, `streaming_tts_timeout_seconds=30`
  - started a realtime session with `tts_transport=chunked_tts_stream` but no configured streaming URL
  - verified status note contains `streaming_tts_url`
  - verified `streaming_tts_output` gate remains not ready until real chunk runtime evidence is observed

## 2026-06-07 update - streaming TTS probe and readiness semantics

### Changes

- Added `POST /api/audio/tts/stream/probe` for explicit streaming TTS upstream health checks.
- The probe can use a request-level `upstream_url` or the configured `audio.realtime.streaming_tts_url`.
- The probe reads a real upstream HTTP byte chunk and reports:
  - `configured`
  - `reachable`
  - `chunk_received`
  - `bytes`
  - `status`
  - `error`
- The probe intentionally does not require a running realtime session and does not emit `tts_chunk`; it is a diagnostic check, not runtime evidence for full-streaming readiness.
- Added a frontend realtime controls button for streaming TTS probe and surfaced the last probe result in realtime status/task-chain details.
- Added `streaming_tts_url_configured` to the shared realtime capability state, so start/status risk calculation uses one source of truth.
- Refined the `streaming_tts_output` readiness gate:
  - before runtime chunk evidence, `chunked_tts_stream` without `audio.realtime.streaming_tts_url` reports the URL configuration gap
  - once an active realtime session observes real `tts_chunk` evidence from the chunk bridge or formal stream adapter, the gate can become `ready`
  - probe-only chunks do not mark the gate ready
- Fixed a test-state race by taking the existing realtime audio test guard in the new probe test.

### Verification

- `node --check modules/gui-web/packages/web-console/src/app.js`
  - Result: passed.
- `cargo test -p coolzhu-web-console realtime_streaming_risk -- --nocapture`
  - Result: 5 passed.
- `cargo test -p coolzhu-web-console tts_stream -- --nocapture`
  - Result: 2 passed.
- `cargo test -p coolzhu-web-console tts_chunk -- --nocapture`
  - Result: 4 passed.
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
  - Result: 46 passed.
- `cargo build -p coolzhu-web-console`
  - Result: passed. Warnings are existing dead-code warnings.
- Fixed-port runtime smoke on `127.0.0.1:8765` after restarting web-console:
  - web-console PID: `20312`
  - `POST /api/audio/tts/stream/probe` without a configured upstream returned `configured=false`, `chunk_received=false`, and error `TTS stream probe requires upstream_url or audio.realtime.streaming_tts_url`
  - starting a realtime session with `tts_transport=chunked_tts_stream` and no configured streaming URL returned `streaming_tts_output.ready=false` with reason `audio.realtime.streaming_tts_url is not configured`
  - posting `POST /api/audio/tts/stream` against a local temporary chunked HTTP upstream returned `ok=true`, `chunk_count=2`, and `bytes=44`
  - after the formal stream call, `GET /api/realtime/session/status` returned `streaming_tts_output.ready=true`

### Next steps

- Wire the production streaming TTS backend or wrapper into `audio.realtime.streaming_tts_url`.
- Add a real streaming model adapter probe and cancellation proof, matching the stricter runtime-evidence pattern used for streaming TTS.
- Continue the frontend end-to-end recording scenario with real STT/TTS where hardware allows: user speech, visual frame, model final reply, TTS playback, and interruption.

## 2026-06-07 update - realtime model stream probe

### Changes

- Added `POST /api/realtime/model/stream/probe`.
- The probe selects a configured selectable agent by `agent_id`, or falls back to the first selectable enabled agent.
- The probe calls the existing real provider streaming path directly and does not persist chat messages, task messages, or memory beads.
- The probe defaults to a short prompt and closes the stream after the first non-empty delta to keep the health check cheap.
- Added `model_stream_delta` as a realtime session event kind that can record `realtime_model_adapter` runtime evidence when:
  - a realtime session is running
  - the session provider adapter is `realtime_provider_adapter`
  - the probe observes a real non-empty model delta
- Added a frontend `模型流探活` button next to the realtime controls.
- Surfaced `last_model_stream_probe` in realtime status JSON, task-chain assistant details, and the runtime task-card summary.

### Verification

- `node --check modules/gui-web/packages/web-console/src/app.js`
  - Result: passed.
- `cargo test -p coolzhu-web-console web_frontend_audio_realtime_and_indextts_are_wired -- --nocapture`
  - Result: 1 passed.
- `cargo test -p coolzhu-web-console realtime_ -- --nocapture`
  - Result: 46 passed.
- `cargo build -p coolzhu-web-console`
  - Result: passed. Warnings are existing dead-code warnings.
- Fixed-port runtime smoke on `127.0.0.1:8765` after restarting web-console:
  - web-console PID: `23432`
  - started a realtime session with `requested_mode=full_streaming` and `provider_adapter=realtime_provider_adapter`
  - before probe, `realtime_model_adapter.ready=false` with reason `not confirmed by realtime adapter health`
  - posted `POST /api/realtime/model/stream/probe` with `agent_id=session-1779459149988` (`test5(qwen3.7-max)`)
  - response: `ok=true`, `delta_count=1`, `first_delta_ms=3421`, `runtime_evidence_recorded=true`, `stream_closed_after_first_delta=true`
  - after probe, `GET /api/realtime/session/status` returned `realtime_model_adapter.ready=true`

### Remaining risk

- The probe proves that this configured model can return a streaming delta and that the client closed the stream after the first delta.
- It does not yet prove provider-side cancellation semantics after a long generation. A separate cancellation probe should start a deliberately longer stream, cancel it through an explicit cancellation path, and verify no further deltas are accepted for that probe id.
