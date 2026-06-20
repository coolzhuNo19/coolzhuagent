# 第四批方案规划：子 agent 并行 / todo 卡片 / 桌宠移植 / 手机远控（2026-05-30）

> 用户要求：以下 4 项为「方案规划」。本文件给出可落地的设计，代码待逐项实施。
> 先行已完成并实测：任务12 模型能力表 API `GET /api/models/capabilities`（HTTP 200，23 条目，
> glm-5→200k/16384/思考档[low,medium,high,xhigh,max]，glm-free→none,medium）。

---

## 任务16：会话配置「调用临时子 agent 处理并行任务」

### 目标
主会话遇到可并行拆分的工作时，派生若干**临时子 agent**并行执行子任务，完成后回收结果汇聚回主会话；
子 agent 用完即销毁（不污染会话列表与记忆）。

### 现有可复用积木
- 会话/Agent：`AgentSessionDto`、`/api/sessions` CRUD、`agent_chat_response`（真实模型回复）。
- 多 agent 协同：Goal 角色（commander/planner/implementer/verifier）、`chat_handoff` tool、roster。
- 并发闸门范式：本批新增的 `compute_use_input_gate`（tokio Mutex 排队）可借鉴做并发上限控制。

### 设计
1. **会话配置新增开关**：`sub_agent { enabled, max_parallel(默认3), inherit(provider/model/key 继承主会话), ttl_secs }`。
   - 持久化进 session（与 `reasoning_effort` 同链路，SQLite 列 + DTO 字段）。
2. **临时子 agent 模型**：`EphemeralAgent { id: "sub-<parent>-<n>", parent_session_id, task, status(pending/running/done/failed), result }`。
   - 进程级 `OnceLock<Mutex<HashMap<String, Vec<EphemeralAgent>>>>` 管理（仿 `pending_approvals`）。
   - 不写入 `/api/sessions` 列表（`selectable=false`），避免污染下拉。
3. **并行执行**：用 `tokio::task::JoinSet`（main.rs 已 import）并发跑 N 个子任务，
   每个调 `agent_chat_response`（继承主会话 provider/model/key）。`Semaphore(max_parallel)` 限并发。
4. **结果汇聚**：全部完成/超时后，把各子结果拼成一条 system/assistant 摘要回注主会话上下文；
   可选沉淀为 bead（高 kind 权重，与任务9 价值老化联动）。
5. **触发方式**：
   - 显式工具 `spawn_sub_agents({tasks:[...]})`（模型可调，走现有 tool dispatch + 审计）。
   - 或语义：主会话回答里出现"并行处理 A/B/C"时由后端拆分。
6. **路由**：`POST /api/sessions/{id}/sub-agents`（提交并行任务）、`GET /api/sessions/{id}/sub-agents`（状态）。

### 落地优先级
- P0：`EphemeralAgent` 状态机 + `JoinSet`+`Semaphore` 并行执行 + 结果汇聚（后端，纯新增）。
- P1：会话配置开关 UI + 子 agent 状态在任务窗口可视（复用任务17 的 todo 卡片）。
- P2：失败重试/超时回收 + 子结果沉淀 bead。

### 风险
- 远程 provider 并发限流/配额：`max_parallel` 必须可配，默认保守(3)。
- 成本放大：N 个子 agent = N 倍 token，UI 需显示预估消耗。

---

## 任务17：任务卡片补齐 todo list 显示（参考截图）

### 截图所示设计（用户提供的「任务状态」卡片）
右上角卡片标题「任务状态」，下列多条任务，每条 = **任务名 + 状态徽章 + 耗时**：
- `数据分析任务   [运行中]  00:12:34`
- `代码审查与优化  [运行中]  00:08:50`
- `知识库构建     [排队中]  --:--`
- `接口测试套件生成 [完成]   00:03:21`
- `报表生成与推送  [失败重试] 00:01:10`

状态徽章配色：运行中=蓝、排队中=橙、完成=绿、失败重试=红。

### 现状
- 顶部 `task-summary-card` 现为单任务（`task.currentTitle` + 我上轮加的进度条 + 工具审批 + 计划）。
- 需升级为**多条 todo list**，对接 Goal phases / 子 agent / schedule 三类任务源。

### 设计
1. **HTML**：把 `task-summary-card` 内换成 `task-todo-list`（最多显示 5 条，超出滚动）：
   ```html
   <ul class="task-todo-list" data-role="task-todo-list"></ul>
   ```
2. **数据源聚合**（app.js `syncTaskCardFromGoals` 扩展为 `syncTaskTodoList`）：
   - Goal phases → 每 phase 一条（名=phase.title，状态映射 running/pending/completed/failed）。
   - 子 agent（任务16）→ 每子任务一条。
   - schedule due → 排队中。
3. **状态徽章 + 耗时**：复用本批任务6 已建的 `TASK_CHAIN_PHASE_STATUS` 映射与状态灯 CSS；
   新增徽章样式 `task-badge {running|pending|done|failed}`（蓝/橙/绿/红，与截图一致）。
   耗时 = `now - started_at` 格式化 `mm:ss`/`HH:mm:ss`；排队中显示 `--:--`。
4. **失败重试**：状态 failed 且有 retry 计数时显示「失败重试」(对接任务4 的回退事件 retry_count)。
5. **实时更新**：复用现有 Goal SSE + 轮询，增量刷新每条耗时（前端 setInterval 1s 只更新时间文本）。

### 落地优先级（最具体、纯前端，建议本批先实现）
- P0：HTML 列表容器 + `syncTaskTodoList` 聚合 Goal phases + 徽章/耗时 + CSS。
- P1：接子 agent（任务16）与 schedule 源。

---

## 任务18：clawd-on-desk 桌宠调研与移植方案

> 注：本轮 WebSearch 不可用，clawd-on-desk 的**确切仓库实现需联网核实**。下列为基于
> 同类桌宠（Shimeji / 桌宠常见行为库）与本项目现有桌宠的移植框架，待补该仓库具体细节。

### 同类桌宠常见功能点（待用仓库实测校正）
- 常驻桌面透明窗（置顶、可穿透/可拖拽）、随机游走、重力下落、抓边缘攀爬。
- 状态机：idle / walk / run / drag(被拖拽) / fall / sleep / interact(点击反应)。
- 事件触发动画（通知、说话气泡）、跟随鼠标、多实例。

### 本项目现有桌宠（可复用）
- 入口：`coolzhu-tauri-shell.exe`（web-console 启动时自动拉起，main.rs 有日志）。
- 后端状态：`pet_state_store()`（`Mutex<PetStateSnapshot>`）、`pet_event_bus()`（broadcast）、
  `emit_backend_pet_event(kind, msg, category)` —— 已能把 agent/tool/chat 事件推给桌宠。
- 前端 office 场景：`office-robot`（mood：idle/working）、`robot-sprite`、`robot-label`。
- → **已有"事件驱动情绪/状态"骨架**，缺的是丰富的**行为动作逻辑 + 动画帧**。

### 移植方案（只移植行为动作逻辑，形象自研）
1. **抽象行为状态机**（与形象解耦）：把 clawd-on-desk 的状态转移表（idle→walk→…触发条件、概率、计时）
   提炼为纯逻辑模块 `pet_behavior`（Rust 或前端 JS），输入=事件/计时/鼠标，输出=动作枚举。
2. **动作枚举对接现有事件总线**：`emit_backend_pet_event` 的 kind 映射到动作（chat.started→talk，
   tool.running→work，idle→walk/sleep）。
3. **形象层替换**：动作枚举 → 本项目自研 sprite 表（见下"需设计的动作图"），不沿用对方美术。

### 需设计的桌宠形象动作图（精灵帧清单，供美术产出）
按状态机所需，建议每个动作 4–8 帧：
| 动作 | 用途 | 帧数建议 |
| --- | --- | --- |
| idle 待机（呼吸/眨眼） | 默认 | 4 |
| walk 行走（左右） | 随机游走 | 6 |
| run 奔跑 | 紧急/被召唤 | 6 |
| drag 被拖拽（挣扎） | 鼠标拖动 | 4 |
| fall 下落 + land 落地 | 重力 | 4+2 |
| sit/sleep 坐下/睡觉(Zzz) | 长时间 idle | 4 |
| talk 说话（配气泡） | chat 事件 | 4 |
| work 工作（敲键盘/转头看屏） | tool 运行 | 6 |
| cheer 庆祝 | 任务完成 | 4 |
| alert 警示（失败/需审批） | 失败/审批 | 4 |
| click-react 点击反应 | 用户交互 | 4 |

形象方向（需用户定）：保持 coolzhu 像素风机器人/吉祥物，与控制台 8-bit 城堡场景统一。

### 落地优先级
- P0：联网核实 clawd-on-desk 仓库，提炼其行为状态机为 `pet_behavior` 逻辑表（不含美术）。
- P1：动作枚举对接现有 `emit_backend_pet_event`。
- P2：自研 sprite 帧（上表）+ tauri-shell 前端动画播放。

---

## 任务19：手机远程控制消息输入方案

### 目标
用手机远程向 coolzhu（运行在 Windows PC）输入/发送消息（最小：远程在聊天框打字发送；
进阶：远程查看回复、触发动作）。

### 方案对比

| 方案 | 原理 | 优点 | 缺点/风险 |
| --- | --- | --- | --- |
| **A. Web 远程（推荐）** | coolzhu 已是本地 HTTP 服务(8765)，手机浏览器经局域网/内网穿透访问同一 Web 控制台 | 复用现有前端/API，几乎零新代码；跨平台(任意手机浏览器) | 需鉴权 + 网络可达(内网穿透/同 WiFi) |
| B. 轻量手机端 App | 原生/Flutter 小程序，调 coolzhu 的 `/api/chat/send` 等 REST | 体验好、可推送 | 要单独开发维护 App |
| C. 通用远程桌面(RustDesk/向日葵/AnyDesk/scrcpy 反向) | 远程操控整个 PC 桌面 | 现成、全功能 | 重(传全屏)、非"消息输入"专用、安全面大 |
| D. Android↔Windows 控制(scrcpy 是 PC控Android，反向需 KDE Connect/串流) | 设备互控 | — | 方向相反/复杂，不契合"手机控 PC 输入" |

### 推荐：方案 A（Web 远程）+ 必要增强
1. **网络可达**：
   - 同局域网：手机直接访 `http://<PC局域网IP>:8765/`（当前 `COOLZHU_WEB_BIND_ADDR` 可设 `0.0.0.0:8765`）。
   - 外网：内网穿透（cloudflared / frp / ngrok）或自建反代 + HTTPS。
2. **鉴权（必须）**：当前 Web 控制台无登录。新增轻量 token 鉴权：
   - 配置 `coolzhu.toml [remote] enabled, token`；非本机来源请求校验 `Authorization: Bearer <token>`。
   - 手机首次扫 PC 上显示的二维码（含 URL+token）建立会话。
3. **移动端适配**：现有前端是桌面布局；新增**精简移动视图**（仅聊天框 + 消息流 + 发送/语音），
   响应式或独立 `/m` 路由。
4. **最小可用闭环**：手机 `/m` 页面 → 选会话 → 输入 → `POST /api/chat/send` → SSE 看回复。
5. **进阶**：手机语音输入复用 `/api/audio/stt/*`；推送回复用 Web Push / 轮询。

### 安全要点
- 默认 bind `127.0.0.1`（仅本机）；开启远程必须显式配置 + token，并提示用户网络暴露风险。
- 内网穿透务必 HTTPS + token；记录远程访问审计。

### 落地优先级
- P0：`0.0.0.0` 绑定开关 + token 鉴权中间件 + 二维码配对页（最小远程打字闭环）。
- P1：移动端精简视图 `/m`。
- P2：手机语音输入 + 推送通知 + 内网穿透引导文档。

---

## 总览：四项均为"方案规划"，建议实施顺序
1. **任务17**（todo 卡片，纯前端、最具体、即时可见）——建议最先实现。
2. **任务16**（子 agent 并行，后端纯新增，与17 的 todo 源天然契合）。
3. **任务19**（手机远控，P0 = bind 开关+token+配对页，复用现有 API）。
4. **任务18**（桌宠移植，需先联网核实 clawd-on-desk + 美术产出，周期最长）。

每步遵循本项目铁律：改前 Read 确认锚点 → 小步 Edit → `cargo build` 退出码为准 → HTTP/测试实证 → 改后端先 Stop-Process 再 build。
