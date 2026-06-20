# Realtime Vision Voice Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified realtime session state layer that coordinates current UI-DETR realtime perception, half-realtime STT, final-reply TTS, and the new echo/barge-in policy.

**Architecture:** Keep existing `/api/audio/realtime/*` and `/api/vision/realtime/*` routes intact. Add `/api/realtime/session/*` as a thin orchestration layer and make the frontend start/stop/status UI call that layer while still reusing current audio and vision flows.

**Tech Stack:** Rust Axum web-console, vanilla JS frontend, existing static frontend tests in `main.rs`, `node --check`, `cargo test`, `cargo build`, Playwright smoke verification on fixed port `8765`.

---

### Task 1: Backend Realtime Session Model And Routes

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [x] Add `RealtimeSessionState`, `RealtimeBargeInPolicy`, route request/response DTOs, and a `realtime_session_state()` singleton.
- [x] Add routes:
  - `GET /api/realtime/session/status`
  - `POST /api/realtime/session/start`
  - `POST /api/realtime/session/stop`
- [x] Starting a session should set `main_state=starting`, derive `vision_state` from current UI-DETR status, set `audio_in_state=listening`, set `audio_out_state=idle`, and persist the barge-in policy.
- [x] Stopping a session should set `main_state=idle`, `audio_in_state=off`, `audio_out_state=idle`, and `barge_in_state=quiet`.
- [x] Status should include current UI-DETR frame count and element count by reading `vision_realtime_state()`.

### Task 2: Backend Static Tests

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [x] Add/extend `web_frontend_*` tests that assert:
  - The new routes are registered.
  - The response structs contain `main_state`, `vision_state`, `audio_in_state`, `audio_out_state`, `barge_in_state`, and `barge_in_policy`.
  - The default policy contains `strong_interrupt_min_ms`, `sustained_speech_min_ms`, and `echo_correlation_threshold`.

### Task 3: Frontend Realtime Orchestrator

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js`

- [x] Add frontend state:
  - `realtimeSessionRunning`
  - `realtimeSessionStatus`
  - `realtimeSessionStartedVision`
- [x] Add functions:
  - `refreshRealtimeSessionStatus`
  - `realtimeSessionStart`
  - `realtimeSessionStop`
  - `renderRealtimeSessionStatus`
  - `buildRealtimeAudioConstraints`
- [x] Update `sttStartDictation` to call `getUserMedia({ audio: buildRealtimeAudioConstraints({ realtime }) })`.
- [x] Use `echoCancellation`, `noiseSuppression`, and `autoGainControl` for realtime microphone capture.
- [x] Keep final-reply-only auto TTS behavior unchanged.

### Task 4: Frontend UI Surface

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [x] Add unified realtime controls and status pre block in the existing audio/multimedia window area.
- [x] Keep chat composer free of realtime start/stop buttons.
- [x] Use compact controls; do not do the larger visual redesign pass here.

### Task 5: Verification

**Files:**
- Modify tests near existing `web_frontend_*` coverage in `modules/gui-web/packages/web-console/src/main.rs`
- Create output artifact under `output/playwright/` only during manual smoke verification if the server starts successfully.

- [x] Run `cargo test -p coolzhu-web-console web_frontend_ -- --nocapture`.
- [x] Run `node --check modules/gui-web/packages/web-console/src/app.js`.
- [x] Run `cargo fmt --check -p coolzhu-web-console`.
- [x] Run `cargo build -p coolzhu-web-console`.
- [x] Restart web-console on fixed port `8765`.
- [x] Verify `/api/realtime/session/status`, `/start`, and `/stop` over HTTP.
- [x] Run a Playwright smoke check when the server is reachable.

## Self-Review

- Spec coverage: Tasks cover backend state, frontend orchestration, echo/barge-in policy, UI visibility, and verification.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: Names are stable across backend and frontend: `main_state`, `vision_state`, `audio_in_state`, `audio_out_state`, `barge_in_state`, `barge_in_policy`.
