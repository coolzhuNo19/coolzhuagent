# Computer Use 审计与权限闸门

时间：2026-05-08 08:05-08:17 +08:00

## 关联需求

- `REQ-CU-005`：执行审计与权限
- `REQ-TOOL-002`：dry-run/execute 策略统一
- `REQ-TOOL-005`：内视觉目标点击工具化
- `REQ-TOOL-006`：Computer Use 动作工具细分

## 背景

第三梯队后续真实输入能力需要先具备可审计的权限闸门。当前仍按安全策略保持真实鼠标/键盘输入禁用，本轮先补 dry-run 响应中的审计记录，保证前端、语义 dispatch 和后续 execute gate 都能读取统一字段。

## 实施内容

1. TDD 红灯
   - 新增 `action_plan_includes_permission_audit_gate`，要求 `ComputerActionPlanResponse` 输出 `audit`。
   - 扩展 `visual_action_dry_run_exposes_evidence_chain`，要求视觉动作审计记录携带截图路径。
   - 扩展 `semantic_dispatch_visual_action_includes_grounding_evidence`，要求 dispatch plan 顶层输出审计记录。
   - 红灯结果：`ComputerActionPlanResponse`、`VisualActionResponse`、`ToolDispatchPlan` 均缺少 `audit` 字段，符合预期。

2. 实现
   - 新增 `ComputerUseAuditRecord`：
     - `audit_id`
     - `mode`
     - `execute_requested`
     - `execute_allowed`
     - `executed`
     - `requires_human_confirmation`
     - `requires_screenshot_evidence`
     - `screenshot_path`
     - `permission_gate`
     - `log_path`
   - `run_action_plan` 统一输出 dry-run 审计记录，明确真实输入仍不允许。
   - `run_visual_action_dry_run` 将本轮截图路径写入审计记录，保留视觉证据链。
   - `build_semantic_dispatch_plan` 从 visual/action plan 回填顶层 audit，便于前端和 LLM tool summary 读取。
   - `ToolRunResponse` 增加可选 `audit`，从工具输出中提取顶层或 dispatch plan 审计记录。
   - 安全闸门文案收敛为：`execute=false; human confirmation and screenshot evidence required before real input`。

## 验证

日志目录：`tmp/logs`

- 红灯：`red-cu005-audit-20260508.log`
- 局部转绿：`green-cu005-audit-filter-20260508.log`
- 格式化：
  - `fmt-web-console-cu005-audit-20260508.log`
  - `fmt-web-console-cu005-audit-fix-20260508.log`
- 全量测试：
  - 首轮：`test-web-console-cu005-audit-20260508.log`，1 个旧断言需随安全闸门文案更新
  - 复跑：`test-web-console-cu005-audit-rerun-20260508.log`
  - `cargo test -p coolzhu-web-console --offline`：129 passed
- 静态检查：`check-web-console-cu005-audit-20260508.log`
  - `cargo check -p coolzhu-web-console --offline`：通过

## 结论

`REQ-CU-005` 代码侧已完成 dry-run 审计和权限字段，状态更新为 `测试中`。真实 execute 仍未开放，后续需要在交互安全验收中验证显式授权、截图审计落盘和失败恢复。
