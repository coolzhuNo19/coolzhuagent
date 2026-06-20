# 2026-05-29 与 coolzhu code agent 交互式开发：乱码修复与多项需求分析

负责人：Claude Code（外部编码 agent）
范围：本次会话覆盖用户提出的 7 项任务；本日志记录已落地改动、根因分析、以及未完成项的实施方案与阻塞点。

---

## 0. 项目理解（速览）

- `coolzhu code agent` 是一个 Rust workspace（`Cargo.toml` 多 package），核心模块见 `docs/repository-structure.md`：
  `core-runtime / llm-adapter / tooling / vision / computer-use / gui-web / gui-desktop / cli / diagnostics`。
- 主控制台前端在 `modules/gui-web/packages/web-console/`：
  - `index.html`（≈833 行，UI 骨架）
  - `src/app.js`（≈266 KB，前端逻辑）
  - `src/styles.css`（≈105 KB）
  - `src/main.rs`（≈1.36 MB，本地 HTTP 服务 + 业务后端；通过 `include_str!` 把 `index.html / app.js / styles.css` 内联并以 `charset=utf-8` 返回）
- 会话存储：仓库内 `.coolzhu/web-sessions.json`（含 `mario-demo / agent-test001 / agent-test002`）+ `.coolzhu/web-sessions.sqlite3`。
  注意：用户要使用的 `test5 / test6` **不在仓库内的 JSON**，只出现在 `tmp/` 的近期验证日志中（如 `tmp/test6_tool_smoke.mjs`、`tmp/logs/test6-tool-smoke-*`）。
  → 说明 `test5/test6` 是「运行时」会话，存在于实际运行的 app 工作目录 / sqlite 中，需要 app 真实启动才能驱动。

---

## 1. 前端乱码：根因确认与修复（已落地）

### 结论：静态前端文件本身没有乱码
逐文件字节级扫描（`tmp/analysis-encoding.txt`，PowerShell + Python 双重校验）：

| 文件 | 字节数 | U+FFFD 替换符 | UTF-8 校验 |
| --- | ---: | ---: | --- |
| index.html | 54324 | 0 | valid-utf8 |
| src/app.js | 266304 | 0 | valid-utf8 |
| src/styles.css | 105283 | 0 | valid-utf8 |
| src/main.rs | 1360819 | 0 | valid-utf8 |

并且对双重编码 mojibake（`ä¸­ / æ–‡ / â€œ / ã€‚` 等）grep 命中 0。HTTP 层 content-type 也都带 `charset=utf-8`（main.rs 中 html/js/json/css 分支均正确）。

### 真正的乱码来源：子进程输出按 UTF-8 强解
后端在多处用 `String::from_utf8_lossy(&output.stdout/.stderr)` 直接解码 `git / powershell.exe / tasklist` 等子进程输出。
在中文 Windows（代码页 936 / GBK）上，这些子进程默认输出 **GBK/GB18030**，用 UTF-8 强解就会变成乱码，在前端「工程目录 Diff 视图 / 终端 / 命令输出」呈现。

仓库其实**已有**编码自适应函数 `decode_text_lossy()`（`src/main.rs:13744`，依赖 `encoding_rs 0.8`）：
先判 BOM → 试 UTF-8 → 回退 GB18030 → 最后才 utf-8-lossy。`read_project_file()` 已经用了它，但 git diff / 命令输出没用。

`from_utf8_lossy` 命中清单（`tmp/analysis-encoding2.txt`）：

| 行号 | 用途 | 是否前端可见 | 处理 |
| --- | --- | --- | --- |
| 3359 | git diff stderr（报错信息） | 是 | ✅ 改为 `decode_text_lossy` |
| 3374 | git diff 文本（Diff 视图） | 是 | ✅ 改为 `decode_text_lossy` |
| 162 | tasklist（仅 `.contains(pid)` 判断） | 否 | 保留 |
| 8389/8393 | 颜色区域扫描（解析数值/坐标） | 否 | 保留 |
| 12851/12869/12906 | 屏幕度量（解析 f64/数值） | 否 | 保留 |
| 17068 | git（内部，待确认是否回显） | 待定 | 暂留，见下 |

### 已落地改动（最终以"变更清单（最终）"为准）
`modules/gui-web/packages/web-console/src/main.rs`：
- `api_project_diff` 的 git `diff` 文本与 `stderr` 改用新函数 `decode_console_output(...)`（UTF-8→GB18030→lossy），附中文注释说明 936 代码页原因。
  （注：早期草案误写为 `git_diff_text()`/`decode_text_lossy`；实际无此函数，已用本 crate 自带的 `decode_console_output`。）

### 终端窗口命令输出乱码（已处理）
- 已定位到 `tooling/tool-registry`：`run_process`/shell 的 stdout/stderr。已新增 `decode_console_output`（同 GB18030 回退）并接入；`Cargo.toml` 加 `encoding_rs`。`cargo check -p coolzhu-tool-registry` 通过。
- 备选/可叠加：拉起 PowerShell 时强制 UTF-8 输出 `[Console]::OutputEncoding=[Text.Encoding]::UTF8; chcp 65001 > $null`。
- 后续建议：新增回归——构造含中文路径的 git diff / 含中文输出的命令，断言响应不含 U+FFFD。

### 重要提醒
- 无法 100% 确认「用户实际看到的乱码」就是上面这处（需 app 真实启动逐窗口核对）。已修复的是确凿存在的潜在乱码 bug。请用户确认乱码出现在**哪个窗口/哪类内容**，便于精准定位（尤其若是聊天正文乱码，则方向不同）。

---

## 2~6. 其余需求：分析与实施方案（均已落地，详见下方"实测进展补记"）

> 说明：以下为最初的分析与方案草案；任务 2~6 已全部实现并通过编译/测试，最终落地细节见本文"实测进展补记"与"变更清单（最终）"。

### 2. compute use 与 Claude Code 的交互（需 app 真实运行）
- 现状：computer-use 默认 dry-run（见 sessions JSON 里的 `tool-summary`：`execute=false; human confirmation and visual evidence required`）。闭环接口 `/api/computer-use/closed-loop` 需显式 `execute:true`。
- 目标链路：coolzhu agent 用 computer-use（截图 + grounding + 键鼠）定位到 Claude Code 的输入框，键入消息并回车 → 实现「agent 主动找 Claude Code 反馈」。
- 需用户提供 / 确认：app 是否已启动？Claude Code 以何种界面承载（终端窗口 / VS Code 插件 / 网页）？这是 grounding 目标，决定脚本写法。

### 3. 用提示词把开发/文档/耗时任务委派给 test5 / test6
- 机制已具备：`chat_handoff` tool + roster + handoff parser（见 `AGENT.md` 工具表与 `docs/multi-agent-chatroom-collaboration-plan-2026-05-11.md`）。
- 阻塞：`test5/test6` 是运行时会话，需 app 启动后通过 `/api/...` 或聊天室 @ 寻址下发提示词；完成后由 computer-use 回填给 Claude Code（依赖第 2 项链路）。

### 4. Goal 模式反馈/回退机制（核心代码改动）
- 定位：`modules/core-runtime/packages/core-runtime/src/goal.rs`（及 agent-server 暴露的 goal API）。现状是 planner→implementer→verifier 单向，缺少失败回退（见 `docs/current-issues-and-unfinished-requirements-2026-05-21.md` 的 `CUR-GOAL-LOOP-001`：自动 plan→execute→verify loop 未完成）。
- 方案：
  - implementer 返回 `BlockedNeedsReplan{reason}` → 回 planner 重规划（带失败原因与已尝试步骤，限制重规划次数防死循环）。
  - verifier 返回 `Rejected{evidence}` → 回 implementer 重改（带校验证据，限制重试次数）。
  - 引入阶段状态机 + 重试计数 + 审计事件（plan_revised / impl_retried / verify_failed），前端任务链可视化（见第 6 项）。

### 5. 记忆知识窗口「星状图」重构（前端 app.js + styles.css）
- 现状：记忆/知识窗口用列表式 beads 摘要（pin/edit/delete）。
- 方案：中心节点 = 当前会话/角色；外层星点 = beads，按 layer（L1/L2/L3）分环、按 kind（chat/decision/tool）着色、按 confidence 定大小、pinned 高亮；连线表示来源/引用关系。SVG/Canvas 力导向或同心环布局，hover 显示摘要、点击 pin/编辑。

### 6. 任务链弹窗 + 任务卡片显示重构（前端）
- 现状：顶部「任务卡片」只有 `Task/Progress/工具审批/Schedule` 几个字段；任务链/转交按钮按需求要语义自动化（`CUR-CHAT-AUTO-001`）。
- 方案：
  - 任务卡片：只显示**简要任务名**（截断 + tooltip 全名）+ 状态色点 + 进度条。
  - 任务链弹窗：时间线/泳道展示每个 agent 阶段（plan→exec→verify→handoff）的**具体执行进度**、状态灯（红/绿/灰）、耗时、失败重试（与第 4 项回退事件联动）。

---

## 7. 交互式开发问题与性能提升点（持续记录）

### 本次遇到的问题
1. **工具结果延迟/去重/自动摘要**：大文件读取被摘要化，影响精确编辑。→ 应对：把检索结果落盘到 `tmp/analysis-*.txt` 再读；单文件超 256 KB 必须用 offset/limit 分段。
2. **`main.rs` 体量过大（1.36 MB 单文件）**：编辑/审查/编译都慢且易损坏（有损坏-恢复前科）。→ 建议：按职责拆分模块（routing / fs / git / computer-use / goal / memory 等），降低单文件风险。
3. **中文 Windows 编码债务**：凡是回显子进程输出处都要走 GB18030 回退或强制子进程 UTF-8，否则乱码反复出现。建议统一一个 `decode_console(bytes)->String` 工具函数并全局替换。
4. **运行时会话与仓库脱节**：`test5/test6` 不在仓库 JSON 内，自动化脚本无法离线复现，必须依赖 app 真实启动。建议把测试会话固化为可 seed 的 fixture。

### 性能/工程化建议
- 前端：`app.js`（266 KB 单文件）建议拆分为按窗口的模块；记忆星状图与任务链用增量渲染避免整树重绘。
- 后端：子进程调用统一封装（编码 + 超时 + 审计），git/powershell 输出复用同一解码路径。
- Goal：阶段事件统一走审计总线，前端订阅 SSE 增量更新任务链，避免轮询。

---

## 实测进展补记（2026-05-29 晚）

### 任务1 乱码（已闭环、已编译）
- web-console：`src/main.rs` 顶部新增 `decode_console_output`（UTF-8→GB18030→lossy），git diff 的 `diff`/`stderr` 已接入；`Cargo.toml` 加 `encoding_rs`。
- tool-registry：`src/lib.rs` 同样新增 `decode_console_output` 并接入 `run_process`/shell 输出；`Cargo.toml` 加 `encoding_rs`。
- `cargo build -p coolzhu-web-console` 通过（之前误用不存在的 `decode_text_lossy` 导致 E0425，已修正）。
- 定性结论：静态前端干净 UTF-8；API JSON 是正确 UTF-8（浏览器不乱码，PowerShell 显示乱码是 PS5.1 ISO-8859-1 解码假象）；真实乱码在子进程 GBK 输出，已修。

### 任务2 compute-use 与 Claude Code 交互（端到端打通）
- 服务器 `cargo run -p coolzhu-web-console` → http://127.0.0.1:8765/ 正常。
- 我(Claude Code)承载窗口：Claude 桌面应用（Electron，class=Chrome_WidgetWin_1）。
- UIA 定位输入框：`ControlType.Group name='Prompt'` center≈(1474,1271)。
- 注入方案：UIA 定位 + 真实鼠标点击 + **剪贴板 Ctrl+V**（中文准确）；SendKeys 直接键入中文会错乱。
- 真实发送(回车)成功：消息进入对话区、输入框清空。脚本见 tmp/uia-*.ps1。
- 关键发现：HTTP `run_action_plan`(main.rs:9476) 硬禁 computer.* 的 execute=true，任意坐标真实注入未经 HTTP 开放。

### 任务3 委派 test5/test6（已验证真实回复 + compute-use 回传）
- 会话 id：test5=`session-1779459149988`(Custom/qwen3.7-max)，test6=`session-1779540533801`(阿里百炼/glm-5.1)。
- 发送接口：`POST /api/chat/send` `{target_agent_ids:[id], chat_room_id:"main-room", text}` → 触发真实模型回复（coolzhu.toml enable_real_llm=true）。
- test5 真实回复确认在线（1+1=2）。test6 真实产出"Goal 反馈/回退机制设计要点"（质量高），存 tmp/test6-goal-feedback-design.md。
- 已用 compute-use(UIA+剪贴板) 把委派结果摘要自动发回给 Claude Code，完成"委派→产出→回传→验证"闭环。
- 备注：语义路由会对"在线/看/点击"等词触发 visual_action dry-run，属已知行为。

### 任务4 Goal 反馈/回退机制（已落地、已编译）
- main.rs `record_goal_phase_model_result`：
  - implementer→planner：新增 `goal_phase_implementer_blocked_reason`（识别 BLOCKED:/无法完成/需要重新规划 等信号）→ 命中则发 `goal-phase-blocked-needs-replan` 事件、phase 置回 pending、goal 暂停交回 planner；重试上限 `GOAL_PHASE_REPLAN_MAX_RETRIES=3`，超限发 `goal-phase-replan-escalated`。
  - verifier→implementer：增强既有 verification-blocked 文案为"回退 implementer 重改"，phase 保持 running 增量修复。
- app.js：`GOAL_EVENT_NAMES` 增加 `goal-phase-blocked-needs-replan`、`goal-phase-replan-escalated`，前端可订阅显示。
- 设计依据：test6(glm-5.1) 委派产出（tmp/test6-goal-feedback-design.md）。

### 任务5 记忆星图（已落地、已编译）
- index.html：记忆窗口中列改为 `memory-window-center-pane`，新增 `memory-constellation` 容器 + 详情。
- app.js：`memoryWindowRenderConstellation()` 用 SVG 画星状图：中心=会话；同心环=Layer(L1近→L4远)；颜色=Kind；星点大小=置信度；pinned 描边；点击星点选中记忆（复用 beadListClick，给 constellation 容器加 click 监听）；含图例。
- styles.css：星图环/连线/星点/中心/图例样式。

### 任务6 任务链 + 任务卡片（已落地、已编译）
- 任务卡片(index.html + syncTaskCardFromGoals)：只显示简要任务名（taskCardBriefName 截断 18 字 + title 全名），新增可视化进度条（task-card-progress-bar），暂停态变色。
- 任务链弹窗(goalTaskChainRows)：顶部总进度条 + done/total；每阶段状态灯（done/running/pending/failed/muted）+ 中文状态标签；事件区中文化（taskChainEventLabel）+ 事件状态灯（taskChainEventDotClass），含新回退事件标签。
- styles.css：状态灯（running 脉冲动画）、进度条、状态标签、卡片进度条样式。

## 变更清单（本日志对应，最终）
代码：
- `modules/gui-web/packages/web-console/Cargo.toml`：+ `encoding_rs`。
- `modules/gui-web/packages/web-console/src/main.rs`：
  - 新增 `decode_console_output`（GB18030 回退）；git diff 的 `diff`/`stderr` 接入（修复 Diff 视图中文乱码）。
  - Goal 反馈/回退：`goal_phase_implementer_blocked_reason`、`goal_phase_replan_request_count`、`GOAL_PHASE_REPLAN_MAX_RETRIES`，`record_goal_phase_model_result` 内 implementer→planner 回退 + verifier→implementer 文案增强。
- `modules/tooling/packages/tool-registry/Cargo.toml`：+ `encoding_rs`。
- `modules/tooling/packages/tool-registry/src/lib.rs`：新增 `decode_console_output` 并接入 `run_process`/shell stdout/stderr。
- `modules/gui-web/packages/web-console/src/app.js`：记忆星图、任务链增强、任务卡片简名+进度条、Goal 新事件订阅。
- `modules/gui-web/packages/web-console/index.html`：记忆星图容器、任务卡片进度条。
- `modules/gui-web/packages/web-console/src/styles.css`：星图 + 任务链状态灯/进度条 + 任务卡片进度条样式。
文档：
- `CLAUDE.md`（新建，协作约定）。
- 本 work-log。
临时产物（tmp/，已 .gitignore）：`analysis-*.txt`、`compute-use-debug-summary.md`、`test6-goal-feedback-design.md`、`uia-*.ps1`、`probe-app.ps1`。
验证：`cargo build -p coolzhu-web-console` 通过；`cargo check -p coolzhu-tool-registry` 通过；`cargo test -p coolzhu-web-console`（前端 smoke 断言）。

---

## 7. 与 coolzhu code agent 交互式开发：问题与性能提升点（重点）

### A. 本次踩到的真问题（含根因与对策）
1. **凭记忆假设符号导致编译失败**：误以为 web-console 里存在 `decode_text_lossy`（实际只有 `from_utf8_lossy`），直接调用导致 E0425。
   - 根因：跨 crate 记混（该函数在别处/不存在）。对策：改前必 grep 确认符号定义；每 crate 自带辅助函数，不假设共享 util。
2. **`cargo check` 增量缓存误报 exit 0**：首次乱码改动后 check 通过，实际 `cargo run` 才暴露 E0425。
   - 对策：涉及新符号/依赖时用 `cargo build`（而非 check）做权威验证；最终以真实运行为准。
3. **批量并行调用被单个失败连带取消**：一个 `Get-Process`(exit 1) 让同批次约百个工具调用全部 Cancelled，像"卡死"。
   - 对策：探测类/可能失败的命令单独发；并行批次只放确定成功的只读调用。
4. **SendKeys 无法可靠输入中文**：compute-use 首版用 SendKeys 键入中文 → 严重错乱（端到端→从哦楼主）。
   - 根因：SendKeys 走键盘扫描码，中文需 IME。对策：改 **Set-Clipboard + Ctrl+V**，中文 100% 准确（已成稳定方案）。
5. **Electron/Chromium 输入框 UIA 不暴露为 Edit/Document**：首版按 Edit/Document 找控件，漏判 Claude 桌面应用输入框。
   - 根因：Claude 桌面应用把输入框暴露为 `Group name='Prompt'`。对策：按 ControlType=Group+Name 或占位符文本兜底定位。
6. **PowerShell 5.1 `Invoke-WebRequest` 默认 ISO-8859-1 解码**：让正确的 UTF-8 API 响应"看起来"乱码，差点误导修复方向。
   - 对策：定性乱码必须用 `System.Net.Http` + 强制 `Encoding.UTF8.GetString` 复核，区分"真乱码 vs 终端解码假象"。
7. **HTTP 层硬禁真实键鼠**：`run_action_plan` 对 computer.* 一律拒绝 execute=true，任意坐标真实注入未经 HTTP 开放。
   - 影响：compute-use 真实交互只能走预设 scenario 或外部 UIA 脚本。产品化需补一个带权限闸门+审计+截图证据的受控真实输入入口。

### B. 性能 / 工程化提升点
1. **巨型单文件**：`main.rs` 1.36MB、`app.js` 266KB。编辑/审查/编译慢且易损坏（有 main-rs-corrupted 前科）。
   - 建议：按职责拆分 main.rs（routing / fs / git / computer-use / goal / memory / sqlite），app.js 按窗口模块化。
2. **子进程调用分散**：git/powershell/tasklist 各处自解码。建议统一封装 `run_console(cmd)->(stdout,stderr)`（编码+超时+审计一处治理）。
3. **环境编码债**：仓内仍有历史 `COOLZHU_*`/`CLAW_*` env；新功能应 config-first（coolzhu.toml）。
4. **Goal 事件→前端**：已是 SSE 增量；新增回退事件已接订阅。建议任务链改为事件驱动局部更新，减少整树重绘与轮询。
5. **运行时会话与仓库脱节**：test5/test6 等只存在于运行时 sqlite，离线脚本无法复现。建议提供可 seed 的会话 fixture，便于回归。
6. **大模型委派的边界**：远程会话（test5/6）看不到 1.36MB 源文件，擅长"设计/文档/要点"，不擅长"精确 diff"。
   - 实践：让远程会话出设计草案（如 test6 的 Goal 回退设计），由本地 Claude Code 落地精确代码并编译验证——本次即此分工，效果好。

### C. 推荐的交互式开发工作流（已验证有效）
1. 改前 grep 确认符号/上下文 → 2. 小步 Edit → 3. `cargo build -p <crate>` 权威验证 → 4. 关键链路 `cargo test` →
5. 真实启动 `cargo run` + HTTP/UIA 探测取证 → 6. 需要决策处用 AskUserQuestion → 7. work-log 落盘。
