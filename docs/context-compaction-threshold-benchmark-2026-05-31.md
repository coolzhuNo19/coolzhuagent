# 上下文压缩触发阈值：业界比对与 coolzhu 取值建议（2026-05-31）

> 用户要求：模型上下文达到阈值后压缩加载的百分比，先搜业界主流 agent 方案做比对再定取值。

## 一、业界主流方案（联网核实）

| Agent | 压缩触发阈值 | 预留缓冲 | 关键做法 | 来源 |
| --- | --- | --- | --- | --- |
| Claude Code（默认） | **~95% 容量**(剩 25%) | — | token 计数跑 tally，过阈值前 compact | [cometapi](https://www.cometapi.com/what-is-auto-compact-in-claude-code/) |
| Claude Code（2025改进后） | **64–75% 提前触发** | ~33K token(16.5%) | 95% 太晚(性能已退化)，提前避免压缩失败 | [hyperdev](https://hyperdev.matsuoka.com/p/how-claude-code-got-better-by-protecting) |
| Claude Code（可配） | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 1–100 | — | 阈值可配 | [issue#41818](https://github.com/anthropics/claude-code/issues/41818) |
| Cursor（Composer 2） | 命中长度阈值即 self-summarize | — | 自压缩到 ~1000 token(传统 5000+)；大输出转文件；选择性加载 MCP(省46.9%) | [vantage](https://www.vantage.sh/blog/cursor-composer-2) |
| 通用最佳实践 | **阈值设在硬上限以下，留足缓冲** | 有意义的缓冲 | 始终留出空间生成完整回复或压缩摘要 | [developertoolkit](https://developertoolkit.ai/en/cursor-ide/advanced-techniques/token-management/) |

### 提炼的共识
1. **不卡硬上限**：触发阈值必须 < 100%，留缓冲让模型有空间生成"最终回复"或"压缩摘要"。
2. **95% 偏晚**：到 95% 时性能/质量已退化，且压缩本身要消耗上下文，易"压缩失败"。业界趋势提前到 **64–75%**。
3. **预留缓冲 ~15–25%**：Claude Code 现预留 ~16.5%(33K)。
4. **大工具输出转文件/截断**：Cursor 和 Claude Code 都把长输出外置/折叠（coolzhu 已有 `truncate_tool_result_for_context`，同向）。

## 二、coolzhu 现状（代码事实）

- **两个独立概念**，不要混淆：
  - **历史占比** `history_token_budget = context × 55%`、`memory = context × 8%`
    （`context_build_options_for_agent`）——决定"组装时历史/记忆在预算里占多少"。
  - **压缩触发**：coolzhu 目前**没有真正的"用量达阈值才触发"机制**。`build_context_assembly` 是
    "按 history_budget 从最新往回收，超预算的旧史走 `summarize_dropped_history` 摘要注入"——
    即**每次都按固定 55% 预算裁剪**，而非"用到 X% 才压缩"。
- 对照业界：coolzhu 的 55% 更像"始终只给历史留 55% 空间"，比 Claude Code 的"用到 64–95% 才压"更激进保守
  （好处是永不超限，代价是大窗口模型下历史利用不足 / 频繁摘要）。

## 三、coolzhu 取值建议

### 方案 A（推荐，最小改动，与现架构兼容）：把"占比"调成"分层预算 + 压缩阈值"
- **压缩触发阈值** `COMPACT_TRIGGER_PCT = 70%`（对齐业界 64–75% 中位，留 30% 缓冲给输出+压缩）。
  - 即：当 `已用历史 tokens ≥ context × 70%` 时才触发 `summarize_dropped_history` 压缩；未到则原文保留。
  - 比现"恒按 55% 裁"更充分利用大窗口，又不会像 95% 那样退化。
- **历史预算上限** `history_budget = context × 70%`（替代 55%），**但**减去：
  - 输出预留 = `min(max_output_tokens, context × 15%)`
  - 记忆预算 = `context × 8%`（保持）
  - 系统提示实测占用
  - → 真正可用历史 ≈ context × (70% − 8%) − 输出预留，动态而非写死。
- 落点：`context_build_options_for_agent` 改为按 model 的 `context_tokens` + `max_output_tokens`（来自更正后的总表）动态算，而非固定 55%/8%。

### 方案 B（更贴业界，改动大）：引入真正的"用量阈值触发"
- 维护会话累计 token tally（用 API 返回的 usage），达 `context × 70%` 才触发一次 compaction，
  压缩后继续，直到再次达阈值。需改 tool loop 多轮累计逻辑（之前审计 H3 已确认 tool loop 有累计但无阈值守卫）。
- 这是 R-AUDIT-A3（tool loop 累积 token 守卫）的完整版。

### 结论与取值
- **本轮建议取 `70%` 作为压缩触发/历史预算基准**（业界 64–75% 中位，留 30% 缓冲），替代现 55%。
- 输出预留按 `max_output_tokens`（更正后总表已有真实值，如 deepseek 384K、qwen 65K）动态扣，避免大输出被历史挤掉。
- 记忆 8% 暂保持（价值老化已管控记忆质量）。
- 先在 **R-MODELTAB 容量更正落地后**再调此比例（因为 70% 作用在准确的 context_tokens 上才有意义——
  当前 deepseek 还是错的 64K，先修容量再调比例）。

### 实施顺序
1. R-MODELTAB-VERIFY 先更正容量（本轮任务2）。
2. 再把 55% → 70% 并接入 max_output 动态预留（下一步，单独验证）。
3. 可选 R-AUDIT-A3：tool loop 用量阈值守卫（方案B，二道防线）。

## 来源
- [Claude Code Compaction](https://stevekinney.com/courses/ai-development/claude-code-compaction)
- [Auto Compact 95%/改进](https://www.cometapi.com/what-is-auto-compact-in-claude-code/)、[hyperdev 64-75%](https://hyperdev.matsuoka.com/p/how-claude-code-got-better-by-protecting)
- [可配阈值 issue](https://github.com/anthropics/claude-code/issues/41818)
- [Cursor Composer 2 self-summarize](https://www.vantage.sh/blog/cursor-composer-2)
- [留缓冲最佳实践](https://developertoolkit.ai/en/cursor-ide/advanced-techniques/token-management/)
