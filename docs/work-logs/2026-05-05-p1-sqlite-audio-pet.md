# 2026-05-05 P1 SQLite / Audio / Pet Work Log

## Scope

- `REQ-WEB-SESSION-002`: move Web session persistence toward SQLite with bounded storage and aging.
- `REQ-WEB-MEDIA-006`: render audio rich-text / URL attachments in chat messages.
- `REQ-DESK-PET-003`: add low-risk pet state mapping for backend events.

## Implemented

### SQLite session store

Files:

- `modules/gui-web/packages/web-console/Cargo.toml`
- `modules/gui-web/packages/web-console/src/main.rs`
- `.cargo/config.toml`

Changes:

- Added `rusqlite` with bundled SQLite.
- Added project-local Cargo sparse mirror override for the existing global `tuna` source, because the global git registry mirror blocked new dependency resolution.
- Added default SQLite path:
  - `COOLZHU_WEB_SESSION_DB`, when set.
  - Otherwise `.coolzhu/web-sessions.sqlite3`.
- Kept JSON compatibility:
  - Existing `COOLZHU_WEB_SESSION_STORE` JSON remains the migration source.
  - Saves also write a JSON backup for rollback and inspection.
- Added relational schema:
  - `metadata`
  - `sessions`
  - `chat_rooms`
  - `session_messages`
  - `chat_room_messages`
  - `memory_beads`
- Kept the current in-memory API surface unchanged. The store loads SQLite/JSON into memory on startup and writes the complete bounded state in one SQLite transaction on save.

Capacity defaults:

- `COOLZHU_SQLITE_MAX_MESSAGES_PER_ROOM`: default `2000`.
- `COOLZHU_SQLITE_MAX_MESSAGES_PER_SESSION`: default `1000`.
- `COOLZHU_SQLITE_MAX_TOTAL_MESSAGES`: default `10000`.
- `COOLZHU_SQLITE_MAX_BEADS_PER_SESSION`: default `256`.
- `COOLZHU_SQLITE_MAX_ESTIMATED_BYTES`: default `134217728` bytes, about 128 MiB.

Aging strategy:

- Per chat room: keep newest messages by `created_at`, delete oldest beyond the room cap.
- Per agent session: keep newest messages by `created_at`, delete oldest beyond the session cap.
- Global total cap: delete the oldest message across room/session stores until under the total cap.
- Estimated byte cap: delete oldest messages first, then lowest-priority unpinned beads.
- Beads: keep pinned first, then lower layer rank, higher confidence, newer `created_at`; truncate to capacity.

Automated tests added:

- `session_store_capacity_prunes_oldest_messages`
- `sqlite_store_round_trips_state_and_migrates_from_json_shape`

### Audio rich-text playback

File:

- `modules/gui-web/packages/web-console/src/app.js`

Changes:

- Classifies audio URL/Markdown paths as `audio`.
- Supports `mp3`, `wav`, `ogg`, `webm`, `m4a`, `flac`, `aac`, `opus`.
- Maps audio MIME types.
- Renders audio attachments with `<audio controls preload="metadata">`.
- Keeps audio controls inside the existing interactive selector so clicking playback does not select the message.

### Desktop pet event mapping

File:

- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`

Changes:

- Added pure event-to-pet-status mapping:
  - `chat*` / `tool*` -> `thinking`
  - `audio*` -> `blink`
  - `error*` / `warning*` -> `warning`
  - `success*` / `complete*` -> `success`
  - unknown -> `idle`
- Added unit coverage for chat/tool/audio, terminal states, and unknown fallback.

## Verification

Passed:

- `node --check modules\gui-web\packages\web-console\src\app.js`
- `rustfmt --edition 2021 --check modules\gui-web\packages\web-console\src\main.rs` after formatting
- Worker verification for desktop pet:
  - `cargo test --manifest-path modules\gui-desktop\packages\tauri-shell\src-tauri\Cargo.toml pet_ -- --nocapture`
  - `cargo check --manifest-path modules\gui-desktop\packages\tauri-shell\src-tauri\Cargo.toml`

Re-verified after manually placing missing crate archives in the sparse TUNA cache:

- `cargo check -p coolzhu-web-console --offline -v`
- `cargo test -p coolzhu-web-console session_store_capacity_prunes_oldest_messages --offline -- --nocapture`
- `cargo test -p coolzhu-web-console sqlite_store_round_trips_state_and_migrates_from_json_shape --offline -- --nocapture`

Observed issue resolved:

- The root cause was Cargo waiting on missing registry downloads after the project switched from the global git TUNA registry to the sparse TUNA source.
- Manual placement of `libsqlite3-sys-0.30.1.crate` and `bitflags-2.10.0.crate` under `C:\Users\zhupu\.cargo\registry\cache\mirrors.tuna.tsinghua.edu.cn-4dc01642fd091eda` unblocked the targeted Web build.
- `cargo fetch -v` can still time out for the full workspace because it may try to fetch every package in `Cargo.lock`; targeted `--offline` checks are now the preferred verification path.

Follow-up:

- If `rusqlite` bundled compile time becomes too high on clean Windows machines, evaluate switching to `rusqlite` without `bundled` plus installer-provided SQLite runtime, or moving the store into a smaller dedicated crate for faster targeted tests.
