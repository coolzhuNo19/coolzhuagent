# 2026-05-16 REQ-WEB-CTX-001: LLM History Context Assembly

Time: 2026-05-15 06:30 - 2026-05-16 00:28  
Scope: `REQ-WEB-CTX-001`  
Backup: `tmp/backups/20260515-063010-req-web-ctx-001/`, `tmp/backups/20260516-002548-req-web-ctx-001-doc-close/`

## Goal

Close the missing LLM context boundary after workspace/session/delete cascade work:

- Each real LLM request must include system prompt, relevant memory beads, recent chat-room history, and current user turn.
- Context assembly must expose a preview API with token budget information.
- Streaming, non-streaming, and tool-loop requests must use the same assembled context.

## Changes

- `modules/gui-web/packages/web-console/src/main.rs`
  - Added `ContextBuildOptions`, `ContextTokenBudget`, and `ContextAssembly`.
  - Added `build_context_assembly` to select prompt-safe relevant beads, append recent chat-room history within a token budget, and keep the current user turn as the final message.
  - Added `build_agent_system_prompt_with_beads` so the assembled bead set, not the static top-8 fallback, becomes the actual request system prompt.
  - Added `agent_message_request_with_context` and `agent_message_request_with_context_messages`.
  - Connected context assembly to non-streaming, streaming, and tool-loop LLM paths.
  - Added `GET /api/sessions/{session_id}/context-preview` for debugging and later UI verification.
  - `prepare_chat_dispatch` now snapshots current room history before persisting the new user message, preventing the model call from losing prior turns.

## TDD And Verification

- RED:
  - `tmp/logs/req-web-ctx-001-red-20260515.log`
  - Failure proved missing `ContextBuildOptions`, `build_context_assembly`, and context request helper.
- GREEN:
  - `tmp/logs/req-web-ctx-001-green-context-builder-20260515-r3.log`
  - `tmp/logs/req-web-ctx-001-request-context-20260515.log`
  - `tmp/logs/req-web-ctx-001-web-console-full-20260515.log`
- Formatting:
  - `tmp/logs/req-web-ctx-001-cargo-fmt-20260515.log`

Final automated result: `cargo test -p coolzhu-web-console --offline -- --test-threads=1` passed.

## Requirement Status

- `REQ-WEB-CTX-001`: completed.
- Demand statistics updated: completed 67, pending 24, total 95.

## Follow-Up

- Move to `REQ-WEB-CHAT-007`.
- The next slice should implement handoff parsing and task-chain safeguards on top of the now stable context boundary.
