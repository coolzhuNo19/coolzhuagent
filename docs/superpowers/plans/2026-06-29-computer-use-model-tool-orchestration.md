# Computer Use Model Tool Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 COOLZHU Agent 的 Computer Use 升级为模型会话可直接调用、可暂停审批、可恢复、可验证并具备硬熔断的一等任务级工具。

**Architecture:** `computer-use-core` 提供与 UI 后端无关的契约、状态机、adapter/planner trait 和 supervisor；`web-console` 提供集中配置、SQLite run store、模型工具注册、桌面与浏览器 adapter bridge、审批恢复和统一工具循环。模型只看到 `computer_use.perform`，所有入口最终返回唯一终态 ToolResult。

**Tech Stack:** Rust 2021、Serde/serde_json、Axum、Tokio、rusqlite、现有 `coolzhu-computer-use-core` / `coolzhu-core-runtime` / `coolzhu-web-console` workspace crates。

---

## File map

- Create `modules/computer-use/packages/computer-use-core/src/contracts.rs`: 模型输入、运行状态、终态结果、错误和预算契约。
- Create `modules/computer-use/packages/computer-use-core/src/supervisor.rs`: run 级动作预算、无进展检测、turn 级幂等缓存与熔断。
- Create `modules/computer-use/packages/computer-use-core/src/controller.rs`: planner/adapter trait 和确定性状态机。
- Modify `modules/computer-use/packages/computer-use-core/src/lib.rs`: 导出新模块；保留 regression scenario 仅供测评。
- Create `modules/gui-web/packages/web-console/src/computer_use_store.rs`: SQLite migration v11、run/step 读写和乐观状态推进。
- Create `modules/gui-web/packages/web-console/src/computer_use_adapters.rs`: Desktop/Browser adapter bridge 与能力声明。
- Create `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`: stable call id、模型回合级幂等/熔断、审批等待与恢复结果通道。
- Modify `modules/gui-web/packages/web-console/src/main.rs`: 配置、工具 schema、正式 executor、统一流式/非流式派发、审批 endpoint、legacy 下线。
- Modify `modules/gui-web/packages/web-console/index.html`: Computer Use 工具卡状态和审批关联字段。
- Modify `modules/gui-web/packages/web-console/src/app.js`: run 事件、审批恢复和终态呈现。
- Modify `modules/gui-web/packages/web-console/src/styles.css`: run 状态和错误卡样式。
- Create `docs/testing/computer-use-model-tool-evaluation-2026-06-29.md`: P01–P16 真实前端证据记录。

### Task 1: Core Computer Use contracts

**Files:**
- Create: `modules/computer-use/packages/computer-use-core/src/contracts.rs`
- Modify: `modules/computer-use/packages/computer-use-core/src/lib.rs`
- Test: `modules/computer-use/packages/computer-use-core/src/contracts.rs`

- [ ] **Step 1: Write failing serde and validation tests**

Add tests that deserialize the task-level input, reject empty success criteria, reject undeclared fields such as coordinates, distinguish running and terminal states, and serialize stable lower-case terminal statuses:

```rust
#[test]
fn task_request_rejects_coordinates_and_requires_success_criteria() {
    assert!(serde_json::from_value::<ComputerUseRequest>(serde_json::json!({
        "objective": "打开记事本",
        "surface": "desktop",
        "success_criteria": []
    })).unwrap().validate().is_err());
    assert!(serde_json::from_value::<ComputerUseRequest>(serde_json::json!({
        "objective": "点击",
        "x": 10,
        "y": 20,
        "success_criteria": ["窗口已打开"]
    })).is_err());
}

#[test]
fn awaiting_approval_is_running_not_terminal() {
    assert!(!ComputerUseRunState::AwaitingApproval.is_terminal());
    assert!(ComputerUseRunState::Succeeded.is_terminal());
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cargo test -p coolzhu-computer-use-core --lib contracts --offline`

Expected: compile failure because `contracts` and its types do not exist.

- [ ] **Step 3: Implement the contracts**

Define `ComputerUseRequest`, `ComputerUseTarget`, `ComputerUseSurface`, `ComputerUseRunState`, `ComputerUseTerminalStatus`, `ComputerUseStage`, `ComputerUseError`, `ComputerUseResult`, `ComputerUseBudgets`, `ComputerUseCapabilities`, `ComputerUseAction`, `Observation`, `StepExecution`, and `Verification`. Use `#[serde(deny_unknown_fields)]` on model-controlled input structs and this validation boundary:

```rust
impl ComputerUseRequest {
    pub fn validate(&self) -> Result<(), ComputerUseError> {
        if self.objective.trim().is_empty() {
            return Err(ComputerUseError::blocked("invalid_objective", "objective is empty"));
        }
        if self.success_criteria.is_empty()
            || self.success_criteria.iter().any(|item| item.trim().is_empty())
        {
            return Err(ComputerUseError::blocked(
                "invalid_success_criteria",
                "at least one non-empty success criterion is required",
            ));
        }
        Ok(())
    }
}
```

Default budgets must be `max_actions=12`, `max_replans=2`, `max_same_signature=2`, `max_no_progress_steps=2`, `timeout_ms=120_000`, and `max_calls_per_turn=2`.

- [ ] **Step 4: Export the module and verify GREEN**

Add `pub mod contracts;` and explicit `pub use` exports in `lib.rs`.

Run: `cargo test -p coolzhu-computer-use-core --lib contracts --offline`

Expected: all `contracts` tests pass.

- [ ] **Step 5: Commit Task 1**

```powershell
git add modules/computer-use/packages/computer-use-core/src/contracts.rs modules/computer-use/packages/computer-use-core/src/lib.rs
git commit -m "feat(computer-use): add task-level contracts"
```

### Task 2: Runtime supervisor and circuit breaker

**Files:**
- Create: `modules/computer-use/packages/computer-use-core/src/supervisor.rs`
- Modify: `modules/computer-use/packages/computer-use-core/src/lib.rs`
- Test: `modules/computer-use/packages/computer-use-core/src/supervisor.rs`

- [ ] **Step 1: Write failing supervisor tests**

Cover these exact behaviors:

```rust
#[test]
fn identical_failed_task_returns_cached_terminal_result() {
    let mut supervisor = TurnComputerUseSupervisor::new(ComputerUseBudgets::default());
    let key = TaskIdempotencyKey::new("s", "t", &request());
    let failed = failed_result("target_not_found");
    supervisor.record_terminal(key.clone(), failed.clone());
    assert_eq!(supervisor.before_run(&key), BeforeRunDecision::ReturnCached(failed));
}

#[test]
fn second_failed_run_opens_turn_circuit() {
    let mut supervisor = TurnComputerUseSupervisor::new(ComputerUseBudgets::default());
    supervisor.record_failure();
    supervisor.record_failure();
    assert_eq!(supervisor.before_new_run(), BeforeRunDecision::Blocked("recursive_call_blocked"));
}

#[test]
fn repeated_action_without_progress_is_blocked() {
    let mut budget = RunBudgetGuard::new(ComputerUseBudgets::default(), 0);
    let fp = ActionFingerprint::new("desktop", 1, "click", "save", "{}");
    assert!(budget.before_action(&fp, 1).is_ok());
    budget.after_verification(false);
    assert!(budget.before_action(&fp, 1).is_ok());
    budget.after_verification(false);
    assert_eq!(budget.before_action(&fp, 1).unwrap_err().code, "no_progress");
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-computer-use-core --lib supervisor --offline`

Expected: compile failure because supervisor types are absent.

- [ ] **Step 3: Implement deterministic guards**

Implement `TaskIdempotencyKey` using normalized request fields and SHA-256-free stable strings, `ActionFingerprint`, `RunBudgetGuard`, `BeforeRunDecision`, and `TurnComputerUseSupervisor`. The guard must never call an adapter after a terminal budget error and must expose a `SupervisorSnapshot` in the terminal result.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test -p coolzhu-computer-use-core --lib supervisor --offline`

Expected: all supervisor tests pass.

- [ ] **Step 5: Commit Task 2**

```powershell
git add modules/computer-use/packages/computer-use-core/src/supervisor.rs modules/computer-use/packages/computer-use-core/src/lib.rs
git commit -m "feat(computer-use): add bounded run supervisor"
```

### Task 3: Controller state machine and adapter contract

**Files:**
- Create: `modules/computer-use/packages/computer-use-core/src/controller.rs`
- Modify: `modules/computer-use/packages/computer-use-core/src/lib.rs`
- Test: `modules/computer-use/packages/computer-use-core/src/controller.rs`

- [ ] **Step 1: Write failing fake-adapter controller tests**

Use an in-memory planner and adapter; verify success requires post-action verification, unsupported actions stop before input, stale observation re-observes once, and two no-progress steps terminate:

```rust
#[test]
fn action_success_without_verified_criteria_is_failed() {
    let planner = FixedPlanner::single(click_action());
    let adapter = FakeAdapter::action_ok_but_verify_false();
    let result = ComputerUseController::default().run(&request(), &planner, &adapter, &mut sink());
    assert_eq!(result.status, ComputerUseTerminalStatus::Failed);
    assert_eq!(result.error.unwrap().code, "verification_failed");
}

#[test]
fn unsupported_action_does_not_touch_input_backend() {
    let planner = FixedPlanner::single(drag_action());
    let adapter = FakeAdapter::without_drag();
    let result = ComputerUseController::default().run(&request(), &planner, &adapter, &mut sink());
    assert_eq!(result.error.unwrap().code, "unsupported_action");
    assert_eq!(adapter.action_count(), 0);
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-computer-use-core --lib controller --offline`

Expected: compile failure because controller traits and state machine are absent.

- [ ] **Step 3: Implement controller interfaces and transitions**

Use synchronous traits so fake and native adapters need no async runtime:

```rust
pub trait ComputerUsePlanner: Send + Sync {
    fn classify(&self, request: &ComputerUseRequest, observation: &Observation)
        -> Result<ComputerUseSurface, ComputerUseError>;
    fn next_action(&self, request: &ComputerUseRequest, observation: &Observation, step: usize)
        -> Result<Option<ComputerUseAction>, ComputerUseError>;
}

pub trait ComputerUseAdapter: Send + Sync {
    fn surface(&self) -> ComputerUseSurface;
    fn capabilities(&self) -> ComputerUseCapabilities;
    fn observe(&self, request: &ComputerUseRequest) -> Result<Observation, ComputerUseError>;
    fn act(&self, action: &ComputerUseAction, expected_generation: u64)
        -> Result<StepExecution, ComputerUseError>;
    fn verify(&self, criteria: &[String], before: &Observation, after: &Observation)
        -> Result<Verification, ComputerUseError>;
}
```

Emit lifecycle events through `ComputerUseEventSink`; only `Succeeded`, `Failed`, `Blocked`, `Cancelled`, or `TimedOut` may construct `ComputerUseResult`.

- [ ] **Step 4: Verify GREEN and full core regression**

Run: `cargo test -p coolzhu-computer-use-core --offline`

Expected: all computer-use-core tests pass.

- [ ] **Step 5: Commit Task 3**

```powershell
git add modules/computer-use/packages/computer-use-core/src/controller.rs modules/computer-use/packages/computer-use-core/src/lib.rs
git commit -m "feat(computer-use): add verified controller state machine"
```

### Task 4: Centralized config and SQLite run store

**Files:**
- Create: `modules/gui-web/packages/web-console/src/computer_use_store.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: `modules/gui-web/packages/web-console/src/computer_use_store.rs`

- [ ] **Step 1: Write failing config and store tests**

Tests must assert the default limits, explicit TOML overrides, v11 table creation, terminal write-once semantics, and optimistic version conflict:

```rust
#[test]
fn terminal_result_is_written_once() {
    let store = temp_store();
    store.create_run(&run()).unwrap();
    assert!(store.finish("cu-1", 0, &failed_result("x")).unwrap());
    assert!(!store.finish("cu-1", 0, &failed_result("y")).unwrap());
    assert_eq!(store.load("cu-1").unwrap().unwrap().terminal_result.unwrap().error.unwrap().code, "x");
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_store -- --test-threads=1`

Expected: compile failure because the module and expanded config do not exist.

- [ ] **Step 3: Expand `ConfigComputerUse`**

Add fields `enabled`, `tool_mode`, `approval_ttl_seconds`, `evidence_retention_days`, `controller`, `desktop`, and `browser`; use the confirmed defaults and clamp unsafe values during conversion to `ComputerUseBudgets`. Do not introduce environment-variable feature gates.

- [ ] **Step 4: Implement schema v11 and store**

Create `computer_use_runs` and `computer_use_steps` with indexes on `(session_id, turn_id)`, `state`, and `updated_at_ms`. `ComputerUseRunStore::transition` must execute:

```sql
UPDATE computer_use_runs
SET state = ?1, state_version = state_version + 1, updated_at_ms = ?2
WHERE call_id = ?3 AND state_version = ?4 AND terminal_result_json IS NULL
```

Add `apply_session_migration_v11` to `initialize_session_schema`.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline computer_use_store -- --test-threads=1`

Expected: all store/config tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add modules/gui-web/packages/web-console/src/computer_use_store.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat(web-console): persist computer-use runs"
```

### Task 5: Formal model tool and stable provider call identity

**Files:**
- Create: `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`
- Test: existing `llm_tool_definitions_*` tests in `main.rs`

- [ ] **Step 1: Write failing tool-schema and identity tests**

Assert `computer_use.perform` appears in whitelist/all/dispatch-only modes when Computer Use is enabled, remains available for a small context window as the single compact GUI tool, has no `x`, `y`, `execute`, `approved`, or retry fields, and runtime `call_id` derives from the provider tool-use id:

```rust
#[test]
fn provider_tool_id_is_preserved_for_computer_use() {
    let ids = ToolCallIdentity::from_provider("toolu_abc", "session-1", "turn-1");
    assert_eq!(ids.provider_tool_call_id, "toolu_abc");
    assert!(ids.call_id.ends_with("toolu_abc"));
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_tool -- --test-threads=1`

Expected: assertions fail because only `tools_semantic_dispatch` is formally registered.

- [ ] **Step 3: Implement the exact task-level ToolDefinition**

Add `computer_use_tool_definition()` with required `objective` and `success_criteria`, surface enum `auto|desktop|browser`, target object, constraints array, and `additionalProperties=false` at every model-controlled object boundary.

- [ ] **Step 4: Thread provider ids into runtime dispatch**

Change `dispatch_model_tool_calls_parallel` to pass `tool_use_id`, `session_id`, and a stable per-user-turn id into `run_model_tool_dispatch_for_session`. Remove millisecond-only ids for model-originated calls. General registry tools keep their current outcome mapping.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline computer_use_tool -- --test-threads=1`

Expected: schema, exposure, and identity tests pass.

- [ ] **Step 6: Commit Task 5**

```powershell
git add modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat(web-console): expose computer-use model tool"
```

### Task 6: Desktop and browser adapter bridges

**Files:**
- Create: `modules/gui-web/packages/web-console/src/computer_use_adapters.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: `modules/gui-web/packages/web-console/src/computer_use_adapters.rs`

- [ ] **Step 1: Write failing routing and capability tests**

Verify URL/DOM targets route to Browser, native window/application targets route to Desktop, ambiguous WebView2 targets return `surface_conflict`, and unsupported Browser drag/key-combo/multi-tab actions are rejected before adapter input.

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_adapters -- --test-threads=1`

Expected: compile failure because adapters do not exist.

- [ ] **Step 3: Implement Desktop bridge**

Reuse existing screenshot, target ownership, visual grounding, and `computer_use::input` primitives. Each `Observation` must include a monotonically increasing generation and target surface identity. Reject coordinates when foreground ownership, DPI, window rectangle, or WebView2 overlay differs from the observation.

- [ ] **Step 4: Implement Browser bridge with truthful capabilities**

Use the existing in-app browser page handle and DOM bridge for navigation, semantic element click, text input, selection, submit, scroll, and history. Set `drag=false`, `slider_drag=false`, `key_combinations=false`, and `multiple_tabs=false`; return `unsupported_action` before execution for these actions.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline computer_use_adapters -- --test-threads=1`

Expected: adapter routing/capability tests pass without sending real input.

- [ ] **Step 6: Commit Task 6**

```powershell
git add modules/gui-web/packages/web-console/src/computer_use_adapters.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat(web-console): add isolated computer-use adapters"
```

### Task 7: ComputerUseExecutor and task controller integration

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/computer_use_adapters.rs`
- Modify: `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: all three files above

- [ ] **Step 1: Write failing executor tests**

Cover valid desktop success, valid browser success, ambiguous surface block, action-ok/verify-false failure, backend unavailable, and exact structured ToolResult fields (`stage`, `goal_achieved`, `error.retryable`, `retry_owner`, `attempts`, `steps_completed`, `evidence`, `supervisor`).

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_executor -- --test-threads=1`

Expected: compile failure because executor is not registered.

- [ ] **Step 3: Implement `ComputerUseExecutor`**

`handles` must match only `computer_use.perform`. Parse and validate `ComputerUseRequest`, run IntentGuard, select exactly one adapter, create a persisted run, execute `ComputerUseController`, persist steps/events, and map exactly one terminal result into `ToolOutcome`. `invoke.ok` is permitted only when `goal_achieved=true`.

- [ ] **Step 4: Register executor without legacy fallback**

Add `ComputerUseExecutor` beside `RegistryExecutor`; in `task-controller` mode, a Computer Use failure returns its structured failure and never calls `legacy_semantic_dispatch`.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline computer_use_executor -- --test-threads=1`

Expected: all executor tests pass.

- [ ] **Step 6: Commit Task 7**

```powershell
git add modules/gui-web/packages/web-console/src/computer_use_adapters.rs modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat(web-console): execute verified computer-use tasks"
```

### Task 8: Approval pause/resume and unique terminal ToolResult

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/computer_use_store.rs`
- Modify: `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: same files

- [ ] **Step 1: Write failing approval lifecycle tests**

Verify awaiting approval emits no terminal ToolResult, approve/reject/cancel/timeout resolve the same provider call id, duplicate approval executes once, and restart either resumes or returns `restart_interrupted`:

```rust
#[tokio::test]
async fn approve_resumes_same_call_once() {
    let waiting = coordinator.start(protected_request()).await.unwrap();
    assert_eq!(waiting.state, ComputerUseRunState::AwaitingApproval);
    assert!(waiting.terminal_result.is_none());
    let first = coordinator.resolve(waiting.call_id(), ApprovalResolution::Approved).await.unwrap();
    let second = coordinator.resolve(waiting.call_id(), ApprovalResolution::Approved).await.unwrap();
    assert_eq!(first.provider_tool_call_id, "toolu-protected");
    assert_eq!(second, first);
    assert_eq!(adapter.action_count(), 1);
}
```

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_approval -- --test-threads=1`

Expected: lifecycle assertions fail because approval currently executes a detached pending record.

- [ ] **Step 3: Implement resolution-based approval**

Change approval endpoints to persist `ApprovalResolution` and wake the coordinator. Reject produces `blocked/permission_denied`, timeout produces `timed_out/approval_expired`, cancel produces `cancelled/user_cancelled`, and lost adapter context after restart produces `failed/restart_interrupted`. Keep old registry-tool approval behavior behind its own path during migration.

- [ ] **Step 4: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline computer_use_approval -- --test-threads=1`

Expected: approval lifecycle tests pass and duplicate approvals are idempotent.

- [ ] **Step 5: Commit Task 8**

```powershell
git add modules/gui-web/packages/web-console/src/computer_use_store.rs modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "feat(web-console): resume approved computer-use calls"
```

### Task 9: Unified streaming/non-streaming tool loop and hard recursion guard

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Test: both files

- [ ] **Step 1: Write failing loop parity and recursion tests**

Run the same scripted provider responses through streaming and non-streaming entry points. Assert identical terminal content and `is_error`; the same failed task returns cached failure; a second failed Computer Use run opens the turn circuit; a third returns `recursive_call_blocked` without adapter calls.

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline tool_loop_coordinator -- --test-threads=1`

Expected: parity/recursion assertions fail because the two loops have separate soft duplicate prompts.

- [ ] **Step 3: Route both loops through one coordinator**

Extract shared request dispatch, ToolResult construction, turn supervisor, call-count budget, cached terminal result, and circuit-open result. Keep provider streaming only for token transport; tool lifecycle logic must be shared.

- [ ] **Step 4: Replace soft-only repeat handling**

The prompt correction may remain explanatory, but runtime must block adapter execution when supervisor returns `recursive_call_blocked`. User input in a new turn creates a fresh supervisor; model retries inside the same turn do not reset it.

- [ ] **Step 5: Verify GREEN**

Run: `cargo test -p coolzhu-web-console --offline tool_loop_coordinator -- --test-threads=1`

Expected: loop parity and recursion guard tests pass.

- [ ] **Step 6: Commit Task 9**

```powershell
git add modules/gui-web/packages/web-console/src/tool_loop_coordinator.rs modules/gui-web/packages/web-console/src/main.rs
git commit -m "refactor(web-console): unify model tool coordination"
```

### Task 10: Legacy removal, UI evidence, and product verification

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Create: `docs/testing/computer-use-model-tool-evaluation-2026-06-29.md`

- [ ] **Step 1: Write failing source and UI contract tests**

Assert `task-controller` mode does not call `run_tool_intent_message` after model tool dispatch, unknown semantic intent no longer defaults to desktop icon click, Computer Use tool cards expose run id/surface/state/error/evidence, and all terminal statuses are rendered.

- [ ] **Step 2: Verify RED**

Run: `cargo test -p coolzhu-web-console --offline computer_use_product -- --test-threads=1`

Expected: tests fail on legacy fallback/default scenario or missing UI fields.

- [ ] **Step 3: Remove product legacy execution**

Keep regression scenarios for evaluation only. In `task-controller` mode, remove model-call post-fallback and semantic default action; `tools_semantic_dispatch` becomes a compatibility alias that translates explicit GUI intent into `ComputerUseRequest`, never a second execution path.

- [ ] **Step 4: Add run/approval/terminal UI**

Render progress events, approval risk summary, action/step budgets, stable error code, retry ownership, and evidence links. Approval UI must show that it resumes the original call.

- [ ] **Step 5: Run automated verification**

Run:

```powershell
cargo fmt --all -- --check
cargo test -p coolzhu-computer-use-core --offline
cargo test -p coolzhu-core-runtime --offline tool
cargo test -p coolzhu-web-console --offline computer_use -- --test-threads=1
cargo check -p coolzhu-web-console --offline
```

Expected: every command exits 0 with no failed tests.

- [ ] **Step 6: Run real COOLZHU front-end P01–P16**

Launch the packaged-development Web Console, submit desktop and browser tasks through the actual chat UI, approve one protected operation, induce one verifiable failure, and induce recursion/no-progress. Record each case in `docs/testing/computer-use-model-tool-evaluation-2026-06-29.md` with result, observed UI state, run id, call id, evidence path, failure layer, and minimal repair direction. A case is PASS only when the real app/page changes and the original model turn receives the matching terminal result.

- [ ] **Step 7: Commit Task 10**

```powershell
git add modules/gui-web/packages/web-console/src/main.rs modules/gui-web/packages/web-console/index.html modules/gui-web/packages/web-console/src/app.js modules/gui-web/packages/web-console/src/styles.css docs/testing/computer-use-model-tool-evaluation-2026-06-29.md
git commit -m "feat(web-console): complete computer-use product loop"
```

## Completion gate

Before marking implementation complete, re-read `docs/superpowers/specs/2026-06-28-computer-use-model-tool-orchestration-design.md` and confirm every completion criterion maps to a passing automated test or a P01–P16 product result. Any non-PASS product case must retain the exact error, failed layer, known facts, and smallest next repair; it must not be reported as completed.
