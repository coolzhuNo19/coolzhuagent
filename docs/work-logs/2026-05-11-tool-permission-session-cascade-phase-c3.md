# Phase C-3 落地：runtime-execute HTTP 端点

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 T3、§5.4  
前置：Phase A / B / C-1 / C-2（均 2026-05-10 → 05-11）

关联需求：
- 推进：`REQ-TOOL-007`（开发中 → 可演示，`runtime_tool_execute` 首次挂到 prod HTTP 路径）
- 推进：`REQ-TOOL-008`（开发中，Protected/WorkspaceWrite 外部场景自动进 pending）
- 不动：旧 `run_model_tool_dispatch`、`/api/tools/dispatch`、`/api/tools/execute`、Tool Loop 回灌

## 1. 本轮范围（Phase C-3）

在保持旧白名单完全不变的前提下，提供一条 **全新的 prod 入口**，让 `runtime_tool_execute` 首次被真实 HTTP 请求触达：

- **新增** `POST /api/tools/runtime-execute`
- **行为**：
  1. 构造 `ToolInvoke{caller = WebUi}`（workspace_id 来自当前 `active_workspace_path`）。
  2. 抽路径效果、查权限档、查会话级授权 `session_grant_view_for`。
  3. 只注入一个 `ReadOnlyRegistryExecutor`。写类 / Danger 工具命中"unknown"分支 → `Failed`，绝不绕过闸门。
  4. 结果是 `DryRunOnly` 且决策 `RequireApproval/RequireConfirm` → 自动 `enqueue_pending_approval`，前端即可通过 `/api/tools/pending` 看到。
  5. `info!` 日志加 `[TOOL-GATE] / [TOOL-EXEC]` 前缀。

- **不改**：
  - 旧 LLM tool_use / run_model_tool_dispatch 保持硬白名单。
  - Tool Loop 回灌格式继续是文本。
  - 无 SSE 新事件（Phase C-4 再加）。
  - 前端 UI 未接入（Phase C-5）。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` routes（line ~224） | 新增 `/api/tools/runtime-execute` POST |
| 同上 紧接 `api_tools_reject` | 新 `RuntimeExecuteRequest / RuntimeExecuteResponse` DTO + `api_tools_runtime_execute` handler |
| 同上 tests | 新 3 个 TDD；并对 Phase C-2 的 pending 系列测试做了一次 **并发抗扰** 改造（不再 `clear_*_for_test` 清整个 map，改用唯一 call_id + "本 call_id 存在性" 断言） |

关键设计点：
- **为什么叫 `runtime-execute` 而不是复用 `/api/tools/execute`？**  
  旧 `/api/tools/execute` 是 computer-use 专用闸门（`execute=true` 强制真实点击），语义不同。新端点走统一 `runtime_tool_execute`，命名区分避免下游客户端混淆。
- **为什么只挂 `ReadOnlyRegistryExecutor`？**  
  把"权限闸门评估路径"和"真实写/危险工具执行路径"解耦。本轮先证明 ReadOnly 全通路；写类工具等 Phase C-5 前端审批面板就位后再增加 executor。未知工具落到 `Failed("unknown tool")` 而非 panic。
- **`enqueue_pending_approval` 登记时机**：仅 `DryRunOnly + decision.requires_ui()`（`RequireApproval` / `RequireConfirm`）。`Deny` 直接 `Rejected`，不登记。

## 3. Tests

| 套件 | 上轮 | 本轮新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 160 | 3 | **163 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-3 新增用例：
1. `runtime_execute_readonly_returns_ok_without_pending` — ReadOnly workspace 内 → `Ok + AllowAuto`，本 call_id 不进 pending。
2. `runtime_execute_protected_dry_run_enqueues_pending` — 写 `coolzhu.toml` → `DryRunOnly + RequireConfirm + protected_match=coolzhu-config`，调 `enqueue_pending_approval` 后可查。
3. `runtime_execute_unknown_tool_returns_failed` — `ReadOnlyRegistryExecutor` 不 handle 的工具 → `Failed("unknown tool")`，不 panic。

Phase C-2 测试的 **并发抗扰** 修复：
- 去掉 `clear_pending_approvals_for_test` / `clear_session_grants_for_test` 的无条件清空（否则并发跑时会清掉别的测试写入的条目，导致 Phase C-2 四个 pending 用例交叉 flaky）。
- 改用 `"unique-aaa/bbb/ccc"` 后缀的 call_id + `workspace_id` + `session_id` 确保互不冲突。
- `api_tools_pending()` 断言从 `len == 1` / `is_empty()` 改为 `iter().any(|r| r.call_id == my_id)` 的存在性检查。

这次修复也让全量 `--test-threads=1` 和 `cargo test` 默认并发 **两种模式** 都稳定。

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c3-runtime-execute-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-2 | `Copy-Item tmp\backups\phase-c2-approval-api-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-1 | 同上，换目录 |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

单文件改动，零多 crate 耦合。

## 5. 接口清单

### 新增 HTTP

| Method | Path | 作用 |
| --- | --- | --- |
| POST | `/api/tools/runtime-execute` | 统一调度入口，经过 `runtime_tool_execute` |

请求体：

```json
{
  "call_id": "optional-string",       // 省略则自动生成 "rt-<ms>"
  "tool_name": "read_file",
  "input": { "path": "src/main.rs" },
  "session_id": "ses-1",              // 可选
  "user_authorized": false,           // 显式授权（比如前端点过 once）
  "user_confirmed_twice": false       // Protected 场景需 true
}
```

响应体：

```json
{
  "outcome": {
    "call_id": "rt-17xxxxxxxx",
    "tool_name": "read_file",
    "status": "ok",                   // ok | dry-run-only | rejected | failed | timeout
    "output": "<text from tools::execute_tool>",
    "summary_text": "read_file: ...",
    "elapsed_ms": 3,
    "permission_gate": {
      "required": "read-only",
      "decision": "allow-auto",
      "reason": "read-only-tool",
      "protected_match": null,
      "workspace_relative": true,
      "affected_paths": ["src/main.rs"]
    }
  },
  "pending_call_id": null             // 若非 null，前端可用它调 /api/tools/pending
}
```

### 日志前缀

- `[TOOL-GATE]` — DryRunOnly 登记 pending
- `[TOOL-EXEC]` — Ok / Failed / Rejected 直返结果

## 6. 未落地（Phase C-4/5 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-007 完成 | `run_model_tool_dispatch` 切到 `runtime_tool_execute`；`llm_tool_definitions` 从 registry 全量生成；Tool Loop 发 `OutputContentBlock::ToolResult` 并发 |
| REQ-TOOL-008 UI | SSE `tool-permission-required` + `app.js` 审批面板组件 |
| REQ-TOOL-010 配置化 | `coolzhu.toml [tool.protected_paths]` 段替代 `default_protected_rules()` |
| REQ-TOOL-011 超时 | bash/PowerShell 的 `tokio::time::timeout` + `Semaphore` |
| 多 executor | 写类/Danger 工具的 executor（目前只有 ReadOnly） |

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- runtime_execute_ pending_approval_ tools_protected_paths build_input_summary

# 全量回归（两种模式都稳定）
cargo test -p coolzhu-web-console --offline --bins
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 新端点被当成 `/api/tools/execute` 误用，绕过 computer-use 闸门 | 低 | 名字区分；handler 内只注入 ReadOnly executor，写类直接 Failed |
| `ReadOnlyRegistryExecutor::from_registry` 随 mvp_tool_specs 扩大，意外把写类塞进来 | 低 | 实现按 `matches!(spec.required_permission, PermissionMode::ReadOnly)` 过滤；TDD `readonly_executor_handles_only_readonly_tools` 钉住 bash/write_file/edit_file/Config 不 handle |
| 并发测试共享 pending map 导致其它测试抖动 | 已修复 | call_id 唯一 + 存在性断言；两种 `--test-threads` 模式均稳定 |
| `user_authorized` 来自请求体，被恶意前端伪造 | 中 | Phase C-5 完成后由 `/api/tools/approve` 写 `session_grants`；本端点的 `user_authorized=true` 仅影响 DangerFullAccess 的外部分支 → 最糟结果是 `AllowApproved`，仍需要 executor 真正认识这个工具；ReadOnly 在任何情况下都是 `AllowAuto`，`user_authorized` 无额外提权 |

## 9. 下一步建议（Phase C-4）

1. **SSE 事件 `tool-permission-required`**：在 `enqueue_pending_approval` 之后通过 ChatSse 广播，前端可立刻接住。
2. **前端审批面板**：`app.js` 新组件 `confirmToolApproval({call_id, tool_name, input_summary, permission})`；3 个按钮 → `/approve scope=once/session`、`/reject`。
3. **`run_model_tool_dispatch` 替换**：把 LLM 触发的工具调用也走 `runtime_tool_execute`（内部改，对外 LLM tool 白名单暂保留 feature flag）。

每一步独立 commit，保持回滚成本 ≤ 1 次 revert。
