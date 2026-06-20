# 2026-05-13 REQ-VIS-008 + Precise-Click Grounding Router 收口

时间：2026-05-13 07:10:00 +08:00  
范围：`REQ-VIS-008`、Precise-Click Grounding Plan、Computer Use 真实点击定位链路  
备份：`tmp/backups/vis008-grounding-router-20260513-013159/`

## 背景

依据 `docs/work-logs/2026-05-11-precise-click-grounding-audit.md` 的审计结论，本轮优先修复两个核心缺口：

- ShowUI grounding backend 与用户可选 Vision Understanding Agent 在总览、会话和前端下拉中混用。
- `api_tool_execute` 真实点击仍保留旧的 taskbar 硬编码锚点 / median fallback，未统一进入 locate router。

## 代码变更

- `modules/gui-web/packages/web-console/src/main.rs`
  - 移除 `system-vision-agent` 默认会话，`showui` 不再被 `resolve_model_type` / `is_multimodal_agent` 自动识别为视觉理解 Agent。
  - 新增 `/api/agents/understanding`，返回用户配置的 `vision/multimodal/video` 会话列表。
  - 新增 `/api/vision/grounding/backends` alias，并保留 `/api/vision/locate/backends` 兼容旧调用。
  - `build_overview_metrics` 改为从 `session_store` 选择视觉 Agent，不再回退 ShowUI。
  - `ConfigVisionRouter` 挂入 `ConfigVision::default()`，默认 pipeline 为 `uia -> local_vlm -> remote_vlm`。
  - `api_tool_execute` 真实点击改走 `run_grounding_router`，定位失败时显式返回 degraded/not_found，不再使用固定 taskbar 锚点。
  - 清理旧 `target_anchor_for_taskbar` 与 `grounding_median_point` fallback helper，避免后续误用。
- `modules/gui-web/packages/web-console/src/app.js`
  - 总览视觉 Agent 下拉只渲染用户配置的视觉/多模态/视频会话。
  - ShowUI 仅作为 grounding backend，不再作为可选 Agent 展示。
  - 会话加载后重新渲染视觉 Agent 下拉，避免初始化顺序导致空列表。
- `docs/requirements-management.md`
  - `REQ-VIS-008` 状态从 `开发中` 推进到 `测试中`。
  - 需求统计同步：`测试中 5 -> 6`，`开发中 4 -> 3`。

## TDD / 验证

日志均位于 `tmp/logs/`：

- `cargo fmt --all`
  - `cargo-fmt-vis008-cleanup-20260513.log`
- `coolzhu-web-console` 关键回归
  - `web-console-vis008-test-20260513.log`：6 passed
  - `web-console-vis008-router-default-test-20260513.log`：1 passed
  - `web-console-vis008-showui-test-20260513.log`：1 passed
  - `web-console-vis008-locate-group-20260513.log`：2 passed
  - `web-console-semantic-group-20260513.log`：8 passed
  - `web-console-vision-group-20260513.log`：6 passed
  - `web-console-visual-action-group-20260513.log`：4 passed
  - `web-console-tool-group-20260513.log`：31 passed
  - `web-console-web-frontend-group-20260513.log`：8 passed
  - `web-console-workspace-group-20260513.log`：6 passed
- `coolzhu-vision-service`
  - `vision-service-vis008-20260513.log`：32 passed
- `node --check`
  - `node-check-app-vis008-final-20260513.log`：通过

说明：PowerShell 将 cargo warning 写入 error stream，部分命令 shell exit 显示为 1，但日志内 test result 均为 ok。

## 剩余验证项

- 真实桌面窗口交互：通过 `/api/tools/execute` 或前端工具入口触发一次 `execute=true` 的左键点击，确认返回的 grounding trace 来自 router pipeline，且定位失败时不会退回固定锚点。
- 前端总览下拉：确认视觉 Agent 只显示已配置的多模态/视觉会话，不显示 ShowUI。
- `/api/vision/grounding/backends`：确认 UIA/LocalVLM/RemoteVLM 状态与当前 `coolzhu.toml [vision.router]` 配置一致。

## 下一步

按照最新优先级进入工具权限需求：

1. 阅读 `tool-permission*` work-log 的 Phase C 思路。
2. 完成 `REQ-TOOL-011` 的工具超时与并发控制收口。
3. 补 `REQ-TOOL-010` diagnostics 规则解析失败提示，并整理 `REQ-TOOL-008/009` 的交互验收清单。
