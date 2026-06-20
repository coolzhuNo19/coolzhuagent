# 上下文管理梳理与业界对比（2026-05-30）

> 任务10：梳理当前模型会话的上下文管理与加载逻辑，对比业界主流 code agent，给出改善点。

## 一、当前实现（web-console 聊天链路）

### 1. 上下文组装入口
`build_context_assembly(session_id, history, beads)`（main.rs:13343）：

```
prompt_beads   = select_prompt_memory_beads(beads, 8)      // 取价值最高的 8 条记忆
history_block  = render_history_block(history)             // 渲染最近历史
prompt_text    = render_prompt_with_memory(prompt_beads, history_block)
token_budget   = compute_token_budget(prompt_beads, history)
```

### 2. 历史窗口策略（固定窗口截断）
- `MEMORY_CONTEXT_HISTORY_LIMIT = 12`：只保留**最近 12 条**消息（`render_history_block` 与 `build_context_history_messages` 都是 `.rev().take(limit).rev()`）。
- `MEMORY_CONTEXT_HISTORY_CHARS = 600`：每条消息正文截断到 600 字。
- 即：**滑动窗口 + 单条截断**，无对更早历史的压缩或检索。

### 3. 记忆 beads（分层 + 价值）
- `select_prompt_memory_beads(beads, 8)`：过滤掉 L4，按 `pinned > layer(L1>L2>L3) > confidence > created_at` 排序，取前 8。
- `MAX_MEMORY_BEADS_PER_SESSION = 256`：每会话最多 256 条，超出触发老化。
- **本轮已增强**：老化改为价值感知 `age_out_memory_beads_by_value`（kind 权重 + 星图关联度 + 置信度 + 新鲜度；pinned 永不淘汰）。低价值问答先老化，高关联任务步骤/结果留存。

### 4. token 预算
- `compute_token_budget` + `estimate_bead_tokens`（中文 0.55 / 英文 0.25 tok/char 粗估）用于**前端预览展示**，并非真正驱动裁剪。

### 5. 关键缺口：压缩未接入
- core-runtime 有完整的 `compact.rs`（`CompactionConfig { trigger_tokens, keep_recent_messages, target_tokens }` + `compact_session` + `estimate_session_tokens`），但 **web 聊天链路完全没调用它**（grep `compact_session` 在 main.rs 命中 0）。
- 也就是说：超出 12 条的历史被**直接丢弃**，不做摘要、不沉淀（仅靠 auto-extract 把个别消息转成 bead）。

## 二、业界主流 code agent 上下文方案（对照）

| 维度 | 业界常见做法（Claude Code / Cursor / Aider / Cline 等） | 本项目现状 |
| --- | --- | --- |
| 历史管理 | 满窗口后**自动压缩/摘要**（rolling summary），保留近 N 轮原文 + 旧轮摘要 | 固定窗口直接截断（丢弃旧历史） |
| 触发方式 | 按 **token 阈值**触发压缩（如达到上下文 70-80%） | 无触发；按条数(12)硬截 |
| 检索增强 | 对代码库/历史做 **RAG/语义检索**，按需注入相关片段 | 无检索；仅 8 条记忆 + 12 条近史 |
| 记忆/事实 | 长期记忆文件（CLAUDE.md / .cursorrules）+ 抽取式记忆 | 分层 beads + 本轮新增价值老化（已较先进） |
| token 预算 | 真正驱动裁剪/选择 | 仅用于预览展示 |
| 工具结果 | 大输出**截断/折叠/外置文件引用** | 部分有（diff 截断），未统一 |

## 三、改善点（按性价比排序）

### P0（高收益、可增量）
1. **把 core-runtime 的 compaction 接入 web 链路**：当 `estimate_session_tokens` 超过 `trigger_tokens` 时，对超出 `keep_recent_messages` 的旧历史做摘要压缩，压到 `target_tokens`。复用现成 `compact.rs`，避免重复造轮子。这是当前最大缺口。
2. **token 预算真正驱动选择**：让 `compute_token_budget` 的结果反过来约束 `select_prompt_memory_beads` 的条数与 `history_limit`（动态而非写死 8/12），在预算内最大化信息密度。

### P1（中收益）
3. **滚动摘要沉淀为高层 bead**：被压缩的旧历史生成 L3/L4 摘要 bead（带高 kind 权重），与本轮价值老化联动——重要历史以摘要形式留存，而非丢弃。
4. **检索式注入**：按当前用户输入的关键词，从全量 beads/历史里检索 top-k 相关项注入（已有 `query_memory_beads` 的关键词匹配基础，可升级为按当前 query 动态召回）。

### P2（长期）
5. **工具结果统一折叠/外置**：大输出写 `tmp/` 并在上下文里只放摘要 + 路径引用（本会话实践证明有效）。
6. **provider-specific tokenizer**：把粗估 `estimate_bead_tokens` 换成各 provider 真实分词，预算更准。

## 四、结论
当前是「固定窗口 + 分层记忆（已加价值老化）」，**记忆侧已接近业界，历史侧偏弱**——最关键的一步是把已经写好但闲置的 `compact.rs` 接到 web 聊天链路，实现 token 阈值触发的滚动摘要。其余按 P1/P2 渐进。
