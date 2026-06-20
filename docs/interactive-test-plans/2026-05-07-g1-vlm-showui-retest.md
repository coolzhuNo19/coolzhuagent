# G1 本地 VLM/ShowUI 交互验证记录

记录时间：2026-05-07 23:58 +08:00

## 目标

闭环 `REQ-VIS-001` 的真实本地模型交互验证：
- Qwen2.5-VL-3B 用于 `describe-screen` / OCR / 屏幕理解。
- ShowUI-2B 用于 `find-target` / point grounding。
- 验证 `use_model=true` 时项目 Web API 能返回 backend trace、截图证据和可解析 grounding。

## 环境

- Web API：`http://127.0.0.1:8765`
- Qwen base_url：`http://127.0.0.1:8001/v1`
- ShowUI base_url：`http://127.0.0.1:8000/v1`
- GPU：NVIDIA GeForce RTX 3070 Ti Laptop GPU，8GB VRAM
- Windows pagefile：`C:\pagefile.sys` 已启用，初始 8192MB，最大 12288MB
- Codex 当前非管理员权限，不能直接扩展 pagefile；扩展 pagefile 需要管理员执行，通常还需要重启后完全生效。

## 过程与结果

### Qwen 描述/OCR

日志目录：`tmp/logs/g1-vlm-interaction-20260507-2331`

- `vlm_chat_completions=PASS`
- `project_describe_screen=PASS`
- 截图证据：`C:\Users\zhupu\.claw\desktop-capture\desktop-latest.png`
- `project_find_target=PASS`，但 `grounding=null`，没有 point/bbox/confidence。

结论：Qwen 适合屏幕描述/OCR，但不适合当前 ShowUI 风格 `[x,y]` grounding 验收。

### ShowUI 与 Qwen 同跑

日志目录：`tmp/logs/g1-showui-virtual-memory-20260507-2340`

- Qwen 运行时端口：`127.0.0.1:8001`
- ShowUI 首次启动：`status=exited-before-ready`
- 失败日志：`showui-server.log`
- 失败类型：加载权重阶段 `Windows fatal exception: access violation`
- 当时 Qwen PID `10156` 占用约 5.27GB RAM，GPU 总占用约 3288MiB/8192MiB。

结论：当前机器上两个本地视觉模型同跑资源风险高。Windows pagefile 已启用，但 ShowUI 失败发生在模型权重加载/显存资源阶段，单纯扩展 pagefile 不一定解决 VRAM 压力。

### ShowUI 单独启动

操作：临时停止 Qwen PID `10156`，再启动 ShowUI。

日志目录：`tmp/logs/g1-showui-virtual-memory-20260507-2340`

- `local-vlm-start-summary.json`：`status=ready`
- ShowUI health：`ok=true`、`served_model=showui-2b`、`loaded=true`
- 端口：`http://127.0.0.1:8000/v1`
- GPU 总占用约 5981MiB/8192MiB。

结论：ShowUI 单独启动成功，后续 grounding 验证使用 ShowUI profile。

### ShowUI find-target

日志目录：
- `tmp/logs/g1-vlm-interaction-20260507-2352-showui`
- `tmp/logs/g1-vlm-interaction-20260507-2355-showui-highlight`
- `tmp/logs/g1-vlm-interaction-20260507-2357-showui-codex-row`

结果：
- `project_find_target` 返回 `status=grounding-model-parsed`
- `the codex project row in the left sidebar` 返回 point：`x=222, y=336`
- 截图证据：`C:\Users\zhupu\.claw\desktop-capture\desktop-latest.png`
- `bbox=null`
- `confidence=null`

风险：
- `Search item in the left sidebar` 与 `highlighted conversation row` 的结果偏向左侧项目/会话区域，命中率不够稳定。
- ShowUI 当前返回 point，但没有 bbox/confidence；需要在 `REQ-VIS-004` 中补策略，例如 point-only 降级置信、区域二次校验或模型输出 JSON 约束增强。

## 判定

- TC-G1-006：PASS with gaps。
- `REQ-VIS-001` 从 `待交互验证` 推进到 `测试中`。
- G1 真实 endpoint 交互验证已完成；剩余缺口进入 G2 的 `REQ-VIS-004`、`REQ-CU-002`、`REQ-TOOL-005`。

## 后续动作

- 不建议在 8GB VRAM 机器上默认同时常驻 Qwen 和 ShowUI。
- 短期采用 profile 切换：Qwen 负责描述/OCR，ShowUI 负责 grounding。
- 后续需要实现：
  - 本地 VLM profile 自动切换或互斥提示。
  - ShowUI point-only 结果的置信度策略。
  - 对目标区域做二次校验，避免复杂目标偏移。
