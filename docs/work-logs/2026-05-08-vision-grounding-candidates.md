# 视觉 grounding 多候选协议补齐

时间：2026-05-08 07:49-07:55 +08:00

## 关联需求

- `REQ-VIS-004`：视觉 point/bbox/confidence 协议
- `REQ-CU-002`：强视觉识别点击
- `REQ-TOOL-005`：内视觉目标点击工具化

## 实施内容

1. 为 grounding parser 增加多候选解析。
   - 支持 `candidates`、`results`、`detections`、`items` 数组。
   - 每个候选复用原有 `[x,y]`、JSON point、bbox、confidence、label 解析。
   - 多候选按最高 `confidence` 选择；无 confidence 时 bbox 默认排序高于 point-only。

2. 保持 point-only 降级策略。
   - `[x,y]` 或缺少 bbox/confidence 的 ShowUI 输出仍保留 point。
   - 不伪造 bbox。
   - 返回低置信度和降级原因，供 Web evidence 和后续 action 安全策略使用。

3. 复验 Web grounding 映射。
   - 确认 bbox/point 到像素坐标映射不回归。
   - `computer.visual_action` 继续通过 evidence 输出 screenshot、target、point、backend、confidence。

## 验证

日志目录：`tmp/logs/vision-tool-service-20260508-0001`

- 红测：`vision-service-candidates-red.log`
- 目标转绿：`vision-service-candidates-green.log`
- Web 回归：`web-console-grounding-regression.log`
- 全量：
  - `cargo test -p coolzhu-vision-service --offline`：19 passed
  - `cargo test -p coolzhu-web-console --offline`：126 passed
  - `cargo check -p coolzhu-vision-service --offline`：通过
  - `cargo check -p coolzhu-web-console --offline`：通过

## 结论

`REQ-VIS-004` 的协议层验收项已完成。真实模型对复杂目标的命中率和 visual_action 场景矩阵继续放在 `REQ-CU-002`、`REQ-TOOL-005` 中推进。
