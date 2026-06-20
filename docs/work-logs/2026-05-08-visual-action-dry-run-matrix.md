# visual_action/drag_select dry-run 矩阵推进

时间：2026-05-08 07:56-08:05 +08:00

## 关联需求

- `REQ-CU-002`：强视觉识别点击
- `REQ-TOOL-005`：内视觉目标点击工具化
- `REQ-CU-008`：左键拖拽区域框选闭环

## 背景

`REQ-VIS-006` 已统一 Vision Tool Service，`REQ-VIS-004` 已补齐 point/bbox/confidence 与多候选解析。本轮继续按需求管理文档优先级推进视觉动作 dry-run 矩阵，重点补齐 bbox grounding 到 `drag_select` 动作计划的闭环，避免语义调度仍使用固定几何坐标。

## 实施内容

1. TDD 红灯用例
   - 新增 `visual_action_drag_select_uses_grounded_bbox_for_path`：验证 `computer.visual_action` 收到 bbox 后能生成 `drag_select` 起点、终点、ROI 和拖拽 path。
   - 新增 `semantic_dispatch_drag_select_prefers_visual_bbox_evidence`：验证 `/api/tools/dispatch` 的语义拖拽在存在 `raw_response`/截图证据时优先使用视觉 bbox，不走固定 start/end。
   - 红灯结果：语义 dispatch 仍未挂载 `visual_action` evidence，断言 `plan.visual_action.is_some()` 失败，符合预期。

2. 实现调整
   - `build_semantic_dispatch_plan` 新增视觉输入判定：当动作是 `visual_action`，或 click/right-click/double-click/context-menu/drag-select 且请求带 `raw_response` 或 `use_model=true` 时，先执行 `run_visual_action_dry_run`。
   - 原工具 ID 保持不变，例如 `drag_select` 仍返回 `computer.drag_select`，但 `action_plan` 来自视觉 grounding 结果。
   - `requires_visual_grounding` 在实际使用视觉证据链时置为 true，方便前端和后续安全闸门识别。

3. 需求状态
   - `REQ-CU-002` 从 `开发中` 推进到 `测试中`：代码侧已禁止视觉输入场景回退固定几何，剩余真实 ShowUI 命中率复测。
   - `REQ-TOOL-005` 仍为 `测试中`：dry-run 和证据链增强完成，真实 execute gate 待安全验收。
   - `REQ-CU-008` 仍为 `测试中`：bbox -> drag path 自动化闭环完成，真实执行和真实模型命中率待后续。

## 验证

日志目录：`tmp/logs`

- 红灯：`red-semantic-drag-select-20260508.log`
- 局部转绿：`green-drag-select-filter-20260508.log`
- 格式化：`fmt-web-console-visual-drag-20260508.log`
- 全量测试：`test-web-console-visual-drag-20260508.log`
  - `cargo test -p coolzhu-web-console --offline`
  - 128 passed
- 静态检查：`check-web-console-visual-drag-20260508.log`
  - `cargo check -p coolzhu-web-console --offline`
  - 通过

## 风险与后续

- 本轮仍保持真实输入禁用，未开启鼠标真实 execute。
- `describe`/`ocr` 仍按用户确认只保留接口，不参与并行联测。
- 下一步继续第三梯队：优先补 `REQ-CU-001/005/006/007/008` 的安全闸门与真实执行审计方案，再推进浏览器/Windows 场景 E2E。
