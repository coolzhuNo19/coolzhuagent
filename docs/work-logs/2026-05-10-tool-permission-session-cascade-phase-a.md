# Phase A 落地：工具调用契约层 + 会话级联删除

时间：2026-05-10 → 2026-05-11  
方案链接：
- `docs/tool-calling-permission-plan-2026-05-10.md`
- `docs/session-memory-workspace-integration-plan-2026-05-10.md`

关联需求：
- 新：`REQ-TOOL-007/008/009/010/011`、`REQ-MEM-006`、`REQ-WEB-CTX-001`
- 推进：`REQ-WEB-SESSION-007`（待开发 → 测试中）
- 依赖：`REQ-CORE-TOOL-001`（未动本体，仅铺垫契约）

## 1. 本轮范围（Phase A）

**只做契约层 + 最低风险的级联删除闭环**，不改：

- `run_model_tool_dispatch` 的硬编码白名单（仍只对 `tools_semantic_dispatch`）
- Tool Loop 的回灌格式（仍为文本）
- `save_session_state_to_sqlite` 的全表重写路径
- `WorkspaceScope` 切换原子 swap

这些留给 Phase B/C 接入，避免引入运行时回归。

## 2. 实际变更

### 2.1 工具调用契约层（文档 1 步骤 A）

| 文件 | 动作 |
| --- | --- |
| `modules/core-runtime/packages/core-runtime/src/tool.rs` | **新建**。`ToolInvoke / ToolOutcome / PermissionGateReport / PermissionDecision / ToolCaller / ToolCallContext / ToolOutcomeStatus` 全套 serde 类型，含 7 个单测 |
| `modules/core-runtime/packages/core-runtime/src/permission_gate.rs` | **新建**。`evaluate_permission`、`is_path_inside_workspace`、`match_protected_rule`、`PathTarget/ProtectedRule/SessionGrantView/PathAccess`、`default_protected_rules()`（`coolzhu.toml/.coolzhu/**/.ssh/**/.git/**/.env*`）。含 11 个 TDD 用例覆盖 4 级权限模型、Protected 规则、`..` 逃逸 |
| `modules/core-runtime/packages/core-runtime/src/permissions.rs` | `PermissionMode` 增 `Serialize/Deserialize`（kebab-case），作为 `ToolInvoke` 传输需要 |
| `modules/core-runtime/packages/core-runtime/src/lib.rs` | 挂载 `tool` / `permission_gate` 模块并 `pub use` 全部契约类型 |
| `modules/tooling/packages/tool-registry/src/path_effect.rs` | **新建**。`TargetPathsExtractor` trait + 4 个默认实现 + `extractor_for(tool_name)`。含 6 个 TDD 用例覆盖 bash 不透明 / read_file / write_file / NotebookEdit / 未知工具 / 缺字段 |
| `modules/tooling/packages/tool-registry/src/lib.rs` | 挂载 `path_effect` 模块 |

### 2.2 SQLite Schema v2 迁移（文档 2 步骤 S）

| 文件 | 动作 |
| --- | --- |
| `modules/gui-web/packages/web-console/src/main.rs` | 新 `apply_session_migration_v2` + `ensure_memory_bead_column`。`PRAGMA user_version` 从 0/1 → 2。幂等：重复执行无副作用 |
| 同上 | `memory_beads` 增 `origin_message_id TEXT` / `origin_table TEXT` / `token_count INTEGER`；`load_memory_beads` 与 `query_memory_beads_sqlite` 读出新列 |
| 同上 | 新表 `attachment_refs(id, message_id, message_tbl, file_name, byte_size, created_at)` + 两条索引 |
| 同上 | 两个 trigger：`trg_session_msg_cascade_beads`、`trg_room_msg_cascade_beads`。消息被 DELETE 时，以它为 origin 的 bead 自动删除（SQL 侧硬保障，即便未来 API 用事务 DELETE 也会生效） |
| 同上 | `MemoryBeadDto` 补 `origin_message_id / origin_table / token_count` 三个可选字段（`skip_serializing_if = Option::is_none`，向后兼容），且派生 `Default` 方便测试构造 |

### 2.3 级联删除流水线（文档 2 步骤 D，Phase A 版本）

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` routes（line ~159） | 新增路由：<br>`DELETE /api/chat/rooms/{room_id}`<br>`GET    /api/chat/rooms/{room_id}/impact`<br>`DELETE /api/chat/rooms/{room_id}/messages/{message_id}`<br>`DELETE /api/sessions/{session_id}/messages/{message_id}` |
| `web-console/src/main.rs` handlers | `api_delete_chat_room / api_chat_room_impact / api_delete_chat_room_message / api_delete_session_message` |
| `SessionStore` methods | `delete_chat_room`、`delete_chat_room_message`、`delete_session_message`、`chat_room_impact` |
| 响应 DTO | `CascadeDeleteReport / ChatRoomDeleteResponse / MessageDeleteResponse / ChatRoomImpactResponse` |

**Phase A 的级联策略**（这是刻意为之的低风险实现）：

1. 走现有 "in-memory retain → `save()` 全表重写" 路径，不碰 SQL 事务。
2. 基于 `memory_beads.origin_message_id` + `origin_table` 字段手动级联。
3. 没有 origin 归因的旧 bead（例如 `default_memory_beads`、UI 手工新增）不会被误删。
4. DB 侧的 trigger 做为"未来接入事务 DELETE 时的双保险"，**本轮不会被触发**——全表重写直接 INSERT，bead 已经不在内存里。

Phase B 接入真正的事务 DELETE 后，trigger 自动生效，迁移成本为零。

### 2.4 Tests

| 套件 | 新增 | 总计 | 结果 |
| --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 18（tool 7 + permission_gate 11） | 116 旧 + 18 新 = **134 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 6 | 28 旧 + 6 新 = **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 5（cascade 3 + serde 2） | 142 旧 + 5 新 = **147 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 0 | **4 passed** | 绿 |

关于 flaky：`tests::semantic_dispatch_returns_structured_dry_run_plan` 在 default 并发下偶发（与本次变更无关，是该测试本身未隔离临时目录的历史问题）。`--test-threads=1` 下 147/147 通过。后续可单独开一条 REQ-TEST-xxx 去稳定。

## 3. 备份与回滚点

### Pre-change 快照（整目录）

`tmp/backups/phase-a-tool-session-20260510-pre/`  
- `core-runtime/`（整包拷贝）  
- `tooling/`（整包拷贝）  
- `web-console/main.rs + Cargo.toml`

### Post-change 关键文件快照

`tmp/backups/phase-a-tool-session-20260510-post/`  
- `main.rs`、`core-runtime-tool.rs`、`core-runtime-permission_gate.rs`、`core-runtime-lib.rs`、`core-runtime-permissions.rs`、`tool-registry-lib.rs`、`tool-registry-path_effect.rs`

### 回滚方案

任意一步出问题都可逐级回退：

1. **回退全部变更**：  
   ```powershell
   Copy-Item -Recurse tmp\backups\phase-a-tool-session-20260510-pre\core-runtime\* modules\core-runtime\
   Copy-Item -Recurse tmp\backups\phase-a-tool-session-20260510-pre\tooling\* modules\tooling\
   Copy-Item tmp\backups\phase-a-tool-session-20260510-pre\web-console\main.rs modules\gui-web\packages\web-console\src\main.rs
   ```
2. **只回退 web-console 侧**（保留契约层）：只覆盖 `main.rs` 即可。`memory_beads` 新列由于 `skip_serializing_if` 在老 DTO 上是 noop，旧 JSON / SQLite 数据照常读。
3. **DB 层回滚**：手工执行 `PRAGMA user_version = 1; DROP TRIGGER trg_session_msg_cascade_beads; DROP TRIGGER trg_room_msg_cascade_beads; DROP TABLE attachment_refs;`。`memory_beads` 新列不需要 DROP（SQLite 3.35+ 虽支持 `DROP COLUMN` 但旧版不支持；留空列无损）。

### Schema 迁移的安全保证

- `apply_session_migration_v2` 完全幂等：`PRAGMA user_version` 保护 + `CREATE IF NOT EXISTS` + `ensure_memory_bead_column` 读 `PRAGMA table_info` 判断存在。
- 全表重写路径（`save_session_state_to_sqlite`）**不** 触及新列/新表/trigger，老数据自动保留。

## 4. 未落地项（Phase B/C 入口）

| 需求 | 待落地动作 | 所在方案章节 |
| --- | --- | --- |
| REQ-TOOL-007 | `llm_tool_definitions` 从 registry 全量生成；Tool Loop 改 `OutputContentBlock::ToolResult` 并发；`run_model_tool_dispatch` 改走 `runtime_tool_execute` | 文档 1 §4 步骤 T2–T4 |
| REQ-TOOL-008 | `runtime_tool_execute` 接入 + 前端审批 UI + SSE `tool-permission-required` + `/api/tools/approve` 等 5 条 | 文档 1 §5 / §7 步骤 B–D |
| REQ-TOOL-009/010/011 | 审计 `input_summary` 白名单投影 + Protected 路径 coolzhu.toml 段 + 超时/并发信号量 | 文档 1 §5.5 / §7 步骤 E |
| REQ-WEB-SESSION-007 | 把 `delete_*` 从"in-memory retain + 全表重写"换为 SQL 事务 `DELETE`（trigger 自动 CASCADE）；附件 GC；前端确认弹窗 | 文档 2 §5 |
| REQ-WEB-PROJECT-003 | `WorkspaceScope` + 原子 swap + `/api/workspace/reload` | 文档 2 §4 |
| REQ-WEB-CTX-001 | `ContextBuilder` 历史窗口 + FTS5 bead 召回 | 文档 2 §6 |
| REQ-MEM-006 | 自动沉淀时填 `origin_*`（当前字段已就位，`persist_auto_memory_beads` 尚未写入） | 文档 2 §7 |

## 5. 接口兼容性清单

**对外接口变更（前端/CLI 需知）**：

| 接口 | 变化 | 兼容性 |
| --- | --- | --- |
| `MemoryBeadDto` JSON | 新增 `origin_message_id / origin_table / token_count`（可选） | ✅ 向后兼容（新字段缺省时不序列化） |
| `PermissionMode` JSON | 新增 serde（`"read-only"` / `"workspace-write"` / `"danger-full-access"` / `"prompt"` / `"allow"`） | ✅ 新能力，未在既有路由中出现 |
| 路由表 | 新增 4 条 DELETE/GET | ✅ 新路由 |
| 既有 `DELETE /api/sessions/{id}` / `POST /api/tools/execute` | 无变化 | ✅ |

**内部接口变更（仅影响本仓）**：

| 接口 | 变化 | 影响 |
| --- | --- | --- |
| `runtime::*` 导出 | 新增 `PermissionDecision / PermissionGateReport / ToolCallContext / ToolCaller / ToolInvoke / ToolOutcome / ToolOutcomeStatus / PathAccess / PathTarget / ProtectedRule / SessionGrantView / default_protected_rules / evaluate_permission / is_path_inside_workspace / match_protected_rule / normalize_for_match` | 仅在后续 Phase B 使用；未修改既有导出 |
| `tools::path_effect::*` | 新模块 | 仅在后续 Phase B 使用 |

## 6. 验证命令速查

```powershell
# 契约层单测
cargo test -p coolzhu-core-runtime --offline --lib -- tool:: permission_gate::

# path_effect
cargo test -p coolzhu-tool-registry --offline --lib -- path_effect::

# 新 cascade + serde TDD
cargo test -p coolzhu-web-console --offline --bins -- cascade_ memory_bead_dto_serde

# 全量回归（单线程稳定）
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1

# 跨模块 smoke
cargo test --test module_linkage_smoke --offline
```

## 7. 诊断日志前缀约定（已预留，Phase B 启用）

| 前缀 | 用途 |
| --- | --- |
| `[TOOL-REG]` | `llm_tool_definitions` 暴露计数 |
| `[TOOL-GATE]` | `evaluate_permission` 判定结果 |
| `[TOOL-EXEC]` | `runtime_tool_execute` 执行路径 |
| `[TOOL-LOOP]` | 并发与 ToolResult 组装 |
| `[TOOL-AUDIT]` | 审计写入 |
| `[CASCADE]` | `delete_*` 流水线 |
| `[MEM-ORIGIN]` | 自动沉淀补 origin |

Phase A 代码未产生以上日志。

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 新列在旧数据上读出 `None` | 低 | `skip_serializing_if` + 代码分支均处理 `Option` |
| Trigger 与全表重写互动误删 | 低 | 全表重写用 `DELETE FROM *` 无 `WHERE`，随后 `INSERT`；trigger 只 match `origin_*`，重写前全清、重写后全插，没有 "留存的已删消息" 可以触发 |
| `PermissionMode` 新增 serde 破坏下游反序列化 | 低 | 既有代码只做 `PartialEq/Ord`，未对字符串形式做假设 |
| `MemoryBeadDto::default()` 在测试中被误用于 prod 路径 | 极低 | `Default` 只派生不导出到 crate 外 |
| 级联删 Phase A 版在多进程场景下不原子 | 中 | Web 后端单进程，实际只有一个 SessionStore Mutex；Phase B 换 SQL 事务后消除 |

## 9. 下一步建议

按风险与价值排序，建议 Phase B 先做：

1. **T3: `run_model_tool_dispatch` 接入 `runtime_tool_execute`**（只要 evaluator 跑通，暴露面不动）
2. **`persist_auto_memory_beads` 写 origin 字段**（让删除级联对 auto-bead 真正生效）
3. **事务化 `delete_chat_room`**（消灭 "全表重写" 风险，解锁多设备并发）
4. **`/api/tools/approve` + 前端审批 UI**（REQ-TOOL-008 打通）
5. **`llm_tool_definitions` 全量暴露 + ToolResult 结构化**（REQ-TOOL-007 完成）

每步独立提交、独立回归，保持回滚成本始终 ≤ 一次 `git revert`。
