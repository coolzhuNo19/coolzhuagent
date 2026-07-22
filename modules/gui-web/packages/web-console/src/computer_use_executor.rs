use std::time::{SystemTime, UNIX_EPOCH};

use computer_use::{
    ComputerUseAction, ComputerUseAdapter, ComputerUseBudgets, ComputerUseCapabilities,
    ComputerUseClock, ComputerUseController, ComputerUseError, ComputerUseEventSink,
    ComputerUsePlanner, ComputerUseRequest, ComputerUseResult, ComputerUseRetryOwner,
    ComputerUseRunContext, ComputerUseRunState, ComputerUseStage, ComputerUseSurface,
    ComputerUseTerminalStatus, Observation, PlannerFuture, StepExecution, SupervisorSnapshot,
    TaskIdempotencyKey, Verification,
};
use serde_json::Value as JsonValue;

use crate::browser_bridge::BrowserNativeBridge;
use crate::computer_use_adapters::{
    backend_error, route_computer_use_surface, BrowserComputerUseAdapter, BrowserComputerUsePolicy,
    DesktopComputerUseAdapter, SurfaceRoutingContext,
};
use crate::computer_use_desktop_bridge::DesktopNativeBridge;
use crate::computer_use_planner::CurrentSessionComputerUsePlanner;
use crate::computer_use_store::{ComputerUseRunStore, ComputerUseStepRecord, NewComputerUseRun};
use crate::tool_loop_coordinator::ToolCallIdentity;

pub(crate) struct DynComputerUseAdapter(Box<dyn ComputerUseAdapter>);

impl DynComputerUseAdapter {
    pub(crate) fn new(adapter: impl ComputerUseAdapter + 'static) -> Self {
        Self(Box::new(adapter))
    }
}

impl ComputerUseAdapter for DynComputerUseAdapter {
    fn surface(&self) -> ComputerUseSurface {
        self.0.surface()
    }

    fn capabilities(&self) -> ComputerUseCapabilities {
        self.0.capabilities()
    }

    fn observe(&self, request: &ComputerUseRequest) -> Result<Observation, ComputerUseError> {
        self.0.observe(request)
    }

    fn act(
        &self,
        action: &ComputerUseAction,
        expected_generation: u64,
    ) -> Result<StepExecution, ComputerUseError> {
        self.0.act(action, expected_generation)
    }

    fn verify(
        &self,
        criteria: &[String],
        before: &Observation,
        after: &Observation,
    ) -> Result<Verification, ComputerUseError> {
        self.0.verify(criteria, before, after)
    }
}

pub(crate) trait ComputerUseAdapterFactory: Send + Sync {
    fn routing_context(&self) -> SurfaceRoutingContext;

    fn build(&self, surface: ComputerUseSurface)
        -> Result<DynComputerUseAdapter, ComputerUseError>;
}

struct PlannerRef<'a>(&'a dyn ComputerUsePlanner);

impl ComputerUsePlanner for PlannerRef<'_> {
    fn classify<'a>(
        &'a self,
        request: &'a ComputerUseRequest,
        observation: &'a Observation,
    ) -> PlannerFuture<'a, Result<ComputerUseSurface, ComputerUseError>> {
        self.0.classify(request, observation)
    }

    fn next_action<'a>(
        &'a self,
        request: &'a ComputerUseRequest,
        observation: &'a Observation,
        step: usize,
    ) -> PlannerFuture<'a, Result<Option<ComputerUseAction>, ComputerUseError>> {
        self.0.next_action(request, observation, step)
    }
}

struct SystemClock;

impl ComputerUseClock for SystemClock {
    fn now_ms(&mut self) -> u64 {
        now_ms()
    }
}

struct PersistingEventSink<'a> {
    store: &'a ComputerUseRunStore,
    call_id: &'a str,
    state_version: u64,
    persistence_error: Option<String>,
}

impl<'a> PersistingEventSink<'a> {
    fn new(store: &'a ComputerUseRunStore, call_id: &'a str) -> Self {
        Self {
            store,
            call_id,
            state_version: 0,
            persistence_error: None,
        }
    }
}

impl ComputerUseEventSink for PersistingEventSink<'_> {
    fn state_changed(&mut self, state: ComputerUseRunState) {
        if self.persistence_error.is_some() {
            return;
        }
        match self
            .store
            .transition(self.call_id, self.state_version, state, now_ms())
        {
            Ok(true) => self.state_version = self.state_version.saturating_add(1),
            Ok(false) => {
                self.persistence_error = Some(format!(
                    "computer-use state transition conflict at version {}",
                    self.state_version
                ));
            }
            Err(error) => {
                self.persistence_error = Some(format!(
                    "computer-use state transition could not be persisted: {error}"
                ));
            }
        }
    }
}

pub(crate) struct ComputerUseExecutor<'a> {
    planner: &'a dyn ComputerUsePlanner,
    adapters: &'a dyn ComputerUseAdapterFactory,
    store: &'a ComputerUseRunStore,
    budgets: ComputerUseBudgets,
}

impl<'a> ComputerUseExecutor<'a> {
    pub(crate) fn new(
        planner: &'a dyn ComputerUsePlanner,
        adapters: &'a dyn ComputerUseAdapterFactory,
        store: &'a ComputerUseRunStore,
        budgets: ComputerUseBudgets,
    ) -> Self {
        Self {
            planner,
            adapters,
            store,
            budgets,
        }
    }

    pub(crate) fn handles(&self, tool_name: &str) -> bool {
        // 正式名是 `computer_use_perform`（OpenAI 兼容协议要求 ^[a-zA-Z0-9_-]+$）；
        // 历史会话里持久化的是旧的点号写法，回放时同样要认。
        tool_name == crate::COMPUTER_USE_TOOL_NAME || tool_name == "computer_use.perform"
    }

    pub(crate) async fn execute(
        &self,
        input: &JsonValue,
        identity: &ToolCallIdentity,
    ) -> ComputerUseResult {
        if let Ok(Some(existing)) = self.store.load(&identity.call_id) {
            if let Some(result) = existing.terminal_result {
                return result;
            }
            return terminal_result(
                identity,
                existing.surface,
                ComputerUseStage::Supervisor,
                ComputerUseError::blocked(
                    "duplicate_call_in_progress",
                    "the same provider tool call is already running",
                    ComputerUseRetryOwner::None,
                ),
            );
        }

        let parsed = serde_json::from_value::<ComputerUseRequest>(input.clone());
        let requested_surface = parsed
            .as_ref()
            .map_or(ComputerUseSurface::Auto, |request| request.surface);

        let request = match parsed {
            Ok(request) => normalize_request_for_verification(request),
            Err(error) => {
                let result = terminal_result(
                    identity,
                    ComputerUseSurface::Auto,
                    ComputerUseStage::IntentGuard,
                    ComputerUseError::blocked(
                        "invalid_tool_input",
                        format!("invalid computer-use request: {error}"),
                        ComputerUseRetryOwner::Model,
                    ),
                );
                self.create_and_finish(input, identity, ComputerUseSurface::Auto, &result);
                return result;
            }
        };

        if let Err(error) = request.validate() {
            let result = terminal_result(
                identity,
                request.surface,
                ComputerUseStage::IntentGuard,
                error,
            );
            self.create_and_finish(input, identity, request.surface, &result);
            return result;
        }

        let idempotency_key =
            TaskIdempotencyKey::new(&identity.session_id, &identity.turn_id, &request)
                .as_str()
                .to_string();

        let turn_count = match self
            .store
            .count_runs_for_turn(&identity.session_id, &identity.turn_id)
        {
            Ok(count) => count,
            Err(error) => {
                return terminal_result(
                    identity,
                    requested_surface,
                    ComputerUseStage::Supervisor,
                    persistence_error(error),
                );
            }
        };
        if turn_count >= self.budgets.max_calls_per_turn {
            let result = terminal_result(
                identity,
                requested_surface,
                ComputerUseStage::Supervisor,
                ComputerUseError::blocked(
                    "recursive_call_blocked",
                    "computer-use call budget for this model turn is exhausted",
                    ComputerUseRetryOwner::None,
                ),
            );
            self.create_and_finish(input, identity, requested_surface, &result);
            return result;
        }

        match self.store.load_by_idempotency_key(
            &identity.session_id,
            &identity.turn_id,
            &idempotency_key,
        ) {
            Ok(Some(existing)) => {
                let result = if let Some(result) = existing.terminal_result {
                    rebound_cached_result(result, identity)
                } else {
                    terminal_result(
                        identity,
                        existing.surface,
                        ComputerUseStage::Supervisor,
                        ComputerUseError::blocked(
                            "duplicate_task_in_progress",
                            "an identical computer-use task is already running in this model turn",
                            ComputerUseRetryOwner::None,
                        ),
                    )
                };
                self.create_and_finish(input, identity, result.surface, &result);
                return result;
            }
            Err(error) => {
                let result = terminal_result(
                    identity,
                    request.surface,
                    ComputerUseStage::Supervisor,
                    persistence_error(error),
                );
                self.create_and_finish(input, identity, request.surface, &result);
                return result;
            }
            Ok(None) => {}
        }

        let surface = match route_computer_use_surface(&request, &self.adapters.routing_context()) {
            Ok(surface) => surface,
            Err(error) => {
                let result = terminal_result(
                    identity,
                    request.surface,
                    ComputerUseStage::Classification,
                    error,
                );
                self.create_and_finish(input, identity, request.surface, &result);
                return result;
            }
        };

        if !self.create_run(input, identity, surface, Some(&idempotency_key)) {
            if let Ok(Some(existing)) = self.store.load(&identity.call_id) {
                if let Some(result) = existing.terminal_result {
                    return result;
                }
            }
            return terminal_result(
                identity,
                surface,
                ComputerUseStage::Supervisor,
                ComputerUseError::blocked(
                    "persistence_conflict",
                    "computer-use run could not be created exactly once",
                    ComputerUseRetryOwner::None,
                ),
            );
        }

        let adapter = match self.adapters.build(surface) {
            Ok(adapter) => adapter,
            Err(error) => {
                let result =
                    terminal_result(identity, surface, ComputerUseStage::Observation, error);
                self.finish_at_version(&result, 0);
                return result;
            }
        };

        let event_sink = PersistingEventSink::new(self.store, &identity.call_id);
        let mut controller = ComputerUseController::new(
            PlannerRef(self.planner),
            adapter,
            event_sink,
            SystemClock,
            self.budgets,
        );
        let mut result = controller
            .run(
                &ComputerUseRequest { surface, ..request },
                ComputerUseRunContext {
                    call_id: identity.call_id.clone(),
                    provider_tool_call_id: Some(identity.provider_tool_call_id.clone()),
                },
            )
            .await;
        let sink = controller.event_sink();
        let state_version = sink.state_version;
        if let Some(error) = &sink.persistence_error {
            result = terminal_result(
                identity,
                surface,
                ComputerUseStage::Supervisor,
                ComputerUseError::new(
                    "persistence_error",
                    error.clone(),
                    true,
                    ComputerUseRetryOwner::System,
                ),
            );
        }

        self.persist_step_summaries(&result);
        self.finish_at_version(&result, state_version)
    }

    fn create_and_finish(
        &self,
        input: &JsonValue,
        identity: &ToolCallIdentity,
        surface: ComputerUseSurface,
        result: &ComputerUseResult,
    ) {
        if self.create_run(input, identity, surface, None) {
            let _ = self.store.finish(&identity.call_id, 0, result);
        }
    }

    fn create_run(
        &self,
        input: &JsonValue,
        identity: &ToolCallIdentity,
        surface: ComputerUseSurface,
        idempotency_key: Option<&str>,
    ) -> bool {
        let created_at_ms = now_ms();
        let idempotency_key = idempotency_key
            .map(str::to_string)
            .or_else(|| {
                serde_json::from_value::<ComputerUseRequest>(input.clone())
                    .ok()
                    .map(|request| {
                        TaskIdempotencyKey::new(&identity.session_id, &identity.turn_id, &request)
                            .as_str()
                            .to_string()
                    })
            })
            .unwrap_or_else(|| identity.call_id.clone());
        self.store
            .create_run(&NewComputerUseRun {
                call_id: identity.call_id.clone(),
                provider_tool_call_id: Some(identity.provider_tool_call_id.clone()),
                session_id: identity.session_id.clone(),
                turn_id: identity.turn_id.clone(),
                chat_room_id: None,
                idempotency_key,
                objective_json: serde_json::to_string(input).unwrap_or_else(|_| "null".into()),
                surface,
                deadline_ms: created_at_ms.saturating_add(self.budgets.timeout_ms),
                created_at_ms,
            })
            .unwrap_or(false)
    }

    fn persist_step_summaries(&self, result: &ComputerUseResult) {
        for step_index in 0..result.steps_completed {
            let evidence = result.evidence.get(step_index).cloned();
            let _ = self.store.append_step(&ComputerUseStepRecord {
                run_id: result.call_id.clone(),
                step_index,
                observation_generation: (step_index + 1) as u64,
                action_type: "controller_action".into(),
                normalized_target: "task_objective".into(),
                action_fingerprint: format!("{}:{step_index}", result.call_id),
                status: if result.goal_achieved {
                    "verified".into()
                } else {
                    "completed_unverified".into()
                },
                error_code: result.error.as_ref().map(|error| error.code.clone()),
                before_evidence_ref: evidence.clone(),
                after_evidence_ref: evidence,
                visible_progress: result.goal_achieved,
                started_at_ms: now_ms(),
                completed_at_ms: Some(now_ms()),
            });
        }
    }

    fn finish_at_version(
        &self,
        result: &ComputerUseResult,
        state_version: u64,
    ) -> ComputerUseResult {
        match self.store.finish(&result.call_id, state_version, result) {
            Ok(true) => result.clone(),
            Ok(false) => self
                .store
                .load(&result.call_id)
                .ok()
                .flatten()
                .and_then(|run| run.terminal_result)
                .unwrap_or_else(|| {
                    terminal_result(
                        &identity_from_result(result),
                        result.surface,
                        ComputerUseStage::Supervisor,
                        ComputerUseError::blocked(
                            "persistence_conflict",
                            "terminal computer-use result was not written exactly once",
                            ComputerUseRetryOwner::None,
                        ),
                    )
                }),
            Err(error) => terminal_result(
                &identity_from_result(result),
                result.surface,
                ComputerUseStage::Supervisor,
                persistence_error(error),
            ),
        }
    }
}

fn identity_from_result(result: &ComputerUseResult) -> ToolCallIdentity {
    ToolCallIdentity {
        call_id: result.call_id.clone(),
        provider_tool_call_id: result.provider_tool_call_id.clone().unwrap_or_default(),
        session_id: String::new(),
        turn_id: String::new(),
    }
}

fn persistence_error(error: impl std::fmt::Display) -> ComputerUseError {
    ComputerUseError::new(
        "persistence_error",
        format!("computer-use persistence failed: {error}"),
        true,
        ComputerUseRetryOwner::System,
    )
}

fn terminal_result(
    identity: &ToolCallIdentity,
    surface: ComputerUseSurface,
    stage: ComputerUseStage,
    error: ComputerUseError,
) -> ComputerUseResult {
    let status = if error.code == "deadline_exceeded" {
        ComputerUseTerminalStatus::TimedOut
    } else if error.retryable {
        ComputerUseTerminalStatus::Failed
    } else {
        ComputerUseTerminalStatus::Blocked
    };
    ComputerUseResult {
        call_id: identity.call_id.clone(),
        provider_tool_call_id: Some(identity.provider_tool_call_id.clone()),
        status,
        stage,
        goal_achieved: false,
        surface,
        summary: error.message.clone(),
        error: Some(error),
        attempts: 0,
        steps_completed: 0,
        evidence: Vec::new(),
        supervisor: SupervisorSnapshot {
            circuit_open: false,
            reason: None,
            action_count: 0,
            replan_count: 0,
            no_progress_count: 0,
        },
    }
}

fn rebound_cached_result(
    mut result: ComputerUseResult,
    identity: &ToolCallIdentity,
) -> ComputerUseResult {
    result.call_id = identity.call_id.clone();
    result.provider_tool_call_id = Some(identity.provider_tool_call_id.clone());
    result.summary = format!(
        "cached terminal result for identical computer-use task in this model turn: {}",
        result.summary
    );
    result
}

fn normalize_request_for_verification(mut request: ComputerUseRequest) -> ComputerUseRequest {
    let mut success_criteria = Vec::new();
    for criterion in std::mem::take(&mut request.success_criteria) {
        let criterion = criterion.trim();
        if criterion.is_empty() {
            continue;
        }
        if is_execution_constraint_criterion(criterion) {
            if !request
                .constraints
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(criterion))
            {
                request.constraints.push(criterion.to_string());
            }
        } else {
            success_criteria.push(criterion.to_string());
        }
    }
    if success_criteria.is_empty() {
        success_criteria.push(request.objective.trim().to_string());
    }
    request.success_criteria = success_criteria;
    request
}

fn is_execution_constraint_criterion(criterion: &str) -> bool {
    let lower = criterion.to_lowercase();
    let mentions_coordinate = lower.contains("coordinate")
        || lower.contains("desktop coord")
        || criterion.contains("坐标");
    let mentions_dom = lower.contains(" dom")
        || lower.contains("dom ")
        || lower.contains("dom引用")
        || lower.contains("dom 引用")
        || lower.contains("dom reference");
    let forbids_or_limits = lower.contains("only")
        || lower.contains("without")
        || lower.contains("not use")
        || lower.contains("do not use")
        || lower.contains("never use")
        || criterion.contains("只")
        || criterion.contains("仅")
        || criterion.contains("不能")
        || criterion.contains("不使用")
        || criterion.contains("未使用")
        || criterion.contains("禁止");
    (mentions_coordinate || mentions_dom) && forbids_or_limits
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

struct ProductionAdapterFactory {
    desktop_enabled: bool,
    browser_enabled: bool,
    browser_policy: BrowserComputerUsePolicy,
}

impl ComputerUseAdapterFactory for ProductionAdapterFactory {
    fn routing_context(&self) -> SurfaceRoutingContext {
        SurfaceRoutingContext {
            foreground_is_webview2: false,
            desktop_available: self.desktop_enabled,
            browser_available: self.browser_enabled,
        }
    }

    fn build(
        &self,
        surface: ComputerUseSurface,
    ) -> Result<DynComputerUseAdapter, ComputerUseError> {
        match surface {
            ComputerUseSurface::Desktop if self.desktop_enabled => {
                DesktopNativeBridge::preflight()?;
                Ok(DynComputerUseAdapter::new(DesktopComputerUseAdapter::new(
                    DesktopNativeBridge,
                )))
            }
            ComputerUseSurface::Browser if self.browser_enabled => {
                BrowserNativeBridge::preflight()?;
                Ok(DynComputerUseAdapter::new(
                    BrowserComputerUseAdapter::with_policy(
                        BrowserNativeBridge::default(),
                        self.browser_policy,
                    ),
                ))
            }
            ComputerUseSurface::Auto => Err(backend_error(
                "computer-use adapter cannot be built for an automatic surface",
            )),
            _ => Err(backend_error(&format!(
                "{} adapter is disabled by configuration",
                surface.as_str()
            ))),
        }
    }
}

pub(crate) async fn execute_with_current_runtime(
    input: &JsonValue,
    identity: &ToolCallIdentity,
) -> ComputerUseResult {
    let config = crate::read_config(|config| config.computer_use.clone());
    if !config.enabled || config.tool_mode != "task-controller" {
        return terminal_result(
            identity,
            ComputerUseSurface::Auto,
            ComputerUseStage::IntentGuard,
            ComputerUseError::blocked(
                "computer_use_disabled",
                "computer-use task controller is disabled by configuration",
                ComputerUseRetryOwner::User,
            ),
        );
    }
    let store = match ComputerUseRunStore::open(&crate::default_session_sqlite_path()) {
        Ok(store) => store,
        Err(error) => {
            return terminal_result(
                identity,
                ComputerUseSurface::Auto,
                ComputerUseStage::Supervisor,
                persistence_error(format!("open computer-use run store: {error}")),
            );
        }
    };
    let adapters = ProductionAdapterFactory {
        desktop_enabled: config.desktop.enabled,
        browser_enabled: config.browser.enabled,
        browser_policy: BrowserComputerUsePolicy {
            allow_drag: config.browser.allow_drag,
            allow_key_combinations: config.browser.allow_key_combinations,
            allow_multiple_tabs: config.browser.allow_multiple_tabs,
        },
    };
    let planner = CurrentSessionComputerUsePlanner::new(identity.session_id.clone());
    ComputerUseExecutor::new(&planner, &adapters, &store, config.budgets())
        .execute(input, identity)
        .await
}

#[cfg(test)]
mod tests {
    use std::sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    };

    use computer_use::{ComputerUseActionKind, ComputerUseRiskClass, ComputerUseTerminalStatus};
    use rusqlite::Connection;
    use serde_json::json;

    use super::*;
    use crate::computer_use_store::apply_session_migration_v11;

    #[test]
    fn task_controller_runtime_does_not_use_unavailable_backends() {
        let source = include_str!("computer_use_executor.rs");
        let runtime = source
            .split("pub(crate) async fn execute_with_current_runtime")
            .nth(1)
            .expect("runtime function")
            .split("#[cfg(test)]")
            .next()
            .expect("runtime function body");
        assert!(!runtime.contains("UnavailablePlanner"));
        assert!(!runtime.contains("UnavailableAdapterFactory"));
        assert!(runtime.contains("CurrentSessionComputerUsePlanner"));
        assert!(runtime.contains("ProductionAdapterFactory"));
    }

    #[test]
    fn request_normalization_moves_dom_coordinate_constraints_out_of_success_criteria() {
        let request: ComputerUseRequest = serde_json::from_value(json!({
            "objective": "读取 Wikipedia 页面标题",
            "surface": "browser",
            "success_criteria": [
                "页面标题包含 Wikipedia",
                "仅使用 DOM 引用，未使用桌面坐标"
            ]
        }))
        .unwrap();

        let normalized = normalize_request_for_verification(request);

        assert_eq!(normalized.success_criteria, vec!["页面标题包含 Wikipedia"]);
        assert_eq!(
            normalized.constraints,
            vec!["仅使用 DOM 引用，未使用桌面坐标"]
        );
    }

    struct FakePlanner {
        actions: Mutex<Vec<ComputerUseAction>>,
    }

    impl FakePlanner {
        fn one_click() -> Self {
            Self {
                actions: Mutex::new(vec![ComputerUseAction {
                    kind: ComputerUseActionKind::Click,
                    target: "submit".into(),
                    arguments: json!({}),
                    risk: ComputerUseRiskClass::ReversibleLocal,
                }]),
            }
        }
    }

    impl ComputerUsePlanner for FakePlanner {
        fn classify<'a>(
            &'a self,
            request: &'a ComputerUseRequest,
            _observation: &'a Observation,
        ) -> PlannerFuture<'a, Result<ComputerUseSurface, ComputerUseError>> {
            Box::pin(async move { Ok(request.surface) })
        }

        fn next_action<'a>(
            &'a self,
            _request: &'a ComputerUseRequest,
            _observation: &'a Observation,
            _step: usize,
        ) -> PlannerFuture<'a, Result<Option<ComputerUseAction>, ComputerUseError>> {
            Box::pin(async move { Ok(self.actions.lock().unwrap().pop()) })
        }
    }

    struct FakeAdapter {
        surface: ComputerUseSurface,
        generation: AtomicU64,
        action_count: Arc<AtomicUsize>,
        verify_count: AtomicUsize,
        achieve_after_action: bool,
    }

    impl ComputerUseAdapter for FakeAdapter {
        fn surface(&self) -> ComputerUseSurface {
            self.surface
        }

        fn capabilities(&self) -> ComputerUseCapabilities {
            ComputerUseCapabilities {
                click: true,
                ..ComputerUseCapabilities::default()
            }
        }

        fn observe(&self, _request: &ComputerUseRequest) -> Result<Observation, ComputerUseError> {
            let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
            Ok(Observation {
                generation,
                surface: self.surface,
                surface_identity: format!("{:?}-surface", self.surface),
                state: json!({"generation": generation}),
                evidence: vec![format!("evidence-{generation}.png")],
            })
        }

        fn act(
            &self,
            _action: &ComputerUseAction,
            _expected_generation: u64,
        ) -> Result<StepExecution, ComputerUseError> {
            self.action_count.fetch_add(1, Ordering::SeqCst);
            Ok(StepExecution {
                input_sent: true,
                summary: "input sent".into(),
                evidence: vec!["input.json".into()],
            })
        }

        fn verify(
            &self,
            _criteria: &[String],
            _before: &Observation,
            _after: &Observation,
        ) -> Result<Verification, ComputerUseError> {
            let call = self.verify_count.fetch_add(1, Ordering::SeqCst);
            let achieved = self.achieve_after_action && call > 0;
            Ok(Verification {
                achieved,
                visible_progress: call > 0,
                summary: if achieved {
                    "success criterion is visibly satisfied".into()
                } else {
                    "success criterion is not yet visible".into()
                },
                evidence: vec![format!("verify-{call}.json")],
            })
        }
    }

    struct FakeFactory {
        context: SurfaceRoutingContext,
        achieve_after_action: bool,
        action_count: Arc<AtomicUsize>,
        backend_unavailable: bool,
    }

    impl ComputerUseAdapterFactory for FakeFactory {
        fn routing_context(&self) -> SurfaceRoutingContext {
            self.context
        }

        fn build(
            &self,
            surface: ComputerUseSurface,
        ) -> Result<DynComputerUseAdapter, ComputerUseError> {
            if self.backend_unavailable {
                return Err(backend_error("test backend unavailable"));
            }
            Ok(DynComputerUseAdapter::new(FakeAdapter {
                surface,
                generation: AtomicU64::new(0),
                action_count: Arc::clone(&self.action_count),
                verify_count: AtomicUsize::new(0),
                achieve_after_action: self.achieve_after_action,
            }))
        }
    }

    fn store() -> ComputerUseRunStore {
        let connection = Connection::open_in_memory().unwrap();
        apply_session_migration_v11(&connection).unwrap();
        ComputerUseRunStore::from_connection(connection)
    }

    fn identity(provider: &str) -> ToolCallIdentity {
        ToolCallIdentity::from_provider(provider, "session-1", "turn-1")
    }

    fn input(surface: &str) -> JsonValue {
        let target = if surface == "browser" {
            json!({"url": "https://example.invalid", "element": "submit"})
        } else {
            json!({"application": "notepad", "window": "Untitled"})
        };
        json!({
            "objective": "click submit",
            "surface": surface,
            "target": target,
            "success_criteria": ["success is visible"]
        })
    }

    fn factory(achieve_after_action: bool) -> FakeFactory {
        FakeFactory {
            context: SurfaceRoutingContext::default(),
            achieve_after_action,
            action_count: Arc::new(AtomicUsize::new(0)),
            backend_unavailable: false,
        }
    }

    #[test]
    fn computer_use_executor_handles_only_the_formal_task_tool() {
        let store = store();
        let planner = FakePlanner::one_click();
        let factory = factory(true);
        let executor =
            ComputerUseExecutor::new(&planner, &factory, &store, ComputerUseBudgets::default());
        // 正式名（协议合法）与历史会话里的旧点号写法都要认。
        assert!(executor.handles(crate::COMPUTER_USE_TOOL_NAME));
        assert!(executor.handles("computer_use.perform"));
        // 其它工具一律不接管。
        assert!(!executor.handles("tools_semantic_dispatch"));
        assert!(!executor.handles("computer.left_click"));
    }

    #[tokio::test]
    async fn valid_desktop_and_browser_runs_succeed_only_after_visible_verification() {
        for surface in ["desktop", "browser"] {
            let store = store();
            let planner = FakePlanner::one_click();
            let factory = factory(true);
            let result =
                ComputerUseExecutor::new(&planner, &factory, &store, ComputerUseBudgets::default())
                    .execute(&input(surface), &identity(&format!("tool-{surface}")))
                    .await;

            assert_eq!(result.status, ComputerUseTerminalStatus::Succeeded);
            assert!(result.goal_achieved);
            assert_eq!(result.stage, ComputerUseStage::Terminal);
            assert_eq!(result.attempts, 1);
            assert_eq!(result.steps_completed, 1);
            assert!(!result.evidence.is_empty());
            assert_eq!(factory.action_count.load(Ordering::SeqCst), 1);
            let persisted = store.load(&result.call_id).unwrap().unwrap();
            assert_eq!(persisted.terminal_result.as_ref(), Some(&result));
        }
    }

    #[tokio::test]
    async fn action_ok_but_verify_false_is_a_terminal_failure_not_success() {
        let store = store();
        let planner = FakePlanner::one_click();
        let factory = factory(false);
        let result =
            ComputerUseExecutor::new(&planner, &factory, &store, ComputerUseBudgets::default())
                .execute(&input("desktop"), &identity("tool-verify-false"))
                .await;

        assert!(!result.goal_achieved);
        assert_eq!(result.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(result.stage, ComputerUseStage::Verification);
        assert_eq!(result.error.as_ref().unwrap().code, "verification_failed");
        assert!(!result.error.as_ref().unwrap().retryable);
        assert_eq!(
            result.error.as_ref().unwrap().retry_owner,
            ComputerUseRetryOwner::Model
        );
        assert_eq!(result.attempts, 1);
        assert_eq!(result.steps_completed, 1);
    }

    #[tokio::test]
    async fn ambiguous_surface_and_unavailable_backend_return_structured_terminal_results() {
        let routing_store = store();
        let planner = FakePlanner::one_click();
        let routing_factory = factory(true);
        let ambiguous = ComputerUseExecutor::new(
            &planner,
            &routing_factory,
            &routing_store,
            ComputerUseBudgets::default(),
        )
        .execute(
            &json!({
                "objective": "click mixed target",
                "surface": "auto",
                "target": {"application": "pet", "element": "submit"},
                "success_criteria": ["success visible"]
            }),
            &identity("tool-ambiguous"),
        )
        .await;
        assert_eq!(ambiguous.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(ambiguous.stage, ComputerUseStage::Classification);
        assert_eq!(ambiguous.error.as_ref().unwrap().code, "surface_conflict");
        assert_eq!(routing_factory.action_count.load(Ordering::SeqCst), 0);

        let backend_store = store();
        let unavailable_base = factory(true);
        let unavailable = FakeFactory {
            backend_unavailable: true,
            ..unavailable_base
        };
        let result = ComputerUseExecutor::new(
            &planner,
            &unavailable,
            &backend_store,
            ComputerUseBudgets::default(),
        )
        .execute(&input("browser"), &identity("tool-unavailable"))
        .await;
        assert_eq!(result.status, ComputerUseTerminalStatus::Failed);
        assert_eq!(result.error.as_ref().unwrap().code, "backend_unavailable");
        assert!(result.error.as_ref().unwrap().retryable);
        assert_eq!(
            result.error.as_ref().unwrap().retry_owner,
            ComputerUseRetryOwner::System
        );
    }

    #[tokio::test]
    async fn exact_terminal_fields_are_serialized_and_duplicate_call_is_idempotent() {
        let store = store();
        let planner = FakePlanner::one_click();
        let factory = factory(true);
        let executor =
            ComputerUseExecutor::new(&planner, &factory, &store, ComputerUseBudgets::default());
        let ids = identity("tool-idempotent");
        let first = executor.execute(&input("desktop"), &ids).await;
        let second = executor.execute(&input("desktop"), &ids).await;
        assert_eq!(second, first);
        assert_eq!(factory.action_count.load(Ordering::SeqCst), 1);

        let value = serde_json::to_value(&first).unwrap();
        for field in [
            "stage",
            "goal_achieved",
            "attempts",
            "steps_completed",
            "evidence",
            "supervisor",
        ] {
            assert!(value.get(field).is_some(), "missing result field {field}");
        }
    }

    #[tokio::test]
    async fn turn_watchdog_blocks_recursive_calls_without_more_ui_input() {
        let store = store();
        let factory = factory(false);
        let budgets = ComputerUseBudgets {
            max_calls_per_turn: 2,
            ..ComputerUseBudgets::default()
        };
        let first_planner = FakePlanner::one_click();
        let first = ComputerUseExecutor::new(&first_planner, &factory, &store, budgets)
            .execute(&input("desktop"), &identity("tool-failure-1"))
            .await;
        assert!(!first.goal_achieved);
        assert_eq!(factory.action_count.load(Ordering::SeqCst), 1);

        let second_planner = FakePlanner::one_click();
        let second = ComputerUseExecutor::new(&second_planner, &factory, &store, budgets)
            .execute(&input("desktop"), &identity("tool-failure-2"))
            .await;
        assert!(!second.goal_achieved);
        assert_eq!(second.call_id, identity("tool-failure-2").call_id);
        assert!(second.summary.contains("cached terminal result"));
        assert_eq!(
            second.error.as_ref().unwrap().code,
            first.error.as_ref().unwrap().code
        );
        assert_eq!(factory.action_count.load(Ordering::SeqCst), 1);

        let planner = FakePlanner::one_click();
        let third = ComputerUseExecutor::new(&planner, &factory, &store, budgets)
            .execute(&input("desktop"), &identity("tool-failure-3"))
            .await;
        assert_eq!(third.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(third.error.as_ref().unwrap().code, "recursive_call_blocked");
        assert_eq!(
            third.error.as_ref().unwrap().retry_owner,
            ComputerUseRetryOwner::None
        );
        assert_eq!(factory.action_count.load(Ordering::SeqCst), 1);
    }
}
