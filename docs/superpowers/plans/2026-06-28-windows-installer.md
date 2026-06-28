# Windows Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and audit a release MSI that contains the current application components but excludes all current model-session, runtime, database, backup and secret-bearing files.

**Architecture:** Make package resources file-aware and whitelist configuration inputs, add one reusable package-safety scanner, run it before and after WiX construction, then verify the MSI by administrative extraction and an unpacked-package UI smoke test.

**Tech Stack:** PowerShell, Cargo release builds, WiX Toolset 5, MSI administrative extraction, SHA-256, Computer Use.

---

### Task 1: Back up packaging inputs and establish the baseline

**Files:**
- Backup: `tmp/backups/<timestamp>-installer-pre/`

- [ ] **Step 1: Back up packaging sources**

Copy `config/package-manifest.json`, `config/package-launcher.json`, `package.ps1`, `scripts/package-all.ps1`, `scripts/build-msi.ps1`, and `installer/Product.wxs` into a timestamped backup with hashes.

- [ ] **Step 2: Audit the current package and MSI**

Record current files, suspicious configuration matches, MSI size/hash and WiX version. Do not treat the existing `dist/CoolzhuAgent-0.1.0.msi` as current until rebuilt.

### Task 2: Add a reusable package-safety scanner

**Files:**
- Create: `scripts/package-safety.ps1`
- Create: `scripts/test-package-safety.ps1`

- [ ] **Step 1: Write failing sandbox tests**

The test creates safe files plus `.coolzhu/web-sessions.json`, `coolzhu.toml`, `.env`, `chat.sqlite3`, `backup/old.exe`, and a text file containing a token-like assignment. Assert the scanner fails and reports every unsafe path; assert a safe package passes.

- [ ] **Step 2: Implement the scanner**

The scanner accepts `-Root` and fails on path patterns:

```powershell
$blockedPathPattern = '(?i)(^|[\\/])(\.coolzhu|backup|backups|tmp|logs?|sessions?)([\\/]|$)|web-sessions|coolzhu\.toml$|\.env($|\.)|\.(sqlite3?|db)$'
```

For text files below 2 MiB, scan for explicit credential assignments such as `api_key=`, `token=`, `secret=` and `authorization: bearer`; allow package schema field names only when no value is present.

- [ ] **Step 3: Run tests**

Expected: unsafe sandbox fails with a complete list; safe sandbox exits 0.

### Task 3: Whitelist package configuration files

**Files:**
- Modify: `config/package-manifest.json`
- Modify: `scripts/package-all.ps1:95-155`
- Test: `scripts/test-package-safety.ps1`

- [ ] **Step 1: Add a failing package resource test**

Run package-all against a temporary root with `-SkipBuild`; assert `config/package-launcher.json` and `config/package-manifest.json` are files, not directories, and no other config file is copied.

- [ ] **Step 2: Replace the whole-directory config resource**

Use two explicit resources:

```json
{
  "id": "package.launcher-config",
  "source": "config/package-launcher.json",
  "target": "config/package-launcher.json"
},
{
  "id": "package.manifest",
  "source": "config/package-manifest.json",
  "target": "config/package-manifest.json"
}
```

- [ ] **Step 3: Make `Copy-PackageResource` file-aware**

For a file source, create only the target parent and copy directly to the target path. For a directory source, retain the current clean-directory behavior. Validate every target remains under the package root before removal or replacement.

- [ ] **Step 4: Invoke the safety scanner after package assembly**

Call `scripts/package-safety.ps1 -Root $resolvedPackageRoot` before writing the final success report.

- [ ] **Step 5: Verify**

Run the resource test and a debug `package.ps1 all -SkipBuild` into an isolated package root.

### Task 4: Harden WiX inclusion rules and MSI build

**Files:**
- Modify: `installer/Product.wxs`
- Modify: `scripts/build-msi.ps1`

- [ ] **Step 1: Add explicit WiX exclusions**

Keep the recursive staging include, but add defense-in-depth exclusions for `.coolzhu`, sessions, SQLite/database files, `coolzhu.toml`, `.env*`, logs and backup directories. The safety scanner remains the authoritative gate.

- [ ] **Step 2: Scan before WiX**

After resolving `PackageRoot`, call the safety scanner and stop before `wix build` on any finding.

- [ ] **Step 3: Use a non-overwriting temporary output**

Build to `dist/.staging-CoolzhuAgent-$Version.msi`; move it to the final name only after WiX exits 0 and the MSI hash is computed.

- [ ] **Step 4: Emit an installer report**

Write `dist/CoolzhuAgent-$Version-installer-report.json` with version, configuration, MSI hash, package scan result, WiX version and signing status.

### Task 5: Build the release package and MSI

**Files:**
- Create: `dist/CoolzhuAgent-0.1.0.msi`
- Create: `dist/CoolzhuAgent-0.1.0-installer-report.json`

- [ ] **Step 1: Run release package build**

Run:

```powershell
.\package.ps1 all -Configuration release
```

Expected: all declared binaries build, package report is generated, and the safety scanner exits 0.

- [ ] **Step 2: Build MSI**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-msi.ps1 `
  -Version 0.1.0 -Configuration release -SkipPackageBuild
```

Expected: final MSI and installer report are generated.

### Task 6: Verify MSI contents and unpacked runtime

**Files:**
- Create: `tmp/msi-admin-verify-<timestamp>/`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\windows-installer-verification.md`

- [ ] **Step 1: Administratively extract the MSI**

Use a task-specific target directory under `tmp/`, verify the resolved path is inside the workspace, and extract without performing a normal machine installation.

- [ ] **Step 2: Scan extracted contents**

Run the package safety scanner against the extracted tree and compare the expected application binaries/resources.

- [ ] **Step 3: Smoke-test the sanitized package**

Launch the package entry point, verify Web Console health, and use Computer Use for one safe desktop click and one page navigation. Record any unsigned/SmartScreen limitation without bypassing safety UI.

- [ ] **Step 4: Record untested lifecycle items**

If normal admin install, upgrade, uninstall or code signing were not run, mark them NOT-RUN rather than PASS.

### Task 7: Publish installer artifacts

**Files:**
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\installer\CoolzhuAgent-0.1.0.msi`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\installer\CoolzhuAgent-0.1.0-installer-report.json`
- Modify: `C:\Users\zhupu\Desktop\coolzhu-agent-project\source\SHA256SUMS.txt`

- [ ] **Step 1: Copy only verified artifacts**

Copy the MSI and report after content scanning and runtime smoke tests finish.

- [ ] **Step 2: Recompute destination hashes**

Confirm the destination MSI hash exactly matches the build report.

- [ ] **Step 3: Commit reproducible packaging changes**

Stage only the package safety scripts, manifest, package-all change, build-msi change and Product.wxs. Do not stage existing unrelated modifications.

