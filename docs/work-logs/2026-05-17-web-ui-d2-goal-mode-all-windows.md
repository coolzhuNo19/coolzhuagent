# 2026-05-17 Web UI D2 Goal Mode 全窗口前端首版

时间：2026-05-17 21:05 CST  
范围：`REQ-WEB-UI-010`、`REQ-WEB-WIN-002/004/005/006/007/008/009/010`

## Goal

使用刚落表的 Goal 编排思路推进 D2 下区窗口前端开发：

- 目标：10 个下区窗口都具备可打开、可确认的前端界面。
- 约束：已有后端能力接真实 API；后端尚未实现的功能给明确占位和降级说明。
- 安全：终端不开放 PTY，不直接 shell；只通过 `/api/tools/runtime-execute` 走工具权限、审批和审计。视觉实验真实键鼠入口默认关闭。
- 完成条件：JS 语法、窗口契约、web-console 全量测试通过，并启动 UI 供人工确认。

## 实现内容

### 任务 / 授权 / Goals

- 新增三栏窗口：Pending approvals、Goals、Handoff / Audit 摘要。
- Pending approvals 复用 `/api/tools/pending`、审批 SSE 和 approve/reject 接口。
- Audit 摘要复用 `/api/tools/audit`。
- Handoff 摘要复用当前聊天室任务链。
- Goals 首版只做 `REQ-GOAL-*` phase 占位，不调用尚未实现的 Goal 后端。

### 记忆 / 知识

- 新增关键词、kind、layer、pinned、source 筛选。
- 新增 bead 列表、详情区、来源追踪区。
- 复用现有 session beads API，不改记忆删除和聊天室级联删除链路。

### 多媒体

- 新增附件媒体库、image/audio/video/document 过滤。
- 新增 Now Playing 和播放列表。
- 复用 `/api/attachments/index`，不改变聊天室附件上传和富媒体消息渲染链路。

### 视觉实验

- 新增 capture、describe dry-run、locate dry-run、profile 区。
- 新增截图证据区、grounding backend / point / bbox / confidence 摘要和 dry-run plan。
- 真实输入按钮默认禁用，避免无意触发键鼠。

### 诊断日志

- 新增 diagnostics health、修复建议、工具审计摘要、logs tail 占位。
- logs tail/SSE 后端暂未接入，当前明确显示降级说明。

### 浏览器

- 新增 URL/search 输入、iframe 预览、外部打开兜底。
- 不承诺登录态复用、跨域读取和真实网页自动化。

### 终端

- 新增 runtime tool 命令面板：tool_name + JSON input + 输出区。
- 调用 `/api/tools/runtime-execute`，危险工具会进入任务 / 授权窗口。
- 不做 PTY/WebSocket/xterm.js。

## 文档与需求状态

- `REQ-WEB-UI-010`：`开发中 -> 测试中`
- `REQ-WEB-WIN-002`：`待开发 -> 测试中`
- `REQ-WEB-WIN-004`：`待开发 -> 测试中`
- `REQ-WEB-WIN-005`：`待开发 -> 测试中`
- `REQ-WEB-WIN-006`：`待开发 -> 测试中`
- `REQ-WEB-WIN-007`：`待开发 -> 测试中`
- `REQ-WEB-WIN-008`：`待开发 -> 测试中`
- `REQ-WEB-WIN-009`：`待开发 -> 测试中`
- `REQ-WEB-WIN-010`：`待开发 -> 测试中`

## 验证

- `node --check modules\gui-web\packages\web-console\src\app.js`
  - PASS
  - 日志：`tmp/logs/node-check-all-windows.log`
- `powershell -NoProfile -ExecutionPolicy Bypass -File tmp\check-web-ui-d2-inner-contract.ps1`
  - PASS
  - 日志：`tmp/logs/web-ui-d2-inner-contract-all-windows.log`
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`
  - PASS，243 passed
  - 日志：`tmp/logs/cargo-test-web-console-all-windows.out.log`、`tmp/logs/cargo-test-web-console-all-windows.err.log`
- 预览服务：
  - URL：`http://127.0.0.1:8765/`
  - PID：`5404`
  - 日志：`tmp/logs/web-ui-preview-direct-20260517-205032.out.log`、`tmp/logs/web-ui-preview-direct-20260517-205032.err.log`
- 截图：
  - `tmp/web-ui-all-windows-current-1920x1080.png`

## 人工确认项

- 逐个展开 10 个窗口，确认标题栏、按钮、输入框、列表和内容区没有重叠。
- 任务 / 授权 / Goals：确认 pending、Goal 占位、handoff、audit 四区视觉比例。
- 记忆 / 多媒体：确认三栏布局、筛选、Now Playing 区域。
- 视觉 / 诊断：确认 dry-run 与 health/audit 区域可读。
- 浏览器 / 终端：确认当前 MVP 的边界说明是否足够清楚。

## 备份

- 前置文档备份：`tmp/backups/web-ui-d2-inner-goal-plan-20260517-164931-pre`
- 文档后置备份：`tmp/backups/web-ui-d2-inner-goal-plan-20260517-164931-post`
- Memory/Media worker 备份：
  - `tmp/backups/frontend-memory-media-20260517-185538-pre`
  - `tmp/backups/frontend-memory-media-20260517-201826-post`
- Vision/Logs worker 备份：
  - `tmp/backups/frontend-visionlogs-20260517-190958-pre`
  - `tmp/backups/frontend-visionlogs-20260517-195134-post`
