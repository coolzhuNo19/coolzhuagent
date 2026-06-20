# Phase B 落地：runtime_tool_execute 脚手架 + 自动沉淀 origin 归因

时间：2026-05-11  
方案链接：
- `docs/tool-calling-permission-plan-2026-05-10.md`
- `docs/session-memory-workspace-integration-plan-2026-05-10.md`

关联需求：
- 推进：`REQ-MEM-006`（新增 → 测试中），`REQ-WEB-SESSION-007`（测试中，级联范围自动扩大到 auto-bead）
- 推进：`REQ-TOOL-007/008`（待开发 → 开发中，runtime 侧脚手架就位，Web 调用侧尚未切换）
- 关联：`REQ-WEB-CTX-001`（token 估算工具函数就位）

前置依赖：Phase A（见 `2026-05-10-tool-permission-session-cascade-phase-a.md`）

## 1. 本轮范围（Phase B）

继续保持零 prod 行为变更的原则：

- **B-1**：自动记忆沉淀链路补齐 `origin_message_id / origin_table / token_count`，让 Phase A 落地的级联删除对 auto-bead 真正生效。
- **B-2**：在 core-runtime 中实装 `runtime_tool_execute` + `ToolInvocationExecutor` trait + `RuntimeToolContext`——作为 Phase C 切换 web-console 的 drop-in 入口，但本轮不接入任何 prod 调用点。
- **不改**：`llm_tool_definitions` / `run_model_tool_dispatch` / Tool Loop 回灌 / `save_session_state_to_sqlite` / 前端审批 UI。

## 2. 实际变更

### 2.1 B-1：自动沉淀 origin 归因

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` `AddMemoryBeadRequest` | 新增 3 个可选字段 `origin_message_id / origin_table / token_count`；`#[derive(Default)]` 便于测试 |
| `web-console/src/main.rs` `SessionStore::add_memory_bead` | 把新字段透传到 `MemoryBeadDto`；既有不传字段的调用点行为不变 |
| `web-console/src/main.rs` `persist_auto_memory_beads` | 自动沉淀 bead 时填 `origin_message_id = message.id`、`origin_table = "chat_room_messages"`、`token_count = estimate_bead_tokens(&summary)` |
| `web-console/src/main.rs` `persist_reference_forward_memory` | 显式用 `..AddMemoryBeadRequest::default()` 保持无 origin（引用/转发不是消息衍生） |
| `web-console/src/main.rs` `estimate_bead_tokens` | 新工具函数：CJK × 0.55 + ASCII × 0.25 粗估；`REQ-WEB-CTX-001` 待 Phase C 替换为 provider-specific tokenizer |

### 2.2 B-2：runtime_tool_execute 脚手架

| 文件 | 动作 |
| --- | --- |
| `core-runtime/src/tool.rs` | 新增 `ToolInvocationExecutor` trait（`handles` + `execute`）、`RuntimeToolContext`、`runtime_tool_execute(invoke, ctx) → ToolOutcome` |
| 同上 | runtime_tool_execute 流程：`evaluate_permission` → `Deny → Rejected`、`Require* → DryRunOnly`、`Allow* → executor.execute` 并用 runtime 评估的 gate **覆盖** executor 返回的 gate（防止 executor 伪造权限状态） |
| `core-runtime/src/lib.rs` | `pub use` 新 API：`runtime_tool_execute / RuntimeToolContext / ToolInvocationExecutor` |

关于命名冲突：`conversation.rs` 已有 `pub trait ToolExecutor`（旧 runtime 用），为避免含糊本轮采用 `ToolInvocationExecutor`。Phase C 切换 web-console 时，两者可以并存；`runtime::ToolExecutor` 继续为旧路径服务，新路径统一走 `runtime::ToolInvocationExecutor`。

### 2.3 Tests

| 套件 | Phase A | Phase B 新增 | Phase B 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 134 | 5（runtime_tool_execute 路径） | **139 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 147 | 2（estimate_bead_tokens、add_memory_bead_request_defaults） | **149 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

B-2 新增的 5 个用例：

1. `runtime_tool_execute_readonly_runs_executor` — ReadOnly 工具直接放行 + executor 被调用
2. `runtime_tool_execute_workspace_outside_returns_dry_run` — WorkspaceWrite 在 workspace 外 → DryRunOnly + RequireApproval
3. `runtime_tool_execute_protected_returns_dry_run_with_confirm` — 写 `coolzhu.toml` → DryRunOnly + RequireConfirm + `protected_match = coolzhu-config`
4. `runtime_tool_execute_unknown_tool_returns_failed` — executors 不认识该工具 → Failed（非 panic）
5. `runtime_tool_execute_overwrites_executor_placeholder_gate` — executor 返回的 `permission_gate` 必须被 runtime 评估结果覆盖

B-1 新增的 2 个用例：

1. `estimate_bead_tokens_mixed_cjk_ascii` — 空串/ASCII/CJK/混合四种场景
2. `add_memory_bead_request_defaults_origin_absent` — `Default` 构造不泄漏 origin 字段

## 3. 备份与回滚点

### Post-change 快照（Phase B）

`tmp/backups/phase-b-tool-session-20260511-post/`
- `main.rs`、`core-runtime-tool.rs`、`core-runtime-permission_gate.rs`、`core-runtime-lib.rs`、`tool-registry-lib.rs`、`tool-registry-path_effect.rs`

### 回滚步骤

| 目的 | 命令 |
| --- | --- |
| 只回退 B-1（保留 B-2 脚手架） | 用 Phase A `post` 覆盖 `main.rs`：`Copy-Item tmp\backups\phase-a-tool-session-20260510-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 只回退 B-2（保留 B-1） | 用 Phase A `post` 覆盖 `core-runtime-tool.rs` + `core-runtime-lib.rs` |
| 一键回退到 Phase A | Copy `tmp\backups\phase-a-tool-session-20260510-post\*` |
| 回退到修改前 | Copy `tmp\backups\phase-a-tool-session-20260510-pre\`（覆盖 core-runtime、tooling、web-console） |

B-1 的字段在既有数据上读 `None`，既有路径不会感知（`skip_serializing_if`）；B-2 没有任何 prod 调用点，零回归。

## 4. 未落地项（Phase C 入口）

| 需求 | 待落地动作 | 所在方案章节 |
| --- | --- | --- |
| REQ-TOOL-007 | `web-console::run_model_tool_dispatch` 内构造 `ToolInvoke` + 注入 `ReadOnly/WorkspaceWrite/DangerFullAccess` 的 `RuntimeToolContext` → 调 `runtime_tool_execute`；Tool Loop 改发 `OutputContentBlock::ToolResult` | 文档 1 §4 T3/T4 |
| REQ-TOOL-008 | 实装 `SessionGrants`（内存，30 min TTL）+ SSE `tool-permission-required` + `POST /api/tools/approve`/`reject`/`pending` | 文档 1 §5 |
| REQ-TOOL-009/010 | 审计 jsonl 的 `input_summary` 白名单投影 + `coolzhu.toml [tool.protected_paths]` 段 | 文档 1 §5.5 |
| REQ-TOOL-011 | 为 bash/PowerShell 接 tokio::time::timeout + semaphore | 文档 1 §4.1 T5 |
| REQ-WEB-SESSION-007 收尾 | 把 `SessionStore::delete_*` 从"in-memory retain + 全表重写"换成 SQL 事务 DELETE；trigger 接管级联；附件 GC | 文档 2 §5 |
| REQ-WEB-PROJECT-003 | `WorkspaceScope` + 原子 swap + `/api/workspace/reload` | 文档 2 §4 |
| REQ-WEB-CTX-001 | `ContextBuilder` 历史窗口 + FTS5 召回（`estimate_bead_tokens` 复用） | 文档 2 §6 |

## 5. 接口兼容性清单

**对外接口**（前端 / CLI 感知）：

| 接口 | 变化 | 兼容性 |
| --- | --- | --- |
| `POST /api/sessions/:sid/beads` | body 可选新字段 `origin_message_id/origin_table/token_count` | ✅ 向后兼容（缺省仍走 None） |
| `MemoryBeadDto` JSON | 三字段可选，`skip_serializing_if = Option::is_none` | ✅ |
| `AddMemoryBeadRequest` JSON | 同上 | ✅ |
| 既有路由 | 无变化 | ✅ |

**内部接口**（仅本仓）：

| 接口 | 变化 | 影响 |
| --- | --- | --- |
| `runtime::*` 导出 | 新增 `runtime_tool_execute / RuntimeToolContext / ToolInvocationExecutor` | 纯新增，Phase C 使用 |
| `runtime::ToolExecutor`（旧 `conversation.rs`） | 未变 | 继续为旧路径服务 |

## 6. 验证命令速查

```powershell
# Phase B-1 单测
cargo test -p coolzhu-web-console --offline --bins -- estimate_bead_tokens add_memory_bead_request

# Phase B-2 单测
cargo test -p coolzhu-core-runtime --offline --lib -- tool::runtime_tool_execute

# 全量回归（单线程稳定）
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test --test module_linkage_smoke --offline
```

## 7. 诊断日志前缀（Phase C 将启用）

本轮未埋 `[TOOL-REG] / [TOOL-GATE] / [TOOL-EXEC] / [TOOL-LOOP] / [TOOL-AUDIT] / [CASCADE] / [MEM-ORIGIN]` 任何一条——代码入口尚未接入 prod 调用路径。

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| B-1：老路径（未经 `persist_auto_memory_beads` 的手工 bead）仍无 origin，级联删除不覆盖 | 低 | 符合预期：手工 bead 不应该被消息删除牵连 |
| B-2：executor gate 覆写有意外情况（例如 executor 自己做了 deny 决策） | 低 | TDD `runtime_tool_execute_overwrites_executor_placeholder_gate` 明确钉住契约；executor 未来需要 deny，走 `ToolOutcomeStatus::Failed` 而非篡改 gate |
| Rust 编译器栈溢出（stack buffer overrun on `tools-*.exe` 默认并发） | 中（历史问题） | 用 `--test-threads=1` 跑 tool-registry 全量；后续若持续，可在方案 §`REQ-TEST-xxx` 中单立需求拆分 `tool-registry/src/lib.rs` |

## 9. 下一步建议

Phase C 推进顺序（每步一个 commit，保持回滚成本 ≤ 1 revert）：

1. **C-1**：在 web-console 新增 `ReadOnlyExecutor`（包一下 `tools::execute_tool`）→ 用 `runtime_tool_execute` 试跑 `read_file/glob_search/grep_search/WebFetch/WebSearch`；仅 `caller=ToolCaller::WebUi` 路径，保证旧 LLM tool_use 回路不受影响。
2. **C-2**：SSE `tool-permission-required` + `POST /api/tools/approve`/`reject`/`pending`；`SessionGrants` 内存结构 + 30 min TTL。
3. **C-3**：`run_model_tool_dispatch` 切到 `runtime_tool_execute`；`llm_tool_definitions` 全量暴露（仍可带白名单 feature flag）。
4. **C-4**：Tool Loop 发 `OutputContentBlock::ToolResult`，并发 `join_all`。
5. **C-5**：事务化 `delete_*` + 附件 GC。

每步独立验收矩阵：`cargo test -p <pkg> --offline` + 至少 1 条针对新增路径的 TDD。
