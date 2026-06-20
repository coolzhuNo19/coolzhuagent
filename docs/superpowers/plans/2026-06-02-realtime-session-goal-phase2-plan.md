# Realtime Session Goal Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the unified realtime vision + voice rollout by adding a testable barge-in decision engine and linking realtime session state into the existing task card/todo list.

**Architecture:** Keep the existing `/api/realtime/session/*` status layer. Add a pure backend classifier endpoint for barge-in/echo/background decisions, then render realtime session as a frontend runtime task using the existing `taskRuntimeItems` and task card functions.

**Tech Stack:** Rust Axum web-console, vanilla JS frontend, existing static frontend tests in `main.rs`, fixed-port HTTP verification on `8765`, Playwright smoke verification.

---

### Task 1: Backend Barge-In Decision Engine

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [x] Add DTOs:
  - `RealtimeBargeInEvaluateRequest`
  - `RealtimeBargeInEvaluateResponse`
- [x] Add pure function `evaluate_realtime_barge_in(policy, request)`.
- [x] Add route `POST /api/realtime/session/barge-in/evaluate`.
- [x] Decision outputs must include:
  - `decision`
  - `barge_in_state`
  - `should_interrupt`
  - `reason`
  - `recommended_action`
- [x] Rules:
  - disabled policy returns `decision=disabled`, `should_interrupt=false`.
  - high echo correlation while TTS is playing returns `decision=echo_detected`.
  - strong interrupt keyword with enough speech duration returns `decision=confirmed`.
  - sustained user speech returns `decision=confirmed`.
  - short/uncertain speech while TTS is playing returns `decision=candidate`.
  - otherwise returns `decision=ignored_background`.

### Task 2: Backend Tests

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [x] Add unit tests for:
  - echo is ignored.
  - strong keyword confirms interruption.
  - sustained speech confirms interruption.
  - short background speech becomes candidate or ignored.
- [x] Extend static route test to assert the new endpoint is wired.

### Task 3: Frontend Runtime Task Integration

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js`

- [x] Add `realtimeSessionTaskItem(status)` that converts realtime session status into the existing runtime task shape.
- [x] Add `syncRealtimeSessionTask(status)` that upserts/removes a realtime runtime task and refreshes `syncTaskCardFromGoals`.
- [x] Call `syncRealtimeSessionTask` from `refreshRealtimeSessionStatus`, `realtimeSessionStart`, and `realtimeSessionStop`.
- [x] The task title should be `Realtime vision voice session`; running status should map to `running`, stopped status should remove the runtime task.

### Task 4: Frontend Barge-In Demo Panel

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [x] Add compact test controls in the realtime status area:
  - text input for transcript sample.
  - select for scenario: `strong_interrupt`, `echo`, `background`, `sustained`.
  - button to evaluate.
  - result pre block.
- [x] Add `realtimeBargeInEvaluate()` to call `/api/realtime/session/barge-in/evaluate`.
- [x] Keep this clearly as a policy simulation panel, not real microphone streaming.

### Task 5: Verification

**Files:**
- Modify static tests near `web_realtime_session_routes_and_barge_in_policy_are_wired`.

- [x] Run `cargo test -p coolzhu-web-console realtime_barge_in -- --nocapture`.
- [x] Run `cargo test -p coolzhu-web-console web_frontend_ -- --nocapture`.
- [x] Run `node --check modules/gui-web/packages/web-console/src/app.js`.
- [x] Run `cargo fmt --check -p coolzhu-web-console`.
- [x] Run `cargo build -p coolzhu-web-console`.
- [x] Restart web-console on fixed port `8765`.
- [x] Verify HTTP barge-in decisions and frontend task card linkage.
- [x] Save a Playwright screenshot under `output/playwright/`.

## Self-Review

- Spec coverage: The plan implements the BargeInGuard decision layer and task-card visibility requested by the realtime session design.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: `barge_in_state`, `decision`, and runtime task status names are consistent with existing realtime status fields.
