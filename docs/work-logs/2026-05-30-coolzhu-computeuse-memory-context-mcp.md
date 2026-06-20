# 2026-05-30 coolzhu 交互式开发（第二批：compute-use 通用化 / 记忆价值 / 上下文 / MCP-CLI-终端）

负责人：Claude Code（外部编码 agent）。延续 2026-05-29 会话，覆盖用户新提的 4 项任务（任务 8–11）。

## 任务8：compute-use 通用化为 skill + 并发排队（已落地、已编译、测试通过）

### 并发排队（防多会话冲突）
- 物理键鼠是全机唯一资源，多聊天室会话同时触发 compute-use 会抢光标/焦点造成错乱。
- 新增进程级 `compute_use_input_gate()`（`tokio::sync::Mutex<()>`，main.rs）：`run_blocking_input`
  在每次真实注入前 `lock().await`，**公平排队、先到先得、async 不阻塞 worker 线程**。
- 选 tokio async Mutex 而非 std Mutex：避免阻塞线程；只在叶子 `run_blocking_input` 加锁，无嵌套自死锁。

### 通用化为 skill
- 新增 `.coolzhu/skills/compute-use-control/SKILL.md`：模型会话遇到 compute-use 场景时按此 skill
  生成 UIA 定位脚本，**支持任意 APP + 任意控件 + 树状关系（下拉菜单等）**。
- 沉淀实测要点：UIA 优先→ShowUI/VLM 回退；Electron 输入框是 Group/占位符非 Edit/Document；
  中文必用剪贴板（SendKeys 会错乱）；菜单项点击后下拉常为独立顶层窗口需重新枚举。
- `/api/state` 的 skills 计数改为**动态统计** `skill_catalog_items().len()`（原硬编码 "8/8"）。

## 任务9：记忆星图 ↔ 价值/老化联动（已落地、已编译通过、测试通过）

> 经过（含一次失败-修复，留作教训）：首次添加后端 5 个价值函数时，Edit 锚点假设
> `memory_bead_signature` 是内联实现，**实际它只是 `runtime::memory_bead_signature` 的包装**，
> 锚点不匹配导致函数定义没写进去、只写进调用点 → `cargo build` 报 E0425（cannot find
> `age_out_memory_beads_by_value`），服务器随之启动失败 exit 101。修复：Read 确认真实内容后
> 把 5 个函数加在包装函数之后 → 编译通过。教训：改前必 Read 确认锚点，勿假设实现形态。

### 后端价值老化（main.rs）
- `memory_bead_kind_weight`：decision 1.0 / tool 0.95 / result|task 0.9 / fact 0.75 / reasoning 0.6 / **chat 0.3**（简单问答最低）。
- `memory_bead_keywords` + `memory_bead_connection_degree`：估算「星图关联度」= 与其它 bead 同 source 或关键词重叠≥2 的连接数（中文按字、英文按词）。
- `memory_bead_value_score` = kind 权重 + 关联度(log 平滑) + 置信度 + 新鲜度。
- `age_out_memory_beads_by_value` 替换原 `prune_memory_beads_to`：**pinned 永不淘汰**；非 pinned 按价值分降序保留，低价值（简单问答）先老化，高关联任务步骤/结果留存。

### 前端星图联动（app.js）
- 星点**大小 + 亮度由关联度（价值）决定**；低价值暗淡（提示易老化）；pinned 始终明亮；tooltip 显示「关联N」。
- 与后端同口径计算关联度（同 source / 关键词重叠≥2）。
- 文案：「大小/亮度=关联度(价值) · 暗淡=易老化」。价值最高（连线最多）= 最该提醒用户生成 skill 的候选。

## 任务10：上下文管理梳理与业界对比（产出文档）
- 文档：`docs/context-management-analysis-2026-05-30.md`。
- 现状：`build_context_assembly` = 价值记忆（含本轮老化）+ token 预算约束的近期历史（`history_token_budget=3000` / `memory_token_budget=1200`）；按 token 预算从最新往回收历史，超预算截断。
- **最大缺口**：core-runtime 的 `compact.rs`（`should_compact` / `compact_session` 滚动摘要，trigger/keep_recent/target tokens）**已写好但 web 链路未调用**——超预算历史被直接丢弃而非摘要。
- 改善点 P0：把 compaction 接入 web 链路（token 阈值触发滚动摘要）；让预算真正驱动记忆+历史的动态选择。P1：滚动摘要沉淀为高层 bead、按当前 query 检索注入。

## 任务11：MCP/CLI 梳理 + 终端 PowerShell 打通（产出文档 + 实测）
- 文档：`docs/mcp-cli-terminal-analysis-2026-05-30.md`。
- **MCP**：core-runtime 有 `config.rs`（各 transport 配置）**及** `mcp_client.rs`（`McpClientTransport/Auth/Bootstrap`、`spawn_mcp_stdio_process`、JsonRpc 类型）——即客户端基础已有；但 **web-console 完全未接**（main.rs `mcp` 命中 0），无 `/api/mcp/*` 路由、无前端入口。
- **CLI**：独立 crate（main.rs≈5347 行 + app/args/init/input/render），自带 REPL/SlashCommand（Help/Agents/Skills…），与 web 双入口、能力未对齐。
- **终端 PowerShell：已打通并实测通过** ✅
  - 链路：前端 `terminalWindowRunPowerShell`(app.js:4151) → `/api/tools/runtime-execute {tool_name:PowerShell}`(main.rs:2301) → tool-registry `execute_powershell` → 真实 powershell。
  - 实测：`Write-Output 中文终端测试-终端已打通; Get-Location` → HTTP 200，exit_code 0，stdout 中文**无乱码**（GB18030 修复生效）。
- 前端呈现建议：终端窗口(已通，后续可选 PTY/xterm)；MCP 面板(列 server/transport/状态灯/连接/工具清单，需补 `/api/mcp/*` 路由把 mcp_client 接起来并并入 tool registry/审计)；CLI 面板(命令模板复用 runtime-execute)。优先级 P1=MCP 客户端接入，P2=CLI 共享 agent core，P3=PTY。

## 变更清单
代码：
- `modules/gui-web/packages/web-console/src/main.rs`：`compute_use_input_gate` + `run_blocking_input` 加锁；记忆价值老化 5 函数（kind_weight/keywords/connection_degree/value_score/age_out）+ `prune_memory_beads_to` 改用价值老化；skills 动态计数。
- `modules/gui-web/packages/web-console/src/app.js`：记忆星图按关联度决定星点大小/亮度。
- `modules/gui-web/packages/web-console/index.html`：星图说明文案。
- `.coolzhu/skills/compute-use-control/SKILL.md`：新增 compute-use 通用 skill。
文档：
- `docs/context-management-analysis-2026-05-30.md`、`docs/mcp-cli-terminal-analysis-2026-05-30.md`、本 work-log。

验证（本轮最终实测证据）：
- `cargo build -p coolzhu-web-console` 通过（exit 0，修复 E0425 后）。
- `cargo test -p coolzhu-web-console -- --test-threads=1`：**366 passed / 0 failed**（含 prune/pin 测试，价值老化未破坏既有行为）。
- 终端 PowerShell：`POST /api/tools/runtime-execute` → HTTP 200，stdout=`中文终端测试-终端已打通`+路径，中文无乱码，exit_code 0。
- 记忆 beads：`GET /api/sessions/mario-demo/beads/summary` → HTTP 200，total=37（by_layer L1:19/L2:17/L4:1，by_kind chat:20/decision:13/tool:3），读取链路未破坏。

临时产物（tmp/，已 gitignore）：`probe-skills-cu.txt`、`probe-mem-ctx.txt`、`probe-mcp-cli-term.txt`、`probe-mcp-cli2.txt`、`probe-context.txt`、`ctx*.txt`、`worklog-0530-dump.txt`。

## 交互式开发增量经验（接 2026-05-29）
1. **服务器占用 exe 导致 build exit 101**：`cargo run` 的服务器进程占用 `coolzhu-web-console.exe`，使后续 `cargo build` 无法替换（test 二进制独立故 test 仍过）。对策：改代码后先 `Stop-Process coolzhu-web-console` 再 build。
2. **Edit 锚点必须先 Read 确认**：把包装函数误当内联实现，old_string 不匹配 → 只写进调用点 → E0425。改前 Read，勿假设实现形态。
3. **工具结果偶发渲染异常**：本轮出现 Edit 返回串台、grep 输出被摘要污染、work-log 标题重复等。对策：用 `cargo build` 的退出码、`grep -c`/`awk` 落盘交叉核实真实状态；发现结构损坏时直接 Write 重写小文件。
4. **过早标记完成的风险**：勿凭"grep exit 0/后台已提交"就判完成；以编译退出码 + 测试 + HTTP 实测三重证据为准。
