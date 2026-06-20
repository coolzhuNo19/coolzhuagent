# Agent 诊断事件字典（Event Dictionary）

- 日期：2026-06-14
- 关联：`CUR-DIAG-LOG-001`（补日志方案 §8 L3 交付物）
- 底座：`modules/diagnostics`（JSONL：`~/.coolzhu/logs/coolzhu-web-console.jsonl`）
- 用途：开机自检（`CUR-SELFCHECK-001`）与长时间随机测试（`CUR-SOAK-MONKEY-001`）据此实现"是否走到功能预期"的机判。

> 事件命名 `<module>.<action>.<phase>`，phase ∈ `begin | ok | incomplete | error`。
> 每条 `LogEntry` 自带 `timestamp_ms / level / app / module / event / trace_id / span_id / fields`。
> Step 2 后，一次会话回合的子操作（context/memory/tool/perm）均带同一 **`trace`** 字段（回合 trace，端到端可归并）。

---

## 1. 已落地事件清单

### memory（记忆，core agent）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `memory.recall.begin` | Info | trace, query, limit | 开始召回 |
| `memory.recall.ok` | Info | trace, hit_count, strategy, used_tokens | 召回成功（span outcome=ok） |
| `memory.recall.incomplete` | **Warn** | trace, strategy | **未达预期**：无召回（span outcome=incomplete） |
| `memory.write.begin` | Info | messages | 开始自动沉淀 |
| `memory.write.ok` | Info | written, messages | 沉淀完成（span outcome=ok） |

### session（会话链路）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `session.context_build.begin` | Info | trace, model, history_len | 开始构建上下文 |
| `session.context_build.ok` | Info | trace, memory_beads, history_msgs, total_tokens, truncated | 构建完成（span outcome=ok） |
| `session.turn.begin` | Info | trace, provider, model, real_llm | 回合开始 |
| `session.turn.ok` | Info | trace, used_real_model, answer_len, tool_requests, latency_ms | 回合成功 |
| `session.turn.incomplete` | **Warn** | trace, reason(`empty_output`/`real_llm_disabled`), latency_ms | **未达预期**：回退本地 |
| `session.turn.error` | **Error** | trace, err_kind(`model_call`), hint, latency_ms | **错误**：模型调用失败回退 |

### context（上下文压缩）
| 事件 | level | 关键字段 | 含义 |
|---|---|---|---|
| `context.compact.ok` | Info | dropped, summary_len | 历史超预算触发滚动摘要压缩 |

### tool（工具调用）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `tool.invoke.begin` | Info | trace, tool | 工具调用开始 |
| `tool.invoke.ok` | Info | trace, tool, latency_ms | 工具调用成功 |
| `tool.invoke.error` | **Error** | trace, tool, err_kind(`dispatch`), hint, latency_ms | **错误**：dry-run 转换失败 |

### perm（权限）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `perm.check` | Info | trace, tool, decision, required, requires_ui, status | 工具权限评估；`requires_ui=true` 或 `decision≠AllowApproved` = 被门控 |

### goal（Goal 阶段）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `goal.phase.begin` | Info | trace, workspace, goal, phase | 阶段开始 |
| `goal.phase.ok` | Info | trace, phase, latency_ms | 阶段成功；**孤儿 begin（无 ok）= 阶段失败** |

### vision（视觉确认）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `vision.locate.begin` | Info | target, use_model | 视觉定位开始 |
| `vision.locate.ok` | Info | grounded, model_requested, latency_ms | 成功；**孤儿 begin = 失败** |
| `vision.describe.begin` | Info | use_model | 视觉描述开始 |
| `vision.describe.ok` | Info | status, latency_ms | 成功；**孤儿 begin = 失败** |

### cu（computer-use）
| 事件 | level | 关键字段 | 含义 / 判据 |
|---|---|---|---|
| `cu.action.begin` | Info | scenario, x, y | 真实输入注入开始（仅 execute=true；dry-run 不发） |
| `cu.action.ok` | Info | scenario | 注入成功 |
| `cu.action.error` | **Error** | scenario, hint | **错误**：注入失败 |

---

## 2. "未达预期" 机判信号（供自检 / soak）

| 信号 | 判据 | 适用事件 |
|---|---|---|
| outcome≠ok | `SpanClosed.attributes["outcome"]` 非 ok | memory.recall / memory.write / session.context_build（带 span 的同步操作） |
| ERROR/WARN | level ≤ Warn | `session.turn.incomplete/error`、`memory.recall.incomplete`、`tool.invoke.error`、`cu.action.error` |
| 孤儿 begin | 有 `*.begin` 无对应 `*.ok/*.error` | `goal.phase.*`、`vision.*`、`tool.invoke.*`、`session.turn.*`（async，靠 `trace` 归并） |
| 超时 | `SpanClosed.duration_ms` 或事件 `latency_ms` > 模块阈值 | 带 latency_ms 的事件 |
| panic 兜底 | 上层 `catch_unwind` → `*.panic` | soak driver（待实现） |
| 权限门控 | `perm.check` 的 `requires_ui=true` / `decision≠AllowApproved` | perm.check |

---

## 3. 归并与回溯

- **同步操作**（memory.recall / memory.write / context_build）：用 `coolzhu-diagnostics` thread-local span，自动带 `span_id/trace_id`（span 自身的）；同时事件携回合 `trace` 字段。
- **异步操作**（session.turn / tool.invoke / goal.phase / vision / cu）：span 上下文不跨 `.await`，靠显式 `trace` 字段归并；Step 2 用 `tokio::task_local!(TURN_TRACE)` 把回合 trace 注入 `call_agent_model*` 内的子操作（context/memory/tool/perm）。
- **一次回合回溯**：按 `trace`=回合 id 过滤 JSONL，即得 turn → context_build → memory.recall → tool.invoke → perm.check 全链路。

---

## 4. 待补（后续）

- vision / computer-use 的 **error/incomplete 显式事件**（当前 vision 靠孤儿 begin；cu 仅 action 有 error）。
- goal 阶段 role（commander/planner/implementer/verifier）字段细化。
- soak driver 的 `*.panic` / `soak.*` 事件。
- 跨 crate（vision-service / computer-use-core 内部）打点（当前在 web-console 调用侧）。
