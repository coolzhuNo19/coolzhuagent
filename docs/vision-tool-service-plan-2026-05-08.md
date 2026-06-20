# Vision Tool Service 能力接口方案

日期：2026-05-08

## 背景

G1 验证显示 Qwen2.5-VL-3B 适合屏幕描述/OCR，ShowUI-2B 适合 point grounding，但当前 8GB VRAM 机器上两个模型同时常驻不稳定。为避免 Web GUI、Tooling、Computer Use 直接耦合具体模型，本轮建立统一 Vision Tool Service 能力接口。

## 范围

本轮开发范围：
- `ground_point`：输入截图与自然语言目标，返回 point、截图证据、backend、latency、confidence 或降级原因。
- `ground_bbox`：预留 bbox 输出结构；当前 ShowUI 只返回 point 时允许 `bbox=null`，必须给出 reason。
- `visual_action`：基于 grounding 结果生成 Computer Use dry-run 动作证据，真实 execute 保持关闭。

本轮只预留、不做并行联测：
- `describe`：保留能力接口，用于后续 Qwen/外部 VLM 描述/OCR 分流。
- `ocr`：保留能力接口，用于后续文本区域识别和屏幕文字证据。

## 技术选型

- 业务层只依赖 Vision Tool Service，不直接依赖 Qwen/ShowUI。
- 本地 ShowUI profile 作为短期 grounding 优先实现。
- Qwen profile 继续作为描述/OCR 能力来源，但本轮不参与 grounding/action 并行测试。
- 外部 OpenAI-compatible VLM agent 后续作为可选工具服务，用于本机资源不足或本地模型不可用时兜底。

## 风险评估

- ShowUI point-only 输出缺少 bbox/confidence：需要降级 confidence 与 reason，不得伪造 bbox。
- 复杂目标偏移：需要在 dry-run 证据中暴露 target、point、screenshot、backend，后续再加区域二次校验。
- 本地模型同跑不稳定：`REQ-VIS-005` 继续处理 profile 互斥、资源检测和启动失败提示。
- 外部 VLM 涉及隐私、成本和网络：必须作为显式配置的工具服务，默认不上传屏幕截图。

## TDD 验证计划

1. 为 Vision Tool Service 添加单测，先用固定 ShowUI-like 输出样例覆盖 `[x,y]`、JSON point、point-only confidence 降级。
2. 为 `visual_action` dry-run 添加证据断言：必须包含 screenshot、backend、target、point、execute_allowed=false。
3. 保持 `describe`/`ocr` 占位接口可枚举、可返回 `not_configured` 或 `reserved`，但不纳入本轮模型联测脚本。

## 落地结果

更新时间：2026-05-08

- `vision-service` 新增 `VisionToolService` 能力接口，`describe`/`ocr` 为 reserved，`ground_point`、`ground_bbox`、`visual_action` 为 available。
- point-only grounding 统一降级为低置信度，并返回 `point-only-grounding; bbox and model confidence unavailable`。
- Web API 新增 `/api/vision/tool-service/capabilities`，以及 `describe`/`ocr` reserved 端点；`ground-point`、`ground-bbox` 作为现有 grounding pipeline alias。
- `computer.visual_action` dry-run 和 semantic dispatch 均输出显式 evidence：screenshot、target、point、bbox、confidence、confidence_reason、backend、execute_allowed=false。
- 本轮仍不触发 `describe`/`ocr` 模型调用，不与 grounding/action 并行联测。
