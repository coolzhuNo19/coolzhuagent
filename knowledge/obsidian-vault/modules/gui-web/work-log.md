---
title: "GUI Web 控制台 work-log"
source:
  - "modules/gui-web/INTERFACE.md"
  - "docs/agent-roadmap-chat-memory-vision.md"
  - "docs/requirements-management.md"
  - "docs/chatroom-richtext-media-analysis-2026-06-04.md"
  - "docs/web-ui-window-d2-implementation-plan-2026-05-17.md"
  - "docs/work-logs/2026-06-11-mario-3d-ui-redesign.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# GUI Web 控制台 work-log

## 迁移工作记录

- Web-GUI 从卡片主界面演进为多窗口工作台；工程、设置、聊天、任务、记忆、媒体、视觉、日志、浏览器和终端窗口已形成 D2 首版。
- 聊天室支持流式真实模型、附件、富文本、引用/转发和多 Agent handoff；下一步重点是视觉交互手感与跨模块回归。
- 最近 UI 迭代集中在 3D/舰桥/像素办公室视觉层和状态反馈，需防止装饰层污染 API 契约。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。

## 2026-06-19 定时 loop 任务（轮询 / Goal 推进两类）

- **背景**：已存在定时任务子系统（`config.scheduled_tasks` + `spawn_scheduled_task_scheduler` 每 30s 防漂移调度 + `deliver_scheduled_task` 复用聊天主链路）。本轮在其上扩展，**不重造轮子**。方案见 `docs/scheduled-loop-task-design-2026-06-19.md`。
- **后端（main.rs）**：
  - `ConfigScheduledTask` / `TaskScheduleCreateRequest` 新增 `task_kind`(poll|goal, 默认 poll) + `goal_id`(Option)，均 `#[serde(default)]` 兼容旧 coolzhu.toml。
  - 新增 `deliver_goal_scheduled_task` + `goal_status_is_finished`：复用 `dispatch_ready_goal_phases`/`next_runnable_goal_phase_id`/`run_goal_phase_once` 推进绑定 goal 一个阶段。
  - 重写 `run_due_task_schedules_once`：按 task_kind 分流；轮询型 content 不变重排；Goal 推进型回写进度 content、整体完成置 status=completed（清空/停触发）。
  - `api_create_task_schedule`：goal 模式校验 goal_id 存在（404）。
- **前端（index.html/app.js/styles.css）**：定时任务面板内新增"任务类型"下拉 + Goal 选择器（拉 `/api/goals`），列表加类型徽标/目标/状态/错误行；改前端后已 `cargo build -p coolzhu-web-console` 重新内联。
- **验证**：`cargo build -p coolzhu-web-console --offline` OK；`cargo test ... schedul` 12 passed（含 `web_frontend_scheduled_loop_supports_poll_and_goal_kinds`、`task_schedule_run_due_appends_message_to_target_session`、scheduler 对齐用例）；`module_linkage_smoke` 4 passed。
- **打包验收**：独立 target 编译 → package.ps1 发布 bin（旧版备份）→ run.ps1 app 组合运行（health 200）→ API 验收：轮询型(content 不变重排)/Goal 推进型(完成清空)/404 校验全过；GLM5.2 会话 provider=阿里百炼 model=glm-5.2 reasoning_effort=max。详见 `tmp/acceptance-summary.txt`。
- 接口审查：新增字段均可选带默认，无破坏性变更；现有 `/api/task-schedules*` 路由签名不变。

## 2026-06-19 接力式顺序群发 + 单次重试（/api/chat/send/relay）

- **背景**：排查发现广播式群发（`/api/chat/send`）各会话独立看同一上下文、互不见彼此回复 → 实测让 test3/test5/test6 报数得 2/1/纠结，无法 1/2/3。用户要"接力式"：后者见前者所有回复。
- **实现（main.rs，零改 SendMessageRequest）**：新增端点 `POST /api/chat/send/relay` + `api_chat_send_relay`，复用 `prepare_chat_dispatch`/`persist_chat_dispatch`。
  - `relay_dispatch` 两阶段：①按 target 顺序接力，每个会话提示 = 原文 + 前序所有回复 + 位次（`build_relay_prompt`）；②超时会话入重试队列，第二阶段各重试一次（带最新接力上文），仍超时则结束（每会话至多一次重试）。
  - `relay_run_one` 用 `tokio::time::timeout`（会话 `default_timeout_ms` 钳 [60s,600s]）做超时门控。
- **验证**：`cargo test ... build_relay_prompt` 通过；编译发布后真机实测 `/api/chat/send/relay` 群发 test3/test5/test6 报数 → **1/2/3**（43.7s）。超时重试路径已实现（代码），因 60s 钳底未在本次现网触发。
- **风险关联**：本端点不走 auto-handoff（接力自带顺序协同）；持久化在接力结束后一次性落盘（与广播同，存在中途崩丢整批的 R3 风险，建议后续改增量落盘）。
- 接口审查：纯新增端点，无破坏性变更；前端触发开关（接力模式）待接入。

## 2026-06-19 群发取消广播=统一接力 + 接力超时配置项 + R3 增量持久化

- **取消广播**：`/api/chat/send` 与 `/api/chat/send/stream` 的多目标群发改为统一走接力（targets>1 → relay_dispatch / 流式逐会话 yield）；单目标保持原逻辑。`/api/chat/send/relay` 保留为显式别名。实测默认 `/api/chat/send` 群发 test3/test5/test6 报数 → 1/2/3。
- **接力超时配置项**：新增 `config.session.relay_timeout_ms`（默认 120s，运行时钳 [5s,600s]）；`relay_run_one` 改读它（取代原 `default_timeout_ms` 钳值）。新增 `GET/POST /api/chat/relay-config`（接受 relay_timeout_seconds，持久化 coolzhu.toml）。前端在**定时任务面板**加"接力超时(秒)"输入 + 保存（`loadRelayTimeout`/`saveRelayTimeout`）。实测 set 90s→toml 持久化→恢复 120s。
- **R3 增量持久化**：`relay_dispatch` 改为每步完成即 `persist_relay_step`（先落盘用户消息），抽出 `relay_run_and_persist_step` 复用于两阶段；`api_chat_send_relay` 去掉结尾全量 persist（避免重复 append）。中途崩不丢已完成回复。
- **验证**：`cargo test ... relay` 通过（build_relay_prompt + web_frontend_has_relay_timeout_control_and_endpoint）；编译发布后真机实测全过（见上）。
- 接口审查：`session.relay_timeout_ms` serde 默认兼容旧 toml；群发端点签名不变（仅多目标语义由广播改接力，属行为变更，已记需求表）。

## 2026-06-19 UI 缩放组件不跟随比例 —— 根因定位（任务2）

- **现象**：缩放/改窗口（尤其缩小或非 16:9）时主控制台组件不随整体等比，错位/相对偏大。
- **根因**：`.ui-redesign` 16:9 舞台（`min(100vw,100vh*16/9)`+`aspect-ratio:16/9`）按视口 letterbox，内部宏观 % 布局能等比；
  但 (a) 定义了 `--design-width/height:1920/1080` 却**无 `transform: scale()` 接线**（设计画布意图未实现，CSS/JS 均无全局舞台缩放）；
  (b) 叶子组件用 `clamp(px,Xvw,px)`——`vw` 参照**视口宽**非舞台、且 min/max px 上下限到边界即停；
  (c) 多处固定 px（`--dock-width:72px`/`--workbench-gap:10px`/`--window-side-title:46px`）完全不随舞台。
  → 视口非 16:9 或变小时，组件参照系（视口/固定px）与舞台真实缩放发散。
- **修复方向**：A(推荐) 设计画布 1920×1080 + 单一 `transform: scale(var(--ui-scale))`（JS resize 重算）统一等比；
  B 全舞台相对单位（cqw/cqh 或 --ui-scale 乘入）并移除固定 px/ clamp 上限。
- **沉淀**：已写入本模块 `开发规范.md` 的"UI 缩放设计检查点（16:9 舞台）"，作为后续 UI 修改设计的强制检查项；分析详见 `tmp/ui-scale-rootcause-analysis.txt`。
- 状态：先定位原因 + 记录（开发规范检查点），随后按用户"先修复画布缩放"指令落地方案 A（见下）。

## 2026-06-19 画布缩放修复（方案 A：设计画布 + 单一 transform: scale）

- **改动**：
  - `styles.css .ui-redesign`：由 `min(100vw,100vh*16/9)` letterbox 改为**固定设计像素** `width:calc(var(--design-width)*1px); height:calc(var(--design-height)*1px)`（1920×1080）+ `position:fixed; top/left:50%; transform: translate(-50%,-50%) scale(var(--ui-scale,1)); transform-origin:center`。
  - `app.js`：初始化块加 `applyUiScale()`（`--ui-scale = min(innerW/1920, innerH/1080)`）+ `resize` 监听 + 首次调用。
- **效果**：舞台内所有元素（含固定 px/字体/图标/clamp 组件）纳入**单一缩放变换**统一等比，消除"组件参照视口/固定px 与 letterbox 舞台发散"的根因。body `overflow:hidden` 裁掉缩放后空白边、居中显示。
- **验证**：新增静态资源测试 `web_frontend_ui_redesign_uses_design_canvas_scale` 通过；编译发布后服务端 `styles.css` 实测含 `scale(var(--ui-scale)`，health 200。建议人工开浏览器在极端窗口（小/高窄/宽扁）做最终视觉签收。
- 符合本模块开发规范新立的"UI 缩放设计检查点"。

## 2026-06-20 UI 缩放最终方案修正（铺满）+ 三项诊断（待决策）

### UI 缩放最终落地（修正上条）
- 上条"方案 A（设计画布 transform/zoom + JS --ui-scale）"在 Tauri WebView 实测**回归**（缩放值取错→整台缩中心）。最终采用：`.ui-redesign` 改 `width:100vw; height:100vh` **铺满整个视口**（放弃 16:9 letterbox 与 zoom/JS 缩放，内部 %布局自适应窗口比例）。用户确认"可以了"。
- 用户澄清要点：四周"星空"是 **body 背景**（非 UI 内容）；要的是控制台 UI 铺满 webview。

### 诊断1：GLM5.2 自主实现 IDE 两次单回合 0 改动 —— 根因锚定
- **是 harness 工程问题：聊天工具循环 `max_feedback_rounds` 默认 8（main.rs:4518 `default_tool_max_feedback_rounds`）上限太小**。`call_agent_model_with_tool_loop` 在第 8 轮仍有未派发 tool_use 即截断、最终答案空，故未走到"编辑+编译"。
- **排除项（证据）**：token 预算——context 仅用 **2.1%**(21132/1000000)，海量余量；网络/超时——工具调用成功、无超时错误；会话链路协议——真实回复/思考正常返回。→ 故**不是 token / 网络 / 协议**问题。
- **叠加真实依赖缺口**：方案要求 `regex`/`once_cell`/`walkdir`，web-console `Cargo.toml` 未引入，`--offline` 不能联网添加（GLM5.2 正确识别、正查离线缓存时回合结束）。
- **决策约束（用户）**：① **不降思考档位**（保持 reasoning_effort=max）；② **对齐 opencode 等市面方案**——长 agentic 循环跑到任务完成/真实停止条件，而非 8 轮硬截断（候选：大幅提高/取消轮数上限 + 跨回合自动续跑 + 成本/步数护栏 + 用户可中断）；③ 工具调用类失败纳入自检。详见 `tmp/glm52-ide-stop-diagnosis.txt`。

### 诊断2：task summary 与 tool-summary 不一致（R-D，待修同步）
- 根因：`model_diagnostic_note`(main.rs:17243) 对每个 tool_use **硬编码** "模型请求工具 X；当前仅生成 dry-run dispatch，不执行真实输入"，此 note 进入 agent_task 的 summary；而 `dispatch_plan_chat_summary`(main.rs:23114) 按真实 `route`（runtime-executed）写"已执行真实 runtime 工具调用 / LLM tool call 执行"。同一调用两处描述矛盾。
- 修向：`model_diagnostic_note` 不应无条件声称 dry-run；应省略该断言或反映真实派发结果（与 route/execute_allowed 同步）。

### 诊断3：聊天室显示了工具调用过程（待改为仅结果+失败原因）
- 现状：`dispatch_plan_chat_summary`(main.rs:23114) 输出"语义工具调度: route/status""LLM tool call 执行: name/action/execute_allowed""安全闸门""动作计划: steps…"等**过程**，由 `run_model_tool_use_message`(main.rs:22475) 作为 tool-summary 消息显示在聊天室。
- 用户要求：聊天室**只反馈调用结果 + 失败原因**，不显示调用过程。修向：精简该 summary（成功仅一句结果；失败给原因/错误文本），过程细节留诊断日志。

### 工具调用类失败 → 自检规划（决策后落地）
统一纳入自检/诊断：① 回合截断（最终答案空 / 轮数用尽仍有 pending tool_use / 声明写文件却无写工具成功）；② 轮数预算耗尽（明示并支持跨回合续跑）；③ 依赖缺口（开工前/编译失败时自检 crate 是否在 Cargo.toml+离线缓存）；④ dry-run/真实执行 一致性（诊断2）；⑤ 工具返回 is_error/非零/超时计入成功率；⑥ 重复空转（已有 L1 雏形）。

> 本轮按用户要求"先定位原因记录 work-log，供决策下一步方案"，未改代码（诊断2/3 与轮数改造待决策后实施）。
