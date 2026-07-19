use std::time::Duration;

use computer_use::{
    ComputerUseAction, ComputerUseActionKind, ComputerUseError, ComputerUseRetryOwner, Observation,
    StepExecution, Verification,
};
use serde_json::{json, Value as JsonValue};
use uia_resolver::{snapshot_foreground_window, UiaElementSnapshot, UiaError};

use crate::computer_use_adapters::{DesktopBridge, DesktopSnapshot};

const INPUT_TIMEOUT: Duration = Duration::from_secs(8);
const UIA_ELEMENT_LIMIT: usize = 500;

#[derive(Debug, Clone, Default)]
pub(crate) struct DesktopNativeBridge;

impl DesktopNativeBridge {
    pub(crate) fn preflight() -> Result<(), ComputerUseError> {
        let input = computer_use::input::preflight_report();
        if !input.ready {
            return Err(backend_error(format!(
                "desktop input backend is not ready: {}",
                input.detail
            )));
        }
        snapshot_foreground_window(1).map_err(map_uia_error)?;
        Ok(())
    }
}

impl DesktopBridge for DesktopNativeBridge {
    fn snapshot(
        &self,
        request: &computer_use::ComputerUseRequest,
    ) -> Result<DesktopSnapshot, ComputerUseError> {
        let target = request.target.as_ref();
        let application = target.and_then(|target| target.application.as_deref());
        let window = target.and_then(|target| target.window.as_deref());
        if uia_resolver::focus_window_by_hint(application, window, Some(&request.objective))
            .map_err(map_uia_error)?
            .is_some()
        {
            std::thread::sleep(Duration::from_millis(120));
        }
        let snapshot = snapshot_foreground_window(UIA_ELEMENT_LIMIT).map_err(map_uia_error)?;
        let webview2_overlay = snapshot.elements.iter().any(|element| {
            element.class_name.as_deref().is_some_and(|class_name| {
                let class_name = class_name.to_ascii_lowercase();
                class_name.contains("webview2")
                    || class_name.contains("chrome_renderwidgethosthwnd")
            })
        });
        let elements = snapshot
            .elements
            .iter()
            .map(element_json)
            .collect::<Vec<_>>();
        let window_id = format!("hwnd-{:x}", snapshot.native_window_handle);
        Ok(DesktopSnapshot {
            window_id: window_id.clone(),
            process_id: snapshot.process_id,
            window_rect: [
                snapshot.bounding_rect.x,
                snapshot.bounding_rect.y,
                snapshot.bounding_rect.width,
                snapshot.bounding_rect.height,
            ],
            dpi: snapshot.dpi,
            webview2_overlay,
            state: json!({
                "window": {
                    "reference": format!("uia-window-{:x}", snapshot.native_window_handle),
                    "name": snapshot.name,
                    "process_id": snapshot.process_id,
                    "native_window_handle": snapshot.native_window_handle,
                },
                "elements": elements,
            }),
            evidence: vec![format!(
                "uia_snapshot:{window_id}:elements={}",
                snapshot.elements.len()
            )],
        })
    }

    fn execute(
        &self,
        action: &ComputerUseAction,
        expected: &DesktopSnapshot,
    ) -> Result<StepExecution, ComputerUseError> {
        let element = find_element(&expected.state, &action.target)?;
        if !element
            .get("enabled")
            .and_then(JsonValue::as_bool)
            .unwrap_or(false)
        {
            return Err(blocked("target_disabled", "target element is disabled"));
        }
        if element
            .get("offscreen")
            .and_then(JsonValue::as_bool)
            .unwrap_or(true)
        {
            return Err(blocked("target_offscreen", "target element is offscreen"));
        }
        let rect = rect_from_element(element)?;
        let x = rect[0].saturating_add(rect[2] / 2);
        let y = rect[1].saturating_add(rect[3] / 2);
        let native_window_handle = expected
            .state
            .pointer("/window/native_window_handle")
            .and_then(JsonValue::as_i64)
            .and_then(|value| isize::try_from(value).ok())
            .ok_or_else(|| stale("foreground window identity is missing"))?;
        uia_resolver::focus_window(native_window_handle).map_err(map_uia_error)?;

        match action.kind {
            ComputerUseActionKind::Click => {
                computer_use::input::click_point(x, y, 1, INPUT_TIMEOUT).map_err(input_error)?;
            }
            ComputerUseActionKind::DoubleClick => {
                computer_use::input::click_point(x, y, 2, INPUT_TIMEOUT).map_err(input_error)?;
            }
            ComputerUseActionKind::TextInput => {
                let control_type = element
                    .get("control_type")
                    .and_then(JsonValue::as_str)
                    .unwrap_or("");
                if !matches!(control_type, "Edit" | "Document") {
                    return Err(blocked(
                        "target_not_editable",
                        "text input requires an Edit or Document UIA control",
                    ));
                }
                let text = action
                    .arguments
                    .get("text")
                    .and_then(JsonValue::as_str)
                    .filter(|text| !text.is_empty() && text.len() <= 4_000)
                    .ok_or_else(|| blocked("invalid_text", "text input is empty or too long"))?;
                computer_use::input::click_point(x, y, 1, INPUT_TIMEOUT).map_err(input_error)?;
                computer_use::input::type_text(text, INPUT_TIMEOUT).map_err(input_error)?;
            }
            ComputerUseActionKind::Scroll => {
                let direction = action
                    .arguments
                    .get("direction")
                    .and_then(JsonValue::as_str)
                    .unwrap_or("down");
                let amount = action
                    .arguments
                    .get("amount")
                    .and_then(JsonValue::as_i64)
                    .unwrap_or(1)
                    .clamp(1, 5) as i32;
                let sign = if matches!(direction, "up" | "left") {
                    1
                } else {
                    -1
                };
                computer_use::input::click_point(x, y, 1, INPUT_TIMEOUT).map_err(input_error)?;
                computer_use::input::scroll_wheel(sign * amount * 120, INPUT_TIMEOUT)
                    .map_err(input_error)?;
            }
            ComputerUseActionKind::KeyCombination => {
                let keys = action
                    .arguments
                    .get("keys")
                    .and_then(JsonValue::as_array)
                    .ok_or_else(|| blocked("invalid_keys", "keys array is missing"))?;
                let virtual_keys = keys
                    .iter()
                    .map(|key| key.as_str().and_then(virtual_key))
                    .collect::<Option<Vec<_>>>()
                    .ok_or_else(|| blocked("invalid_keys", "key combination is not allowlisted"))?;
                computer_use::input::send_virtual_key_combo(&virtual_keys, INPUT_TIMEOUT)
                    .map_err(input_error)?;
            }
            _ => {
                return Err(blocked(
                    "unsupported_action",
                    "desktop bridge does not implement the requested action",
                ));
            }
        }
        Ok(StepExecution {
            input_sent: true,
            summary: format!("desktop {:?} sent to {}", action.kind, action.target),
            evidence: vec![format!("sendinput:{:?}:{}", action.kind, action.target)],
        })
    }

    fn verify(
        &self,
        criteria: &[String],
        before: &Observation,
        after: &Observation,
    ) -> Result<Verification, ComputerUseError> {
        let visible_progress = before.state != after.state || before.evidence != after.evidence;
        let corpus = after.state.to_string().to_lowercase();
        let achieved = !criteria.is_empty()
            && criteria
                .iter()
                .all(|criterion| criterion_visible(criterion, &corpus));
        Ok(Verification {
            achieved,
            visible_progress,
            summary: if achieved {
                "desktop success criteria are visible in the fresh UIA snapshot".to_string()
            } else if visible_progress {
                "desktop UI changed but success criteria are not all visible".to_string()
            } else {
                "desktop UIA snapshot shows no visible progress".to_string()
            },
            evidence: after.evidence.clone(),
        })
    }
}

fn element_json(element: &UiaElementSnapshot) -> JsonValue {
    json!({
        "reference": element.reference,
        "name": element.name,
        "automation_id": element.automation_id,
        "class_name": element.class_name,
        "control_type": element.control_type,
        "value": element.value,
        "rect": [
            element.bounding_rect.x,
            element.bounding_rect.y,
            element.bounding_rect.width,
            element.bounding_rect.height,
        ],
        "offscreen": element.is_offscreen,
        "enabled": element.is_enabled,
    })
}

fn find_element<'a>(
    state: &'a JsonValue,
    reference: &str,
) -> Result<&'a JsonValue, ComputerUseError> {
    let matches = state
        .get("elements")
        .and_then(JsonValue::as_array)
        .into_iter()
        .flatten()
        .filter(|element| element.get("reference").and_then(JsonValue::as_str) == Some(reference))
        .collect::<Vec<_>>();
    match matches.as_slice() {
        [element] => Ok(*element),
        [] => Err(blocked(
            "target_not_found",
            "UIA reference is not present in the expected snapshot",
        )),
        _ => Err(blocked(
            "target_ambiguous",
            "UIA reference is not unique in the expected snapshot",
        )),
    }
}

fn rect_from_element(element: &JsonValue) -> Result<[i32; 4], ComputerUseError> {
    let values = element
        .get("rect")
        .and_then(JsonValue::as_array)
        .filter(|values| values.len() == 4)
        .ok_or_else(|| stale("UIA target rectangle is missing"))?;
    let mut rect = [0i32; 4];
    for (index, value) in values.iter().enumerate() {
        rect[index] = value
            .as_i64()
            .and_then(|value| i32::try_from(value).ok())
            .ok_or_else(|| stale("UIA target rectangle is invalid"))?;
    }
    if rect[2] <= 0 || rect[3] <= 0 {
        return Err(blocked(
            "target_offscreen",
            "UIA target has no visible bounds",
        ));
    }
    Ok(rect)
}

fn criterion_visible(criterion: &str, corpus: &str) -> bool {
    let normalized = criterion.trim().to_lowercase();
    if normalized.len() >= 4 && corpus.contains(&normalized) {
        return true;
    }
    let tokens = normalized
        .split(|character: char| {
            !character.is_alphanumeric() && character != '-' && character != '_'
        })
        .filter(|token| token.len() >= 4)
        .filter(|token| {
            !matches!(
                *token,
                "visible"
                    | "result"
                    | "success"
                    | "window"
                    | "desktop"
                    | "shows"
                    | "uia"
                    | "element"
                    | "field"
                    | "input"
                    | "value"
                    | "text"
                    | "document"
                    | "edit"
                    | "contains"
                    | "contain"
                    | "记事本"
                    | "文本区域"
                    | "文本编辑区域"
                    | "输入框"
                    | "文本"
                    | "包含"
            )
        })
        .collect::<Vec<_>>();
    let evidence_tokens = tokens
        .iter()
        .copied()
        .filter(|token| is_strong_evidence_token(token))
        .collect::<Vec<_>>();
    if !evidence_tokens.is_empty() {
        return evidence_tokens.iter().all(|token| corpus.contains(*token));
    }
    !tokens.is_empty() && tokens.iter().all(|token| corpus.contains(*token))
}

fn is_strong_evidence_token(token: &str) -> bool {
    let has_digit = token.chars().any(|character| character.is_ascii_digit());
    let has_ascii_alpha = token
        .chars()
        .any(|character| character.is_ascii_alphabetic());
    let has_separator = token.contains('-') || token.contains('_');
    token.starts_with("coolzhu-")
        || (token.len() >= 12 && has_digit && has_ascii_alpha && has_separator)
        || (token.len() >= 24 && has_digit && has_ascii_alpha)
}

fn virtual_key(value: &str) -> Option<u8> {
    Some(match value.to_ascii_lowercase().as_str() {
        "ctrl" => 0x11,
        "shift" => 0x10,
        "alt" => 0x12,
        "enter" => 0x0D,
        "escape" => 0x1B,
        "tab" => 0x09,
        "home" => 0x24,
        "end" => 0x23,
        "a" => 0x41,
        "c" => 0x43,
        "l" => 0x4C,
        "v" => 0x56,
        "x" => 0x58,
        "y" => 0x59,
        "z" => 0x5A,
        _ => return None,
    })
}

fn map_uia_error(error: UiaError) -> ComputerUseError {
    match error {
        UiaError::ElementNotFound => blocked("target_not_found", "UIA target was not found"),
        UiaError::ElementAmbiguous => blocked("target_ambiguous", "UIA target is ambiguous"),
        UiaError::UnsupportedPlatform => backend_error("desktop bridge requires Windows"),
        UiaError::ComInitFailed(message) | UiaError::QueryError(message) => backend_error(message),
    }
}

fn input_error(message: String) -> ComputerUseError {
    ComputerUseError::new("input_failed", message, true, ComputerUseRetryOwner::System)
}

fn stale(message: impl Into<String>) -> ComputerUseError {
    ComputerUseError::recoverable("stale_observation", message)
}

fn blocked(code: &'static str, message: impl Into<String>) -> ComputerUseError {
    ComputerUseError::blocked(code, message, ComputerUseRetryOwner::Model)
}

fn backend_error(message: impl Into<String>) -> ComputerUseError {
    ComputerUseError::new(
        "backend_unavailable",
        message,
        true,
        ComputerUseRetryOwner::System,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_bridge_requires_one_enabled_visible_reference() {
        let state = json!({
            "elements": [{"reference":"uia-1","enabled":true,"offscreen":false,"rect":[1,2,30,40]}]
        });
        assert!(find_element(&state, "uia-1").is_ok());
        assert_eq!(
            find_element(&state, "uia-2").unwrap_err().code,
            "target_not_found"
        );
    }

    #[test]
    fn desktop_verifier_uses_fresh_visible_value_evidence() {
        let bridge = DesktopNativeBridge;
        let before = Observation {
            generation: 1,
            surface: computer_use::ComputerUseSurface::Desktop,
            surface_identity: "desktop:1".into(),
            state: json!({"desktop":{"elements":[]}}),
            evidence: vec!["before".into()],
        };
        let after = Observation {
            generation: 2,
            surface: computer_use::ComputerUseSurface::Desktop,
            surface_identity: "desktop:1".into(),
            state: json!({"desktop":{"elements":[{"value":"COOLZHU-CU-E2E-20260629"}]}}),
            evidence: vec!["after".into()],
        };
        let verification = bridge
            .verify(
                &["COOLZHU-CU-E2E-20260629 is visible".into()],
                &before,
                &after,
            )
            .unwrap();
        assert!(verification.achieved);
        assert!(verification.visible_progress);
    }

    #[test]
    fn desktop_criterion_requires_marker_not_uia_field_name() {
        let corpus_without_marker = json!({
            "elements": [
                {"control_type": "Document", "value": "", "text": ""}
            ]
        })
        .to_string()
        .to_lowercase();
        let corpus_with_marker = json!({
            "elements": [
                {
                    "control_type": "Document",
                    "value": "COOLZHU-DESKTOP-E2E-91ae1b92738c",
                    "text": "COOLZHU-DESKTOP-E2E-91ae1b92738c"
                }
            ]
        })
        .to_string()
        .to_lowercase();
        let criterion = "记事本文本区域 value 包含 COOLZHU-DESKTOP-E2E-91ae1b92738c";

        assert!(!criterion_visible(criterion, &corpus_without_marker));
        assert!(criterion_visible(criterion, &corpus_with_marker));
    }
}
