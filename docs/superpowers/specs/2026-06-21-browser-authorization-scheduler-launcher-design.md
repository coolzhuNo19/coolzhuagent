# Browser, Authorization, Scheduler Room and Launcher Design

## Objective

Implement the approved Scheme A across four bounded areas:

1. Restore the Browser window toolbar and make external sites such as Baidu open through a reliable top-level WebView2 window.
2. Reclaim Task Authorization space by removing the empty pending-approval card, make Goal role session names readable and keep scheduled tasks permanently expanded.
3. Route scheduled-task reasoning and replies into a system-managed chat room named `定时任务`.
4. Produce a user-facing `package/COOLZHU-AGENT.exe` entry point that starts the packaged application without requiring the user to run PowerShell.

The implementation must preserve existing module boundaries, avoid new business environment-variable gates, use minimal behavior-focused TDD and finish with real Computer Use interaction validation.

## Current root causes

### Browser

The Browser toolbar renders seven controls against a five-column CSS grid. The third control, Refresh, lands in the flexible address column and expands across most of the row; the actual URL input is pushed near the right edge.

External HTTP(S) URLs are intentionally routed away from the iframe because arbitrary sites can reject embedding through `X-Frame-Options` or CSP `frame-ancestors`. They are sent to the Tauri `external-browser` WebView2 window. The browser fix therefore must repair both the toolbar geometry and the top-level window lifecycle instead of attempting to force Baidu into the iframe.

### Task Authorization

The first column still reserves a large flexible row for the pending-approval card even when there are no approvals. Goal role cards use a four-column override inside that narrow column, leaving too little width for full session/model labels. Scheduled tasks are wrapped in a collapsed `<details>` element.

### Scheduled-task chat output

Poll scheduled tasks currently call the normal chat dispatch with `chat_room_id: None`, which falls back to the default room. Goal scheduled tasks persist phase reasoning and replies to the room originally associated with the Goal. No dedicated scheduled-task room is created or protected.

### Package startup

The package contains module executables and `package/run.ps1`, but no user-facing executable that coordinates Web Console startup, health readiness and Tauri Shell launch.

## Architecture

### 1. Browser host boundary

The Browser window keeps two explicit hosts:

- Loopback, `about:` and `file:` previews may use the existing sandboxed iframe.
- Non-loopback HTTP(S) URLs use the dedicated Tauri WebView2 window.

The toolbar becomes a seven-column grid in this order:

`Back | Forward | URL | Go | Reload | Stop | Independent window`

Refresh no longer occupies the elastic column. The URL input owns the only flexible column and remains readable at narrow widths. Advanced proxy controls stay in the collapsed drawer.

The Tauri browser window lifecycle will:

- Reuse the stable `external-browser` label.
- Restore and show an existing minimized/hidden window before focusing it.
- Surface creation, navigation and focus failures to the main Browser status strip.
- Fall back to the system browser only when Tauri window creation or navigation actually fails.
- Keep Back, Forward, Reload and Stop routed to the same active host.

No attempt will be made to bypass external-site frame restrictions.

### 2. Task Authorization layout

The pending-approval card is removed from this window. Approval counts and backend approval state remain available to other consumers; only this redundant empty visual area is deleted.

The left authorization column becomes:

1. Goal role assignment.
2. Goal runtime configuration.
3. Always-visible scheduled-task editor and task list.

Goal role assignment uses a 2x2 card grid. Each card places the role name and icon above a full-width session select. Selects must use the available width, and option/title text must expose the complete session and model name rather than relying on a clipped fixed-width field.

The scheduled-task container becomes a normal section with a static header. It must not require disclosure expansion and must keep the existing `data-role` and `data-action` contracts.

### 3. System-managed `定时任务` chat room

Introduce stable constants for the scheduled room ID and display name. Session-store initialization ensures this room exists without making it the active room and without consuming one of the eight user-created room slots.

The room is system-managed:

- It is recreated if missing during startup or before scheduled delivery.
- Rename and delete operations reject attempts against the reserved room ID.
- User-created room limits count only user rooms.

Poll task flow:

1. Ensure the scheduled room exists.
2. Dispatch the task to the selected model session with `chat_room_id` set to the scheduled room ID.
3. Persist the normal user task message, reasoning, tool summaries and assistant reply through the existing chat pipeline.

Goal task flow:

1. Run the existing Goal phase in its authoritative Goal room so Goal context and state remain intact.
2. Mirror only the resulting phase messages into the scheduled room.
3. Preserve message IDs and kinds so reasoning/reply rendering remains consistent and duplicate mirroring can be detected.
4. Add a concise scheduler status message for skipped, completed or failed runs when no model message is produced.

The scheduled room is visible in the normal room list and does not automatically steal focus when a background task runs.

### 4. User-facing package launcher

Add a small Windows Rust launcher as a root-workspace package. It is a coordination binary, not a second copy of application logic.

The launcher is published as:

`package/COOLZHU-AGENT.exe`

At runtime it:

1. Resolves `bin/coolzhu-web-console.exe` and `bin/coolzhu-tauri-shell.exe` relative to its own package directory.
2. Creates the configured package log directory.
3. Starts Web Console hidden with stdout/stderr redirected to separate log files.
4. Polls the existing Web Console health endpoint with a bounded timeout.
5. Writes `tmp/logs/package-selfcheck-last.json` using the existing `id/status/detail` self-check shape.
6. Starts Tauri Shell with the Web Console PID one-shot process argument so shell shutdown can coordinate the child process.
7. Displays a concise Windows error dialog and exits non-zero when required files are missing or health readiness fails.

The EXE is the single user entry point but remains dependent on the sibling package files. Producing a self-contained installer or one-file extraction bundle remains a later installer task.

Launcher paths, executable names, health URL and timeout are declared through the existing package manifest/configuration boundary rather than duplicated across scripts.

## Error handling and logging

- Browser UI errors remain visible in the Browser status strip and desktop module logs.
- Scheduled-task delivery failures update the task's existing `last_error` and also append a concise failure message to the scheduled room when persistence is available.
- Launcher process output is written under `tmp/logs`; long-running child stdout/stderr are separated by module.
- No stderr is silently discarded.
- No new `COOLZHU_*` or similar business environment-variable gate is introduced.

## Risk management and rollback

Before implementation:

- Back up the complete affected Web Console source directory.
- Back up the affected Tauri Shell source directory before editing its already-dirty working tree.
- Back up package configuration/scripts and generate SHA-256 manifests under `tmp/backups/<timestamp>-browser-scheduler-launcher-pre/`.
- Record backup and command output under `tmp/logs/`.

Git commits remain scoped by repository:

- `modules/gui-web`: Browser UI, authorization layout and scheduled-room behavior.
- `modules/gui-desktop`: Browser WebView2 lifecycle only, without staging unrelated desktop-pet changes.
- Root repository: design/plan/work-log, launcher crate and package manifest/script integration.

## Minimal TDD strategy

Only one focused regression contract is required per root cause:

1. Browser static contract: seven toolbar controls map to the intended flexible URL column and external URLs classify to WebView2.
2. Authorization static contract: no pending-approval card, Goal assignment is 2x2, scheduled tasks are not a collapsible `<details>`.
3. Scheduled room backend contract: system room is created/protected and poll/Goal scheduled results route or mirror into it without changing the active room.
4. Launcher contract: package-relative binary resolution, missing-file failure and bounded health readiness are covered with temporary directories and a local test listener.

Tests must be run once in the failing state before production changes and again after the minimal implementation.

## Functional acceptance

After builds and package publication:

1. Launch `package/COOLZHU-AGENT.exe`.
2. Use Computer Use to open the Browser window, enter `https://www.baidu.com`, press Open and confirm a visible, focused top-level browser window loads Baidu.
3. Use the Browser controls to navigate, reload and focus the same window.
4. Open Task Authorization and visually confirm the pending area is gone, all four model session names are readable and scheduled tasks are already expanded.
5. Run a short scheduled task and confirm its reasoning/reply appears in the `定时任务` room while the user's current room remains selected.
6. Confirm launcher logs and `package-selfcheck-last.json` exist and contain successful readiness evidence.

All executable commands use explicit timeouts and redirect output to `tmp/logs/`. Final implementation and evidence are recorded in a new `docs/work-logs/` document.
