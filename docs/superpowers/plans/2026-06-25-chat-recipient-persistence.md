# Chat Recipient Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Web Console startup from resetting the selected chat recipient to the active GLM5.2 session.

**Architecture:** Keep recipient selection as browser-side UI state keyed by the existing normalized workspace key and active chat room ID. Restore only valid selectable Agent IDs, and use `/api/agents.active_agent_ids` solely as a first-use fallback.

**Tech Stack:** Vanilla JavaScript, browser `localStorage`, Rust static frontend contract tests, Cargo.

---

### Task 1: Add recipient persistence contract

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: Write the failing test**

Add a frontend contract test requiring:

```rust
assert!(WEB_APP_JS.contains("coolzhu.chat.recipients.v1."));
assert!(WEB_APP_JS.contains("restoreAgentTargets"));
assert!(WEB_APP_JS.contains("persistAgentTargets"));
assert!(WEB_APP_JS.contains("activeWorkspaceKey"));
assert!(WEB_APP_JS.contains("activeChatRoomId"));
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cargo test -p coolzhu-web-console chat_recipient_selection_is_persisted_per_workspace_and_room -- --exact
```

Expected: FAIL because the persistence key and helpers do not exist.

### Task 2: Implement workspace/room recipient restore

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js`

- [ ] **Step 1: Add minimal persistence helpers**

Add:

```javascript
const chatRecipientStoragePrefix = "coolzhu.chat.recipients.v1.";

function chatRecipientStorageKey(roomId = activeChatRoomId) { /* workspace + room */ }
function readPersistedAgentTargets(roomId = activeChatRoomId) { /* JSON array or null */ }
function persistAgentTargets(roomId = activeChatRoomId) { /* selected valid IDs */ }
function restoreAgentTargets(agents, fallbackIds, roomId = activeChatRoomId) { /* valid saved IDs or fallback */ }
```

- [ ] **Step 2: Wire lifecycle**

- On recipient checkbox change, update label and persist.
- In `loadAgents()`, call `restoreAgentTargets()` instead of treating `active_agent_ids` as the persisted choice.
- After chat-room activation, restore the room-specific selection.
- `setSingleAgentTarget()` persists its selection.

- [ ] **Step 3: Run targeted test**

Run the Task 1 Cargo test. Expected: PASS.

### Task 3: Verify and document

**Files:**
- Modify: `docs/requirements-management.md`
- Create: `docs/work-logs/2026-06-25-chat-recipient-persistence-fix.md`

- [ ] **Step 1: Run automated verification**

```powershell
cargo fmt --all -- --check
cargo test -p coolzhu-web-console --no-fail-fast -- --test-threads=1
cargo check -p coolzhu-web-console
```

Expected: all commands exit 0.

- [ ] **Step 2: Build package**

```powershell
.\package.ps1 all -Configuration debug
```

Expected: package report updated and Web Console binary copied or confirmed unchanged.

- [ ] **Step 3: Record manual verification**

Document that Windows restart and visual interaction confirmation remain pending by user request.

- [ ] **Step 4: Commit**

Commit the GUI subrepository first, then commit root documentation and the updated submodule pointer only if the root tracks that pointer.

