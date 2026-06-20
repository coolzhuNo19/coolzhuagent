# 2026-06-07（续）视频闭环 / 流式多轮 / model_type / 记忆剔除

承接同日上一份 work-log。本轮解决用户两项需求：① 恢复 image 会话 + video 会话调试；
② goal 不通根因 + 工具调用架构对比 + 记忆剔除。

## 1. model_type 保存 bug（"图片生成模型类型无法保存"根因）

- 根因：`api_update_session`（main.rs ~23543）的 model_type 白名单
  `"text"|"vision"|"audio"|"video"|"embedding"|"multimodal"` **漏了 "image"** →
  PATCH model_type=image 被丢弃，停留旧值。
- 修复：白名单加 `"image"`。
- 验证：PATCH agnes-image 会话 model_type=image → 回读 `type=image`（此前卡在 video）。✓

## 2. 会话恢复 / 配置

- agnes-image（session-1780813100746）恢复：model=agnes-image-2.1-flash / type=image /
  endpoint=v1/images/generations。
- agnes-video（session-1780829045320，用户新建）：model=agnes-video-v2.0 / type=video /
  endpoint=v1/videos。

## 3. 视频 url 提取 bug（视频闭环最后一公里）

- 现象：视频生成 status=completed（poll#105），却报"已完成但未找到 url"。
- 根因：直接 GET 已完成 task（不过期）拿到完整响应——agnes 把 mp4 url 放在**反直觉的
  `remixed_from_video_id` 字段**（与 GitHub skill 仓库提示一致），不在原多路径列表里。
  ```json
  {"status":"completed","progress":100,"remixed_from_video_id":
   "https://storage.googleapis.com/agnes-aigc/.../video_xxx.mp4","video_id":"video_xxx"}
  ```
- 修复 `extract_video_url`：
  - 显式路径加 `remixed_from_video_id`（及 data/result 前缀）。
  - 新增 `find_video_url_recursive` 递归兜底：遍历整个响应找任意以 .mp4/.mov/.webm/.m4v
    结尾的 http(s) 串——适配未来字段名变化。
- 验证：单测 `extract_video_url_handles_agnes_remixed_field` /
  `extract_video_url_recursive_fallback_finds_mp4` 通过（用实测响应结构）。

## 4. goal 不通根因 ——【纠正"记忆污染"假设】

- 用户假设：记忆加载引入失败直接返回。
- **实测否定**：err.log 显示 `stale_hits=0`、`system_len` 正常 —— **不是记忆污染**。
- **真正根因**：**流式 tool loop 只实现单轮反馈**。err.log 自证：
  ```
  [TOOL-LOOP-STREAM] round2 model requested ANOTHER tool 'TodoWrite' but only
     single-round feedback is implemented; request ignored (multi-step goal stalls here)
  [TOOL-LOOP-STREAM] round2 done: assistant_len=0
  ```
  round1 调用→round2 喂结果后，模型想继续调下一个工具（多步任务必然）就被忽略 →
  round2 无文本（assistant_len=0）→ 落"模型未返回最终回复"。即 `CUR-GOAL-LOOP-001`。
- 关键区分：**非流式 `call_agent_model_with_tool_loop` 早已是多轮**
  （`for round in 0..=max_feedback_rounds`，默认 8 轮，含 L1 空转纠偏）；**只有流式是单轮**。
  截图 test5 走流式聊天，故 stall。

## 5. 工具调用架构对比（主流 agent vs 本项目）

- 主流（Claude Code / OpenAI Assistants / LangChain agent）：工具调用是 **while 多轮循环**——
  `while 模型返回 tool_call { 执行 → 喂回结果 → 再调模型 }`，直到返回纯文本或达 max_iterations。
- 本项目此前：非流式多轮 ✓，**流式写死单轮** ✗（不稳定/卡死的根源）。

## 6. 流式 tool loop 多轮化（核心修复）

- 把流式 round2 单轮块改成多轮循环：round1 保留流式 token 体验；round2+ 改用**非流式
  send_message 逐轮推进**（复用 `model_tool_requests_from_blocks` /
  `dispatch_model_tool_calls_parallel` / `answer_text`），直到模型返回纯文本或达
  `max_feedback_rounds`。带 L1 空转纠偏 + 工具结果摘要兜底。不重复执行 round1 已执行的工具。
- 验证：多步任务（建 index.html/style.css/app.js 三文件）→
  ```
  [TOOL-LOOP-STREAM] 3 tool call(s) write_file ×3 → OK ×3
  [TOOL-LOOP-STREAM] round2 final reply, answer_len=462
  [TOOL-LOOP-STREAM] multi-round done: rounds_used=2 answer_len=462
  ```
  对比旧 `round2 done: assistant_len=0`（stall）——现 round2 产出最终回复，多步不再卡死。✓

## 7. 记忆剔除（只沉淀有效成功流程）

- 现状：加载侧 `render_prompt_memory_context` 已过滤 stale-tool-denial；但**留存侧
  `evaluate_auto_memory_candidate` 无任何失败过滤**（assistant-fallback 照存 0.28），
  且 `stale_tool_denial_hits` 只测"工具不可用"，不含"失败/超时/未返回最终回复"等。
- 新增 `is_failure_or_debug_memory_text`：stale + 中英失败/调试信号
  （失败/超时/报错/未返回最终回复/已执行工具结果摘要/error sending/timeout/is_error…）。
- 留存侧（evaluate）：assistant-fallback 永不沉淀；含失败/调试信号且无成功证据 → 不沉淀。
- 加载侧（render）：过滤升级为 `!is_failure_or_debug_memory_text || has_success_evidence`，
  旧的已存失败记忆加载时也剔除。
- 误杀防护：带明确成功证据的（"修复失败并通过测试"，positive+evidence）豁免保留。
- 验证：单测 `failure_and_fallback_memory_not_persisted` /
  `successful_experience_still_persisted` / `failure_text_detector_basics` 通过。

## 验证汇总

- `cargo build -p coolzhu-web-console --offline`：OK。
- 单测：`media_and_memory_tests` 5/5 通过；`intent_gate_tests` 5/5（上轮）。
- 流式多轮：端到端 OK（多步建 3 文件 + round2 最终回复）。
- model_type：端到端 OK（image 会话 type=image）。
- 视频闭环端到端：上次提交成功 + 轮询 completed 已验证；url 提取修复经单测验证；
  完整端到端（提交→轮询→提取 url→assistant-video）复测中（曾遇 agnes 端网络抖动偶发提交失败）。

## 8. 视频异步架构改造（解决同步阻塞，用户选定方向）

- 问题：原同步轮询架构 app 阻塞最多 10–20 分钟，agnes 慢时前端 SSE/HTTP 必断；实测同步
  chat/send 卡 40s+（agnes 连提交端点都慢）。
- 改造：彻底异步——
  - `submit_video_task` + `poll_video_task` 拆分，**全部放入 `tokio::spawn` 后台**（连提交也后台）。
  - `video_pending_chat_message` 立即返回 `assistant-video-pending` 消息（job key = message_id）。
  - 全局 `video_jobs`（OnceLock<Mutex<HashMap>>）记录 submitting/processing/completed/failed + url。
  - 新端点 `GET /api/videos/{message_id}` 查状态（注册于路由表）。
  - 前端 `scheduleVideoPolling`：pending 消息按 message_id 轮询，completed → `applyVideoToMessage`
    替换为 `<video>`，failed → 显示错误。
  - 轮询上限提至 240×5s=20 分钟，容忍 agnes 慢生成。
- 验证：chat/send **0.4s 秒级返回** pending（此前同步卡 40s+）；`GET /api/videos/{id}` 返回
  status=submitting；后台 spawn 提交（err.log `[VIDEO-GEN] submit POST`）。agnes 服务端这段时间
  整体过载（提交响应慢 + 生成排队 10+ 分钟），但**已不阻塞用户**——pending 即时显示，后台出结果。

## 9. 图生图 + 图生视频（附件上传参考图）

- 需求：通过聊天附件上传参考图，驱动 agnes 图生图 / 图生视频。
- 链路复用：用户上传的 image 附件经 `encode_attachment_images` 编码为 data URI，存于
  `PreparedChatDispatch.image_urls`；image/video 生成分支取 `image_urls.first()` 作参考图。
  前端附件上传（`/api/attachments/upload` + composer）已有，无需改。
- agnes 参数（GitHub skill `agnes_api.py` 源码确认）：
  - 图生图：body 加 `extra_body: {"image": <值>, "response_format": "url"}`。
  - 图生视频：body 顶层加 `image: <值>`（单图）。
  - 值用 data URI（自包含 base64），agnes 后端可解码，无需公网 URL（实测可用）。
- 改动：`generate_image_attachments_for_agent` / `submit_video_task` /
  `image_generation_chat_message` / `video_pending_chat_message` 增 `reference_image: Option<&str>`；
  4 个生成分支调用点传 `result.image_urls.first().map(String::as_str)`。
- 验证（curl 上传测试 PNG + chat/send 带附件）：
  - 图生图：`[IMAGE-ENCODE] encoded ... base64` + `[IMAGE-GEN] ... ref_image=true` +
    返回 `assistant-image atts=1`（agnes 端到端出图）✓
  - 图生视频：`[VIDEO-GEN] submit ... ref_image=true` + 0.4s 秒级 pending（参考图正确传入，异步提交）✓

## 10. 视频生成任务卡片化（进度 / 等待时长 / 状态 + 隐藏遗留中断任务，2026-06-08）

- 需求：视频异步等待时长进任务卡片；按 agnes 状态/进度/错误更新；按最近对话刷新；不显示遗留中断任务。
- agnes 字段（官网 + 实测确认）：轮询响应含 `status` / `progress`(0-100) / `video_url`(completed 时) /
  `error`；失败用 `status=failed`+`error`；生成时长数分钟（实测 task ~8-10 分钟，受 agnes 负载波动）。
- 后端：
  - `VideoJobState` 加 `progress` + `created_at`；`set_video_job` 保留首次 created_at、completed→100；
    新增 `update_video_job_progress`（轮询中更新）、`extract_video_progress`（多路径 0-100，兼容整/浮点）。
  - `poll_video_task` 加 `job_key`，每轮回写进度。
  - `VideoJobStatusDto` 加 `progress` + `elapsed_ms`；端点算 `elapsed_ms=now-created_at`；
    job 丢失返回 `status=unknown`（app 重启 / 遗留中断标识）。
- 前端：
  - `videoRuntimeTasks`(Map) 并入 `mergedRuntimeTaskItems` → 视频任务自动进任务卡片
    （复用 `syncTaskCardFromGoals` / `renderTaskTodoList` / `formatTaskElapsed` 现成渲染）。
  - `scheduleVideoPolling` 每轮更新任务卡片项（状态=运行中/完成/失败，summary=进度%，
    `startedAt` 用 `elapsed_ms` 折算 → 时长跨页面刷新仍准确）；完成/失败短暂保留后移除（不遗留）。
  - `status=unknown`（遗留中断）→ 停止轮询、移出任务卡片、消息改"（视频生成任务已中断，请重新发起）"。
  - 任务卡片每轮对话经 `renderTaskList` 替换 `taskRuntimeItems` 刷新；视频任务独立 Map、完成即清。
- 验证：发视频 → `/api/videos/{message_id}`：T1 `submitting elapsed=278ms` → T2(+7s) `queued elapsed=7293ms`
  （状态推进 + 等待时长累积）；假 id → `status=unknown`（遗留中断识别）。`cargo build` OK。

## 遗留

- 视频生成耗时较长（queued 轮询数分钟）+ agnes 端偶发网络抖动；前端 SSE 长等待体验可后续加进度提示。
- goal 角色编排（commander→planner→implementer→verifier handoff）的真实多会话流转，
  在流式多轮打通后可再做端到端回归（本轮已扫清"单轮 stall"这一最大拦路石）。
