# 2026-05-17 Web UI D2 窗口内布局与 Goal 工具方案

## 背景

上半区布局已经确认可用，下半区外层窗口结构也基本稳定。本轮目标是把每个窗口内部做成清晰的功能面，并把用户提供的 Goal-Driven 多角色 Agent 编排方案纳入正式需求。

输入材料：

- `C:\Users\zhupu\Desktop\goal.txt`
- `C:\Users\zhupu\Desktop\goal-driven-multi-agent-orchestration-plan-2026-05-13.md`
- 现有 D2 方案：`docs/web-ui-window-d2-implementation-plan-2026-05-17.md`
- 3 个并行 explorer 只读审计结果：Goal 需求拆分、功能归窗审计、窗口实现边界审计

## 外部设计参考

| 参考 | 可借鉴模式 | 落地决策 |
| --- | --- | --- |
| VS Code User Interface | 左侧 Activity Bar、Explorer + Editor、Panel 区域把终端/输出/问题收束在主编辑区之外 | 工程目录窗口采用左树右预览/Diff；终端首版仍归独立窗口但走受控命令面板 |
| Microsoft Fluent 2 Layout | 用 grid/regions/spacing 建立可扫视的信息层级，重要内容占更大区域 | 每个窗口内部固定主区和辅助栏比例，避免把功能继续堆进小卡片 |
| GitHub Projects view layouts | 同一任务集合可有 table、board、roadmap 三种视图 | 任务 / 授权窗口预留 Goals 的列表、阶段时间线、状态列；不在聊天室里展示完整任务管理 |
| Carbon tabs pattern | tabs 适合在同一上下文组织 forms、settings、dashboard，降低认知负担 | 设置窗口使用分区/轻 tabs：会话模型、工具能力、视觉配置、音频 |
| xterm.js addon model | 终端能力可逐步从容器适配、搜索、链接等 addon 扩展 | 当前不做 PTY；若未来上 xterm.js，需要独立安全评审和授权窗口稳定后再做 |
| WebView2 browser sample | 浏览器控件通常包含地址栏、导航、标签、外部打开/加载取消 | 浏览器窗口首版只做 URL/search/外部打开兜底，不承诺登录态复用和跨域读取 |
| HTMLMediaElement | 原生媒体元素已提供 play/pause/load/volume/canPlayType 等能力 | 多媒体窗口先使用原生 `audio/video/img` + 附件索引，不引入重播放器框架 |

## 功能归窗决策

| 功能类别 | 页面展示必要性 | 所属窗口 | 首版形态 |
| --- | --- | --- | --- |
| Workspace、文件树、文件预览、Diff | 必须 | 工程目录 | 左侧树 + 右侧 preview/meta/diff tabs，只读 |
| 会话、Provider、Custom base_url/endpoint、视觉 Agent、TTS/STT 状态、工具目录 | 必须 | 设置 | 多分区表单，工具目录只做能力浏览和配置状态 |
| 聊天消息、roster、附件、引用、手工转交轻入口 | 必须 | 聊天室 | 消息主流 + 固定 composer；完整任务链迁出 |
| Pending approvals、时间授权、handoff 链、工具审计、Goal 进度 | 必须 | 任务 / 授权 | Queue + Goals + Handoff + Audit 四区 |
| Beads、上下文预览、prompt preview、来源追踪 | 必须 | 记忆 / 知识 | 列表筛选 + 详情侧栏 |
| 附件媒体库、图片/音频/视频播放 | 必须 | 多媒体 | 媒体库 + Now Playing + 播放列表 |
| Capture、describe、locate、dry-run action、profile | 必须 | 视觉实验 | 截图证据链 + grounding/action panels，真实输入默认关闭 |
| Health、修复建议、日志 tail、审计筛选 | 必须 | 诊断日志 | Health cards + log viewer + audit filter |
| URL/search/页面展示 | 可展示 MVP | 浏览器 | 地址栏 + iframe/webview 尝试 + 外部打开 |
| 单条命令执行 | 可展示 MVP | 终端 | 命令面板 + 输出流，必须走 runtime/审批/审计 |
| 桌宠状态、Web 卡片审计、外部能力探测 | 不单独开窗口 | 诊断日志 | 只作为调试 tab/摘要 |
| 打包/安装/资源加密 | 当前不展示 | 文档冻结 | 不进入 Web UI |

## 窗口内部布局方案

### 工程目录

- 左侧 28%：workspace header、搜索/刷新、目录树。
- 右侧 72%：文件 header、metadata strip、Preview / Diff / Info tabs。
- Icon：`folder.png`、`file.png`、`refresh.png`、新增缺口 `diff`、`binary-file`、`workspace-root`。
- 不做：文件编辑、保存、批量删除。

### 设置

- 顶部：当前 session 摘要和保存状态。
- 主体：两列布局。
  - 左列：会话与模型、Custom provider 条件字段、reasoning effort。
  - 右列：视觉 Agent、工具 catalog、TTS/STT 状态。
- Icon：`settings.png`、`save.png`、`delete.png`、`skill.png`、`plugin.png`、`speaker.png`、`microphone.png`，新增缺口 `provider`、`api-key`、`vision-agent`。
- 不做：工具真实执行、审批操作。

### 聊天室

- 顶部：roster strip、房间操作、新建/重命名/删除。
- 主体：消息流独立滚动，保留至少 50 行阅读空间。
- 底部：发送对象、附件、输入框、发送、TTS/STT。
- Handoff：保留轻量抽屉入口；完整链路去任务窗口。
- Icon：`chat.png`、`send.png`、`upload.png`、`robot-message.png`、`mario.png`，新增缺口 `handoff`、`agent-roster`、`selected-message`。

### 任务 / 授权 / Goals

- 左列：Pending approvals，展示工具名、caller、风险、影响路径、TTL。
- 中列：Goals，展示 goal 状态、phase 时间线、iteration、pause/resume/cancel。
- 右列：Handoff 链 + Audit 摘要。
- 顶部摘要：授权等待数、会话授权剩余时间、运行中的 Goals 数。
- Icon：`lock.png`、`warning.png`、`success.png`、`fail.png`、`task-list.png`，新增缺口 `approve-once`、`approve-session`、`reject`、`timer`、`shield-risk`。
- 不做：Goal 独立大窗口；后续 Goals 体量膨胀后再评估 `REQ-WEB-WIN-011`。

### 记忆 / 知识

- 顶部筛选：关键词、kind、layer、pinned、source。
- 左侧：bead 列表，显示 summary、layer、confidence、token_count。
- 右侧：详情、来源消息、origin table/message id、pin/delete、跳转。
- Goal 集成：phase 完成、plan 决策、goal 完成摘要都作为可筛选来源。

### 多媒体

- 左侧：附件媒体库，image/audio/video/document filter。
- 主区：Now Playing，使用原生 `img`、`audio controls`、`video controls`。
- 右侧：播放列表和来源消息。
- 不做：视频理解、关键帧 VLM、波形编辑。

### 视觉实验

- 左侧：capture/describe/locate/action/profile 操作组。
- 主区：截图预览与 evidence overlay。
- 右侧：backend health、point/bbox/confidence、dry-run action plan。
- 真实键鼠默认关闭，只通过授权脚本和靶场验证。

### 诊断日志

- 顶部：health 状态和修复建议。
- 主体：logs tail、tool audit、pet/web cards debug tabs。
- 后端缺口：`/api/diagnostics/logs?tail=` 或 SSE；未完成前只接 health + audit。

### 浏览器

- 顶部：back/forward/reload、URL/search、external open。
- 主区：嵌入尝试；失败显示 CSP/X-Frame 兜底和外部打开按钮。
- 不做：登录态复用、DOM 读取、真实网页点击。

### 终端

- 顶部：shell/profile、cwd、危险等级提示。
- 主区：命令输入 + 输出 buffer。
- 执行：只走 `/api/tools/runtime-execute`，危险命令必须进入任务 / 授权。
- 不做：PTY/WebSocket/xterm.js 首版。

## Goal 需求落地拆分

`goal.txt` 里的 `REQ-CORE-AGENT-001` 作为 Epic 保留概念即可，正式开发拆成 `REQ-GOAL-001~009`：

| REQ-ID | 名称 | 优先级 | 依赖 | UI 归属 |
| --- | --- | --- | --- | --- |
| `REQ-GOAL-001` | Goal 契约、状态与持久化 | P1 | SQLite、workspace/session 边界 | 任务 / 授权 |
| `REQ-GOAL-002` | CompletionCondition DSL 与验证器 | P1 | 工具 runtime、审批、超时 | 任务 / 授权 |
| `REQ-GOAL-003` | GoalPlan / GoalPhase 编排模型 | P1 | `REQ-GOAL-001/002` | 任务 / 授权 |
| `REQ-GOAL-004` | 角色模板与 Goal Role Session | P1 | 会话管理、聊天室 handoff | 设置 |
| `REQ-GOAL-005` | Skill 注册与执行约束 | P2 | 工具 catalog、角色模板 | 设置 / 任务 |
| `REQ-GOAL-006` | Goal Loop 引擎 | P1 | `REQ-GOAL-001~005`、handoff、tool loop | 任务 / 授权 |
| `REQ-GOAL-007` | 后台 Goal 与事件流 | P1 | SSE/event bus | 任务 / 授权 |
| `REQ-GOAL-008` | 自愈与 Plan 修正 | P2 | Goal Loop、review/tester roles | 任务 / 授权 |
| `REQ-GOAL-009` | Goal 审计、诊断与回滚开关 | P1 | tool audit、diagnostics | 诊断日志 |

首版不实现完整 Goal Loop UI，只在 D2 窗口布局中预留 Goals 区。等 `REQ-WEB-WIN-004` 的任务/授权窗口稳定后，再进入 `REQ-GOAL-001` 后端 TDD。

## 工具 / 插件 / Skill 后续治理

新增后续需求 `REQ-TOOL-012`：工具、插件、Skill 与常用外部工具的场景目录和适配矩阵。

目标：

- 现有 Core/Vision/Computer Use/Plugin/Skill 工具按能力、风险、输入输出、是否可自动执行分类。
- 市面常用工具按 dev、browser、office、media、automation、data、release、security 分组，记录接入方式和风险。
- 与 Goal skill registry 对齐，形成“场景 -> 推荐工具 -> 权限 -> 验证方式”的目录。

该需求排在 D2 窗口功能接入和 Goal G1 之后，不阻塞当前 UI 落地。

## 并行开发批次

### 当前可并行

| Worker | 任务 | 写入边界 |
| --- | --- | --- |
| Frontend-TasksGoal | 任务 / 授权窗口内布局、Goals 占位、approval/audit/handoff 聚合 | `tasks-workbench-window` DOM、tasks/approval/audit JS、`.tasks-workbench-window` CSS |
| Frontend-MemoryMedia | 记忆 / 知识与多媒体窗口布局，接 beads 与 attachments index | memory/media DOM、beads/media JS、对应 CSS |
| Frontend-VisionLogs | 视觉实验与诊断日志窗口布局，接现有 vision/health/audit | vision/logs DOM、vision/log JS、对应 CSS |

### 暂缓并行

- 聊天室发送链和 composer 属于核心高风险区，当前只做 bugfix，不与其它 worker 同时大改。
- 浏览器和终端是 P2 风险窗口，等任务 / 授权窗口稳定后再做。
- 工程目录已进入测试中，下一步只做交互确认和局部打磨。

## TDD 与验证

- 文档阶段：更新需求表、README、work-log，保留备份。
- 前端布局阶段：先补静态契约检查，确保 `data-role` 不重复、每个窗口有独立根类、关键 icon 存在。
- 自动化：`node --check modules/gui-web/packages/web-console/src/app.js`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`。
- 视觉：1920x1080 截图逐个展开 `settings/tasks/memory/media/vision/logs`。
- 交互：pending approval、audit refresh、beads 筛选、附件播放、vision dry-run、health refresh。

## 风险

- `index.html/app.js/styles.css` 是热点文件，并行 worker 必须按窗口根类和函数前缀隔离。
- Goal Loop 后台执行不能绕过 workspace、Protected 路径、键鼠时间授权。
- 终端和浏览器不得先于任务授权窗口进入真实执行路径。
- 记忆窗口展示 Goal 产物时，需要明确保留/删除策略，避免取消 Goal 后误删有价值总结。
