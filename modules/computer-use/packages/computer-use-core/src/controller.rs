use crate::{
    ActionFingerprint, ComputerUseAction, ComputerUseBudgets, ComputerUseCapabilities,
    ComputerUseError, ComputerUseRequest, ComputerUseResult, ComputerUseRetryOwner,
    ComputerUseRunState, ComputerUseStage, ComputerUseSurface, ComputerUseTerminalStatus,
    Observation, RunBudgetGuard, StepExecution, Verification,
};

pub type PlannerFuture<'a, T> = std::pin::Pin<Box<dyn std::future::Future<Output = T> + Send + 'a>>;

pub trait ComputerUsePlanner: Send + Sync {
    fn classify<'a>(
        &'a self,
        request: &'a ComputerUseRequest,
        observation: &'a Observation,
    ) -> PlannerFuture<'a, Result<ComputerUseSurface, ComputerUseError>>;

    fn next_action<'a>(
        &'a self,
        request: &'a ComputerUseRequest,
        observation: &'a Observation,
        step: usize,
    ) -> PlannerFuture<'a, Result<Option<ComputerUseAction>, ComputerUseError>>;
}

pub trait ComputerUseAdapter: Send + Sync {
    fn surface(&self) -> ComputerUseSurface;
    fn capabilities(&self) -> ComputerUseCapabilities;
    fn observe(&self, request: &ComputerUseRequest) -> Result<Observation, ComputerUseError>;
    fn act(
        &self,
        action: &ComputerUseAction,
        expected_generation: u64,
    ) -> Result<StepExecution, ComputerUseError>;
    fn verify(
        &self,
        criteria: &[String],
        before: &Observation,
        after: &Observation,
    ) -> Result<Verification, ComputerUseError>;
}

pub trait ComputerUseEventSink {
    fn state_changed(&mut self, state: ComputerUseRunState);
}

pub trait ComputerUseClock {
    fn now_ms(&mut self) -> u64;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComputerUseRunContext {
    pub call_id: String,
    pub provider_tool_call_id: Option<String>,
}

pub struct ComputerUseController<P, A, E, C> {
    planner: P,
    adapter: A,
    events: E,
    clock: C,
    budgets: ComputerUseBudgets,
}

impl<P, A, E, C> ComputerUseController<P, A, E, C>
where
    P: ComputerUsePlanner,
    A: ComputerUseAdapter,
    E: ComputerUseEventSink,
    C: ComputerUseClock,
{
    #[must_use]
    pub fn new(planner: P, adapter: A, events: E, clock: C, budgets: ComputerUseBudgets) -> Self {
        Self {
            planner,
            adapter,
            events,
            clock,
            budgets,
        }
    }

    #[must_use]
    pub const fn adapter(&self) -> &A {
        &self.adapter
    }

    #[must_use]
    pub const fn event_sink(&self) -> &E {
        &self.events
    }

    pub async fn run(
        &mut self,
        request: &ComputerUseRequest,
        context: ComputerUseRunContext,
    ) -> ComputerUseResult {
        self.events.state_changed(ComputerUseRunState::Requested);
        if let Err(error) = request.validate() {
            return self.terminal(
                &context,
                request.surface,
                ComputerUseStage::IntentGuard,
                error,
                0,
                0,
                Vec::new(),
                crate::SupervisorSnapshot::default(),
            );
        }

        let started_at_ms = self.clock.now_ms();
        let mut guard = RunBudgetGuard::new(self.budgets, started_at_ms);
        let mut attempts = 0usize;
        let mut steps_completed = 0usize;
        let mut evidence = Vec::new();
        let mut stale_recovered = false;

        self.events.state_changed(ComputerUseRunState::Observing);
        let mut observation = match self.adapter.observe(request) {
            Ok(observation) => observation,
            Err(error) => {
                return self.terminal(
                    &context,
                    request.surface,
                    ComputerUseStage::Observation,
                    error,
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }
        };
        evidence.extend(observation.evidence.clone());

        let surface = if request.surface == ComputerUseSurface::Auto {
            match self.planner.classify(request, &observation).await {
                Ok(surface) => surface,
                Err(error) => {
                    return self.terminal(
                        &context,
                        ComputerUseSurface::Auto,
                        ComputerUseStage::Classification,
                        error,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            }
        } else {
            request.surface
        };
        self.events.state_changed(ComputerUseRunState::Classified);

        if surface == ComputerUseSurface::Auto || surface != self.adapter.surface() {
            return self.terminal(
                &context,
                surface,
                ComputerUseStage::Classification,
                ComputerUseError::blocked(
                    "surface_unavailable",
                    "no adapter is available for the selected surface",
                    ComputerUseRetryOwner::System,
                ),
                attempts,
                steps_completed,
                evidence,
                guard.snapshot(),
            );
        }
        if observation.surface != surface {
            return self.terminal(
                &context,
                surface,
                ComputerUseStage::Observation,
                ComputerUseError::recoverable(
                    "surface_mismatch",
                    "observation does not belong to the selected surface",
                ),
                attempts,
                steps_completed,
                evidence,
                guard.snapshot(),
            );
        }

        self.events.state_changed(ComputerUseRunState::Verifying);
        match self
            .adapter
            .verify(&request.success_criteria, &observation, &observation)
        {
            Ok(verification) => {
                evidence.extend(verification.evidence.clone());
                if verification.achieved {
                    return self.success(
                        &context,
                        surface,
                        verification.summary,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            }
            Err(error) => {
                return self.terminal(
                    &context,
                    surface,
                    ComputerUseStage::Verification,
                    error,
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }
        }

        loop {
            self.events.state_changed(ComputerUseRunState::Planning);
            let action = match self
                .planner
                .next_action(request, &observation, attempts)
                .await
            {
                Ok(Some(action)) => action,
                Ok(None) => {
                    return self.terminal(
                        &context,
                        surface,
                        ComputerUseStage::Verification,
                        ComputerUseError::blocked(
                            "verification_failed",
                            "planner stopped before all success criteria were verified",
                            ComputerUseRetryOwner::Model,
                        ),
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
                Err(error) => {
                    return self.terminal(
                        &context,
                        surface,
                        ComputerUseStage::Planning,
                        error,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            };

            self.events.state_changed(ComputerUseRunState::PolicyCheck);
            if !self.adapter.capabilities().supports(action.kind) {
                return self.terminal(
                    &context,
                    surface,
                    ComputerUseStage::PolicyCheck,
                    ComputerUseError::blocked(
                        "unsupported_action",
                        format!("adapter does not support {:?}", action.kind),
                        ComputerUseRetryOwner::Model,
                    ),
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }

            let arguments = serde_json::to_string(&action.arguments).unwrap_or_default();
            let fingerprint = ActionFingerprint::new(
                surface.as_str(),
                observation.generation,
                &format!("{:?}", action.kind),
                &action.target,
                &arguments,
            );
            if let Err(error) = guard.before_action(&fingerprint, self.clock.now_ms()) {
                return self.terminal(
                    &context,
                    surface,
                    ComputerUseStage::Supervisor,
                    error,
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }

            attempts = attempts.saturating_add(1);
            self.events.state_changed(ComputerUseRunState::Executing);
            let execution = match self.adapter.act(&action, observation.generation) {
                Ok(execution) => execution,
                Err(error) if error.code == "stale_observation" && !stale_recovered => {
                    if let Err(budget_error) = guard.record_replan() {
                        return self.terminal(
                            &context,
                            surface,
                            ComputerUseStage::Supervisor,
                            budget_error,
                            attempts,
                            steps_completed,
                            evidence,
                            guard.snapshot(),
                        );
                    }
                    stale_recovered = true;
                    self.events.state_changed(ComputerUseRunState::Observing);
                    observation = match self.adapter.observe(request) {
                        Ok(observation) => observation,
                        Err(observe_error) => {
                            return self.terminal(
                                &context,
                                surface,
                                ComputerUseStage::Observation,
                                observe_error,
                                attempts,
                                steps_completed,
                                evidence,
                                guard.snapshot(),
                            );
                        }
                    };
                    evidence.extend(observation.evidence.clone());
                    continue;
                }
                Err(error) => {
                    return self.terminal(
                        &context,
                        surface,
                        ComputerUseStage::Execution,
                        error,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            };

            evidence.extend(execution.evidence.clone());
            if !execution.input_sent {
                return self.terminal(
                    &context,
                    surface,
                    ComputerUseStage::Execution,
                    ComputerUseError::recoverable(
                        "input_not_sent",
                        "adapter returned without sending the requested input",
                    ),
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }
            steps_completed = steps_completed.saturating_add(1);

            self.events.state_changed(ComputerUseRunState::Observing);
            let next_observation = match self.adapter.observe(request) {
                Ok(observation) => observation,
                Err(error) => {
                    return self.terminal(
                        &context,
                        surface,
                        ComputerUseStage::Observation,
                        error,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            };
            evidence.extend(next_observation.evidence.clone());

            self.events.state_changed(ComputerUseRunState::Verifying);
            let verification = match self.adapter.verify(
                &request.success_criteria,
                &observation,
                &next_observation,
            ) {
                Ok(verification) => verification,
                Err(error) => {
                    return self.terminal(
                        &context,
                        surface,
                        ComputerUseStage::Verification,
                        error,
                        attempts,
                        steps_completed,
                        evidence,
                        guard.snapshot(),
                    );
                }
            };
            evidence.extend(verification.evidence.clone());
            guard.after_verification(verification.visible_progress);
            if verification.achieved {
                return self.success(
                    &context,
                    surface,
                    verification.summary,
                    attempts,
                    steps_completed,
                    evidence,
                    guard.snapshot(),
                );
            }
            observation = next_observation;
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn terminal(
        &mut self,
        context: &ComputerUseRunContext,
        surface: ComputerUseSurface,
        stage: ComputerUseStage,
        error: ComputerUseError,
        attempts: usize,
        steps_completed: usize,
        evidence: Vec<String>,
        supervisor: crate::SupervisorSnapshot,
    ) -> ComputerUseResult {
        let status = if error.code == "deadline_exceeded" {
            ComputerUseTerminalStatus::TimedOut
        } else if !error.retryable {
            ComputerUseTerminalStatus::Blocked
        } else {
            ComputerUseTerminalStatus::Failed
        };
        self.events.state_changed(match status {
            ComputerUseTerminalStatus::Succeeded => ComputerUseRunState::Succeeded,
            ComputerUseTerminalStatus::Failed => ComputerUseRunState::Failed,
            ComputerUseTerminalStatus::Blocked => ComputerUseRunState::Blocked,
            ComputerUseTerminalStatus::Cancelled => ComputerUseRunState::Cancelled,
            ComputerUseTerminalStatus::TimedOut => ComputerUseRunState::TimedOut,
        });
        ComputerUseResult {
            call_id: context.call_id.clone(),
            provider_tool_call_id: context.provider_tool_call_id.clone(),
            status,
            stage,
            goal_achieved: false,
            surface,
            summary: error.message.clone(),
            error: Some(error),
            attempts,
            steps_completed,
            evidence,
            supervisor,
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn success(
        &mut self,
        context: &ComputerUseRunContext,
        surface: ComputerUseSurface,
        summary: String,
        attempts: usize,
        steps_completed: usize,
        evidence: Vec<String>,
        supervisor: crate::SupervisorSnapshot,
    ) -> ComputerUseResult {
        self.events.state_changed(ComputerUseRunState::Succeeded);
        ComputerUseResult {
            call_id: context.call_id.clone(),
            provider_tool_call_id: context.provider_tool_call_id.clone(),
            status: ComputerUseTerminalStatus::Succeeded,
            stage: ComputerUseStage::Terminal,
            goal_achieved: true,
            surface,
            summary,
            error: None,
            attempts,
            steps_completed,
            evidence,
            supervisor,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    };

    use serde_json::json;

    use super::*;
    use crate::{
        ComputerUseAction, ComputerUseActionKind, ComputerUseCapabilities, ComputerUseError,
        ComputerUseRequest, ComputerUseRetryOwner, ComputerUseRiskClass, ComputerUseStage,
        ComputerUseSurface, ComputerUseTerminalStatus, Observation, StepExecution, Verification,
    };

    #[derive(Default)]
    struct FakePlanner {
        surface: ComputerUseSurface,
        actions: Mutex<VecDeque<Result<Option<ComputerUseAction>, ComputerUseError>>>,
    }

    impl ComputerUsePlanner for FakePlanner {
        fn classify<'a>(
            &'a self,
            _request: &'a ComputerUseRequest,
            _observation: &'a Observation,
        ) -> PlannerFuture<'a, Result<ComputerUseSurface, ComputerUseError>> {
            Box::pin(async move { Ok(self.surface) })
        }

        fn next_action<'a>(
            &'a self,
            _request: &'a ComputerUseRequest,
            _observation: &'a Observation,
            _step: usize,
        ) -> PlannerFuture<'a, Result<Option<ComputerUseAction>, ComputerUseError>> {
            Box::pin(async move { self.actions.lock().unwrap().pop_front().unwrap_or(Ok(None)) })
        }
    }

    struct FakeAdapter {
        surface: ComputerUseSurface,
        capabilities: ComputerUseCapabilities,
        observations: Mutex<VecDeque<Result<Observation, ComputerUseError>>>,
        executions: Mutex<VecDeque<Result<StepExecution, ComputerUseError>>>,
        verifications: Mutex<VecDeque<Result<Verification, ComputerUseError>>>,
        action_count: AtomicUsize,
    }

    impl ComputerUseAdapter for FakeAdapter {
        fn surface(&self) -> ComputerUseSurface {
            self.surface
        }

        fn capabilities(&self) -> ComputerUseCapabilities {
            self.capabilities
        }

        fn observe(&self, _request: &ComputerUseRequest) -> Result<Observation, ComputerUseError> {
            self.observations
                .lock()
                .unwrap()
                .pop_front()
                .expect("test observation")
        }

        fn act(
            &self,
            _action: &ComputerUseAction,
            _expected_generation: u64,
        ) -> Result<StepExecution, ComputerUseError> {
            self.action_count.fetch_add(1, Ordering::SeqCst);
            self.executions
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or_else(|| Ok(execution("input sent")))
        }

        fn verify(
            &self,
            _criteria: &[String],
            _before: &Observation,
            _after: &Observation,
        ) -> Result<Verification, ComputerUseError> {
            self.verifications
                .lock()
                .unwrap()
                .pop_front()
                .expect("test verification")
        }
    }

    #[derive(Default)]
    struct RecordingEvents(Vec<ComputerUseRunState>);

    impl ComputerUseEventSink for RecordingEvents {
        fn state_changed(&mut self, state: ComputerUseRunState) {
            self.0.push(state);
        }
    }

    #[derive(Default)]
    struct TickClock(u64);

    impl ComputerUseClock for TickClock {
        fn now_ms(&mut self) -> u64 {
            self.0 += 1;
            self.0
        }
    }

    fn request() -> ComputerUseRequest {
        serde_json::from_value(json!({
            "objective": "点击提交并确认成功",
            "surface": "browser",
            "target": { "element": "submit" },
            "success_criteria": ["页面显示提交成功"]
        }))
        .unwrap()
    }

    fn observation(generation: u64, state: &str) -> Observation {
        Observation {
            generation,
            surface: ComputerUseSurface::Browser,
            surface_identity: "tab-1".into(),
            state: json!({ "state": state }),
            evidence: vec![state.into()],
        }
    }

    fn click() -> ComputerUseAction {
        ComputerUseAction {
            kind: ComputerUseActionKind::Click,
            target: "submit".into(),
            arguments: json!({}),
            risk: ComputerUseRiskClass::ReversibleLocal,
        }
    }

    fn drag() -> ComputerUseAction {
        ComputerUseAction {
            kind: ComputerUseActionKind::Drag,
            target: "slider".into(),
            arguments: json!({ "to": 80 }),
            risk: ComputerUseRiskClass::ReversibleLocal,
        }
    }

    fn execution(summary: &str) -> StepExecution {
        StepExecution {
            input_sent: true,
            summary: summary.into(),
            evidence: vec![summary.into()],
        }
    }

    fn verification(achieved: bool, visible_progress: bool, summary: &str) -> Verification {
        Verification {
            achieved,
            visible_progress,
            summary: summary.into(),
            evidence: vec![summary.into()],
        }
    }

    fn context() -> ComputerUseRunContext {
        ComputerUseRunContext {
            call_id: "cu-1".into(),
            provider_tool_call_id: Some("tool-call-1".into()),
        }
    }

    fn adapter(
        observations: Vec<Result<Observation, ComputerUseError>>,
        verifications: Vec<Result<Verification, ComputerUseError>>,
    ) -> FakeAdapter {
        FakeAdapter {
            surface: ComputerUseSurface::Browser,
            capabilities: ComputerUseCapabilities {
                click: true,
                ..ComputerUseCapabilities::default()
            },
            observations: Mutex::new(observations.into()),
            executions: Mutex::new(VecDeque::new()),
            verifications: Mutex::new(verifications.into()),
            action_count: AtomicUsize::new(0),
        }
    }

    #[tokio::test]
    async fn successful_input_without_verified_goal_is_a_failure() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(vec![Ok(Some(click())), Ok(None)].into()),
        };
        let adapter = adapter(
            vec![Ok(observation(1, "before")), Ok(observation(2, "after"))],
            vec![
                Ok(verification(false, false, "not yet")),
                Ok(verification(false, true, "changed but not complete")),
            ],
        );
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(result.stage, ComputerUseStage::Verification);
        assert!(!result.goal_achieved);
        assert_eq!(result.error.as_ref().unwrap().code, "verification_failed");
        assert_eq!(controller.adapter().action_count.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn verified_goal_is_the_only_success_path() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(vec![Ok(Some(click()))].into()),
        };
        let adapter = adapter(
            vec![Ok(observation(1, "before")), Ok(observation(2, "success"))],
            vec![
                Ok(verification(false, false, "not yet")),
                Ok(verification(true, true, "success visible")),
            ],
        );
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Succeeded);
        assert!(result.goal_achieved);
        assert_eq!(result.steps_completed, 1);
        assert_eq!(result.provider_tool_call_id.as_deref(), Some("tool-call-1"));
    }

    #[tokio::test]
    async fn unsupported_action_is_blocked_before_input() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(vec![Ok(Some(drag()))].into()),
        };
        let adapter = adapter(
            vec![Ok(observation(1, "before"))],
            vec![Ok(verification(false, false, "not yet"))],
        );
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(result.stage, ComputerUseStage::PolicyCheck);
        assert_eq!(result.error.as_ref().unwrap().code, "unsupported_action");
        assert_eq!(controller.adapter().action_count.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn stale_observation_is_reobserved_once_by_the_controller() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(vec![Ok(Some(click())), Ok(Some(click()))].into()),
        };
        let stale =
            ComputerUseError::recoverable("stale_observation", "surface changed before input");
        let adapter = adapter(
            vec![
                Ok(observation(1, "before")),
                Ok(observation(2, "refreshed")),
                Ok(observation(3, "success")),
            ],
            vec![
                Ok(verification(false, false, "not yet")),
                Ok(verification(true, true, "success visible")),
            ],
        );
        *adapter.executions.lock().unwrap() = vec![Err(stale), Ok(execution("input sent"))].into();
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Succeeded);
        assert_eq!(result.attempts, 2);
        assert_eq!(controller.adapter().action_count.load(Ordering::SeqCst), 2);
        assert_eq!(result.supervisor.replan_count, 1);
    }

    #[tokio::test]
    async fn repeated_no_progress_stops_before_a_third_input() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(
                vec![Ok(Some(click())), Ok(Some(click())), Ok(Some(click()))].into(),
            ),
        };
        let adapter = adapter(
            vec![
                Ok(observation(1, "same")),
                Ok(observation(2, "same")),
                Ok(observation(3, "same")),
            ],
            vec![
                Ok(verification(false, false, "not yet")),
                Ok(verification(false, false, "still same")),
                Ok(verification(false, false, "still same")),
            ],
        );
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Blocked);
        assert_eq!(result.error.as_ref().unwrap().code, "no_progress");
        assert_eq!(controller.adapter().action_count.load(Ordering::SeqCst), 2);
        assert_eq!(result.supervisor.no_progress_count, 2);
    }

    #[tokio::test]
    async fn adapter_errors_keep_retry_ownership_for_the_model_result() {
        let planner = FakePlanner {
            surface: ComputerUseSurface::Browser,
            actions: Mutex::new(vec![Ok(Some(click()))].into()),
        };
        let adapter = adapter(
            vec![Ok(observation(1, "before"))],
            vec![Ok(verification(false, false, "not yet"))],
        );
        *adapter.executions.lock().unwrap() = vec![Err(ComputerUseError::new(
            "target_not_found",
            "submit disappeared",
            true,
            ComputerUseRetryOwner::Model,
        ))]
        .into();
        let mut controller = ComputerUseController::new(
            planner,
            adapter,
            RecordingEvents::default(),
            TickClock::default(),
            crate::ComputerUseBudgets::default(),
        );

        let result = controller.run(&request(), context()).await;

        assert_eq!(result.status, ComputerUseTerminalStatus::Failed);
        assert_eq!(result.stage, ComputerUseStage::Execution);
        assert_eq!(
            result.error.as_ref().unwrap().retry_owner,
            ComputerUseRetryOwner::Model
        );
    }

    #[test]
    fn controller_contracts_are_exported_from_crate_root() {
        let context = crate::ComputerUseRunContext {
            call_id: "cu-root".into(),
            provider_tool_call_id: None,
        };
        fn accepts_planner<T: crate::ComputerUsePlanner>(_planner: &T) {}
        fn accepts_adapter<T: crate::ComputerUseAdapter>(_adapter: &T) {}

        let planner = FakePlanner::default();
        let adapter = adapter(
            vec![Ok(observation(1, "before"))],
            vec![Ok(verification(true, true, "done"))],
        );
        assert_eq!(context.call_id, "cu-root");
        accepts_planner(&planner);
        accepts_adapter(&adapter);
    }
}
