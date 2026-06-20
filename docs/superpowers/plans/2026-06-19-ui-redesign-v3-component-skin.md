# UI Redesign V3 Component Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mixed legacy control, icon and avatar visuals with one wuxia bamboo metal-glass component system while preserving all frontend behavior.

**Architecture:** Keep the existing HTML/JavaScript behavior contracts. Add a final CSS component-token layer, a code-native SVG icon directory and a versioned Image Gen avatar family with legacy-path migration.

**Tech Stack:** HTML, CSS, vanilla JavaScript, SVG, PNG, Rust embedded static assets, PowerShell packaging, Windows Computer Use.

---

### Task 1: Back up affected sources and assets

**Files:**
- Create: `tmp/run-ui-component-skin-backup.ps1`
- Create: `tmp/backups/<timestamp>-ui-component-skin-pre/`

- [ ] Write a PowerShell backup script under `tmp/` with a 60-second timeout.
- [ ] Copy the four frontend source files, avatar manifest and any existing `icons-wuxia` directory.
- [ ] Generate a SHA-256 manifest.
- [ ] Redirect output to `tmp/logs/20260619-ui-component-skin-backup.log`.

### Task 2: Freeze the component contract with RED

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Create: `tmp/run-ui-component-skin-contract.ps1`

- [ ] Add `web_frontend_v3_component_skin_uses_wuxia_controls_icons_and_avatars`.
- [ ] Assert new component tokens, `icons-wuxia` references, `wuxia-v3` avatar entries and compatibility mapping.
- [ ] Run the focused test with a 120-second timeout and log output under `tmp/logs/`.
- [ ] Confirm failure is caused by the missing component skin.

### Task 3: Implement the shared component skin

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [ ] Add the component tokens defined in the design.
- [ ] Apply one scoped style to text inputs, search fields, number fields, textareas and selects.
- [ ] Add keyboard-visible focus, disabled, readonly and placeholder states.
- [ ] Add shared secondary, primary, danger and icon-only button states.
- [ ] Add checkbox/toggle and avatar frame styles.
- [ ] Keep active-window gold limited to navigation/primary actions.

### Task 4: Add and wire the vector functional icon set

**Files:**
- Create: `modules/gui-web/packages/web-console/assets/icons-wuxia/*.svg`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`

- [ ] Create the 25 required 24x24 SVG icons from the approved jade/gold vector recipe.
- [ ] Replace dock icon sources.
- [ ] Replace high-frequency Project, Chat, Browser, Terminal, Task, Vision and Settings control icons.
- [ ] Add a frontend icon URL helper for dynamically rendered icons.
- [ ] Preserve legacy fallback paths for low-frequency icons.

### Task 5: Generate and integrate the wuxia avatar family

**Files:**
- Create: `modules/gui-web/packages/web-console/assets/avatars/wuxia-v3/source-sheet-v1.png`
- Create: `modules/gui-web/packages/web-console/assets/avatars/wuxia-v3/*.png`
- Modify: `modules/gui-web/packages/web-console/assets/avatars/manifest.json`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Create: `tmp/imagegen/crop-wuxia-avatar-sheet.mjs`

- [ ] Use the built-in Image Gen path with `wuxia-swordsman.png` as a style reference.
- [ ] Generate a strict 4x2 square portrait sheet with no text.
- [ ] Save the selected source sheet in the workspace with a versioned filename.
- [ ] Crop eight cells using the temporary script under `tmp/imagegen/`.
- [ ] Validate dimensions, aspect ratio and non-empty pixel coverage.
- [ ] Update the avatar manifest and legacy filename migration map.

### Task 6: GREEN verification

**Files:**
- Create: `tmp/run-ui-component-skin-tests.ps1`
- Create: `tmp/run-ui-component-skin-static-check.ps1`

- [ ] Run the focused contract test.
- [ ] Run the Web frontend static group.
- [ ] Validate every referenced new icon/avatar path exists.
- [ ] Run JavaScript syntax checking.
- [ ] Record all output under `tmp/logs/`.

### Task 7: Package and Computer Use acceptance

**Files:**
- Create: `tmp/run-package-all-component-skin.ps1`
- Create: `tmp/run-package-app-component-skin.ps1`

- [ ] Run package all with an explicit timeout and log redirection.
- [ ] Start the packaged app and verify diagnostics health is HTTP 200.
- [ ] Use Computer Use to inspect Chat, Settings, Project and Task Authorization.
- [ ] Use keyboard navigation to confirm `:focus-visible`.
- [ ] Confirm new avatars appear in overview, roster, picker and messages.
- [ ] Leave the app on Chat for user review.

### Task 8: Documentation

**Files:**
- Modify: `docs/requirements-management.md`
- Create: `docs/work-logs/2026-06-19-ui-redesign-v3-component-skin.md`

- [ ] Record component scope, asset generation prompt, new asset paths and compatibility mapping.
- [ ] Record RED/GREEN evidence, package output, HTTP health and Computer Use observations.
- [ ] Record backup and rollback commands.
- [ ] Note any legacy low-frequency icons intentionally deferred.

