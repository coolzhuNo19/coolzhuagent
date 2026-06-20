# Vision Tool Service 能力接口落地

时间：2026-05-08 07:35-07:48 +08:00

## 关联需求

- `REQ-VIS-006`：统一 Vision Tool Service 能力接口
- `REQ-VIS-004`：视觉 point/bbox/confidence 协议
- `REQ-CU-002`：强视觉识别点击
- `REQ-TOOL-005`：内视觉目标点击工具化

## 实施内容

1. 新增统一 Vision Tool Service 能力层。
   - 在 `vision-service` 中新增 `VisionToolCapability`、`VisionToolCapabilityStatus`、`VisionToolService`。
   - `describe`、`ocr` 标记为 reserved，本轮不触发模型调用。
   - `ground_point`、`ground_bbox`、`visual_action` 标记为 available。

2. 补 point-only grounding 降级策略。
   - ShowUI `[x,y]` 仅返回 point 时，统一补 `confidence=0.35`。
   - 同时返回 `point-only-grounding; bbox and model confidence unavailable`，避免伪造 bbox 或高置信度。

3. Web API 暴露能力接口。
   - 新增 `/api/vision/tool-service/capabilities`。
   - 新增 `/api/vision/tool-service/describe` 和 `/api/vision/tool-service/ocr` reserved 端点。
   - 新增 `/api/vision/tool-service/ground-point` 和 `/api/vision/tool-service/ground-bbox`，作为现有 grounding pipeline alias。

4. 补齐 `computer.visual_action` evidence。
   - `VisualActionResponse` 新增 `execute_allowed=false` 和 `evidence`。
   - evidence 包含 screenshot、target、point、bbox、confidence、confidence_reason、backend。
   - `/api/tools/dispatch` 对 `visual_action` 走同一条 `run_visual_action_dry_run` 链路，不再退回普通固定几何 action plan。

## 验证

日志目录：`tmp/logs/vision-tool-service-20260508-0001`

- 红测：
  - `vision-service-red.log`
  - `web-console-red.log`
- 目标测试转绿：
  - `vision-service-green-target.log`
  - `web-console-green-target.log`
- 全量验证：
  - `cargo test -p coolzhu-vision-service --offline`：18 passed
  - `cargo test -p coolzhu-web-console --offline`：126 passed
  - `cargo check -p coolzhu-vision-service --offline`：通过
  - `cargo check -p coolzhu-web-console --offline`：通过

## 后续

`REQ-VIS-006` 本轮范围已完成。下一步继续推进 `REQ-VIS-004`、`REQ-CU-002`、`REQ-TOOL-005`：基于统一 service 的 grounding evidence 做 bbox/confidence 策略增强、命中率证据沉淀和 visual_action dry-run 矩阵扩展。
