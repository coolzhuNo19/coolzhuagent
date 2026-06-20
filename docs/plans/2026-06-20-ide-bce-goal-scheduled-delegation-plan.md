# IDE 工程窗口 阶段 B-E · 托管 GLM5.2 + 定时任务 Goal 推进型 实施计划

> 日期：2026-06-20　性质：可执行计划（下一轮执行，本轮只撰写）
> 关联：IDE 总方案 docs/plans/ide-project-window-plan-2026-06-12.md（阶段 A 后端已由 GLM5.2 自主完成并运行期验收）
> 方式：把 IDE 前端阶段 B-E 分解为一个 Goal 的若干阶段（DAG），用「定时任务 Goal 推进型」按节拍推进，
> 实现者(implementer)= GLM5.2 会话 session-1781738898772；Claude Code 全程监督（节拍之间独立验证 + 介入）。

---

## 0. 现成前提（已就绪，无需重做）

- 工具循环轮数 40、工具默认超时 600s（cargo build 不被杀）、regex/once_cell/walkdir 已入 Cargo.toml。
- GLM5.2 会话：glm-5.2 / reasoning_effort=max / Key 已配 / full-access 已授予 / allowed_roots 含仓库。
- 阶段 A 后端三端点已上线可用（/api/project/symbol-index、/symbols、/search-files）。

## 1. 机制说明（执行前必读，避免踩坑）

### 1.1 Goal 模式（阶段 = DAG + 角色）
- 建 Goal：`POST /api/goals`（CreateGoalRequest: title, chat_room_id?, max_iterations?, completion_condition?）。
- 设阶段：`POST /api/goals/{goal_id}/plan`（GoalPlanRequest.phases[]，每项：
  `id, title, assigned_role, depends_on[], skills_required[], output_artifacts[], verification`）。阶段按 depends_on 成 DAG。
- 绑角色→会话：`POST /api/goals/roles/assign`（把 implementer 等角色绑到具体会话；GLM5.2 当 implementer）。
- 阶段执行 `run_goal_phase_once`（main.rs:9506）：
  1) `agent_chat_response(该阶段角色会话, prompt, …)` —— **走该会话的 40 轮工具循环**真实实现（GLM5.2 写代码）。
  2) `run_goal_phase_command_gate` —— **确定性命令门（cargo build/test 等）作为该阶段验证**；失败证据决定**回退 implementer 重做**还是推进完成。
  → 即 Goal 模式自带「实现→构建验证→失败回退」闭环（命令门级）。
- 推进 API：`POST /api/goals/{id}/dispatch-ready`（解依赖）、`/run-next`（跑下一个可运行阶段一次）、`/run-all`、
  `/{id}/phases/{phase_id}/run`；状态 `GET /api/goals/{id}/status`、事件 `GET /api/goals/{id}/events`；
  控制 `/{id}/pause`、`/resume`、`/cancel`、`/loop/start|stop`。

### 1.2 定时任务 Goal 推进型（按节拍推进）
- 建：`POST /api/task-schedules`（TaskScheduleCreateRequest）关键字段：
  `task_kind:"goal"`、`goal_id:<上面建的 goal>`、`schedule_kind:"interval"`、`interval_ms:>=60000`、
  `content:<说明文本>`、`target_session_id:<可填 GLM5.2，goal 型主要靠阶段角色驱动>`、`run_at_ms`。
  （task_kind=goal 时后端校验 goal 必须存在，否则 400/404。）
- 触发：到点由 `api_run_due_task_schedules`（/api/task-schedules/run-due，或后台 due 扫描）调
  `deliver_goal_scheduled_task`（main.rs:6401）：每次 tick **推进绑定 goal 一个可运行阶段**（dispatch-ready → run 下一个），
  `goal_completed` 时**自动停止并清空该定时任务**。cancelled/paused/finished 状态有对应短路处理。
- 即：**一个 interval 定时任务 = 每隔 N 分钟自动推进 IDE Goal 一个阶段，直到全部完成自动停。**

### 1.3 已知坑（执行时务必规避）
- **工作区 vs 仓库**：runtime write_file 默认相对路径解析到工作区 `~/coolzhuagent`，**不是仓库**。
  IDE 改的是仓库 `C:\Users\zhupu\Desktop\codex\modules\gui-web\...`，阶段 prompt 必须强制**绝对路径**（阶段 A 即如此才成功）。
- **include_str! 编译缓存**：改 index.html/app.js/styles.css 后，验证前必须 `touch main.rs` 再 build/test，否则陈旧产物掩盖真实结果（本轮血泪）。
- **GLM5.2 越界 + 自报不实**：阶段 A 它自称只改 main.rs 实则动了全部 UI 文件。监督必须**独立 diff 核对改动范围**，越界即回退。
- **巨型文件**：app.js 440KB / main.rs ~2MB，prompt 强制「禁整文件重写、精确锚点增量、每步编译」。

## 2. IDE B-E 阶段分解为 Goal 阶段（DAG）

每个 IDE 阶段拆成「implement 阶段（GLM5.2）」，验证由命令门 + 监督方独立跑契约测试承担。依赖关系沿用总方案
（A→B、A→C、B→D、B→E）。建议 Goal 阶段（assigned_role 全 = implementer = GLM5.2；depends_on 控制顺序）：

| phase id | title | depends_on | output_artifacts | verification(命令门/契约) |
|---|---|---|---|---|
| `ide-b-lineno` | 阶段B：行号双栏 + `:n` 跳转 + file 端点行窗口参数 | （A 已完成，无） | app.js renderIdeEditor/行号、main.rs file 端点 start_line/end_line、styles.css ide-gutter/ide-line-flash | `cargo build -p coolzhu-web-console --offline --target-dir modules/gui-web/target` 绿 + 规格1/2 |
| `ide-c-search` | 阶段C：omni-search(文件/@符号/:行) + Ctrl+点击取词跳转 | `ide-b-lineno` | app.js initIdeOmniSearch/openViewTab、index.html ide-omni-search/ide-omni-results | build 绿 + 规格3/4（@符号跨文件跳、Ctrl+点击多命中浮层） |
| `ide-d-diff` | 阶段D：View/Diff 合并按钮状态机 + self-diff 默认 + 右路径回车 + 树拖拽 dropzone | `ide-b-lineno` | app.js ideModeToggle/diff dropzone、index.html ide-diff-paths/ide-diff-right、树节点 draggable | build 绿 + 规格5 |
| `ide-e-tabs` | 阶段E：多文件标签页 ideState.tabs + tabbar 渲染/切换/关闭/sessionStorage 持久 | `ide-b-lineno` | app.js renderIdeTabbar/ideState、index.html ide-tabbar、styles.css tab 样式 | build 绿 + 规格6 |
| `ide-final` | 收尾：旧按钮下线 + 全规格回归 + 不回归(树/splitter/内容搜索) + work-log | `ide-c-search,ide-d-diff,ide-e-tabs` | work-log | `cargo test -p coolzhu-web-console --offline --target-dir modules/gui-web/target -- --test-threads=1` 全绿 |

> 注：B/C/D/E 触点见总方案 §6；每阶段 prompt 附该阶段对应的总方案小节（§4.4/§4.3/§4.6/§4.7）与「规格N」验收口径。
> verification 字段可写 `{"kind":"command","command":"cargo build ...","expect":"exit 0"}` 形式（具体 schema 执行时按 GoalPlanPhaseRequest.verification 实测确认）。

## 3. 角色绑定

- `implementer` → GLM5.2（session-1781738898772）：每阶段的真实编码。
- `planner` → GLM5.2 或留空：本计划阶段已预先拆好，planner 阶段可省（直接给 implementer 明确 prompt）。
- `verifier` → 由命令门(cargo build/test) + **Claude Code 监督**承担（不绑独立会话，避免再引入不确定的第二个模型）。
- `commander` → Claude Code（人工/监督位）：阶段间审阅、决定 pause/resume/重规划。
- 执行：`POST /api/goals/roles/assign` 把 implementer 绑 GLM5.2；其余角色按上述策略。

## 4. 定时任务配置（节拍）

- `POST /api/task-schedules`：`task_kind:"goal"`、`goal_id:<IDE goal>`、`schedule_kind:"interval"`、
  `interval_ms: 1800000`（30 分钟/阶段，给监督方留出独立验证窗口）、`content:"IDE B-E goal 推进"`。
- 节拍语义：每 30 分钟自动推进一个阶段；阶段内 GLM5.2 跑 40 轮工具循环 + 命令门验证；全部完成自动停。
- **备选/降级**：若定时 goal 推进型实测有问题（如 due 扫描不触发/阶段卡住），降级为**手动 `POST /api/goals/{id}/run-next` 逐阶段推进**（每跑完一阶段我验证后再手动推下一阶段），把"自动节拍"换成"监督手动节拍"，更可控。首轮建议先手动 run-next 跑通 1-2 个阶段验证机制，再切定时自动。

## 5. 监督 GLM5.2 定时推进 Goal 的方案（核心）

### 5.1 启动前（一次性）
1. 备份三件套 + main.rs 到 `tmp/backups/ide-bce-<date>-pre/`（防 GLM5.2 越界/损坏，可回退）。
2. 确认 git：当前 `.git` 为空（无版本控制）——**强烈建议先 `git init` + 首次提交**，让每阶段可 `git diff`/`git stash` 审改动、出错可 `git checkout` 回退（否则又陷入"无历史不可恢复"）。这是监督的关键基础设施。
3. 建 Goal + 设阶段(§2) + 绑角色(§3)，先 `GET /api/goals/{id}/status` 确认阶段 DAG 正确。

### 5.2 每阶段（tick）监督闭环
对每个阶段，节拍触发(或手动 run-next)后，Claude Code 执行：
1. **盯过程**：`GET /api/goals/{id}/events` + err.log `[goal]`/`[TOOL-LOOP]` 看 GLM5.2 实际工具调用；watch 目标文件 mtime/大小。
2. **范围核对**（防越界）：`git diff --stat`（init 后）核对本阶段只动了预期文件；越界文件即 `git checkout` 回退 + 给 GLM5.2 纠偏 prompt。
3. **独立验证**（不信自报）：自己 `touch main.rs` + `cargo build`，再跑该阶段契约测试（规格 N 对应的 web_frontend_* 测试），而非只看命令门结论。
4. **完整性**：main.rs/app.js 大小合理无截断；浏览器 GET / 抓 served 资源核对新标记（如阶段 A 那样）。
5. **判定**：
   - 通过 → 让 goal 推进下一阶段（定时自动 / 手动 run-next）。
   - 失败/越界/卡死/空转 → `POST /api/goals/{id}/pause` 暂停 → 我修或回退或改 prompt → `/resume`。
   - 命令门已自带「回退 implementer 重做」，但**重试上限要盯**：同阶段连续失败 N 次（建议 3）即暂停人工介入，避免无限空转（对应 CUR-GOAL-LOOP-001 缺失败回退的补位——由监督方兜）。
6. **留痕**：每阶段在 tmp/backups 增量快照 + 简短验证日志。

### 5.3 全局护栏
- **成本/步数**：interval 30min + 每阶段 40 轮上限；总阶段 5 个；预估上限可控。监督方每 tick 检查一次即可，不需常驻轮询。
- **可中断**：随时 `POST /api/goals/{id}/pause` 或删定时任务 `DELETE /api/task-schedules/{id}`。
- **完成**：`ide-final` 阶段全绿后，停定时任务、部署(停旧→package→启动)、served 标记核验、交付视觉确认给用户。

## 6. 下一轮执行步骤（顺序）

1. `git init` + 首次提交（基线，监督基础设施）；备份三件套+main.rs。
2. `POST /api/goals` 建 IDE Goal（title="IDE 工程窗口 B-E"）。
3. `POST /api/goals/{id}/plan` 设 §2 的 5 个阶段（DAG）。
4. `POST /api/goals/roles/assign` 绑 implementer=GLM5.2。
5. `GET /api/goals/{id}/status` 核对阶段/角色/依赖。
6. **先手动验证机制**：`POST /api/goals/{id}/run-next` 跑第一个阶段 `ide-b-lineno`，按 §5.2 监督闭环验证跑通。
7. 机制确认 OK 后，`POST /api/task-schedules`（task_kind=goal,interval 30min）切自动节拍；或继续手动 run-next（更可控）。
8. 逐阶段监督到 `ide-final` 全绿 → 停定时任务 → 部署 → 核验 → 交付。

## 7. 待定决策（执行时定）

- 节拍：自动定时(30min) vs 监督手动 run-next。**建议首轮手动**跑通 B 阶段验证机制，再决定是否切自动。
- planner 阶段：省略（直接给 implementer 详细 prompt）vs 让 GLM5.2 先 planner 产出子计划再 implement。建议先省略。
- verification 字段 schema：执行时先 `GET` 一个已有 goal 或读 set_goal_plan_sqlite 确认 verification JSON 形态。
- 是否 git init：强烈建议是（监督回退的基础），但需用户确认（会在仓库建 .git + 首次提交）。

## 8. 风险与缓解（汇总）

| 风险 | 缓解 |
|---|---|
| GLM5.2 改仓库外/相对路径写错地方 | prompt 强制绝对路径；git diff 核对；workspace 仍是 ~/coolzhuagent |
| GLM5.2 越界改非目标文件（前科） | 每阶段 git diff --stat 核对 + 越界回退 |
| include_str! 缓存掩盖失败 | 验证前 touch main.rs 强制重编译 |
| 阶段无限失败空转 | 重试上限 3 次即 pause 人工介入 |
| 定时 goal 推进型实测异常 | 降级手动 run-next 逐阶段 |
| 巨型文件损坏 | 每阶段前备份 + git 基线，可回退 |
| 无 git 历史不可恢复（本轮教训） | 启动前 git init + 首次提交 |
