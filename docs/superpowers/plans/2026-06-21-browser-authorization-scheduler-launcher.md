# Browser, Authorization, Scheduler Room and Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Scheme A so the Browser and Task Authorization windows match the approved wuxia bamboo visual design, scheduled-task output is routed to a protected system chat room, and the packaged application has a user-launchable `COOLZHU-AGENT.exe`.

**Architecture:** Keep the existing module boundaries. The Web Console owns Browser markup/style, authorization layout, scheduled-room persistence and scheduler routing. The Tauri Shell owns the external WebView2 browser window lifecycle. A new root-workspace launcher crate coordinates packaged process startup through a checked-in JSON configuration copied into `package/`. GLM5.2 may implement non-visual scheduler-room and launcher tasks through a supervised scheduled Goal; the main agent retains all visual changes, integration decisions and Computer Use acceptance.

**Tech Stack:** Rust, Axum, rusqlite, Tauri 2/WebView2, vanilla HTML/CSS/JavaScript, PowerShell packaging, Cargo tests, Computer Use.

---

## Task 1: Create rollback evidence and capture a clean baseline

**Files:**

- Create: `tmp/backup-browser-scheduler-launcher.ps1`
- Create: `tmp/backups/<timestamp>-browser-scheduler-launcher-pre/`
- Create: `tmp/logs/browser-scheduler-launcher/backup.log`
- Create: `tmp/logs/browser-scheduler-launcher/baseline-tests.log`

- [ ] Create `tmp/backup-browser-scheduler-launcher.ps1` with an explicit source allow-list:
  - `modules/gui-web/packages/web-console`
  - `modules/gui-desktop/packages/tauri-shell/src-tauri`
  - root `Cargo.toml`, `Cargo.lock`, `config/package-manifest.json`, `scripts/package-all.ps1`
  - any existing launcher/package configuration files
- [ ] Resolve every source and destination to an absolute path and reject any destination outside `tmp/backups/`.
- [ ] Copy the allow-listed paths and write a SHA-256 manifest into the backup directory.
- [ ] Run the backup script with a 120-second timeout and redirect stdout/stderr to `tmp/logs/browser-scheduler-launcher/backup.log`.
- [ ] Record `git status --short`, the current branch and the three repository heads for root, `modules/gui-web` and `modules/gui-desktop`.
- [ ] Run the focused Web Console and Tauri baseline tests with explicit timeouts, preserving failures as baseline evidence rather than changing code.

Commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/backup-browser-scheduler-launcher.ps1 *> tmp/logs/browser-scheduler-launcher/backup.log
cargo test -p coolzhu-web-console --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/baseline-web-console.log
cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/baseline-tauri.log
```

Expected: backup manifest exists; any baseline failures are recorded with their exact test names and are not hidden.

## Task 2: Start and supervise the GLM5.2 scheduled Goal

**Files:**

- Create: `tmp/logs/browser-scheduler-launcher/glm-goal-supervision.jsonl`
- Modify only through GLM phase 1: `modules/gui-web/packages/web-console/src/main.rs`
- Modify only through GLM phase 2: `packages/app-launcher/Cargo.toml`
- Modify only through GLM phase 2: `packages/app-launcher/src/lib.rs`
- Modify only through GLM phase 2: `packages/app-launcher/src/main.rs`
- Modify only through GLM phase 2: `config/package-launcher.json`
- Modify only through GLM phase 2: root `Cargo.toml`

- [ ] Start the packaged Web Console and wait for `/health` with a bounded timeout.
- [ ] Query `/api/sessions` and select the active `GLM5.2 (glm-5.2)` session by stable session ID; do not hard-code a display label as an ID.
- [ ] Ensure Goal roles used by the scheduled Goal point to the selected GLM5.2 session.
- [ ] Create one background Goal associated with a non-user-visible implementation room and the completion condition:
  `focused tests pass, changed-file allow-list is respected, artifacts and error report are emitted`.
- [ ] Plan two dependency-ordered phases:
  1. `scheduled-room-backend`: implement Task 3 only.
  2. `package-launcher-core`: implement Task 6 launcher core only after phase 1 verification.
- [ ] Create a one-shot Goal scheduled task that invokes the Goal progress mode.
- [ ] Poll Goal state/events and repository diffs every 30 seconds. Append JSONL entries containing timestamp, phase, status, changed files, test result and error text.
- [ ] Stop or correct the Goal if it edits `index.html`, `styles.css`, Browser visual assets, unrelated modules, or pre-existing dirty files.
- [ ] After each phase, inspect the diff, rerun its focused tests independently and either accept the phase or repair/revert only the phase-owned hunks.
- [ ] Record every GLM execution error, retry, stale assumption, test failure and scope violation for the final work-log.

Expected: GLM5.2 performs only deterministic non-visual work. Visual acceptance and final completion claims remain with the main agent.

## Task 3: Add the protected system `定时任务` room and scheduler routing

**Files:**

- Modify: `modules/gui-web/packages/web-console/src/main.rs`

### 3.1 Write failing tests

- [ ] Add tests proving store initialization creates the reserved scheduled room without activating it.
- [ ] Add a test proving the reserved room does not consume one of the eight user-created room slots.
- [ ] Add tests proving rename and delete reject the reserved room.
- [ ] Add a poll-scheduler test proving `SendMessageRequest.chat_room_id` is the reserved room ID.
- [ ] Add a Goal scheduler test proving newly generated phase messages are mirrored into the reserved room without changing the active room.
- [ ] Add an idempotency test proving rerunning delivery does not duplicate mirrored messages.

Run:

```powershell
cargo test -p coolzhu-web-console scheduled_task_system_room --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/scheduled-room-red.log
```

Expected: the new tests fail because no reserved room or routing exists.

### 3.2 Implement the minimum backend behavior

- [ ] Add stable constants for the scheduled-room ID and display name.
- [ ] Add an idempotent `ensure_scheduled_task_room` helper used during store initialization and immediately before scheduled delivery.
- [ ] Exclude the reserved room from the user-room count.
- [ ] Reject update/delete attempts for the reserved room with a specific validation error.
- [ ] Route poll scheduled tasks directly to the reserved room.
- [ ] For Goal tasks, snapshot the phase room messages before/after `run_goal_phase_once`, mirror only newly generated messages into the reserved room, and preserve message IDs because `chat_room_messages` uses the composite key `(room_id, id)`.
- [ ] Never change the active chat room while creating or delivering to the reserved room.
- [ ] Persist concise scheduler status messages for skipped, failed and no-output executions.

### 3.3 Verify and commit

- [ ] Run focused tests, then the full Web Console test suite.
- [ ] Review the diff for unrelated formatting or behavior.
- [ ] Commit only the scheduler-room backend changes in `modules/gui-web`.

Commit:

```text
feat(scheduler): route task output to system chat room
```

## Task 4: Repair Browser layout and external WebView2 lifecycle

**Files:**

- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/app.js` only if status/error routing requires it
- Modify: `modules/gui-web/packages/web-console/src/main.rs` for static contract tests
- Modify: `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`

### 4.1 Write failing visual-contract and lifecycle tests

- [ ] Replace the old Browser toolbar static contract with an ordered seven-control contract:
  `back`, `forward`, URL input, `go`, `reload`, `stop`, `open-external`.
- [ ] Add a CSS contract test requiring seven grid columns with the URL as the only flexible column.
- [ ] Add Tauri unit/static tests for restoring an existing external browser window before focus and for propagating lifecycle errors.

Run:

```powershell
cargo test -p coolzhu-web-console browser_window_toolbar --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/browser-toolbar-red.log
cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml external_browser --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/browser-tauri-red.log
```

Expected: tests fail against the five-column toolbar and incomplete existing-window lifecycle.

### 4.2 Implement Browser visual alignment

- [ ] Reorder Browser controls in `index.html` to match the approved design.
- [ ] Set the toolbar grid to:
  `auto auto minmax(16rem, 1fr) auto auto auto auto`.
- [ ] Keep controls on one row, preserve the dark green glass/metal skin, remove stray gold borders, and use the existing approved icon family.
- [ ] Keep the advanced proxy area collapsed and avoid exposing debug-only text.
- [ ] Retain existing `data-action` and `data-role` contracts.

### 4.3 Harden Tauri browser lifecycle

- [ ] For an existing `external-browser` window: navigate, unminimize, show and focus in that order, returning the first actionable error.
- [ ] For a new window: build the WebView2 window, show it and focus it, surfacing failures to the caller.
- [ ] Keep loopback/about/file in iframe and route non-loopback HTTP(S) URLs to the external Tauri window.
- [ ] Use system-browser fallback only after a Tauri create/navigation failure.

### 4.4 Verify and commit

- [ ] Run Browser-focused and full module tests.
- [ ] Commit Web Console and Tauri Shell changes separately because they are separate repositories.

Commits:

```text
fix(browser): restore toolbar geometry and external host routing
fix(browser): harden external webview lifecycle
```

## Task 5: Rebuild Task Authorization layout to match the approved design

**Files:**

- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

### 5.1 Write failing layout contracts

- [ ] Add a test proving the Task Authorization window no longer renders the pending-approval card.
- [ ] Add a test proving the left column order is Goal role assignment, Goal runtime configuration, scheduled tasks.
- [ ] Add a test proving the Goal cards use a 2x2 grid and full-width selects.
- [ ] Add a test proving scheduled tasks are a normal always-visible section, not `<details>`.
- [ ] Add a test proving all existing `data-role` and `data-action` hooks remain present.

Run:

```powershell
cargo test -p coolzhu-web-console task_authorization_layout --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/task-authorization-red.log
```

Expected: tests fail against the pending card, four-column role override and collapsed scheduled-task container.

### 5.2 Implement the approved visual structure

- [ ] Remove only the redundant pending-approval visual card; retain backend approval data and counters.
- [ ] Place Goal role assignment first and render four role cards in a 2x2 grid.
- [ ] Give each model/session select full card width and expose the complete display name through visible text and `title`.
- [ ] Keep Goal runtime configuration expanded.
- [ ] Convert scheduled tasks to a normal section with editor and list always visible.
- [ ] Match the approved dark jade glass, restrained bronze separators, green state badges and wuxia icon style.
- [ ] Remove stale gold border overrides and avoid new fixed pixel widths that clip localized labels.

### 5.3 Verify and commit

- [ ] Run focused and full Web Console tests.
- [ ] Commit only Task Authorization markup/style/test changes.

Commit:

```text
fix(authorization): align goal and scheduler workspace
```

## Task 6: Add the packaged application launcher

**Files:**

- Modify: root `Cargo.toml`
- Modify: root `Cargo.lock`
- Create: `packages/app-launcher/Cargo.toml`
- Create: `packages/app-launcher/src/lib.rs`
- Create: `packages/app-launcher/src/main.rs`
- Create: `config/package-launcher.json`
- Modify: `config/package-manifest.json`
- Modify: `scripts/package-all.ps1`

### 6.1 Write failing launcher tests

- [ ] Add unit tests for resolving package-relative paths without hard-coded user directories.
- [ ] Add unit tests for bounded health polling success and timeout.
- [ ] Add unit tests for the self-check JSON schema and log directory creation.
- [ ] Add unit tests proving the Tauri child receives `--web-console-pid=<pid>`.
- [ ] Add a packaging manifest contract test proving `COOLZHU-AGENT.exe` and `package-launcher.json` are publish artifacts.

Run:

```powershell
cargo test -p coolzhu-app-launcher --offline -- --test-threads=1 *> tmp/logs/browser-scheduler-launcher/launcher-red.log
```

Expected: the package does not yet exist, so the test/build command fails.

### 6.2 Implement launcher core

- [ ] Add `packages/app-launcher` to the root workspace.
- [ ] Read executable names, health URL, timeout and log path from `package-launcher.json`.
- [ ] Start the Web Console hidden with stdout/stderr redirected under `tmp/logs`.
- [ ] Poll health until success or configured timeout.
- [ ] Start Tauri Shell with the Web Console PID.
- [ ] On failure, write a structured `package-selfcheck-last.json`, preserve child logs and display a concise Windows error dialog or console error without swallowing the cause.
- [ ] Avoid introducing new business environment-variable gates.

### 6.3 Integrate package-all

- [ ] Add the launcher as an independently built manifest artifact.
- [ ] Publish it as `package/COOLZHU-AGENT.exe`.
- [ ] Copy `config/package-launcher.json` to `package/package-launcher.json`.
- [ ] Preserve the existing timestamp comparison and ten-backup retention behavior.

### 6.4 Verify and commit

- [ ] Run launcher tests and root workspace checks.
- [ ] Commit root launcher/package changes without staging unrelated documentation.

Commit:

```text
feat(package): add user-facing application launcher
```

## Task 7: Package, launch and perform real Computer Use acceptance

**Files:**

- Create: `tmp/logs/browser-scheduler-launcher/package-all.log`
- Create: `tmp/logs/browser-scheduler-launcher/computer-use-validation.md`
- Modify: `docs/work-logs/2026-06-21-browser-authorization-scheduler-launcher.md`

- [ ] Run `scripts/package-all.ps1` with a bounded timeout and redirect output to `tmp/logs/browser-scheduler-launcher/package-all.log`.
- [ ] Confirm `package/COOLZHU-AGENT.exe`, `package/package-launcher.json` and updated binaries exist.
- [ ] Launch `package/COOLZHU-AGENT.exe`.
- [ ] Use Computer Use—not DOM-only automation—to perform these user-visible checks:
  1. Open Browser, type `https://www.baidu.com`, click Go, verify the top-level external WebView2 window loads Baidu.
  2. Verify URL, Go, Reload, Stop and independent-window controls remain on one row and match the approved style.
  3. Open Task Authorization, verify no pending card, role labels are readable, and scheduled tasks are permanently visible.
  4. Keep a user chat selected, run a due scheduled task, verify the selected chat does not change.
  5. Open `定时任务`, verify the scheduled model reasoning/reply or concise scheduler status is present.
  6. Close and relaunch through `COOLZHU-AGENT.exe`, verify `tmp/logs/package-selfcheck-last.json` reports healthy startup.
- [ ] Capture screenshots and exact failures in `tmp/logs/browser-scheduler-launcher/computer-use-validation.md`.
- [ ] If a check fails, return to the smallest responsible task, add a focused regression test, fix it and repeat the failed UI path.

## Task 8: Final audit, error ledger and Git history

**Files:**

- Create: `docs/work-logs/2026-06-21-browser-authorization-scheduler-launcher.md`
- Update only if a new general rule was learned: `docs/development-standard.md`

- [ ] Run formatting and complete relevant test suites with timeouts.
- [ ] Confirm all three repositories contain only intended changes plus pre-existing user changes.
- [ ] Document:
  - root causes and changed files
  - backup location and restoration procedure
  - GLM5.2 Goal/session/schedule IDs
  - phase timings, retries, scope violations and encountered errors
  - fixes applied by the supervising agent
  - automated test evidence
  - Computer Use steps and screenshots
  - package artifact paths and self-check result
  - remaining risks and installer follow-up
- [ ] Add a development-standard rule only if supervision revealed a reusable long-task requirement; do not add task-specific prose as a general rule.
- [ ] Commit the work-log in the root repository without staging the user’s unrelated dirty files.

Commit:

```text
docs(work-log): record browser scheduler launcher delivery
```

## Completion gate

The work is complete only when all of the following are true:

- Browser toolbar order and proportions match the approved design and Baidu opens in a functioning external WebView2 host.
- Task Authorization has no pending card, Goal session names are readable and scheduled tasks are always visible.
- The protected `定时任务` room exists, scheduled output arrives there and current chat focus is preserved.
- `package/COOLZHU-AGENT.exe` starts the packaged application and writes a passing self-check.
- Focused and full tests pass.
- Computer Use validates the actual frontend paths.
- GLM5.2 supervision errors and corrections are recorded.
- Root, Web Console and Tauri changes are committed in their respective repositories.
