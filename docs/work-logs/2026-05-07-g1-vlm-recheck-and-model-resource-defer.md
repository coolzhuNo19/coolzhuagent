# 2026-05-07 G1 本地 VLM 复测与模型资源内置后置

记录时间：2026-05-07 05:45:24 +08:00

## 背景

用户已手动拉起 `qwen2.5-vl-3b` 本地 OpenAI-compatible VLM 服务，并要求当前先继续 G1 交互验证；内视觉模型资源内置和 Web UI 自启动方案后续在打包阶段一起处理。

## 文档调整

- 更新 `docs/requirements-management.md`
  - `REQ-VIS-005` 调整为“本地 VLM 启动检查资源集成”，状态为 `测试中`，用于辅助当前 G1 验证。
  - 新增 `REQ-PACK-013`：内视觉模型资源随包内置与 Web UI 自启动，状态为 `待开发`，并入 G3 打包阶段。
  - 更新需求统计：测试中 23、开发中 2、待开发 25、合计 76、P1 56。
- 更新 `docs/packaging-and-device-migration.md`
  - 记录内视觉模型资源内置与自启动方案。
  - 记录本机模型资源体积：Qwen2.5-VL-3B-Instruct 约 7.0GB，ShowUI-2B 约 4.1GB。
  - 记录打包阶段需处理模型随包/分包、hash 校验、资源镜像、Web UI 自启动和启动稳定性。

## 复测结果

日志目录：

- `tmp/logs/g1-vlm-recheck-20260507-0538`
- `tmp/logs/g1-vlm-project-api-20260507-0543`

结果：

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 本地 VLM `/health` | PASS | `tmp/logs/g1-vlm-health-20260507.json` |
| 本地 VLM `/v1/chat/completions` | PASS | `tmp/logs/g1-vlm-recheck-20260507-0538/chat-completions.json` |
| Web API `/api/vision/describe-screen` | PASS | `status=model-described`，`backend.error=null` |
| Web API `/api/vision/find-target` | PASS with gap | `status=grounding-model-parsed`，返回截图路径和 point 坐标 |

2026-05-07 05:49 追加复核：

- 日志目录：`tmp/logs/g1-interaction-20260507-054320`
- 前置检查：`web_api_state=PASS`、`vlm_health=PASS loaded=True`、`vlm_chat_completions=PASS`、`coolzhu_processes=PASS`
- 项目视觉 API：`project_describe_screen=PASS`、`project_find_target=PASS`
- 兼容性备注：`/v1/models` 当前 `FAIL_OR_UNSUPPORTED`，但 `/v1/chat/completions` 可用，不阻塞 G1 视觉验证。

`find-target` 当前返回：

- `capture.path`: `C:\Users\zhupu\.claw\desktop-capture\desktop-latest.png`
- `grounding.point`: `(1621, 192)`（05:49 追加复核）
- `grounding.bbox`: `null`
- `grounding.confidence`: `null`

## 协议缺口

`REQ-VIS-001` 的理想验收包含 point/bbox/confidence。当前真实模型链路已经能返回可解析 point 和截图证据，但默认 grounding prompt 未要求模型返回 confidence，因此 `confidence` 为空。该项记录为后续 `REQ-VIS-004/REQ-CU-002` 的协议补强点，不阻塞当前 G1 继续收集人工截图结果。

## 验证命令

- `modules/vision/resources/local-vlm/check-local-vlm.ps1`
- `POST http://127.0.0.1:8765/api/vision/describe-screen`
- `POST http://127.0.0.1:8765/api/vision/find-target`

## 备份

- 修改前备份目录：`tmp/backups/g1-vlm-verification-docs-pre-20260507-053753`
- 修改后备份目录：`tmp/backups/g1-vlm-verification-post-20260507-054736`
