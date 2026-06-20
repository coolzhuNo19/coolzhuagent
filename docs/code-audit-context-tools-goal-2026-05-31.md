# 四子系统代码隐患审查（2026-05-31，最终版）

范围：① 上下文阈值检测 ② 自动 compact 加载 ③ 工具调用与权限拦截 ④ goal 模式流程。

> 证据口径：本审计结论均以可信信号为准——(a) 运行时 `/api/*` HTTP 实测结构化 JSON；
> (b) `cargo build/test/clippy` 退出码与计数；(c) `grep -c` 数字。
> ⚠️ 过程纠错：审计初版曾据"修复前旧服务器实例"的快照误判出 H1/H3 两个"高危"，
> 新二进制实测后**已撤销**（详见各条）。教训：实测前必确认服务器跑的是含改动的新二进制。

---

## 已确认并修复

### 🔴→✅ H6（高）：`semantic_action_from_intent` visual_action 关键词含空串 `""`，导致恒命中
- 确认（grep -c，不依赖易污染的内容读取）：修复前 `grep -c '&\["", "视觉"'` = **1**。
- 危害：Rust `任意字符串.contains("")` **恒为 true**。该分支是 `else if` 链的倒数第二个，凡未命中
  前面（右键/双击/拖拽/滚动/输入/热键/按键）的输入都落到这里并**恒返回 `visual_action`**，
  使 `semantic_action_from_intent` 对几乎所有意图都判为"视觉动作" → `calls_vision=true` → 误触截图。
- **这是 test5"分析目录"却执行 `computer.visual_action`(desktop-icon-left-click)+闭环截图的直接代码根因。**
- 修复：`""` → `"看"`（恢复本应有的"看"字）。验证：`grep -c` 空串变体=0、"看"变体=1；
  `cargo build` exit 0、0 error；`cargo test -- --test-threads=1` **374 passed / 0 failed**。

---

## 排查后排除（含撤销的误判）

### ✗ H1（撤销）：动态上下文预算"失效"——实为旧二进制快照误导
- 新二进制运行时实测 `/api/.../context-preview` 的 `token_budget.history`：
  - qwen3.7-max = **67453**（128k×~55%，且经 compact 后 total 68409/budget 71356）。
  - deepseek-v4-pro = **35200**（64k×55%）。
- → `context_build_options_for_agent` 的 `model_context*55/100` **完全生效**。初版读到的 3000 是
  修复前旧实例的会话快照。**无此隐患。**

### ✗ H3（撤销）：tool loop"无限累积绕过预算"——实为有界
- 真实读取确认：tool loop 后续轮 `agent_message_request_with_context_messages(&assembly.system_prompt, msgs)`，
  system_prompt 仍来自经预算约束的 assembly；每轮工具结果已套 `truncate_tool_result_for_context`(单条≤8000字符)；
  轮数受 `tool_execution_policy().max_feedback_rounds` 上限。累积**有界**，非"无限绕过"。
- 仍建议（P2 加固，非缺陷）：tool loop 增加"累积 history token 超 context×0.7 即停循环强制总结"的二道防线。

### ✗ ② goal 记忆污染 —— 排除
- 实测 test5 beads total=106，source 全为 `chat-room:auto-extract`(105)+`reference-forward`(1)，
  **goal 相关=0**；`select_context_memory_beads` 受 memory_budget 约束实际只注入少量。无 goal/skill overlay 污染。

### ✗ ③ 权限拦截 —— 排除
- 截图 `execute_allowed=true / allow-auto / execution allowed by permission profile`，无错误拦截。

### ✗ unwrap panic 风险 —— 排除
- clippy restriction 扫描 `unwrap_used` 命中仅 **2 处，且均在 `#[cfg(test)] mod tests`**
  （main.rs 全部 `.unwrap()` 调用行号 ≥27789，均属测试）。**生产代码路径无 unwrap panic。**

---

## 真实但次要的隐患（建议修，不紧急）

### 🟡 A1：deepseek-v4 系列上下文容量登记偏小
- `model_token_limit` 中 deepseek-v4-flash/pro/chat/reasoner 未在 `MODEL_TOKEN_LIMITS` 显式登记，
  走 `DEFAULT_MODEL_TOKEN_LIMIT` = **64000**（实测能力表/预算均显示 64000）。
- deepseek-v4 实际上下文为 128k → 当前**保守一半**，长会话历史窗口被低估。
- 建议：在 `MODEL_TOKEN_LIMITS` 补 `deepseek-v4-*` = context_tokens 128_000（providers/mod.rs，小改）。

### 🟡 A2：clippy restriction 噪音中的潜在算术/索引点（需人工甄别）
- `arithmetic_side_effects` 186 处、`indexing_slicing` 108 处——**绝大多数是 lint 过度敏感的误报**
  （token 估算的 `+`/`*`、已知边界的切片等），但其中**少数**用户输入驱动的索引/减法值得逐个核对。
- 建议（P2）：对 `[...]` 直接索引、`a - b`(无 saturating) 的非测试命中点人工过一遍，改 `get()`/`saturating_*`。
- 不阻断：默认 clippy（无 restriction）= 605 warnings 多为 pedantic/cast，非运行时致命。

### 🟢 ④ goal 回退状态机 —— 自洽（确认）
- `next_runnable_goal_phase_id` 只选 `status=="running"` 的 phase。本会话所加回退把受阻 phase 置 `pending`+goal `paused`，
  即"暂停等 planner 重规划/人工 resume"——与 `dispatch_ready_goal_phases`(在 review 通过后把 ready phase 重新派为 running)
  配合自洽，不会与 verification-blocked(保持 running)路径冲突（两者状态不同：blocked 留 running 原地重试，
  needs-replan 退 pending 等重派）。**逻辑一致，无死锁。**

---

## 结论
| 项 | 等级 | 状态 |
| --- | --- | --- |
| H6 空串 visual_action 恒命中 | 🔴高 | **已修**（test5 截图直接根因）build+374测试通过 |
| H1 动态预算失效 | — | 误判撤销（实测预算生效） |
| H3 tool loop 绕过预算 | — | 误判撤销（有界，已加单条截断） |
| goal 记忆/权限/unwrap | — | 排除（实测/clippy 证实无） |
| A1 deepseek 容量登记 64k | 🟡中 | 待补 128k（小改 providers） |
| A2 算术/索引 restriction 命中 | 🟡低 | P2 人工甄别少数真点 |
| tool loop 累积守卫 / goal 状态机 | 🟢 | 加固建议(P2) / 自洽确认 |

**净结论**：本轮唯一真实功能性 bug = H6 空串 visual_action（已修，正是 test5 误截图根因）；
其余"高危"经新二进制实测均为误判或保守项。生产路径无 unwrap panic。次要项 A1/A2 列入需求文档 P2。
