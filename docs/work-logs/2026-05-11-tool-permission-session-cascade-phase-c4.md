# Phase C-4 落地：工具事件广播通道（SSE）

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.4  
前置：Phase A / B / C-1 / C-2 / C-3（均 2026-05-10 → 05-11）

关联需求：
- 推进：`REQ-TOOL-008`（开发中，审批 UI 的后端事件通道已就绪）
- 铺底：`REQ-DESK-PET-003`（桌宠事件总线可复用此模式）
- 不动：`run_model_tool_dispatch`、LLM Tool Loop、前端 app.js

## 1. 本轮范围（Phase C-4）

给 Phase C-2/C-3 建立的审批管道加上「实时推送」，前端不再需要轮询 `/api/tools/pending`：

- **新增** `tool_event_bus()` —— `tokio::sync::broadcast` 通道，容量 128，进程全局静态
- **新增** `ToolEvent` 枚举：`permission-required` / `approved` / `rejected`
- **新增** `GET /api/tools/events` SSE 端点
- **接入点**：`enqueue_pending_approval` / `api_tools_approve` / `api_tools_reject` 三个位置
- **不阻塞原则**：`broadcast::Sender::send` 无订阅者时返回 `Err`，直接 `let _ =` 吞掉
- **lagged 保护**：容量满时老事件被挤出，订阅者拿到 `RecvError::Lagged`，SSE 发 `lagged {"skipped":N}` 事件让前端走 `/api/tools/pending` 补齐

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` imports | 新增 `tokio::sync::broadcast` |
| 同上 routes（line ~226） | 新 `/api/tools/events` GET |
| 同上 `enqueue_pending_approval` | 登记后 `broadcast_tool_event(PermissionRequired(record.clone()))` |
| 同上 `api_tools_approve` | 成功后 `broadcast_tool_event(Approved{ call_id, scope, confirmed_twice, ttl_secs })` |
| 同上 `api_tools_reject` | 成功后 `broadcast_tool_event(Rejected{ call_id, reason })` |
| 同上 紧接 `clear_pending_approvals_for_test` | `ToolEvent` + `tool_event_bus` + `broadcast_tool_event` + `subscribe_tool_events`(#[cfg(test)]) + `api_tools_events` |
| 同上 tests | 新 3 个 TDD |

关键设计点：
- **SSE 连接时发 `hello` 事件**：让前端确认通道可用；WebView 某些情况下 301/502 也不会立刻 onerror，靠首条事件最可靠。
- **`ToolEvent::PermissionRequired(PendingApprovalRecord)`**：复用已有 DTO，前端只学一套 schema，和 `/api/tools/pending` 的条目结构一致。
- **`#[serde(tag = "kind", rename_all = "kebab-case")]`**：事件 JSON 自带 `kind` 判别，SSE `event:` 字段额外再给一次，前端可二选一。
- **测试中不 `clear_*`**：沿用 Phase C-3 的并发抗扰策略，每个测试用唯一 call_id 后缀，从 channel 拉时用 `try_recv + match call_id` 过滤。

## 3. Tests

| 套件 | Phase C-3 | Phase C-4 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 163 | 3 | **166 passed** | 绿（多线程 & `--test-threads=1` 两模式稳定） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-4 新增用例：

1. `tool_event_bus_broadcasts_permission_required_on_enqueue` — `subscribe_tool_events()` → `enqueue_pending_approval` → `try_recv` 扫到本 call_id 的 `PermissionRequired`
2. `tool_event_bus_emits_approved_and_rejected_events` — pending → `approve session scope=session,confirmed_twice=true` → 收到 `Approved{ ttl_secs=1800 }`；另一条 pending 走 reject → 收到 `Rejected{ reason: "test-reject" }`
3. `tool_event_bus_does_not_block_when_no_subscribers` — 无订阅者时广播 `PermissionRequired` 不 panic 不阻塞（验证 `send()` 返回 Err 被静默吞没）

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c4-tool-events-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-3 | `Copy-Item tmp\backups\phase-c3-runtime-execute-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-2 | `tmp\backups\phase-c2-approval-api-20260511-post\main.rs` |
| 回 Phase C-1 | `tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs` |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

单文件改动，零多 crate 耦合。

## 5. 接口清单

### 新增 HTTP

| Method | Path | 作用 |
| --- | --- | --- |
| GET | `/api/tools/events` | SSE 实时推送工具事件；连接建立时发 `hello` |

### SSE 事件 schema

```
event: hello
data: {"ok":true}

event: permission-required
data: {
  "kind": "permission-required",
  "call_id": "...", "tool_name": "write_file",
  "caller": "web-ui", "workspace_id": "ws-xxx",
  "session_id": "ses-1",
  "input_summary": "write_file: path=len22, content=len...",
  "permission": {
    "required": "workspace-write",
    "decision": "require-confirm",
    "reason": "protected-rule-hit:coolzhu-config",
    "workspace_relative": true,
    "protected_match": "coolzhu-config",
    "affected_paths": ["...coolzhu.toml"]
  }
}

event: approved
data: { "kind": "approved", "call_id": "...", "scope": "session",
        "confirmed_twice": true, "ttl_secs": 1800 }

event: rejected
data: { "kind": "rejected", "call_id": "...", "reason": "user-denied" }

event: lagged
data: {"skipped": 12}
```

### 影响的已有端点

| 端点 | 变化 | 兼容性 |
| --- | --- | --- |
| `/api/tools/approve` | 成功时额外广播 `Approved` 事件 | ✅ 响应体未变 |
| `/api/tools/reject` | 成功时额外广播 `Rejected` 事件 | ✅ 响应体未变 |
| `enqueue_pending_approval`（内部） | 登记后额外广播 `PermissionRequired` | ✅ 内部函数 |

## 6. 未落地（Phase C-5 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-008 UI | `app.js` 订阅 `/api/tools/events`，`permission-required` 时弹审批面板，按钮接 `/approve`/`/reject` |
| REQ-TOOL-007 完成 | `run_model_tool_dispatch` 切到 `runtime_tool_execute`；LLM tool_use 触发的审批也走同一通道 |
| REQ-TOOL-010 配置化 | `coolzhu.toml [tool.protected_paths]` 段；`/api/tools/protected-paths` 读配置而非 `default_protected_rules()` |
| REQ-TOOL-011 超时 | bash/PowerShell 的 `tokio::time::timeout` + `Semaphore` |

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- tool_event_bus_ runtime_execute_ pending_approval_

# 全量回归（两模式）
cargo test -p coolzhu-web-console --offline --bins
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 事件洪泛（几百次/秒的审批风暴） | 低 | `broadcast::channel(128)` 容量有限；满时 lagged 事件让前端走 pending 端点补齐，而不是无界增长 |
| 多浏览器标签页同时 subscribe，互相干扰 | 低 | `broadcast` 多订阅者模型设计如此；每个 SSE 连接独立 receiver；对前端透明 |
| `PendingApprovalRecord.created_at: Instant` 无法 serde | 已处理 | 结构体 `#[serde(skip)]`；对外暴露的字段均可序列化 |
| `broadcast_tool_event` 被误用于不该广播的状态 | 低 | 仅 3 处调用点；未来新增事件类型需扩 enum |

## 9. 下一步建议（Phase C-5）

1. **`app.js` 订阅**：`new EventSource("/api/tools/events")` + `addEventListener("permission-required", ...)`，跳过 `hello` / `lagged`；用 `input_summary` 和 `permission.decision` 渲染面板。
2. **审批面板组件**：3 个按钮 → `[拒绝]`/`[授权本次]`/`[授权本会话]`；Protected 规则命中时强制二次确认勾选。
3. **Tool Loop 接入**：`run_model_tool_dispatch` 改为构造 `ToolInvoke + RuntimeToolContext` → `runtime_tool_execute`；在 LLM round 1 收到 `DryRunOnly` 时，round 2 发 `ToolResult { is_error: true, content: { status: "dry-run-only", summary: "awaiting user approval" } }` 让模型感知。
4. **配置化 Protected 规则**（REQ-TOOL-010）：读 `coolzhu.toml [tool.protected_paths]`，缺省 fallback `default_protected_rules()`。

每一步独立 commit，保持回滚成本 ≤ 1 次 revert。
