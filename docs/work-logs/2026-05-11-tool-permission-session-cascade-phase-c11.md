# Phase C-11 落地：run_model_tool_dispatch 分流到 runtime

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 T3 / `docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md` §2.3  
前置：Phase A / B / C-1 ~ C-10

关联需求：
- 推进：`REQ-TOOL-007`（45% → 85%，LLM tool_use 首次走权限闸门 + 审计链）
- 推进：`REQ-TOOL-008`（LLM 触发的审批自动进 pending 队列，SSE 广播直达前端面板）
- 推进：`REQ-TOOL-009`（LLM tool_use 全链路落审计）
- 不动：Tool Loop 回灌格式（仍是纯文本；C-12 做 ToolResult block）

## 1. 本轮范围（Phase C-11）

按 C-9 §2.3 落地 **`run_model_tool_dispatch` 内部分流**。对外签名 `ApiResult<ToolDispatchResponse>` 保持不变 —— Tool Loop / `run_model_tool_use_message` 均不用改。内部按工具名分两路：

- **路径 A**：`tools_semantic_dispatch` → 提取到新函数 `legacy_semantic_dispatch`，行为完全不变。
- **路径 B**：其它 registry 工具 → `invoke_through_runtime` → `runtime_tool_execute` → `tool_outcome_to_dispatch_response` 映射回 `ToolDispatchResponse`。

新增两个内部函数：

- `invoke_through_runtime(name, input) -> ToolOutcome`：构造 `ToolInvoke{caller: Llm}` + `RuntimeToolContext`，跑 `runtime_tool_execute`，并复用 `enqueue_pending_approval` / `append_tool_audit_record`。
- `tool_outcome_to_dispatch_response(name, input, outcome) -> ToolDispatchResponse`：`status` 映射 `route` 枚举（`runtime-executed` / `runtime-dry-run` / `runtime-rejected` / `runtime-failed` / `runtime-timeout`），`safety_gate` 取 `permission_gate.decision`，`audit` 用 `ComputerUseAuditRecord` 封装 runtime 审计路径。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` `run_model_tool_dispatch` | 重写为 2 行路径分流（A → `legacy_semantic_dispatch`；B → `invoke_through_runtime` + 映射） |
| 同上（紧邻） | 新 `legacy_semantic_dispatch` / `invoke_through_runtime` / `tool_outcome_to_dispatch_response` 三个内部 async/sync 函数 |
| tests | 新 5 个 TDD 钉住分流语义 |

### 关键决策

**为什么 `invoke_through_runtime` 返回 `ToolOutcome` 而非 `ApiResult<ToolOutcome>`？**  
`runtime_tool_execute` 已经把所有失败态（unknown tool、权限 Deny、executor 错误）表达成 `ToolOutcomeStatus::Failed/Rejected/Timeout`。上层永远收到成功的 `Outcome`，然后通过 `status` 字段区分。这样 path B 绝对不会把 LLM 的某次 tool_use 变成 HTTP 5xx，更不会让 Tool Loop 整体失败。

**为什么 `session_id` 来自 `active_session_id` 而不是 Tool Loop 的 `agent.id`？**  
Phase C-11 不改 Tool Loop 的签名，先用全局 `active_session_id` 作为近似。精确化（`agent.id` 沿调用栈下传）放到 C-12：那时候 Tool Loop 要改成 ToolResult block 回灌，签名反正要动，一起改。

**为什么 DryRunOnly 的 `execute_allowed=false`？**  
因为它还没真正执行，等待用户审批。`safety_gate` 直接给决策字符串（`require-approval` / `require-confirm`），前端/LLM 都能读懂。

**审计与 pending 策略与 `/api/tools/runtime-execute` handler 保持一致**：DryRunOnly + 需 UI → 先 `enqueue_pending_approval`（触发 SSE + 审批面板），再 `append_tool_audit_record`。顺序不可颠倒，跟 Phase C-4 约定一致。

## 3. Tests

| 套件 | Phase C-10 | Phase C-11 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 177 | 5 | **182 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-11 新增用例：

1. `run_model_tool_dispatch_semantic_legacy_path_preserved` — `tools_semantic_dispatch` 不走 runtime 前缀；旧 computer-use dispatch 路径零回归
2. `run_model_tool_dispatch_readonly_through_runtime` — `read_file` → `route=runtime-executed + status=ok + plan.tool_id=read_file + mode=runtime + execute_allowed=true`
3. `run_model_tool_dispatch_write_file_goes_to_dry_run_and_pending` — `write_file(coolzhu.toml)` → `route=runtime-dry-run + status=dry-run-only + execute_allowed=false + safety_gate=require-confirm`
4. `run_model_tool_dispatch_unknown_tool_returns_failed_not_panic` — `nonexistent_tool` → `status=failed + notes contains "unknown tool"`，不 panic、不 HTTP 错
5. `run_model_tool_dispatch_emits_audit_entry_for_llm_calls` — 调 `read_file` 后 `.coolzhu/tool-audit.jsonl` 出现 `caller=llm + tool_name=read_file` 条目

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c11-dispatch-runtime-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-10 | `Copy-Item tmp\backups\phase-c10-llm-tool-definitions-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-8（纯后端态） | `tmp\backups\phase-c6-audit-jsonl-20260511-post\main.rs` |
| 回 Phase C-6 | 同上（main.rs 在 C-7/C-8 未变） |
| 回 Phase C-5 | `tmp\backups\phase-c5-protected-config-20260511-post\main.rs` |
| 回 Phase C-4 | `tmp\backups\phase-c4-tool-events-20260511-post\main.rs` |
| 回 Phase C-3 | `tmp\backups\phase-c3-runtime-execute-20260511-post\main.rs` |
| 回 Phase C-2 | `tmp\backups\phase-c2-approval-api-20260511-post\main.rs` |
| 回 Phase C-1 | `tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs` |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

**运行时紧急回退**（不重编）：`coolzhu.toml [model] llm_tool_exposure = "dispatch-only"` → LLM 只看到 `tools_semantic_dispatch` → 永远只走 path A，path B 不会被激活。

## 5. 接口契约

### `ToolDispatchResponse` 新出现的 `route` / `status` 值

| route | 触发条件 | status |
| --- | --- | --- |
| `runtime-executed` | ReadOnly 工具成功跑完 | `ok` |
| `runtime-dry-run` | `DryRunOnly`（RequireApproval / RequireConfirm） | `dry-run-only` |
| `runtime-rejected` | `Deny` 分支 | `rejected` |
| `runtime-failed` | 未知工具 / executor 内部错误 | `failed` |
| `runtime-timeout` | 超时（目前 runtime 未实装，预留） | `timeout` |

旧 route 值（`semantic-dispatch` / `computer-use-...`）继续适用于 path A，前端/测试无需改。

### `dispatch_plan.llm_tool_call.mode`

Path A 保持旧值（`"computer-use"` / `"vision"` 等），Path B 为 `"runtime"`，前端可据此区分 UI 展示风格。

## 6. 未落地（Phase C-12 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-007 收尾 | Tool Loop 改用 `InputContentBlock::ToolResult` + `join_all` 并发 |
| REQ-TOOL-011 | `runtime_tool_execute` 实装 tokio::time::timeout + Semaphore；status=Timeout 路径启用 |
| REQ-CORE-TOOL-001 | CLI / MCP 入口切 runtime |
| 会话级 session_id | 从 Tool Loop 沿调用栈传 `agent.id`，替换全局 `active_session_id` |

## 7. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| Path A 和 B 的 ToolDispatchResponse 字段语义不完全对称（如 `audit.log_path`） | 低 | path B 的 audit 指向 `tool-audit.jsonl`，path A 指向 `computer-use-audit.jsonl`，前端按 route 前缀区分展示 |
| LLM 误用 `write_file` 进入 DryRunOnly 后无人审批 → 卡住 | 中 | Phase C-4 SSE 实时推送 + Phase C-7 面板；如无人操作 5 min TTL 自动过期 |
| `active_session_id` 为 None 时 session grant 查不中 | 低 | `session_grant_view_for(&ws, None, &tool)` 返回 `session_authorized=false`，最多是每次都审批 |
| 审计文件快速膨胀（LLM 密集调用） | 中 | Phase D 加日志轮转；目前 audit 单行 < 1KB，50 条 < 50KB |

## 8. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- run_model_tool_dispatch_

# 全量回归
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline

# 手工端到端：
# 1. enable_llm_tools=true + llm_tool_exposure="all"
# 2. LLM 发 tool_use name=read_file input={path:".."} → 前端审计表出现 runtime-executed 记录
# 3. LLM 发 tool_use name=write_file input={path:coolzhu.toml} → SSE permission-required → 面板弹出
# 4. 点授权 → session grant 记入；再发一次同 call → allow-approved
```

## 9. 下一步（Phase C-12）

Tool Loop 两处（流式 3948-4003 / 非流式 7115-7143 `run_model_tool_dispatch` 调用点）切为：

```rust
for (tool_use_id, (name, input)) in model_tool_calls {
    let outcome = run_model_tool_dispatch(&name, &input).await?;
    tool_result_blocks.push(InputContentBlock::ToolResult {
        tool_use_id,
        content: vec![ToolResultContentBlock::Json { value: outcome_to_json(&outcome) }],
        is_error: outcome.status == "failed" || "rejected" || "timeout",
    });
}
messages.push(InputMessage::user_with_blocks(tool_result_blocks));
```

同时做 `futures::future::join_all` 并发，整批 5 条 TDD。预期 web-console 187 passed。

## 10. 给下一任 agent 的提醒

1. **Path A 不可替代**：`tools_semantic_dispatch` 返回的是 computer-use dry-run plan（带 `action_plan / visual_action` 等字段），path B 映射无法 1:1 还原。前端/tool-summary 消息格式都依赖这些字段，Phase C-12+ 都不要动 path A。
2. **audit 写入顺序**：`enqueue_pending_approval → append_tool_audit_record`；如果把 audit 放前面，pending 的 `call_id` 不会出现在 audit 里（因为 audit 从 `outcome.call_id` 取，此时还未变）。
3. **`ReadOnlyRegistryExecutor` 单例**：每次 `invoke_through_runtime` 都 `from_registry()` 构造，开销可忽略（< 1μs）；如果未来要加更多 executor，考虑 `OnceLock<Vec<Box<dyn ToolInvocationExecutor>>>` 缓存。
4. **`diag!` 前缀一致性**：`[TOOL-CHAIN]`（入口）、`[TOOL-GATE]`（权限闸门触发）、`[TOOL-EXEC]`（直通执行）、`[TOOL-AUDIT]`（审计写失败） — 全部 Phase A~C 已约定，新代码沿用。
