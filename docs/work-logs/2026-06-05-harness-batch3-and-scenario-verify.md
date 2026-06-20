# 2026-06-05 Harness 批次三 + 场景化脚本验证

> 配套：`docs/harness-optimization-plan-2026-06-04.md`、批次一/二 work-log。本轮落地批次三方案 7/8/9 并场景化验证全部已落地方案；方案10 评估现有覆盖 + spin off 增量。

## 方案9 harness 效果指标（✅ 已落地+验证）
- `web-console/main.rs`：新增 `/api/harness/metrics`，聚合 goal_events 关键事件（command-gate-failed / verification-blocked / blocked-needs-replan / escalations）+ 运行时计数器 `HARNESS_L1_TRIGGERS`（L1 监管触发）、`HARNESS_IDEMPOTENT_HITS`（请求幂等命中）。
- 埋点：L1 监管块 `fetch_add`、`check_chat_request_duplicate` 命中 `fetch_add`。
- 验证：场景脚本确认指标 API 结构完整 + 幂等命中实时计入（0→1）。

## 方案7 长期记忆语义检索（✅ 已落地+验证）
- `core-runtime/memory.rs`：新增 `memory_bead_relevance_score`（词命中比例，轻量无 embedding）；`query_memory_beads` 在**精确 AND 关键词无召回时**用相似度（>0.5）回退召回语义相近 bead。精确有结果时不触发→不破坏现有行为。
- 验证：`cargo test -p coolzhu-core-runtime` 132 passed（现有 memory 测试不回归）。

## 方案8 规则文件分层加载（✅ 已落地+验证）
- `core-runtime/prompt.rs`：`push_context_file` 加 frontmatter `apply: manual/always` 解析（`parse_instruction_frontmatter`）。`apply: manual` 的规则文件不自动注入（仅显式引用，省 context）；无 frontmatter 等同 `always`（不破坏现有 `.claw/CLAW.md` 加载）。
- 验证：`cargo test -p coolzhu-core-runtime` 132 passed。
- 注：`agent_requested`（按相关性自动加载）需 query 上下文，本项目 `discover_instruction_files` 为静态发现，暂以 always/manual 二级落地；relevance 自动加载可后续接入。

## 方案10 动态子 agent（评估 + 增量 spin off）
**现有覆盖**：本项目 `HandoffGate`（max_depth=4 / max_per_turn=8 / dedup_window / `Reject(reason)`）已实现方案10 的核心护栏——**受限委托 + 递归深度上限 + 交接去重**；goal 分层委托（commander→planner→implementer→verifier）已实现分层任务委派。
**纯增量**（spin off）：implementer 运行时**动态 spawn 任意受限子 agent**（隔离会话 + 预算上限 + 结果回收），落点 `core-runtime/remote.rs` + goal 编排，需专门设计隔离/预算/回收/权限继承，已 spin off 独立推进。

## 场景化脚本验证（✅ 7 passed, 0 failed）
`tmp/scenario-verify-harness.ps1` 端到端验证已落地方案的可观测行为：
- 方案9 指标 API 结构完整。
- 方案6 幂等（首次 200 → 重复 409；不同内容 200 不误判）。
- 方案9 幂等命中实时计入指标（0→1）。
- 视觉语音 realtime 编排可达（全程零影响）。
- goal API 可达（门控/回退/进度注入基座）。
- 静态资源 no-cache（前端不被旧缓存遮蔽）。

各方案的内核逻辑由单测覆盖：方案3 命令门控 exit code（`goal_command_gate_detects_exit_code`）、方案5 L1 重复检测、方案7 记忆语义回退、方案8 frontmatter 分层。

## 总体进度
- **方案 1-9 全部落地 + 验证**（批次一全 / 批次二全 / 批次三 7/8/9）。
- **方案10** 核心由 HandoffGate + goal 覆盖；动态 spawn 增量 spin off。
- 全程视觉语音零影响（场景脚本回归确认）。

## 落点文件
- `modules/gui-web/packages/web-console/src/main.rs`（方案9）。
- `modules/core-runtime/packages/core-runtime/src/memory.rs`（方案7）、`prompt.rs`（方案8）。
- `tmp/scenario-verify-harness.ps1`（场景脚本）。
