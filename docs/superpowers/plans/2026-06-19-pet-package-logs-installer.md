# Pet Blink, Package Run, Logs, and Installer Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the desktop pet blink shrink/jump symptom, run the decoupled package build, add the next slice of module error logging/self-check readiness, and prepare the installer packaging plan.

**Architecture:** Keep image geometry stable by fixing the runtime state-transition path instead of stretching assets. Use the existing package manifest/build scripts as the packaging source of truth, and extend diagnostics/self-check documentation and minimal code only where it reduces startup ambiguity.

**Tech Stack:** Rust/Tauri, HTML/CSS/JS pet mini WebView, PowerShell package scripts, shared `coolzhu-diagnostics`, Cargo offline tests.

---

### Task 1: Desktop pet blink transition fix

**Files:**
- Modify: `C:\Users\zhupu\Desktop\codex\modules\gui-desktop\packages\tauri-shell\src-tauri\src\main.rs`
- Modify: `C:\Users\zhupu\Desktop\codex\modules\gui-desktop\packages\tauri-shell\ui\pet-mini.html`
- Use: `C:\Users\zhupu\Desktop\codex\tmp\analyze_pet_frame_metrics.py`

- [ ] **Step 1: Write the failing regression test**

Add a Rust string-contract test that requires `scheduleIdleBlink()` to call `setState("blink")`, to guard the idle return with `state === "blink"`, and to avoid direct `state = "blink"` / `activeFrames = frames.blink` mutations.

- [ ] **Step 2: Run RED**

Run:

```powershell
cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml pet_mini_idle_blink_uses_unified_state_transition --offline
```

Expected: FAIL before the HTML fix.

- [ ] **Step 3: Implement minimal HTML fix**

Update `scheduleIdleBlink()` so automatic blink uses the same `setState("blink")` path as explicit status events and only returns to idle if the state is still blink.

- [ ] **Step 4: Run GREEN**

Run the same targeted test and then the existing pet frame tests.

### Task 2: Package build and startup

**Files:**
- Use: `C:\Users\zhupu\Desktop\codex\package.ps1`
- Use: `C:\Users\zhupu\Desktop\codex\package\run.ps1`
- Use: `C:\Users\zhupu\Desktop\codex\config\package-manifest.json`

- [ ] **Step 1: Run package build**

Run:

```powershell
.\package.ps1 all -Configuration debug
```

with timeout and logs under `tmp/logs`.

- [ ] **Step 2: Verify package report and binaries**

Check `package/package-report.json` and `package/bin`.

- [ ] **Step 3: Start packaged app**

Run:

```powershell
.\package\run.ps1 app
```

and inspect process/log state.

### Task 3: Module error logging and startup self-check readiness

**Files:**
- Inspect/modify only minimal current-slice targets after explorer result.
- Document: `C:\Users\zhupu\Desktop\codex\docs\work-logs\2026-06-19-pet-package-logs-installer.md`
- Document/update: self-check proposal under `docs/`

- [ ] **Step 1: Inventory diagnostics coverage**

Use existing diagnostics code and explorer findings to identify practical gaps.

- [ ] **Step 2: Add low-risk err-level startup/reporting where missing**

Prefer shared diagnostics calls over scattered ad-hoc logs.

- [ ] **Step 3: Write module startup self-check scheme**

Define module checks, output JSON shape, timeout, package integration, and first implementation slice.

### Task 4: Installer packaging preparation

**Files:**
- Create: packaging plan/work-log under `docs/`

- [ ] **Step 1: Document installer approach**

Base the installer on `package/` as runtime root; list required binaries/resources/configs.

- [ ] **Step 2: Define risks and rollback**

Include signed/unsigned installer path, runtime dependency handling, user config/data preservation, and rollback from `package/backup`.

### Task 5: Final verification

- [ ] **Step 1: Run targeted tests**
- [ ] **Step 2: Run package build/start checks**
- [ ] **Step 3: Record logs and work-log**
