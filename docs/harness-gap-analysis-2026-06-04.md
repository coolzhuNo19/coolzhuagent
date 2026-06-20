# coolzhu code agent —— Harness 工程对照分析（2026-06-04）

> 目的：以附件《AI Agent Harness Engineering 可复用工程设计要点》为基准，结合**当前项目工程实现**与**主流 coding agent harness 调研**，找出可引入到本项目（偏 coding + workflow agent）的优化点。本文只做**分析与定位**；落地方案见同目录 `harness-optimization-plan-2026-06-04.md`。

## 一、方法与口径

- **基准文档**：附件 12 章（Anthropic《Building Effective Agents》+ Lilian Weng《LLM Powered Autonomous Agents》+ DAIR.AI）。
- **主流调研**（联网）：
  - Augment Code《Harness Engineering for AI Coding Agents》——PEV 模式、三层 harness、确定性门控、结构化交接。
  - arXiv《Architectural Design Decisions in AI Agent Harnesses》——70 个 agent 项目实证，5 大设计维度与共现规律。
  - 《Agentic Harness Engineering: Observability-Driven Automatic Evolution》、OpenHands SDK、SWE-agent 等。
- **关键判别**（联网新增认知）：**harness engineering 是独立于 context engineering 的架构层**——context engineering 在单个 context window 内策划 token；harness engineering 引入 **context reset、结构化交接产物（handoff artifacts）、phase gates**，支撑**跨多个 context window** 的连贯目标工作。本项目的 `compact.rs` + goal 阶段 + handoff 正落在这一层。

## 二、当前项目 Harness 架构画像（含代码落点）

| 组件 | 实现落点 | 主流定位（arXiv 70 项目） |
|---|---|---|
| 单 agent 主循环 | `web-console/main.rs::call_agent_model_with_tool_loop`（ReAct 工具循环 + `max_feedback_rounds` 上限） | Orchestration: ReAct（50% 默认） |
| 多 agent 编排 | goal 模式 commander/planner/implementer/verifier，`max_iterations`(默认20，clamp 1-100)，SQLite 持久 | Subagent: orchestrator-worker（31% Multi-Agent Orchestrator 模式） |
| agent 间交接护栏 | `HandoffGateOptions`（max_depth=4 / max_per_turn=8 / dedup_window=60s / `Reject(reason)`），`parse_handoff_directives` | Safety: policy approval |
| 上下文装配 | `build_context_assembly` + `context_build_options`（output_reserve 15% / history 70% / memory 8%） | Context: 预算化 token |
| 上下文压缩/重置 | `core-runtime/compact.rs`（`should_compact` / `compact_session` / `merge_compact_summaries` / continuation message） | Context: LLM summarization + 跨 window reset |
| 记忆 | `core-runtime/memory.rs`（`MemoryLayer` 短/长期，beads，`query_memory_beads`/`select_prompt_memory_beads`/`render_prompt_memory_context`，`memory_bead_matches_query` **关键词**召回） | Context: 文件持久 + 分层（但**无向量/RAG**） |
| 工具系统 | `tooling/tool-registry`（`description` + JSON `input_schema`），bash/powershell/read/write/edit/glob/grep/web 等 | Tool: explicit registry（34% 主流） |
| MCP | `core-runtime/mcp.rs` / `mcp_client.rs` / `mcp_stdio.rs` | Tool: MCP-first（14%） |
| 权限/隔离 | `permission_gate.rs` / `permissions.rs` / `path_effect.rs` / `sandbox.rs` | Safety: 策略审批 + 进程隔离 |
| 钩子 | `core-runtime/hooks.rs`、`plugin-system/hooks.rs` | 扩展点 |
| 可观测 | `request_id` 贯穿 LLM 调用、`diag!` 日志、工具审计 `tool_audit` | Audit: 基础日志 |
| 兼容 harness | `tooling/compatibility-harness` | —— |

**总体定位**：本项目已是一个**中高复杂度的 "Multi-Agent Orchestrator" 形态**（goal 4 角色 + hybrid 上下文 + 策略审批 + MCP），远超"轻量工具"档；与 arXiv 实证中 `claude-code-src` 一类同属第三档（31% 占比）。强项是**编排深度 + 上下文工程 + 权限治理**三轴已同步发育（符合论文"协调深度↔上下文复杂度↔治理投入"耦合规律）。

## 三、逐维度对照（已有 / 缺失 / 可引入）

| 附件维度 | 当前项目现状 | 主流做法 | 判定 |
|---|---|---|---|
| 7.1 执行循环 / 3.2 反馈规划 | ReAct tool loop + 反馈轮上限 ✅ | ReAct/plan-execute 是默认 | **已有** |
| 4.4/8.1 Orchestrator-Workers | goal 4 角色固定流水线 ✅ | orchestrator-worker | **已有，但流水线单向** |
| 4.5 Evaluator-Optimizer / 3.2 Reflexion | verifier 存在，但**拒绝不回流、无重试纠偏** ❌ | Verifier 拒绝→**结构化纠正上下文**回流 | **缺（P0，CUR-GOAL-LOOP-001）** |
| 3.2#1 结构化任务状态注入 | tool loop 仅追加 ToolResult，**无"当前步/已改文件/已跑命令/验证结果"结构化注入** ❌ | 每轮注入结构化进度，模型不靠猜 | **缺（P1）** |
| 3.2#2 双模监管 L1/L2 | 未见后台空转/无进展/跑偏监控（grep 无 supervis/watchdog） ❌ | 后台监控+自动介入 | **缺（P1）** |
| 3.2#3 提示词去重 | `dedup_window` 仅用于 **handoff 交接**，用户**重复提交同一指令**未见请求级幂等 ❌ | 请求幂等键 | **缺（P1，弱网价值高）** |
| 5 Context Engineering / 5.2 分层 | system + beads + history + current turn 分层装配 ✅；预算化 ✅ | 分层 + 预算 | **已有** |
| 跨 window：context reset + 交接 | `compact.rs` summary + continuation ✅；goal handoff ✅ | context reset + handoff artifacts | **已有（强项）** |
| 6 ACI 工具接口 | 有 description + schema，但**描述简短、缺示例/边界/防错** ⚠️ | 工具文档投入=HCI；Poka-Yoke 防错 | **可优化（P1，低成本高收益）** |
| 6.2 Poka-Yoke 防错 | path_effect/权限有边界校验 ✅；但工具参数层**未强制防错**（如绝对路径） ⚠️ | 参数设计使模型难犯错 | **可优化（P1）** |
| augmentcode 三层 harness / 确定性门控 | verify 偏模型自评，**未把 lint/类型/测试作为硬门自动回流** ⚠️ | "error 非 warn" 硬门；错误信息变 prompt | **可优化（P1）** |
| 3.3 长期记忆 / MIPS 检索 | beads **关键词** matches_query ⚠️ | 向量/RAG 语义召回（HNSW/FAISS） | **可优化（P2，基础设施较重）** |
| augmentcode 规则文件分层加载 | CLAUDE.md 单一注入，无 always_apply/agent_requested/manual 分级 ⚠️ | AGENTS.md 分层按需加载，省 context | **可优化（P2）** |
| 9 评估与监控 | request_id + diag + tool_audit ✅；但**无 harness 效果指标体系** ⚠️ | 任务完成率/代码 churn/verification tax/缺陷逃逸率 | **可优化（P2）** |
| 8 子 agent 分层委托 | goal 固定 4 角色；**无动态 spawn 子 agent**（R-SUBAGENT 未做） ⚠️ | 多级递归/动态委派 | **可优化（P2）** |
| 7.4 护栏 | max_iterations / max_feedback_rounds / 权限 / sandbox ✅ | 最大迭代+权限分级+沙盒 | **已有** |
| 3.4 工具协议 MCP | mcp.rs 已有 ⚠️（完成度待核） | MCP-first | **基本已有（深度待核）** |

## 四、Gap 清单（按优先级 + 与本项目"coding/workflow"契合度）

### P0（直接卡住 coding/workflow 闭环）
1. **goal 失败回退闭环（CUR-GOAL-LOOP-001）**：verifier 不通过 → 带**原因/证据**回 implementer 重改；implementer 受阻 → 回 planner 重规划；均设**重试上限**。这是 coding agent 可靠性的核心（对应 augmentcode "Verifier 拒绝→结构化纠正" + 附件 Reflexion/Evaluator-Optimizer）。

### P1（高性价比，显著提升可靠性/可调试性）
2. **主循环结构化进度注入**：每轮给模型注入"当前阶段 / 已改文件 / 已跑命令 / 验证通过与否 / 待办"的结构化状态块，减少模型靠历史推断。
3. **确定性验证门控**：verify 阶段把 `cargo build/test`、lint、类型检查作为**硬门**，失败输出**结构化回流**为下一轮 implementer 的 prompt（错误信息即 prompt）。与 #1 协同。
4. **工具 ACI 增强 + Poka-Yoke**：为高频工具（bash/powershell/edit/write/read/grep）补**示例、边界、与相似工具差异、防错约束**（如强制绝对路径、edit 要求先 read）。低成本高收益。
5. **双模监管 L1/L2**：后台轻量监控"无进展（连续 N 轮无文件改动/无验证推进）/ 空转（重复同一失败工具调用）/ 跑偏（越权路径）"，触发软介入（注入纠偏提示）或硬停（达上限）。
6. **用户请求级幂等**：弱网下用户重复提交同一指令，按 (session, 规范化指令, 时间窗) 幂等键去重，避免重复执行。

### P2（架构增强，可分阶段）
7. **长期记忆语义检索**：beads 增加向量召回（先用轻量本地 embedding + 余弦/HNSW，或复用现有 provider embedding），关键词 + 语义混合。
8. **规则文件分层加载**：CLAUDE.md / 项目规则支持 always_apply / agent_requested / manual 三级，按相关性注入，省 context 预算。
9. **harness 效果指标**：沉淀任务完成率、回退次数、代码 churn、验证耗时占比等，落 SQLite + 控制台面板，驱动迭代。
10. **动态子 agent（R-SUBAGENT）**：在 goal 固定角色之外，允许 implementer 按需 spawn 受限子 agent 处理可隔离子任务（带深度/权限上限，复用 HandoffGate）。

## 五、结论

- 本项目 harness 的**地基扎实**：编排（goal orchestrator-worker）、上下文工程（分层+预算+compact 跨 window）、治理（权限/沙盒/handoff gate）三轴已同步，处于主流第三档（Multi-Agent Orchestrator）。
- **最大短板是"反馈闭环"**：plan→execute→verify 仍是单向流水线，缺**失败回退 + 确定性门控 + 进度可见性 + 行为监管**——而这恰是 coding/workflow agent 可靠性的命门，也是主流（augmentcode PEV 三层 harness、SWE-agent/OpenHands）投入最重之处。
- 优化主线应聚焦 **P0/P1 的"闭环化 + 确定性门控 + 可观测/可监管"**，P2 做架构增强。

## 六、引用来源

- [Harness Engineering for AI Coding Agents | Augment Code](https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents)
- [Architectural Design Decisions in AI Agent Harnesses (arXiv)](https://arxiv.org/html/2604.18071v1)
- [Building AI Coding Agents for the Terminal (arXiv)](https://arxiv.org/html/2603.05344v1)
- [OpenHands Software Agent SDK (arXiv)](https://arxiv.org/pdf/2511.03690)
- [OpenHands Deep Dive (DEV Community)](https://dev.to/truongpx396/openhands-deep-dive-build-your-own-guide-1al0)
- 附件：《AI Agent Harness Engineering 可复用工程设计要点》（基于 Anthropic Building Effective Agents、Lilian Weng LLM Powered Autonomous Agents、DAIR.AI）
