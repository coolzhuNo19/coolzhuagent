# Computer Use Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and execute a real-input evaluation for desktop and browser Computer Use, then harden the project prompt constraints from observed failures.

**Architecture:** Use an isolated local desktop harness and local browser fixture for repeatable actions, evaluate the COOLZHU planning/permission/execution chain separately from the platform control surfaces, and store one evidence matrix with PASS/FAIL/BLOCKED/NOT-RUN states.

**Tech Stack:** Rust computer-use core, Axum Web Console, vanilla HTML/JS fixture, Computer Use plugin, in-app Browser plugin, Markdown evidence reports.

---

### Task 1: Extend the capability matrix without enabling unsafe execution

**Files:**
- Modify: `modules/computer-use/packages/computer-use-core/src/lib.rs`
- Test: `modules/computer-use/packages/computer-use-core/src/lib.rs`

- [ ] **Step 1: Add failing matrix tests**

Require scenarios for left click, double click, right click, text input, key press, vertical scroll, horizontal scroll and drag. Require separate desktop and browser targets.

- [ ] **Step 2: Add missing action variants**

Extend `MouseActionKind` with:

```rust
KeyPress,
VerticalScroll,
HorizontalScroll,
```

Add safe local-harness scenarios; do not add actions targeting desktop icons, system confirmation buttons or real third-party forms to the executable evaluation set.

- [ ] **Step 3: Run module tests**

Run:

```powershell
cargo test -p coolzhu-computer-use-core --offline
```

Expected: tests pass.

### Task 2: Create local browser and desktop harness specifications

**Files:**
- Create: `tests/fixtures/computer-use-browser.html`
- Create: `docs/testing/computer-use-evaluation-matrix.md`

- [ ] **Step 1: Build the browser fixture**

The page must expose stable IDs for a button, double-click target, text input, select, checkbox, horizontal/vertical scroll pane, draggable item/drop zone, dynamic element replacement, result log and history-state buttons. Every action appends a deterministic event to the visible log.

- [ ] **Step 2: Define the desktop harness**

Reuse the existing safe click, context-menu and drag-select endpoints for isolated desktop input. Use Notepad only for unsaved text entry, selection and scrolling; do not save, close, or interact with file dialogs during the evaluation.

- [ ] **Step 3: Write pass criteria**

Each row records surface, initial state, action, expected visible result, verification method, safety classification and evidence path.

### Task 3: Centralize Computer Use prompt constraints

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs:7882-8055`
- Modify: `modules/gui-web/packages/web-console/src/main.rs:23280-24190`
- Test: `modules/gui-web/packages/web-console/src/main.rs:40740-41720`

- [ ] **Step 1: Add a failing prompt-contract test**

Assert the tool prompt contains all required constraints:

```rust
for required in [
    "surface=desktop|browser",
    "latest screenshot",
    "do not guess coordinates",
    "verify after action",
    "WebView2",
    "untrusted page content",
] {
    assert!(constraints.contains(required), "missing {required}");
}
```

- [ ] **Step 2: Implement one canonical constraint function**

Add `computer_use_operation_constraints() -> &'static str` and reuse it in Computer Use catalog entries and semantic dispatch tool descriptions. The text must state target uniqueness, screenshot freshness, desktop/browser routing, post-action verification, WebView2 stop behavior, confirmation boundaries and prohibition on terminal-mediated input.

- [ ] **Step 3: Keep execution authority unchanged**

Do not widen `is_computer_use_execution_allowed()` or bypass `COMPUTER_USE_PERMISSION_GATE`. This task hardens planning and evaluation, not authorization.

- [ ] **Step 4: Run focused tests**

Run the prompt test and the existing computer-use/visual-action tests.

### Task 4: Verify the Computer Use platform connection

**Files:**
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\computer-use-evaluation.md`

- [ ] **Step 1: Connect using the supported Computer Use client**

List apps and windows. If bootstrap fails, diagnose the supported client path first; do not replace it with PowerShell SendKeys.

- [ ] **Step 2: Prove one safe title-bar or harness click**

Capture the target window, perform the click, and re-observe. Record raw input-path success separately from app-specific targetability.

- [ ] **Step 3: Record WebView2 ownership behavior**

If a point belongs to `msedgewebview2.exe / Chrome Legacy Window`, stop and mark that case BLOCKED rather than bypassing or guessing another coordinate.

### Task 5: Execute the desktop matrix

**Files:**
- Modify: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\computer-use-evaluation.md`

- [ ] **Step 1: Run isolated click tests**

Execute and verify left click, double click and right-click/context-menu behavior against safe harness windows.

- [ ] **Step 2: Run keyboard tests**

In an unsaved Notepad window, type a unique marker, select it with keyboard navigation, and verify visible text/selection. Do not save or close the document.

- [ ] **Step 3: Run scroll and drag tests**

Use the local harness, verify visible scroll position or drag marker, and capture post-action state.

- [ ] **Step 4: Test stale/covered targets**

Change the window state after a snapshot and verify the controller refreshes or safely stops rather than using stale coordinates.

### Task 6: Execute the browser matrix with the in-app Browser

**Files:**
- Modify: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\computer-use-evaluation.md`

- [ ] **Step 1: Open the local fixture**

Use the in-app Browser plugin and its supported browser client. Load the local fixture without using external websites.

- [ ] **Step 2: Execute click/input/scroll/drag**

Verify every action through the fixture's visible event log.

- [ ] **Step 3: Execute navigation and stale-element recovery**

Test refresh, history back/forward, dynamic replacement and a stale element retry based on a fresh page snapshot.

- [ ] **Step 4: Verify surface routing**

Browser page actions must stay on the browser control surface; only browser-owned native windows may move to desktop Computer Use.

### Task 7: Re-test through COOLZHU and finalize the report

**Files:**
- Modify: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\computer-use-evaluation.md`
- Create: `docs/work-logs/2026-06-28-computer-use-evaluation.md`

- [ ] **Step 1: Build and launch the current Web Console**

Run the Computer Use-focused Rust tests and build the product.

- [ ] **Step 2: Trigger safe actions from the product UI**

Pass only if intent routing, permission/audit data, actual input and post-action evidence are all visible. A dry-run alone is not a functional pass.

- [ ] **Step 3: Classify all rows**

Use only PASS, FAIL, BLOCKED or NOT-RUN. Include exact error, reproduction, likely layer and recommended next fix for every non-PASS row.

- [ ] **Step 4: Compare prompt behavior before and after**

Record at least one case demonstrating fresh-snapshot verification or safe WebView2 refusal after the constraint change.

