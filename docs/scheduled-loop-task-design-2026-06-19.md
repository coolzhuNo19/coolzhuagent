# 定时 loop 任务方案设计（2026-06-19）

> 需求来源：用户要求"开发定时 loop 任务功能"——指派指定会话 Agent 每隔可配置时间执行指定任务，
> 完成后可更新任务目标、下一次定时推进、目标完成清空。分两类场景：①定时轮询；②长时 Goal 推进。

## 1. 现状基线（已存在，避免造重复轮子）

后端 `modules/gui-web/packages/web-console/src/main.rs`：
- 数据：`ConfigScheduledTask`（存 `config.scheduled_tasks.tasks` → coolzhu.toml）
  字段：id / target_session_id / content / run_at_ms / interval_ms / permissions / status /
  created_at_ms / last_run_at_ms / last_error / schedule_kind(once|interval|daily|weekly) /
  wall_hour / wall_minute / weekdays / tz_offset_minutes。
- 路由：`GET/POST /api/task-schedules`、`DELETE /api/task-schedules/{id}`、`POST /api/task-schedules/run-due`。
- 引擎：`spawn_scheduled_task_scheduler()`（每 30s 扫描，不依赖前端）→ `run_due_task_schedules_once()`
  （到期判定 status==scheduled && run_at<=now；防漂移 `next_aligned_run_at` / 挂钟 `next_wallclock_fire`）→
  `deliver_scheduled_task()`（构造 `SendMessageRequest{text: content}` 调 `api_chat_send` 复用聊天主链路，
  可选 full-access 临时授权 300s TTL）。
- 前端 `app.js` ~2587-2638 已有定时任务创建/执行/删除；`index.html` 有面板。

**结论**：用户"①定时轮询"场景已具备（到点把同一 content 发给会话，再按计划重排）。
缺口是"②Goal 推进型"与两类的显式区分、目标更新/完成清空。

## 2. Goal 模式可复用接口

- `GET /api/goals`（`api_goals`）：列目标，供前端 Goal 选择器。
- `next_runnable_goal_phase_id(&GoalDto) -> Option<String>`：下一个可运行阶段。
- `dispatch_ready_goal_phases(ws, goal_id)`：派发就绪阶段。
- `run_goal_phase_once(ws, goal_id, phase_id).await -> GoalPhaseRunResult`（含 status/assigned_session_id/messages/phase_id）。
- 推进一步标准流程见 `api_run_next_goal_phase`：取 status → 无 runnable 且未 paused/cancelled/completed → dispatch → 再取 status → 取 next runnable → 无则 blocked/完成，有则 run_once。
- 目标完成：`status.goal.status == "completed"`（全部阶段完成后由既有逻辑置位）。

## 3. 设计：在现有定时任务上扩展"任务类型"

### 3.1 数据模型扩展（`ConfigScheduledTask` 新增，均带 serde default，兼容旧 toml）
- `task_kind: String`（default `"poll"`）：`"poll"`=轮询型；`"goal"`=Goal 推进型。
- `goal_id: Option<String>`（default None）：task_kind="goal" 时绑定的目标。

### 3.2 两类场景行为

**① 轮询型 poll（默认，现状即是）**
- 到点：把 `content` 发给 `target_session_id`（现有 deliver 逻辑）。
- 完成后：按 schedule_kind/interval 重排，**content 不变**（"下一次任务内容与当前一致"）。
- 例：每天 10:00 让会话搜集 GitHub Top10 AI 热点写入指定目录文档。

**② Goal 推进型 goal**
- 到点：对绑定 `goal_id` 执行"推进一步"（复用 `api_run_next_goal_phase` 流程：
  dispatch-ready → run 下一个 runnable phase once）。指派对象为该阶段在 Goal 模式中绑定的角色会话。
- 完成一步后：更新 `content` 为进度摘要（"Goal X：已完成 N/M 阶段，下一步：<phase 标题>"），满足"执行结果更新任务目标"。
- 重排：按 schedule_kind/interval 排下一次（"下一次定时达到往下一步推进"）。
- 整体目标完成（`goal.status=="completed"` 或无 runnable 且全完成）：把该定时任务 `status="completed"`，
  停止后续触发（"目标完成清空任务"），content 记"目标已完成"。
- 阻塞（无 runnable 但未完成）：软成功，content 记"等待依赖/被阻塞"，下次间隔再试。
- 出错（goal 不存在等）：status="failed"，last_error 记原因。

### 3.3 交付路径（delivery）改造
`run_due_task_schedules_once()` 按 `task.task_kind` 分支：
- poll：`deliver_scheduled_task(task)`（不变）。
- goal：`deliver_goal_scheduled_task(task) -> ApiResult<GoalDeliveryOutcome{ goal_completed, content_update }>`。
重排块（mutate_workspace_config）增强：
- executed 且 goal_completed → status="completed"，content=content_update。
- executed 其余 → 既有重排 + （若 content_update=Some）更新 content。
- failed → status="failed"。

### 3.4 API
- `TaskScheduleCreateRequest` 新增 `task_kind: Option<String>`、`goal_id: Option<String>`（serde default）。
- `api_create_task_schedule`：task_kind="goal" 时校验 goal_id 非空且 `get_goal_sqlite` 存在（404）；
  content 仍必填（goal 模式可填目标标题/说明）。其余不变。
- 列表 DTO `TaskScheduleListResponse.tasks` 随结构体自然带出新字段（前端渲染类型/目标）。

### 3.5 前端（与定时任务并排，同一面板内扩展）
- 新建表单加"类型"下拉：轮询型 / Goal 推进型。
- 选 Goal 推进型时：显示 Goal 选择器（拉 `GET /api/goals`），content 输入框标签变"目标说明"。
- 列表项展示：类型徽标（轮询/Goal）、Goal 推进型显示绑定目标与进度（content 即进度摘要）、状态、下次触发、last_error。
- 改前端后必须 `cargo build -p coolzhu-web-console`（编译期内联）。

## 4. 持久化与风险
- scheduled_tasks 存 TOML（非 SQLite），新增字段 serde default → 旧 coolzhu.toml 兼容；不触发 SQLite save 级联清空侧表陷阱。
- goal 读取/推进走既有 SQLite 函数（只读 + 既有 update），不重写表结构 → 安全。
- 调度器内 await 期间不持锁（沿用现状）；goal 推进会调用 LLM，直接 await（与现有 poll 一致）。

## 5. 验证
- 后端：各 crate `cargo build/test -p ... --offline`；web-console `module_linkage_smoke`。
- 真实前端：启动 `cargo run -p coolzhu-web-console`，定时任务面板可见两类、可创建、到点派发、
  轮询 content 不变 / Goal 推进逐阶段并在完成时停。
- 打包：各模块独立编译二进制 → 更新 obsidian → `package/run.ps1` 统一组合运行。
