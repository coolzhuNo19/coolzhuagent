# Functional Gap Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current workbench windows up to their intended functional baseline before doing the final visual layout pass.

**Architecture:** Land one independently testable capability at a time, keeping each feature behind existing window APIs and current data contracts. Avoid hardcoded local paths or environment-only switches; prefer existing `coolzhu.toml`, REST routes, and UI state stores.

**Tech Stack:** Rust Axum web-console, vanilla JS frontend, Playwright frontend verification, local Python UI-DETR wrapper where relevant.

---

### Phase P0: Current State Correctness

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [x] Remove Goal creation/list controls from Settings so that Settings only configures reusable roles and sessions. Goal creation remains chat-triggered or task-chain driven.
- [x] Make the top task card use only current runtime work or open Goal work. Closed old Goal records must not keep the task card stuck on stale paused/completed content.
- [x] Verify with focused Rust static tests, `cargo build -p coolzhu-web-console`, and Playwright screenshots after restarting port `8765`.

### Phase P1: Window Functional Baselines

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [x] Project window: finish file tree parent navigation and diff-by-two-paths flow with readable errors.
- [x] Media window: add true audio/video playback using native `<audio>` / `<video>` controls, playlist selection, and source validation.
- [ ] Terminal window: add persistent workspace PowerShell sessions instead of single-command execution only.
- [ ] Browser window: make proxy mode explicit and observable; surface iframe-blocked fallback clearly.
- [x] Vision window: overlay UI-DETR bbox results on the current screenshot and expose a safe dry-run target selection flow.
  - [x] Overlay UI-DETR bbox results on the current screenshot.
  - [x] Expose a safe dry-run target selection flow from selected bbox.

### Phase P2: Integrated Acceptance Scenarios

**Files:**
- Create: `docs/work-logs/2026-06-01-functional-gap-acceptance.md`
- Modify tests near existing `web_frontend_*` coverage in `modules/gui-web/packages/web-console/src/main.rs`

- [ ] Add a frontend acceptance scenario for UI-DETR realtime start/stop with element count evidence.
- [x] Add a frontend acceptance scenario for realtime full-streaming readiness gates:
  - [x] Default mode remains conservative when adapters are missing.
  - [x] Runtime/config capability state can report all three gates ready.
  - [x] Task card and `任务链` popup show `mode=full_streaming`, `risk=ready`, and `gates=3/3`.
- [ ] Add a functional smoke scenario for project diff, media playback selection, terminal command execution, and browser proxy status.
- [ ] Save screenshots or logs under `output/playwright/` for each window before the final visual-layout pass.

### Phase P3: Visual Layout Pass

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/index.html`

- [ ] Align each subwindow with the reference design language after functional behavior is stable.
- [ ] Keep current responsive constraints and avoid replacing functional DOM with decorative bitmap-only frames.
