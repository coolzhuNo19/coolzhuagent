# Goal Multi-Agent UI/Ops Implementation Plan

Date: 2026-05-23

## Scope

- Keep Web Console on port 8765 for every live verification run.
- Keep ShowUI/desktop pet coupled to Web Console lifecycle.
- Keep development-stage tool permissions open while preserving test isolation.
- Merge goal mode into multi-agent collaboration:
  - Commander orchestrates goal phases.
  - Role assignment asks which configured session agent should act as each role.
  - Temporary role skills guide execution during the goal.
  - Role leases, goal memory, and task-scoped context are cleaned after completion.
- Update top cards:
  - Task card shows current task title and progress.
  - Overview card shows active role assignments.
- Add two-file project diff requirements and a first local implementation.
- Improve media window for audio/video playback and remove the document lane.
- Replace generic terminal launcher with workspace PowerShell execution.
- Slim task authorization window to external file access, full access, protected rules, and scheduled tasks.
- Add browser proxy configuration visibility.
- Add self-iteration and rollback plan visibility.

## Verification

- Run focused unit/frontend tests after code changes.
- Run `cargo fmt`.
- Run `cargo test -p coolzhu-web-console -- --test-threads=1`.
- Run `cargo build -p coolzhu-web-console`.
- Run live tests only through `tmp/invoke-with-web-console-8765.ps1`, which restarts Web Console and ShowUI/desktop pet on fixed port 8765.
