# Phase C-1 落地：ReadOnly Executor 桥接

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 / §6-C1  
前置：Phase A（2026-05-10）、Phase B（2026-05-11）

关联需求：
- 推进：`REQ-TOOL-007`（开发中，runtime 桥接已在 web-console 可用；尚未替换 `run_model_tool_dispatch`）
- 推进：`REQ-TOOL-008`（开发中，`preview_tool_permission` 为 Phase C-2 审批端点铺底）

## 1. 本轮范围（Phase C-1）

保持"零 prod 行为变更"原则：

- **新增**可用组件，**不替换**旧 LLM 白名单 dispatch。
- 下列三个函数只在测试路径被调用，prod 代码未挂接：
  1. `ReadOnlyRegistryExecutor` — 桥接 `tools::execute_tool`，仅 handle `mvp_tool_specs` 中 `PermissionMode::ReadOnly` 的工具
  2. `required_permission_for_tool(name)` — 从 registry 查权限档位，未知工具降级为 `ReadOnly`
  3. `extract_path_targets(name, input)` — 调 `tools::path_effect::extractor_for` 抽路径效果
  4. `preview_tool_permission(...)`（`#[cfg(test)]`） — 只评估不执行，供 Phase C-2 端点复用
- 旧 `run_model_tool_dispatch` 硬白名单保持不变；Tool Loop 回灌仍为文本。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` 顶部 imports | 新增 `runtime::{default_protected_rules, evaluate_permission, runtime_tool_execute, PermissionDecision, PermissionMode, ProtectedRule, RuntimeToolContext, SessionGrantView, ToolCaller, ToolInvocationExecutor, ToolInvoke, ToolOutcome, ToolOutcomeStatus}`；`tools::path_effect::extractor_for` |
| 同上（紧接 `active_workspace_path`） | 新 `ReadOnlyRegistryExecutor` + `from_registry()` + `#[cfg(test)] with_allowlist`；实现 `ToolInvocationExecutor` |
| 同上 | 新 `required_permission_for_tool`、`extract_path_targets`、`preview_tool_permission`（`#[cfg(test)]`） |

关键设计：
- `ReadOnlyRegistryExecutor::execute` 把 `permission_gate` 置为占位 `deny("placeholder-overwritten-by-runtime")`，由 `runtime_tool_execute` 用真实评估结果覆盖（见 B-2 TDD `runtime_tool_execute_overwrites_executor_placeholder_gate`）。
- `required_permission_for_tool` 未知工具返回 `ReadOnly`，而不是 `WorkspaceWrite`/`DangerFullAccess`。原因：静态枚举不到的工具很可能是插件或新增，默认按低权限开放；一旦它声明了写路径，`extract_path_targets` 会抽出 `Write` 目标，Phase B 的 `evaluate_permission` 仍会把它判成 `RequireApproval`（因为 `WorkspaceWrite` 分支看 path_targets）。**反过来做**（默认高权限）会带来更隐蔽的 bug：新工具不小心被拒后看不到原因。
- `preview_tool_permission` 只用 `#[cfg(test)]`。Phase C-2 补 `POST /api/tools/pending` 时会把它改成普通 `fn`，加 `diag!` 前缀。

## 3. Tests

| 套件 | Phase B | Phase C-1 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 139 | 0 | **139 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿（`--test-threads=1`） |
| `coolzhu-web-console` (bin) | 149 | 5 | **154 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-1 新增用例：

1. `readonly_executor_handles_only_readonly_tools` — 正面确认 read_file/glob_search/grep_search/WebFetch/WebSearch，反面拒绝 bash/write_file/edit_file/Config/nonexistent
2. `readonly_executor_runs_read_file_through_runtime` — 端到端：`runtime_tool_execute` → `ReadOnlyRegistryExecutor` → `tools::execute_tool("read_file")` → 读回临时文件内容
3. `required_permission_for_tool_matches_spec_defaults` — read_file/write_file/bash/totally-new 四档权限映射
4. `preview_tool_permission_blocks_coolzhu_toml_write` — 写 `coolzhu.toml` → `RequireConfirm + protected_match=coolzhu-config`
5. `preview_tool_permission_workspace_write_outside_flags_approval` — write_file 到 `C:\Windows\Temp\outside.txt` → `RequireApproval + workspace_relative=false`

## 4. 备份与回滚点

### Post-change 快照

`tmp/backups/phase-c1-readonly-bridge-20260511-post/main.rs`

### 回滚步骤

| 目的 | 命令 |
| --- | --- |
| 一键回 Phase B | `Copy-Item tmp\backups\phase-b-tool-session-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 一键回 Phase A | `Copy-Item tmp\backups\phase-a-tool-session-20260510-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回到修改前 | `Copy-Item -Recurse tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

Phase C-1 全部改动在 `web-console` 单文件，零多文件耦合。

## 5. 未落地（Phase C-2 入口）

| 需求 | 动作 | 位置 |
| --- | --- | --- |
| REQ-TOOL-008 审批 UI | 新增 `GET /api/tools/pending`、`POST /api/tools/approve`、`POST /api/tools/reject`、`GET /api/tools/protected-paths`；`SessionGrants` 内存结构 + 30 min TTL；SSE `tool-permission-required` 事件 | 文档 1 §5.4 / §7 步骤 D |
| REQ-TOOL-007 切换 | `run_model_tool_dispatch` 内构 `ToolInvoke` 走 `runtime_tool_execute`（先对 ReadOnly 工具开，写类暂留旧白名单） | 文档 1 §4.1 T3 |
| REQ-TOOL-011 | bash / PowerShell 的 tokio::time::timeout + semaphore | 文档 1 §4.1 T5 |

## 6. 接口兼容性

**对外**：无变化（所有新增函数都在 web-console 内部，没有新 HTTP 路由、没有新 DTO 字段）。

**内部**：`web-console` 从 `runtime::*` 多 import 几个类型；从 `tools::path_effect` 多 import `extractor_for`。两个 crate 的公开 API 在 Phase A/B 已经确定，这里只是消费方。

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- readonly_executor_ required_permission_for_tool preview_tool_permission_
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib -- --test-threads=1
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| `ReadOnlyRegistryExecutor` 被意外接入 prod 前未走 runtime gate | 极低 | 本轮根本没有任何 prod 调用点；`run_model_tool_dispatch` / Tool Loop 代码未变 |
| `required_permission_for_tool("plugin-x")` fallback 到 ReadOnly 让插件写路径绕过 gate | 低 | `extract_path_targets` 依然会抽 `Write` 目标；真正的越界写会在 `evaluate_permission` 被拦（`WorkspaceWrite` 外 → RequireApproval）。**前提**：插件工具要实现 `TargetPathsExtractor`，否则应改挂 `DangerFullAccess`（Phase C-3 做） |
| `preview_tool_permission` 仅测试可见，生产端点缺失 | 接受 | Phase C-2 的范围目标 |

## 9. 下一步建议

Phase C-2 具体拆分：

1. 新增 `SessionGrants`（`HashMap<(workspace_id, tool_name, risk_tag), Instant>`，30 min TTL）放在 `session_store()` 同层静态。
2. 新增 `GET /api/tools/protected-paths` 返回 `default_protected_rules()`（Phase D 读配置文件覆盖）。
3. 新增 `GET /api/tools/pending` 返回当前挂起的 `LocateRequest`-like 数据结构；暂时空列表即可。
4. 新增 `POST /api/tools/approve`、`/reject` 路径；body `{call_id, scope: once|session}`。
5. SSE 扩展：`/api/chat/send/stream` 在遇到 `RequireApproval` 时发 `tool-permission-required` 事件；前端可先打印日志。
6. 仍然**不**切换 `run_model_tool_dispatch`；该步放 Phase C-3，独立 commit。
