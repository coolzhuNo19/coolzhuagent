# UI Redesign V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已确认的新武侠竹林风格迁移到 Web Console 前端，删除重复页眉/折叠栏，把空间交还给各窗口内容区。

**Architecture:** 本轮只改 Web Console 前端壳层和静态窗口布局：`index.html` 调整 DOM，`styles.css` 统一布局与风格，`app.js` 只做现有选择器兼容所需的最小调整。记忆知识页只做前端预留壳，不新增后端接口。

**Tech Stack:** Rust 静态前端契约测试、HTML/CSS/Vanilla JS、Computer Use 真实桌面点击验证。

---

### Task 1: Remove redundant page chrome

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Test: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: Write failing layout contract test**

Add a test asserting that the workbench has no visible breadcrumb/fold strip and no per-window local title bars.

- [ ] **Step 2: Run focused test and verify RED**

Run: `cargo test --manifest-path modules/gui-web/packages/web-console/Cargo.toml web_frontend_v3_removes_redundant_page_chrome -- --nocapture`

Expected: FAIL because current HTML still has `window-side-title` and `window-panel-head` header strips.

- [ ] **Step 3: Remove duplicate chrome from DOM/CSS**

Remove per-window `window-side-title` buttons and top-level content title/header rows where navigation already identifies the window. Keep only content-local section labels inside panels.

- [ ] **Step 4: Run focused test and verify GREEN**

Expected: PASS.

### Task 2: Migrate key windows to new direct-content layouts

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [ ] **Step 1: Write failing test for direct content and memory placeholder**

Add a test requiring direct content containers for chat, project, settings, tasks, vision, browser, terminal, and memory. Require memory placeholder roles: knowledge library, knowledge map, context insight, semantic search.

- [ ] **Step 2: Run focused test and verify RED**

Expected: FAIL because memory page still uses old bead/filter layout and several windows retain old header rows.

- [ ] **Step 3: Update window DOM and CSS**

Implement direct layouts: chat/sidebar, project tree-preview, settings three cards, task auth/self-check, vision command-evidence-result, browser/sidebar-web-summary, terminal/sidebar-console-status, memory knowledge placeholder.

- [ ] **Step 4: Run focused test and verify GREEN**

Expected: PASS.

### Task 3: Verify and document

**Files:**
- Modify: `docs/work-logs/2026-06-19-ui-redesign-v3-migration.md`

- [ ] **Step 1: Run frontend contract tests**

Run focused Rust tests and `node --check` if JS changed.

- [ ] **Step 2: Launch/package if needed**

Use existing package/runtime flow only after static tests pass.

- [ ] **Step 3: Computer Use validation**

Open real Web Console/Tauri window, click representative tabs, confirm no duplicate title/fold strips and memory placeholder is visible.

- [ ] **Step 4: Write work-log**

Record files changed, backup path, test logs, Computer Use evidence, and rollback method.
