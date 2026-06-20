# UI Redesign V3 Batch 2 Design

## Objective

Continue the approved wuxia bamboo, dark metal and glass redesign without changing backend protocols. This batch aligns the overview card, task card and chat room with the approved mockup, then applies the same information-density rules to Project, Browser, Terminal, Task Authorization and Vision.

Memory/Knowledge remains a frontend reservation only. Its backend is explicitly out of scope.

## Approved visual direction

- Ink-green bamboo-night background with restrained animated leaves.
- Gunmetal frames and low-opacity glass panels.
- Jade green for healthy/runtime state.
- Gold only for the active window and primary actions.
- No repeated local window titles, page-description strips, rivet labels or static fake telemetry.
- Main content receives priority over toolbars, debug data and helper text.

## Layout decisions

### Top overview region

- Height is reduced to 12% of the application viewport.
- Columns remain exactly 26 / 48 / 26 for overview, bamboo logo and current task.
- Column gaps and outer horizontal padding are zero so the ratio is not over-allocated.
- The overview card keeps avatar, health, agent count, room count, goal-role count and current visual agent.
- The task card keeps current task, progress, running/completed/queued/failed counts and success rate.
- Detailed todo data stays bound but is not displayed in the compact card.

### Chat room

- Left rail width is compact and bounded: approximately 18%, with usable minimum and maximum widths.
- Left rail order is room selector, channel/model list, recipient selector, then compact room actions.
- The main area contains only message history and the composer.
- The composer height is approximately 10%, bounded to a compact usable height.
- The duplicate “Communication Bay” and “通讯发射台” labels are removed.
- Existing room, channel, handoff, attachment, send and STT hooks are preserved.

### Project

- The left rail owns project tree, search and preview/diff controls.
- Selecting a file previews it automatically; the redundant Preview action is removed.
- Diff inputs remain available in a collapsible control group.
- The right pane contains a compact file breadcrumb/meta row and a full-height content/diff preview.

### Browser

- One compact navigation row contains back, refresh, address, open and external-window actions.
- Proxy controls move into a collapsed advanced drawer.
- The iframe occupies the main area and keeps its sandbox attribute.
- Status is a compact glass strip and appears only when meaningful.

### Terminal

- Command output is the dominant region.
- The command composer sits at the bottom, with timeout, run and clear controls.
- Normal output shows command result and concise state; raw execution data is reserved for a collapsed details region.
- Existing runtime and approval flow remains authoritative.

### Task authorization

- Three columns: pending/scheduled work, permission configuration and module self-check.
- Permission configuration contains default workspace, external allowed roots and full-access controls.
- Full access clearly states that it is session-scoped and displays backend-provided expiry state when available.
- Module self-check reuses real diagnostics data; no fake module states are introduced.
- Scheduled-task hooks remain present in a compact collapsible area.

### Vision

- Evidence-first ratio: approximately 18 / 60 / 22.
- Left rail contains compact capture/describe/locate/closed-loop controls.
- Center contains screenshot/evidence and realtime overlay.
- Right rail contains concise backend, point, bbox, confidence and plan results.
- Profiles, capabilities, backend lists and raw realtime data move to a collapsed details region.

## Compatibility constraints

- Preserve all active `data-role`, `data-action`, `data-bind`, `data-window-id` and `data-window-target` contracts unless a redundant action is deliberately removed with its listener and test.
- Keep `.brand-banner` because desktop-pet throne-region reporting depends on it.
- Keep the Browser iframe `sandbox` attribute.
- Scope diagnostics rendering through a reusable module-selfcheck host instead of the Logs window.
- Do not add environment-variable gates or hard-coded backend behavior.

## Data and error flow

- Existing REST endpoints and session/runtime identifiers remain unchanged.
- UI controls continue to call the existing handlers.
- Errors remain visible in the affected panel; collapsed diagnostic detail must not hide the primary failure state.
- Module self-check is rendered from the existing health endpoint.

## Minimal test strategy

1. Static contract test proves the compact layout classes and all critical hooks are present.
2. Existing tests are updated only where they lock the removed labels or obsolete percentages.
3. Build and package verification use explicit timeouts and logs under `tmp/logs`.
4. Final functional acceptance uses Computer Use to switch windows and exercise representative controls.

## Rollback

Restore the source files from:

`tmp/backups/20260619-194754-ui-redesign-v3-batch2-pre`

The backup manifest includes SHA-256 hashes for every copied file.
