# 2026-05-05 P1 Diagnostics Health Check

## Scope

Implemented the low-risk, automatable part of `REQ-DIAG-001`:

- Added `GET /api/diagnostics/health` in `modules/gui-web/packages/web-console/src/main.rs`.
- The endpoint is read-only and does not call real LLM, vision, mouse, keyboard, microphone, or desktop execution paths.
- The response is designed for the Diagnostics card, first-start wizard, and packaging migration checks.

## Response Coverage

Health checks now cover:

- Web console router availability.
- Workspace root resolution.
- SQLite session store readability and legacy JSON migration state.
- Selectable LLM agents, provider kind, model alias, base URL, API key ref/env fallback state.
- Inner-vision latest capture metadata and configured local VLM base URL.
- Voice-monitor bridge state.
- Tool catalog categories, item counts, and dry-run availability.
- Desktop pet executable discovery and `COOLZHU_DISABLE_DESKTOP_PET`.

The endpoint returns:

- `summary`: aggregate `ok/warn/error` counters.
- `checks`: per-module health detail and optional fix hint.
- `suggestions`: actionable suggestions derived from warnings/errors.
- `flags`: real LLM, LLM tools, desktop pet disabled flags.
- `paths`: workspace, session DB, legacy JSON, latest capture, desktop pet exe.
- `agents`, `latest_capture`, `tools`, `voice_monitor` snapshots.

## Verification

Passed:

- `rustfmt --edition 2021 --check modules\gui-web\packages\web-console\src\main.rs`
- `cargo check -p coolzhu-web-console --offline -q`
- `cargo test -p coolzhu-web-console diagnostics_ --offline -- --nocapture`
- `cargo test -p coolzhu-web-console session_store_health_reports_readable_sqlite --offline -- --nocapture`

Existing SQLite verification remains passing:

- `cargo test -p coolzhu-web-console session_store_capacity_prunes_oldest_messages --offline -- --nocapture`
- `cargo test -p coolzhu-web-console sqlite_store_round_trips_state_and_migrates_from_json_shape --offline -- --nocapture`

## Follow-Up

- Add a Diagnostics card view or reuse the Tools/System card to display `/api/diagnostics/health`.
- Expand `REQ-DIAG-002` with more specific repair suggestions for base URL errors, WebView2 missing, port conflicts, and missing desktop pet binaries.
- Reuse the endpoint in packaging and first-start wizard work.
