# UI Redesign V3 Batch 2 Implementation Plan

> Execute in small behavior-focused increments. Preserve existing frontend hooks, use minimal TDD, log every build/run command under `tmp/logs`, and complete acceptance through Computer Use.

**Goal:** Align the overview card, task card, chat room and five supporting workbench windows with the approved wuxia bamboo metal-glass design.

**Architecture:** Retain the current native HTML/CSS/JavaScript application and Rust embedded assets. Restructure DOM around existing `data-*` contracts, consolidate the final CSS precedence layer, and generalize diagnostics rendering so Task Authorization can host real module self-check data.

**Tech stack:** HTML, CSS, vanilla JavaScript, Rust/Axum static resource embedding, PowerShell packaging, Windows Computer Use.

---

### Task 1: Freeze the approved structure with a failing contract test

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

1. Add one static contract test for the batch-2 layout classes and critical hooks.
2. Run only that test with an explicit timeout and write output to `tmp/logs`.
3. Confirm RED because the new structure is not implemented yet.

### Task 2: Compact overview, task card and chat

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

1. Set the top region to 12% and restore exact 26/48/26 columns.
2. Remove final-rule gap/padding conflicts.
3. Reorder the chat left rail without changing room/channel/recipient/handoff hooks.
4. Remove duplicate chat labels and compress the composer to a bounded 10%.
5. Update only tests that lock the obsolete labels or dimensions.

### Task 3: Rebalance Project, Browser and Terminal

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/app.js`

1. Move Project controls to the left command rail and make preview content full-height.
2. Remove the redundant Project Preview action and its listener.
3. Move Browser proxy controls into a collapsed advanced drawer.
4. Make Terminal output dominant and move command controls into a bottom composer.
5. Keep every backend endpoint and security boundary unchanged.

### Task 4: Build the three-column Task Authorization view

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/app.js`

1. Create pending/scheduled, permission configuration and module-selfcheck columns.
2. Move the existing health/check/suggestion DOM into the self-check column.
3. Generalize diagnostics selectors to a reusable self-check host.
4. Correct full-access copy and visual-state class while preserving backend TTL behavior.
5. Keep audit/tail content in Logs and avoid duplicate role selectors.

### Task 5: Make Vision evidence-first

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

1. Use an 18/60/22 command/evidence/result layout.
2. Compress control cards and remove repeated explanatory copy.
3. Move raw profiles, capabilities and backend diagnostics into a collapsed details area.
4. Preserve capture, locate, verify, closed-loop and realtime hooks.

### Task 6: Verify, package and run

**Files:**
- Modify: `docs/requirements-management.md`
- Add: `docs/work-logs/2026-06-19-ui-redesign-v3-batch2.md`

1. Run focused tests and the relevant frontend static test group with timeout logs.
2. Run `package all` with timeout and log capture.
3. Start the packaged application.
4. Use Computer Use to verify the three primary design targets independently:
   - Overview card: compact height, 26% column share and retained operational metrics.
   - Current-task card: compact height, 26% column share and readable task/progress/status data.
   - Chat room: compact left rail, message-first center and bounded bottom composer without duplicate labels.
5. Continue the same Computer Use pass through Project, Browser, Terminal, Task Authorization and Vision.
6. Record screenshots/results, limitations and rollback information in the work log.
