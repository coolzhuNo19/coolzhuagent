use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseSurface {
    #[default]
    Auto,
    Desktop,
    Browser,
}

impl ComputerUseSurface {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Desktop => "desktop",
            Self::Browser => "browser",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComputerUseTarget {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub application: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub window: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub element: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComputerUseRequest {
    pub objective: String,
    #[serde(default)]
    pub surface: ComputerUseSurface,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<ComputerUseTarget>,
    pub success_criteria: Vec<String>,
    #[serde(default)]
    pub constraints: Vec<String>,
}

impl ComputerUseRequest {
    pub fn validate(&self) -> Result<(), ComputerUseError> {
        if self.objective.trim().is_empty() {
            return Err(ComputerUseError::blocked(
                "invalid_objective",
                "objective is empty",
                ComputerUseRetryOwner::Model,
            ));
        }
        if self.success_criteria.is_empty()
            || self
                .success_criteria
                .iter()
                .any(|criterion| criterion.trim().is_empty())
        {
            return Err(ComputerUseError::blocked(
                "invalid_success_criteria",
                "at least one non-empty success criterion is required",
                ComputerUseRetryOwner::Model,
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseRunState {
    Requested,
    Classified,
    Observing,
    Planning,
    PolicyCheck,
    AwaitingApproval,
    Executing,
    Verifying,
    Succeeded,
    Failed,
    Blocked,
    Cancelled,
    TimedOut,
}

impl ComputerUseRunState {
    #[must_use]
    pub const fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::Blocked | Self::Cancelled | Self::TimedOut
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseTerminalStatus {
    Succeeded,
    Failed,
    Blocked,
    Cancelled,
    TimedOut,
}

impl ComputerUseTerminalStatus {
    #[must_use]
    pub const fn is_error(self) -> bool {
        !matches!(self, Self::Succeeded)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseStage {
    IntentGuard,
    Classification,
    Observation,
    Planning,
    PolicyCheck,
    Approval,
    Execution,
    Verification,
    Supervisor,
    Terminal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseRetryOwner {
    Controller,
    Model,
    User,
    System,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComputerUseError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    pub retry_owner: ComputerUseRetryOwner,
}

impl ComputerUseError {
    #[must_use]
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        retryable: bool,
        retry_owner: ComputerUseRetryOwner,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
            retry_owner,
        }
    }

    #[must_use]
    pub fn blocked(
        code: impl Into<String>,
        message: impl Into<String>,
        retry_owner: ComputerUseRetryOwner,
    ) -> Self {
        Self::new(code, message, false, retry_owner)
    }

    #[must_use]
    pub fn recoverable(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(code, message, true, ComputerUseRetryOwner::Controller)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComputerUseBudgets {
    pub max_actions: usize,
    pub max_replans: usize,
    pub max_same_signature: usize,
    pub max_no_progress_steps: usize,
    pub timeout_ms: u64,
    pub max_calls_per_turn: usize,
}

impl Default for ComputerUseBudgets {
    fn default() -> Self {
        Self {
            max_actions: 12,
            max_replans: 2,
            max_same_signature: 2,
            max_no_progress_steps: 2,
            timeout_ms: 120_000,
            max_calls_per_turn: 2,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComputerUseCapabilities {
    pub navigate: bool,
    pub click: bool,
    pub double_click: bool,
    pub text_input: bool,
    pub select: bool,
    pub check: bool,
    pub submit: bool,
    pub scroll: bool,
    pub history: bool,
    pub drag: bool,
    pub slider_drag: bool,
    pub key_combinations: bool,
    pub multiple_tabs: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseActionKind {
    Navigate,
    Click,
    DoubleClick,
    TextInput,
    Select,
    Check,
    Submit,
    Scroll,
    HistoryBack,
    HistoryForward,
    Drag,
    SliderDrag,
    KeyCombination,
    OpenTab,
    ActivateTab,
    CloseTab,
}

impl ComputerUseCapabilities {
    #[must_use]
    pub const fn supports(self, action: ComputerUseActionKind) -> bool {
        match action {
            ComputerUseActionKind::Navigate => self.navigate,
            ComputerUseActionKind::Click => self.click,
            ComputerUseActionKind::DoubleClick => self.double_click,
            ComputerUseActionKind::TextInput => self.text_input,
            ComputerUseActionKind::Select => self.select,
            ComputerUseActionKind::Check => self.check,
            ComputerUseActionKind::Submit => self.submit,
            ComputerUseActionKind::Scroll => self.scroll,
            ComputerUseActionKind::HistoryBack | ComputerUseActionKind::HistoryForward => {
                self.history
            }
            ComputerUseActionKind::Drag => self.drag,
            ComputerUseActionKind::SliderDrag => self.slider_drag,
            ComputerUseActionKind::KeyCombination => self.key_combinations,
            ComputerUseActionKind::OpenTab
            | ComputerUseActionKind::ActivateTab
            | ComputerUseActionKind::CloseTab => self.multiple_tabs,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseRiskClass {
    Observe,
    ReversibleLocal,
    Stateful,
    Sensitive,
    ForbiddenOrAmbiguous,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ComputerUseAction {
    pub kind: ComputerUseActionKind,
    pub target: String,
    #[serde(default)]
    pub arguments: Value,
    pub risk: ComputerUseRiskClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Observation {
    pub generation: u64,
    pub surface: ComputerUseSurface,
    pub surface_identity: String,
    #[serde(default)]
    pub state: Value,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StepExecution {
    pub input_sent: bool,
    pub summary: String,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Verification {
    pub achieved: bool,
    pub visible_progress: bool,
    pub summary: String,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupervisorSnapshot {
    pub circuit_open: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub action_count: usize,
    pub replan_count: usize,
    pub no_progress_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComputerUseResult {
    pub call_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_tool_call_id: Option<String>,
    pub status: ComputerUseTerminalStatus,
    pub stage: ComputerUseStage,
    pub goal_achieved: bool,
    pub surface: ComputerUseSurface,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<ComputerUseError>,
    pub attempts: usize,
    pub steps_completed: usize,
    #[serde(default)]
    pub evidence: Vec<String>,
    pub supervisor: SupervisorSnapshot,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request_json() -> serde_json::Value {
        serde_json::json!({
            "objective": "打开记事本",
            "surface": "desktop",
            "target": { "application": "notepad" },
            "success_criteria": ["记事本窗口可见"],
            "constraints": ["不要关闭已有窗口"]
        })
    }

    #[test]
    fn task_request_accepts_task_level_contract() {
        let request: ComputerUseRequest =
            serde_json::from_value(valid_request_json()).expect("valid task request");

        assert_eq!(request.surface, ComputerUseSurface::Desktop);
        assert_eq!(
            request
                .target
                .as_ref()
                .and_then(|target| target.application.as_deref()),
            Some("notepad")
        );
        assert!(request.validate().is_ok());
    }

    #[test]
    fn task_request_rejects_coordinates_and_requires_success_criteria() {
        let request: ComputerUseRequest = serde_json::from_value(serde_json::json!({
            "objective": "打开记事本",
            "surface": "desktop",
            "success_criteria": []
        }))
        .expect("schema is valid before semantic validation");
        assert_eq!(
            request
                .validate()
                .expect_err("empty criteria must fail")
                .code,
            "invalid_success_criteria"
        );

        assert!(
            serde_json::from_value::<ComputerUseRequest>(serde_json::json!({
                "objective": "点击",
                "x": 10,
                "y": 20,
                "success_criteria": ["窗口已打开"]
            }))
            .is_err()
        );
    }

    #[test]
    fn task_request_rejects_empty_objective_and_target_extensions() {
        let request: ComputerUseRequest = serde_json::from_value(serde_json::json!({
            "objective": "   ",
            "success_criteria": ["完成"]
        }))
        .expect("schema is valid before semantic validation");
        assert_eq!(
            request
                .validate()
                .expect_err("empty objective must fail")
                .code,
            "invalid_objective"
        );

        let mut json = valid_request_json();
        json["target"]["coordinates"] = serde_json::json!([1, 2]);
        assert!(serde_json::from_value::<ComputerUseRequest>(json).is_err());
    }

    #[test]
    fn awaiting_approval_is_running_not_terminal() {
        assert!(!ComputerUseRunState::AwaitingApproval.is_terminal());
        assert!(ComputerUseRunState::Succeeded.is_terminal());
        assert!(ComputerUseRunState::Failed.is_terminal());
        assert!(ComputerUseRunState::Blocked.is_terminal());
        assert!(ComputerUseRunState::Cancelled.is_terminal());
        assert!(ComputerUseRunState::TimedOut.is_terminal());
    }

    #[test]
    fn terminal_status_serializes_as_stable_snake_case() {
        assert_eq!(
            serde_json::to_string(&ComputerUseTerminalStatus::TimedOut).unwrap(),
            "\"timed_out\""
        );
        assert_eq!(
            serde_json::to_string(&ComputerUseTerminalStatus::Succeeded).unwrap(),
            "\"succeeded\""
        );
    }

    #[test]
    fn default_budgets_match_runtime_safety_contract() {
        let budgets = ComputerUseBudgets::default();
        assert_eq!(budgets.max_actions, 12);
        assert_eq!(budgets.max_replans, 2);
        assert_eq!(budgets.max_same_signature, 2);
        assert_eq!(budgets.max_no_progress_steps, 2);
        assert_eq!(budgets.timeout_ms, 120_000);
        assert_eq!(budgets.max_calls_per_turn, 2);
    }

    #[test]
    fn multiple_tab_capability_gates_all_tab_lifecycle_actions() {
        let disabled = ComputerUseCapabilities::default();
        for action in [
            ComputerUseActionKind::OpenTab,
            ComputerUseActionKind::ActivateTab,
            ComputerUseActionKind::CloseTab,
        ] {
            assert!(!disabled.supports(action));
        }

        let enabled = ComputerUseCapabilities {
            multiple_tabs: true,
            ..ComputerUseCapabilities::default()
        };
        for action in [
            ComputerUseActionKind::OpenTab,
            ComputerUseActionKind::ActivateTab,
            ComputerUseActionKind::CloseTab,
        ] {
            assert!(enabled.supports(action));
        }
    }

    #[test]
    fn contracts_are_exported_from_crate_root() {
        let request: crate::ComputerUseRequest =
            serde_json::from_value(valid_request_json()).expect("root export");
        assert_eq!(request.surface, crate::ComputerUseSurface::Desktop);
    }
}
