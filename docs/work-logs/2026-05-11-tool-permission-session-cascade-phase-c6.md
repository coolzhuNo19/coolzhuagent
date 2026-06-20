# Phase C-6 落地：审计 jsonl 落盘（REQ-TOOL-009）

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.5  
前置：Phase A / B / C-1 / C-2 / C-3 / C-4 / C-5（均 2026-05-10 → 05-11）

关联需求：
- 完成：`REQ-TOOL-009`（从 `开发中` → 测试中，每次 runtime-execute 都落 jsonl 审计）
- 不动：`run_model_tool_dispatch`、LLM Tool Loop、前端 app.js

## 1. 本轮范围（Phase C-6）

给 Phase C-3 的 `/api/tools/runtime-execute` 加上审计落盘 + 查询端点：

- **新增** `ToolAuditEntry` schema（ts / call_id / tool_name / caller / workspace_id / session_id / input_summary / status / elapsed_ms / permission / summary_text / evidence）
- **新增** `append_tool_audit_record(invoke, outcome)`：单调 `O_APPEND` 追加到 `.coolzhu/tool-audit.jsonl`
- **新增** `GET /api/tools/audit?limit=N`（默认 50，上限 500，从尾部截取）
- **接入点**：`api_tools_runtime_execute` 无论 Ok / DryRunOnly / Failed / Rejected 都落审计
- **强制脱敏**：只落 `build_input_summary` 投影（字段名 + 长度），禁止原 JSON 值入文件

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` routes | 新 `/api/tools/audit` GET |
| 同上 `api_tools_runtime_execute` | 末尾加 `append_tool_audit_record(&invoke, &outcome)` |
| 同上 `PendingApprovalPermission` | 补 `Deserialize`（审计 jsonl 需要 round-trip） |
| 同上 紧接 broadcast_tool_event | 新 `tool_audit_log_path`、`ToolAuditEntry`、`append_tool_audit_record`、`ToolAuditQuery`、`ToolAuditResponse`、`api_tools_audit` |
| tests | 新 3 个 TDD + `scoped_session_db_env` 辅助（env var 隔离） |

关键设计：
- **为什么不复用 `computer-use-audit.jsonl`？**  
  旧 audit 是 computer-use dry-run 专用 schema；新 `tool-audit.jsonl` 针对 `ToolOutcome` 设计，字段不一致。分开存便于 jq 过滤和独立归档。
- **为什么写 `ts = secs.millis`？**  
  为了避免引入 `chrono`；`SystemTime::duration_since(UNIX_EPOCH)` 已经够用，后续可替换为 RFC3339。
- **为什么 `limit` 默认 50 / 上限 500？**  
  单次请求 < 1MB，避免前端一次性拉几万行；大查询走 jq 离线。
- **解析失败不 panic**：`serde_json::from_str::<ToolAuditEntry>(line).ok()` 跳过坏行；`tool_audit_survives_parse_failures` 钉住这个行为。

## 3. Tests

| 套件 | Phase C-5 | Phase C-6 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 170 | 3 | **173 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-6 新增用例：

1. `tool_audit_append_and_read_roundtrip` — 写入含 `SECRET_KEY=long-val-should-not-leak` 的 invoke → audit 文件不含原值 + `/api/tools/audit` 读回 1 条 + `input_summary` 也不泄漏
2. `tool_audit_honors_limit_and_tail_semantics` — 写 5 条 + limit=3 → 返回最后 3 条按时间升序
3. `tool_audit_survives_parse_failures` — 夹杂两条脏行（非 JSON + 不完整 JSON）→ `/audit` 只返回 1 条好行，不 panic

**测试隔离**：用 `scoped_session_db_env(&data_dir)` 设 `COOLZHU_WEB_SESSION_DB` env 让 `tool_audit_log_path()` 落到 tempdir；和 Phase C-5 复用同一把 `config_test_guard()` 串行化锁。

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c6-audit-jsonl-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-5 | `Copy-Item tmp\backups\phase-c5-protected-config-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-4 | `tmp\backups\phase-c4-tool-events-20260511-post\main.rs` |
| 回 Phase C-3 | `tmp\backups\phase-c3-runtime-execute-20260511-post\main.rs` |
| 回 Phase C-2 | `tmp\backups\phase-c2-approval-api-20260511-post\main.rs` |
| 回 Phase C-1 | `tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs` |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

## 5. 接口清单

### 新增 HTTP

| Method | Path | 作用 |
| --- | --- | --- |
| GET | `/api/tools/audit?limit=N` | 读最近 N 条审计（默认 50，上限 500） |

### 审计条目 schema（每行一条 JSON）

```json
{
  "ts": "1760000000.123",
  "call_id": "rt-17xxxxxxxx",
  "tool_name": "write_file",
  "caller": "web-ui",
  "workspace_id": "ws-abc123",
  "session_id": "ses-1",
  "input_summary": "write_file: path=len22, content=len34",
  "status": "ok",
  "elapsed_ms": 7,
  "permission": {
    "required": "workspace-write",
    "decision": "allow-auto",
    "reason": "inside-workspace",
    "workspace_relative": true,
    "protected_match": null,
    "affected_paths": ["src/main.rs"]
  },
  "summary_text": "write_file: ...",
  "evidence": null
}
```

### 影响的已有端点

`/api/tools/runtime-execute` 的响应体未变；副作用是每次调用都追加一行到 `.coolzhu/tool-audit.jsonl`。

## 6. 未落地（Phase C-7 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-008 UI | `app.js` 订阅 `/api/tools/events`，`permission-required` 时弹审批面板 |
| REQ-TOOL-007 完成 | `run_model_tool_dispatch` 切到 `runtime_tool_execute`；LLM tool_use 触发的审批也走同一审计链 |
| REQ-TOOL-011 超时 | bash/PowerShell 的 `tokio::time::timeout` + `Semaphore` |
| REQ-TOOL-009 增强 | `input_summary` 字段名黑名单（`authorization / api_key / password / token`）值白名单化 |

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- tool_audit_

# 全量回归（--test-threads=1 稳定）
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 审计文件快速膨胀 | 中 | 单行 JSON，压缩率高；Phase D 可加滚动（按大小切片 + gzip） |
| `input_summary` 夹带敏感字段名（如 `authorization=len32`）暗示有 key 存在 | 低 | 字段长度可见；原值不可见。若要完全隐藏需字段名黑名单 |
| 并发 writer 日志交错 | 低 | `OpenOptions::append(true)` + 单行 write，但不保证 OS 层面原子；万行并发下可能穿插，不影响 `serde_json::from_str` 逐行解析的容忍度 |
| 审计路径不可写（disk full / 权限） | 低 | `warn!("[TOOL-AUDIT] append failed: ...")` 降级，不影响工具执行本身 |

## 9. 下一步建议（Phase C-7）

1. **前端订阅 SSE**：`app.js` 监听 `/api/tools/events`，`permission-required` 弹审批面板。  
2. **前端审计面板**：新增"工具调用记录"tab，调 `/api/tools/audit?limit=50` 展示最近记录，辅助调试与治理。
3. **`run_model_tool_dispatch` 切换**：这是 `REQ-TOOL-007` 完成的最后一步，LLM tool_use 统一走 `runtime_tool_execute`，同步得到审批 + 审计。

每步独立 commit，保持回滚成本 ≤ 1 次 revert。
