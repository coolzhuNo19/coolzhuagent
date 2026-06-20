# 2026-05-05 P1 Visual Action Tool Dry Run

## Scope

推进 `REQ-TOOL-005` / `REQ-CU-002` 的低风险部分：把内视觉目标识别和 computer-use 动作计划组合成工具侧 dry-run，不开放真实鼠标执行。

## Implemented

- `computer.visual_action` 从普通 action-plan 分支拆出为组合 dry-run。
- 新增 `VisualActionRequest` / `VisualActionResponse`。
- `visual_action` 先调用 `run_vision_find_target` 获取截图、screen、grounding、backend trace。
- 获得 point 或 bbox 后，再生成 `ComputerActionPlanResponse`。
- 没有 grounding 时返回 `visual-grounding-missing`，不退回固定几何点。
- 后端不可达时返回 `visual-grounding-backend-error` 和 VLM backend trace。
- `execute=true` 继续拒绝，响应保留 `execute=false`、`executed=false` 和安全闸门说明。

## Verification

Passed:

- `rustfmt --edition 2021 modules\gui-web\packages\web-console\src\main.rs`
- `cargo check -p coolzhu-web-console --offline -q`
- `cargo test -p coolzhu-web-console visual_action_plan_uses_grounded_point_without_geometry_fallback --offline -- --nocapture`
- `cargo test -p coolzhu-web-console tools_catalog_exposes_core_plugins_skills_and_safe_actions --offline -- --nocapture`
- `cargo test -p coolzhu-web-console action_plan_covers_keyboard_and_scroll_dry_runs --offline -- --nocapture`
- `cargo test -p coolzhu-web-console semantic_dispatch_returns_structured_dry_run_plan --offline -- --nocapture`
- `node --check modules\gui-web\packages\web-console\src\app.js`

## Remaining Risk

- `use_model=true` 依赖本地 VLM/OpenAI-compatible 服务，真实命中率和延迟还需联调。
- 强视觉点击闭环仍未开放真实 execute，需后续人工确认、截图审计和失败恢复。
- 浏览器内/Windows 应用内操作场景仍需 E2E 或靶场扩展。
