# Phase C-2 落地：工具审批 API 脚手架

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.4 / §7 步骤 D  
前置：Phase A（2026-05-10）、Phase B、Phase C-1（2026-05-11）

关联需求：
- 推进：`REQ-TOOL-008`（开发中，审批 4 条 API + SessionGrants/PendingApprovals 内存结构就位）
- 推进：`REQ-TOOL-009`（新增 → 开发中，`build_input_summary` 白名单投影 TDD 落）
- 未动：`REQ-TOOL-007`（仍在 Phase C-3）

## 1. 本轮范围（Phase C-2）

在不替换 `run_model_tool_dispatch` 的前提下，打通"审批接口 + 会话级授权缓存"：

- **新增** 4 条 HTTP：
  - `GET  /api/tools/protected-paths`
  - `GET  /api/tools/pending`
  - `POST /api/tools/approve`
  - `POST /api/tools/reject`
- **新增** `SessionGrants`（`OnceLock<Mutex<BTreeMap<String, SessionGrantRecord>>>`，TTL 30 min）
- **新增** `PendingApprovals`（`OnceLock<Mutex<BTreeMap<String, PendingApprovalRecord>>>`，TTL 5 min）
- **新增** `build_input_summary` — 审计/SSE 时只落字段名 + 长度，不落值（REQ-TOOL-009）
- **去掉** `preview_tool_permission` 的 `#[cfg(test)]` 门，使其对新 API 可见
- 旧 `run_model_tool_dispatch` 与 Tool Loop **未动**；前端 UI 也未动

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` routes（line ~220） | 新增 4 条路由（`/protected-paths /pending /approve /reject`） |
| `web-console/src/main.rs` `preview_tool_permission` | 去 `#[cfg(test)]`，正式暴露 |
| `web-console/src/main.rs` | 新 `SessionGrantRecord`、`session_grants()`、`session_grant_key`、`session_grant_view_for`、`record_session_grant`、`clear_session_grants_for_test` |
| 同上 | 新 `PendingApprovalRecord`（含 `PendingApprovalPermission`）、`pending_approvals()`、`build_input_summary`、`enqueue_pending_approval`、`clear_pending_approvals_for_test` |
| 同上 | 4 个 handler + 请求/响应 DTO（`ProtectedPathsResponse`、`PendingApprovalsResponse`、`ApproveRequest`、`ApproveResponse`、`RejectRequest`、`RejectResponse`） |
| `web-console/src/main.rs` tests | 顶部 `use axum::Json;` 让 TDD 能模式匹配 Json handler 返回 |
| 同上 | 新 6 个 TDD 用例 |

关键常量：
- `SESSION_GRANT_TTL = 30 min`
- `PENDING_APPROVAL_TTL = 5 min`
- 清理策略：每次 `session_grant_view_for` / `enqueue_pending_approval` 都做 `retain(|_, rec| ...)` 软清理，避免后台线程。

核心设计点：
- **不依赖 call_id 防重**：`BTreeMap` key 就是 call_id；同一 call_id 重入则覆盖旧条目，配合 5 min TTL 能防止调用方误用。
- **session grant 的 key** = `(workspace_id, session_id, tool_name)`；跨 workspace / 跨 session / 跨工具均不共享。
- **confirmed_twice 随 grant 存**：后续 `preview_tool_permission` 拿到 `SessionGrantView { session_confirmed_twice: true }` 时，`evaluate_permission` 对 `DangerFullAccess 外部 + Protected` 场景会放行到 `AllowApproved`。
- **审计摘要白名单**：`build_input_summary` 遍历 JSON object 字段，`String → "{key}=len{N}"`，`Number/Bool/Null/Array/Object` 直接出类型摘要。不出现原值，最多显示 4 个字段然后截断 `…`。TDD 明确钉死 "super-long-api-key" 不得出现。

## 3. Tests

| 套件 | Phase C-1 | Phase C-2 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿（默认多线程；单线程会触发已知 rustc 栈溢出 flake，与本轮无关） |
| `coolzhu-web-console` (bin) | 154 | 6 | **160 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-2 新增用例：

1. `tools_protected_paths_returns_default_rules` — `GET /api/tools/protected-paths` 返回 coolzhu-config / coolzhu-data / env-file 等默认规则
2. `pending_approval_roundtrip_approve_once_consumes_entry` — enqueue → `/pending` 可见 → `/approve scope=once` → pending 被消费；不建立 session grant
3. `pending_approval_session_scope_grants_future_preview` — `/approve scope=session` → `session_grant_view_for` 返回 `session_authorized=true`；跨 workspace / session / tool 不共享
4. `pending_approval_reject_removes_entry_and_does_not_grant` — `/reject` 移除 pending；不改 session grant
5. `pending_approval_approve_missing_returns_404` — 未知 call_id → 404
6. `build_input_summary_does_not_leak_secret_values` — 长字符串 `super-long-api-key` 不出现在摘要

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c2-approval-api-20260511-post/main.rs`

### 回滚步骤

| 目的 | 命令 |
| --- | --- |
| 一键回 Phase C-1 | `Copy-Item tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase B | `Copy-Item tmp\backups\phase-b-tool-session-20260511-post\main.rs ...` |
| 回 Phase A | `Copy-Item tmp\backups\phase-a-tool-session-20260510-post\main.rs ...` |
| 回到修改前 | Copy Phase A `pre/*` 覆盖三个目录 |

Phase C-2 改动仍在 `web-console/src/main.rs` 单文件，零多文件耦合。

## 5. 未落地（Phase C-3/4/5 入口）

| 需求 | 动作 | 位置 |
| --- | --- | --- |
| REQ-TOOL-007 | `run_model_tool_dispatch` 切到 `runtime_tool_execute`；在 RequireApproval 时 `enqueue_pending_approval` + SSE 事件 | 文档 1 §4.1 T3 |
| REQ-TOOL-008 前端 | `app.js` 监听 SSE `tool-permission-required`，轮询 `/api/tools/pending` 渲染审批面板；接入授权按钮 | 文档 1 §5.4 |
| REQ-TOOL-010 | `coolzhu.toml [tool.protected_paths]` 配置段 + `reload_workspace_config` 联动 | 文档 1 §5.3 |
| REQ-TOOL-011 | bash/PowerShell 接 tokio::time::timeout + Semaphore 并发闸门 | 文档 1 §4.1 T5 |
| REQ-TOOL-007 round 2 | Tool Loop 发 `OutputContentBlock::ToolResult`；`join_all` 并发 | 文档 1 §4.1 T4 |

## 6. 接口兼容性清单

**对外**（前端 / CLI）：

| 接口 | 变化 | 兼容性 |
| --- | --- | --- |
| `GET /api/tools/protected-paths` | 新增 | ✅ 新路由 |
| `GET /api/tools/pending` | 新增 | ✅ |
| `POST /api/tools/approve` | 新增 | ✅ |
| `POST /api/tools/reject` | 新增 | ✅ |
| 既有工具路由 | 无变化 | ✅ |

**SSE**：本轮未新增事件；Phase C-3 才会发 `tool-permission-required`。

**内部**：`preview_tool_permission` 从 `#[cfg(test)]` 晋升为正式函数，但仍无 prod 调用点（由 Phase C-3 的 `run_model_tool_dispatch` 路径触发）。

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- tools_protected_paths_returns_default_rules pending_approval_ build_input_summary

# 全量（单线程稳定）
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib   # 默认多线程
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 跨 workspace 误放行（session_grant_view_for 用错 key） | 低 | TDD `pending_approval_session_scope_grants_future_preview` 明确钉住跨 workspace / session / tool 不共享 |
| `enqueue_pending_approval` 无后台 GC，内存泄漏 | 低 | 每次 enqueue 都 `retain(< PENDING_APPROVAL_TTL)`；总量上限由前端节奏和 5 min TTL 约束 |
| `build_input_summary` 未覆盖特殊字段名（如 `authorization`） | 中 | 当前只按 JSON 类型脱敏；Phase D 增加字段名黑名单（`authorization / api_key / password / token`）做值白名单 |
| `ApproveResponse.ttl_secs` 未实际用于闸门再评估 | 接受 | Phase C-3 的 `run_model_tool_dispatch` 会在评估前调 `session_grant_view_for`；本轮只负责写入 |

## 9. 下一步建议（Phase C-3）

1. `run_model_tool_dispatch` 改为构造 `ToolInvoke` + `RuntimeToolContext`（`required_permission_for_tool` + `extract_path_targets` + `session_grant_view_for`），调 `runtime_tool_execute`。
2. 分支 → `Rejected` / `DryRunOnly`：调 `enqueue_pending_approval` 并发 SSE 事件 `tool-permission-required`。
3. 前端 `app.js` 监听 SSE + `GET /api/tools/pending` 渲染面板；按钮点击走 `/approve`/`/reject`。
4. 先只对 `ReadOnlyRegistryExecutor` 的工具（read_file/glob_search/grep_search/WebFetch/WebSearch）启用，写类工具暂留硬白名单；确认闭环后再放开。

每步独立 commit，保持回滚成本 ≤ 1 revert。
