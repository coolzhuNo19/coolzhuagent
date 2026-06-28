# Project Curation and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a curated Obsidian vault and a reproducible, sanitized source ZIP from the current multi-repository working tree.

**Architecture:** A PowerShell delivery script inventories docs and source from explicit allowlists, writes all output to a timestamped staging directory, scans exclusions and hashes every file, then promotes verified artifacts into `C:\Users\zhupu\Desktop\coolzhu-agent-project` without deleting the original docs or worktree files.

**Tech Stack:** PowerShell 7/Windows PowerShell-compatible scripts, Git, SHA-256, ZIP, Markdown/Obsidian.

---

### Task 1: Add reproducible exclusion and inventory helpers

**Files:**
- Create: `scripts/project-delivery.ps1`
- Create: `scripts/test-project-delivery.ps1`

- [ ] **Step 1: Write the failing exclusion tests**

The test script creates a sandbox with `src/main.rs`, `backup/main.rs`, `.coolzhu/web-sessions.json`, `target/app.exe`, `config/package-launcher.json`, and `coolzhu.toml`, then calls the delivery script in `-InventoryOnly` mode. Assert only `src/main.rs` and the explicitly safe launcher config are included.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-project-delivery.ps1
```

Expected: FAIL because `project-delivery.ps1` does not exist.

- [ ] **Step 3: Implement canonical path exclusion**

Use one function for every source decision:

```powershell
function Test-DeliveryExcludedPath {
    param([Parameter(Mandatory)][string]$RelativePath)
    $path = $RelativePath.Replace('/', '\\')
    $segments = @($path -split '\\')
    $blockedSegments = @('.git','target','node_modules','tmp','dist','package','output','test-results','models','logs','backup','backups')
    if ($segments | Where-Object { $blockedSegments -contains $_.ToLowerInvariant() }) { return $true }
    if ($segments | Where-Object { $_ -match '^(backup-|.*-backup-)' }) { return $true }
    if ($path -match '(?i)(web-sessions|sessions|\.sqlite3?$|\.db$|coolzhu\.toml$|\.env($|\.)|credentials|secrets|token-cache)') { return $true }
    if ($path -match '(?i)(\.bak|\.old|\.orig|\.rej)$') { return $true }
    return $false
}
```

Treat `config/package-launcher.json` and `config/package-manifest.json` as explicit safe exceptions only.

- [ ] **Step 4: Verify GREEN**

Expected: sandbox test passes.

### Task 2: Inventory the multi-repository source tree

**Files:**
- Modify: `scripts/project-delivery.ps1`
- Test: `scripts/test-project-delivery.ps1`

- [ ] **Step 1: Add failing inventory assertions**

Assert the manifest records `relative_path`, `size`, `sha256`, `repository`, and `git_status` for a tracked file and an untracked but allowlisted source file.

- [ ] **Step 2: Implement explicit source roots**

Use only these roots when present:

```powershell
$sourceRoots = @(
  'src','packages','modules','scripts','skills','installer','.coolzhu/plugins','config'
)
$rootFiles = @(
  'Cargo.toml','Cargo.lock','package.json','package.ps1','AGENT.md','CLAUDE.md','.gitignore'
)
```

Within `modules`, include package source, tests, manifests and required UI/assets, but apply the exclusion function before hashing or copying. Record the nearest Git root by walking parent directories.

- [ ] **Step 3: Run tests**

Expected: manifest fields and exclusion behavior pass.

### Task 3: Curate the Obsidian vault

**Files:**
- Modify: `scripts/project-delivery.ps1`
- Create: `docs/obsidian-curation-map.json`
- Test: `scripts/test-project-delivery.ps1`

- [ ] **Step 1: Define the curation map**

Create JSON entries with `source`, `destination`, `topic`, and `status`. Include canonical specs/standards and the latest evidence for architecture, realtime, Computer Use, packaging, session/LLM, GUI, tooling and operations. Do not include superseded duplicate plans unless they contain unique evidence.

- [ ] **Step 2: Add validation tests**

Fail when a mapped source does not exist, two sources map to one destination, or a destination escapes the vault root.

- [ ] **Step 3: Implement Markdown migration**

Prepend frontmatter:

```yaml
---
source_path: docs/example.md
source_modified: 2026-06-28
topic: architecture
status: current
migrated: 2026-06-28
---
```

Write `00-首页/项目总览.md`, `00-首页/阅读路径.md`, `_meta/source-map.json`, and `_meta/excluded-docs.md`. Preserve original body text and normalize only vault-internal links.

- [ ] **Step 4: Verify vault integrity**

Check every mapped destination exists and every generated `[[wikilink]]` resolves to a vault file.

### Task 4: Build and audit the source ZIP

**Files:**
- Modify: `scripts/project-delivery.ps1`
- Test: `scripts/test-project-delivery.ps1`

- [ ] **Step 1: Add a failing ZIP round-trip test**

Create a sandbox source ZIP, expand it, compare every manifest hash, and assert no excluded path is present.

- [ ] **Step 2: Implement staging and hashing**

Copy allowlisted files into `<destination>/.staging-<timestamp>/source-tree`, write `SOURCE-MANIFEST.json`, `SOURCE-EXCLUSIONS.md`, and `SHA256SUMS.txt`, then create `coolzhu-agent-source-20260628.zip`.

- [ ] **Step 3: Re-open and scan the ZIP**

Expand into a task-specific verification directory, run the same exclusion scan and hash comparison, then remove only that verified temporary directory.

- [ ] **Step 4: Run tests**

Expected: all delivery tests pass.

### Task 5: Generate the real delivery

**Files:**
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\obsidian-vault\**`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\source\**`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\project-structure.md`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\docs-migration.md`
- Create: `C:\Users\zhupu\Desktop\coolzhu-agent-project\reports\source-package-audit.md`

- [ ] **Step 1: Run the delivery script against the current workspace**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/project-delivery.ps1 `
  -WorkspaceRoot 'C:\Users\zhupu\Desktop\codex' `
  -DestinationRoot 'C:\Users\zhupu\Desktop\coolzhu-agent-project'
```

- [ ] **Step 2: Verify the original docs remain untouched**

Compare the pre-run docs file count and hashes for mapped source documents. Expected: no source document was deleted or modified by migration.

- [ ] **Step 3: Verify the final artifacts**

Expand the final ZIP, compare manifest hashes, scan for excluded paths and sensitive patterns, and validate vault links.

- [ ] **Step 4: Commit reproducible tooling and curation metadata**

Stage only `scripts/project-delivery.ps1`, `scripts/test-project-delivery.ps1`, and `docs/obsidian-curation-map.json`. Do not stage existing unrelated worktree changes.

