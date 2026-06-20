# 2026-05-17 Web UI D2 下半区独立窗口实现方案

## 背景

上半区布局已经确认可用：Logo、Agent 总览、任务卡片进入稳定期。D2 开始聚焦下半区多窗口工作台，把每个窗口做成独立功能面，而不是继续把所有能力挤在单一聊天室布局里。

本方案基于 4 个并行 explorer 的只读审计结果：

- 工程目录 / IDE 窗口
- 设置 / 任务授权 / 诊断日志窗口
- 聊天室 / 会话协同 / 记忆知识窗口
- 浏览器 / 多媒体播放器 / 终端 / 视觉实验窗口

## 总原则

- 保持上半区布局不再大改，只接受 bugfix 和小幅视觉修正。
- 下半区每个窗口独立设计、独立验收；一个窗口展开时其它窗口自动折叠为左侧标题栏。
- 先接已具备后端能力的窗口，再做需要新增高风险后端的窗口。
- 优先只读能力和已有权限闸门；写文件、真实键鼠、终端命令必须走现有工具权限、审批、审计。
- 浏览器和终端不做“大而全”首版：浏览器先做搜索/展示/外部打开兜底；终端先做 runtime-execute 命令面板，不直接上 PTY。

## 窗口拆分与优先级

| 子需求 | 窗口 | 优先级 | MVP 目标 | 后端状态 |
| --- | --- | --- | --- | --- |
| REQ-WEB-WIN-001 | 工程目录 / IDE | P0 | 文件树、文件预览、只读 diff view | 缺 UI 专用 tree/file/meta/diff API |
| REQ-WEB-WIN-002 | 设置 | P0 | 会话/模型、Custom provider、视觉 Agent、TTS/STT、工具目录分区 | 会话、音频、工具 API 已有；缺设置聚合 API |
| REQ-WEB-WIN-003 | 聊天室 | P0 | 至少 50 行可读消息、固定输入区、引用/附件/转交入口稳定 | 后端主体已完成 |
| REQ-WEB-WIN-004 | 任务 / 授权 | P0 | pending approvals、授权剩余时间、handoff 任务链、工具审计摘要 | 审批/审计已有；缺独立任务查询 API |
| REQ-WEB-WIN-005 | 记忆 / 知识 | P1 | beads 检索、筛选、详情、来源追踪、删除/固定 | 后端 beads API 已有；前端仍是摘录 |
| REQ-WEB-WIN-006 | 多媒体播放器 | P1 | 附件媒体库、图片/音频/视频预览、播放列表 | 附件索引/文件服务已有 |
| REQ-WEB-WIN-007 | 视觉实验 | P1 | capture、describe、locate、dry-run action、profile 证据展示 | 视觉/Computer Use API 已较完整 |
| REQ-WEB-WIN-008 | 诊断日志 | P1 | health 检查、修复建议、日志 tail、工具审计日志视图 | health 已有；缺 logs tail/SSE |
| REQ-WEB-WIN-009 | 浏览器 | P2 | URL/搜索输入、iframe/webview 展示、外部打开兜底 | 无 browser session API |
| REQ-WEB-WIN-010 | 终端 | P2 | 单命令面板，走 runtime-execute、审批、审计 | 有工具执行闸门；无 PTY |

## 设计方案

### REQ-WEB-WIN-001 工程目录 / IDE

首版只做只读 IDE：

- 左侧：可展开文件树，支持目录展开、选中文件、刷新。
- 右侧：文件预览、metadata、Diff View 三个 tab。
- 文件预览：文本分页，大文件/二进制保护，编码错误提示。
- Diff View：先支持 worktree/staged/head 只读 diff，后续再考虑编辑和保存草稿。

建议新增 API：

- `GET /api/project/tree?path=&depth=&limit=`
- `GET /api/project/file/meta?path=`
- `GET /api/project/file?path=&offset=&limit=`
- `GET /api/project/diff?path=&mode=worktree|staged|head`

风险：

- Windows 路径、空格、`..`、绝对外部路径必须复用 workspace 边界校验。
- 不可直接复用工具 dry-run 输出当 IDE 文件预览，否则 UI 权限语义会混乱。

### REQ-WEB-WIN-002 设置

设置窗口承接旧三合一卡片职责，并分区呈现：

- 会话与模型：session CRUD、provider/model、Custom base_url/endpoint、reasoning effort、模型类型、视觉 Agent。
- 工具能力：工具 catalog、插件/Skill 状态、暴露模式。
- 音频：TTS/STT 状态、voice、模型路径、测试按钮；不恢复 voice monitor。
- 视觉配置：云端视觉理解 Agent、grounding backend 状态只读展示。

缺口：

- 后续可加 `GET /api/settings/summary` 聚合读取，降低前端多个 loader 的耦合。
- 音频配置目前只有 status 和动作 API，缺配置读写 API，可放 D2 后半段。

### REQ-WEB-WIN-003 聊天室

聊天室窗口只保留“对话主流程”：

- 中央消息流，默认加载 80 条，视觉上至少稳定显示 50 行文本。
- 顶部 roster strip 只显示当前房间成员。
- 底部固定 composer，附件与引用预览不遮挡消息流。
- 手工转交入口跟“选中消息 toolbar”绑定，不挤在输入主路径。
- 任务链侧栏可在聊天室中作为轻量入口，但完整任务链放到任务窗口。

后端基本够用，重点是前端布局和交互验收。

### REQ-WEB-WIN-004 任务 / 授权

任务窗口承接全局审批浮层和协同任务：

- pending approvals：工具名、调用方、参数摘要、影响路径、危险级别。
- 操作按钮：拒绝、单次授权、会话授权；展示授权剩余时间。
- handoff 任务链：from/to、status、depth、intent、rejected_reason。
- 工具审计摘要：最近调用、状态、耗时、脱敏入参。

缺口：

- 独立任务查询 API 仍不足，目前 task list 多来自聊天发送结果。
- 可以先用 existing pending + audit + handoffs 聚合，后续补 `/api/tasks`.

### REQ-WEB-WIN-005 记忆 / 知识

首版从“4 条摘录”升级成完整知识窗口：

- 筛选：kind、layer、pinned、source、关键词。
- 列表：summary、layer、confidence、token_count、origin。
- 详情：来源消息、创建时间、origin table/message id。
- 操作：pin/unpin、delete、跳回来源消息。

后端 beads CRUD/query 已有，首版可少改后端。

### REQ-WEB-WIN-006 多媒体播放器

首版复用附件索引：

- 左侧媒体库：按 image/audio/video 过滤，支持聊天室/全局范围。
- 右侧播放器：`img` / `audio controls` / `video controls`。
- 播放列表：前端内存队列即可。
- 与聊天消息的富媒体控件共享“点击控件不触发消息选中”的防冲突规则。

暂缓：

- 视频理解、关键帧 VLM、波形、最近播放持久化。

### REQ-WEB-WIN-007 视觉实验

当前能力最完整，D2 主要是整理呈现：

- capture：采集桌面，展示截图和元数据。
- describe：云端/本地可用时返回屏幕描述。
- locate：输入目标文本，展示 grounding backend、point/bbox/confidence。
- action dry-run：生成动作计划和截图证据，默认 `execute=false`。
- profile：显示操作场景矩阵。

真实输入默认不开放；只在靶场或显式确认脚本中启用。

### REQ-WEB-WIN-008 诊断日志

诊断窗口分三层：

- Health：`/api/diagnostics/health`、状态、修复建议。
- Logs：后端 log tail 或 SSE，必须分页/限流。
- Audit：工具审计 jsonl 只读视图，可按 caller/status/tool 过滤。

缺口：

- 现有测试曾刻意确认前端不加载 diagnostics health，D2 接入时要同步改测试期望。
- 缺 `/api/diagnostics/logs?tail=` 或 SSE。

### REQ-WEB-WIN-009 浏览器

首版保守实现：

- URL/搜索输入。
- URL 归一化：普通文本转搜索 URL，合法 URL 加 scheme。
- iframe/webview 展示可尝试，但必须显示 CSP/X-Frame-Options 失败兜底。
- 外部打开按钮。

暂缓：

- 登录态复用、DOM 自动化、跨域读取、真实网页点击。

### REQ-WEB-WIN-010 终端

首版不是交互式 PTY，而是命令面板：

- 单条命令输入。
- 执行必须走 `/api/tools/runtime-execute`。
- DangerFullAccess 必须 pending approval + audit。
- 输出追加到 terminal-like log，限制长度和敏感信息展示。

暂缓：

- PTY/WebSocket/xterm.js。若后续做，必须单独方案评审。

## 多 Agent 并行开发切分

### 第一批：可并行，风险低到中

| Agent | 任务 | 写入范围 | 备注 |
| --- | --- | --- | --- |
| Backend-Project | `REQ-WEB-WIN-001` 后端 API | `modules/gui-web/packages/web-console/src/main.rs`，必要时 `core-runtime/src/file_ops.rs` | 只读 API，先 TDD |
| Frontend-SettingsTasks | `REQ-WEB-WIN-002/004/008` 前端分区 | `index.html`、`src/app.js`、`src/styles.css` 的 settings/tasks/logs 区域 | 不改 chat/project/media DOM |
| Frontend-ChatMemory | `REQ-WEB-WIN-003/005` 聊天与记忆布局 | `index.html`、`src/app.js`、`src/styles.css` 的 chat/memory 区域 | 不改工具/设置逻辑 |
| Frontend-MediaVision | `REQ-WEB-WIN-006/007` 多媒体与视觉实验 | `index.html`、`src/app.js`、`src/styles.css` 的 media/vision 区域 | 只接现有 API |

### 第二批：需要第一批结果或安全评审

| Agent | 任务 | 写入范围 | 前置 |
| --- | --- | --- | --- |
| Frontend-Project | `REQ-WEB-WIN-001` IDE 前端 | project DOM/JS/CSS | Backend-Project API 完成 |
| Browser-MVP | `REQ-WEB-WIN-009` 浏览器 MVP | browser DOM/JS/CSS，小型 normalize API 可选 | URL 安全策略确认 |
| Terminal-MVP | `REQ-WEB-WIN-010` 命令面板 | terminal DOM/JS/CSS，复用 runtime-execute | 工具审批窗口可用 |

## TDD 与验收

自动化：

- 所有后端变更先补 Rust 单测。
- 前端静态契约补到 `tmp/ui-redesign-contract-check.ps1` 和 web-console 现有 `WEB_INDEX_HTML/WEB_APP_JS` 测试。
- JS 语法：`node --check modules/gui-web/packages/web-console/src/app.js`。
- 全量：`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`。

交互：

- 1920x1080 截图确认每个窗口展开/折叠稳定。
- 聊天室：80 条消息、至少 50 行可读、输入区固定。
- 工程目录：展开目录、预览文本、diff、workspace 切换清理选中状态。
- 任务授权：pending 出现、拒绝、单次授权、会话授权、审计刷新。
- 多媒体：图片/音频/视频控件可播放且不触发消息选中。
- 视觉实验：execute=false dry-run，证据链展示。

## 推荐推进顺序

1. `REQ-WEB-WIN-001` 后端只读 API。
2. `REQ-WEB-WIN-003` 聊天室窗口布局稳定。
3. `REQ-WEB-WIN-004` 任务/授权窗口承接审批浮层。
4. `REQ-WEB-WIN-002` 设置窗口深化。
5. `REQ-WEB-WIN-005` 记忆/知识窗口。
6. `REQ-WEB-WIN-006` 多媒体播放器。
7. `REQ-WEB-WIN-007` 视觉实验。
8. `REQ-WEB-WIN-008` 诊断日志。
9. `REQ-WEB-WIN-009` 浏览器 MVP。
10. `REQ-WEB-WIN-010` 终端命令面板。

## 2026-05-17 补充：窗口内布局与 Goal 工具

新增细化方案见 `docs/web-ui-window-d2-inner-layout-goal-plan-2026-05-17.md`。

本补充锁定以下决策：

- `REQ-WEB-WIN-004` 调整为“任务 / 授权 / Goals 独立窗口”，承接 pending approvals、时间授权、handoff 任务链、工具审计摘要和 Goal phase 时间线。
- Goal 不新开独立窗口；`/goal` 输入触发仍在聊天室，完整进度、pause/resume/cancel、phase 时间线归任务 / 授权窗口。
- `REQ-CORE-AGENT-001` 作为 Epic 概念保留，正式拆分为 `REQ-GOAL-001~009`。
- 新增 `REQ-TOOL-012`，用于后续工具 / 插件 / SKILL 场景目录与适配矩阵。
- 当前可并行实现的低风险窗口为任务/授权/Goals、记忆/多媒体、视觉/诊断日志；浏览器和终端继续后置。
