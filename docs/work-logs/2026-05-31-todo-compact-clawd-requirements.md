# 2026-05-31 落地 todo 卡片 + 自动 compact + clawd 分析 + 需求收敛

负责人：Claude Code。承接第四批：用户要求收敛方案到需求文档，并优先落地任务12-D(自动 compact)与任务17(todo 卡片)，补任务14 显存切换，clawd-on-desk 待源码下载后评估。

## 已落地（代码 + 编译 + 测试 + 服务器实测）

### 任务17：任务卡片 todo 清单（参考截图）✅
- index.html：task-summary-card 内新增 `<ul data-role="task-todo-list">`。
- app.js：`renderTaskTodoList` 聚合 goal phases → 每条「任务名 + 状态徽章(运行中/排队中/完成/失败重试) + 实时耗时」；
  `collectTaskTodoItems`(按状态优先级排序)、`taskTodoStatusMeta`、`formatTaskElapsed`(mm:ss/HH:mm:ss)、
  `tickTaskTodoTimers`(每秒只更新运行中耗时文本，不重建 DOM)；在 `syncTaskCardFromGoals` 末尾调用。
- styles.css：`.task-todo-list/item/name/badge(running蓝/pending橙/done绿/failed红)/time/empty`，与截图配色一致。
- 验证：cargo build exit 0；366 测试通过；服务器返回的 index.html 含 `task-todo-list`、app.js 含 `renderTaskTodoList`。

### 任务12-D：自动 compact（结合记忆摘要的滚动压缩）✅
- main.rs `build_context_assembly_with_roster`：超出 `history_token_budget` 的较旧历史不再直接丢弃，
  收集进 `dropped_history` → `summarize_dropped_history`(轻量本地摘要：角色+正文前80字，最多24条，
  不调模型避免组装期同步 LLM) → 作为 `[历史摘要]` 注入 system_prompt(计入 system_tokens)。
- 验证：cargo build exit 0；366 测试通过(含 `context_builder_truncates_old_history_but_keeps_current_turn`、
  `context_builder_includes_relevant_beads_history_and_current_turn` 等上下文路径)；
  context-preview HTTP 200。**运行时真实触发需长历史会话自然积累**，列入回收任务(R-CTX 运行时实测)。
- 进阶(P2，已入需求文档 R-CTX-COMPACT2)：摘要沉淀为高 kind 权重 bead；预算由 model context_window 动态推导。

### 任务14 补充：ShowUI/UI-DETR-1 显存互斥切换 ✅(方案入文档)
- 显存不足以同时常驻两模型 → 设计**单模型互斥切换**：grounding 按需用 ShowUI / 实时感知用 UI-DETR-1，
  vision-service 加 backend 切换 + 显存预算守卫。入需求文档 R-VIS-SWITCH。

### 任务20：需求收敛 ✅
- `docs/current-issues-and-unfinished-requirements-2026-05-31.md`：把 05-29~05-31 全部任务/方案统一编号
  (R-ENC/CU/GOAL/MEM/TASK/CTX/TERM/MCP/SUBAGENT/TTS/VIS/REMOTE/CLI/PET + B-* 受阻)，分「已落地/方案/受阻」三类。

## clawd-on-desk 分析（任务18）
- 源码已下载 `C:/Users/zhupu/coolzhuagent/clawd-on-desk-main`（Electron 桌宠，纯 JS 非 TS，无 src/lib|hooks 子目录；
  实际是 main.js/state.js/animation-cycle.js/pet-window-runtime.js 等大型 JS + assets/gif/ 的 GIF 动画帧）。
- 关键认知修正：clawd 不是"自主游走宠物"，而是**agent 活动驱动的状态反应宠物**——12 个动画态
  (idle/thinking/typing/building/subagent-groove/multi-subagent-juggling/error/happy/notification/sweeping/carrying/sleeping)
  由各 AI agent 的 hooks/log 轮询驱动；3 内置主题(Clawd 蟹/Calico 三花猫/Cloudling 云宝)；动画用 GIF/APNG 而非精灵切帧；
  60s idle 进入睡眠、鼠标动则惊醒；眼睛跟随光标。
- 与 coolzhu 高度契合：coolzhu 已有 `emit_backend_pet_event`(chat/tool/idle 事件总线)，**正是 clawd 的"agent 活动→动画态"模式**。
- 产出 `docs/clawd-on-desk-port-analysis-2026-05-31.md`：功能点/状态机/动画映射/移植方案/需自研动作帧清单。
  （注：该文档首版基于"自主游走桌宠"假设，与 clawd 实际"agent 反应桌宠"有偏差，已在本 work-log 修正认知；
  文档将按真实模型在回收任务中校正。）

## 受阻（诚实记录）
- **B-SERVER（已定位并解除）**：之前多次"启动失败/HTTP 000/AddrInUse"根因 = 旧 cargo-run 实例(PID 10360)未被
  PowerShell `Stop-Process`(按 exe 名)真正杀掉，仍占 8765 跑**旧二进制**；新实例反复撞端口。
  用 `taskkill //F //IM` 杀掉后端口释放，重建+cargo run，服务器现跑新代码(已实测)。
  教训：Windows 下杀进程用 `taskkill //F //IM <name>.exe`，并 netstat 确认端口释放，再 build/run。
- **B-TEST5**：委派 test5(qwen3.7-max) 分析 clawd 源码，HTTP 200 但**模型返回空回复**(remote truncated)。
  已自行基于一手源码完成分析。可换 test6 或重试(提示词存 tmp/delegate-test5-clawd.json)。
- **B-WEBSEARCH**：本环境 WebSearch 底层模型不可用，无法联网检索。

## 交互式开发经验（本批新增，接前）
1. **Windows 杀进程**：PowerShell `Stop-Process -Name` 对 cargo run 拉起的 exe 可能未命中；用 `taskkill //F //IM` +
   netstat 确认端口，否则旧二进制残留导致"改了没生效/端口占用"双重假象。
2. **服务器实测前必确认跑的是新二进制**：curl 服务器返回的 app.js/index.html 里 grep 新符号，确认内联生效。
3. **委派远程会话不保证成功**：test5 可能空回复；耗时分析任务要有"自己兜底"预案，且别据"HTTP 200"判成功(要看 content)。
