# 工具调用适配与风险控制调整方案

文档版本：v1.0  
创建日期：2026-05-10  
关联需求：`REQ-TOOL-007`（LLM 多工具调用适配，P0）、`REQ-TOOL-008`（工具权限分级审批，P0）、`REQ-CORE-TOOL-001`（工具调用编排，P1）、`REQ-LLM-003`（已完成，当前 tool_use loop）  
交付对象：实现 agent（拿到文档即可开发）

---

## 1. 现状定性

| 维度 | 现状 | 位置 |
| --- | --- | --- |
| LLM 可见工具 | 仅 `tools_semantic_dispatch` 一个 | `web-console/src/main.rs:7728 llm_tool_definitions` |
| dispatch 白名单 | 硬编码 allowlist，命中即走 computer-use 的 `run_tool_dispatch` | `web-console/src/main.rs:7900 run_model_tool_dispatch` |
| Tool Registry | `GlobalToolRegistry` 已注册 20 个内置工具 + plugins，按 `PermissionMode` 标记 | `tool-registry/src/lib.rs:60` |
| 内置执行器 | `execute_tool(name, input)` 同步 API，返回 `Result<String, String>` | `tool-registry/src/lib.rs:548` |
| Tool Loop 回灌 | 工具结果以纯文本拼入 round 2 prompt，而非 OpenAI `tool_result` content block | `web-console/src/main.rs:3037 TOOL-LOOP-STREAM`、`6211 TOOL-LOOP` |
| 权限 metadata | ToolSpec 已含 `PermissionMode`（ReadOnly / WorkspaceWrite / DangerFullAccess） | `tooling/src/permissions.rs:4` |
| 权限执行闸门 | **无**：只有 computer-use 有 `execute/confirm_after`，其它工具一旦接入就直接跑 | — |
| workspace 边界 | `allowed_workspace_roots` 已存在；文件工具已做路径检查 | `main.rs:1170`、`REQ-WEB-PROJECT-002` |
| Protected 路径 | **无**：`coolzhu.toml` / `.coolzhu/**` 没有保护 | — |
| 前端审批 UI | `[Allow]/[Deny]` 只接 computer-use，参数摘要缺失 | `app.js:113` |
| 目录 API | `GET /api/tools/catalog` 已出 5 分类 50+ 工具，含 `executable_now` | `main.rs:1175` |
| 跨模块协议 | Web / CLI / MCP 各自一套，尚无统一 runtime 协议 | `REQ-CORE-TOOL-001` 待开发 |

**核心矛盾**：registry 已就绪，但 LLM 能看到的只有 1 个工具，且工具结果回灌不规范；权限等级只有 metadata，没有闸门，扩大工具暴露后风险立刻放大。

---

## 2. 目标与原则

1. **便捷性**：LLM 能直接按 OpenAI `tool_use` 语义调用全部 21 个内置工具与插件工具，结果按 `tool_result` 标准回灌，支持多工具并发返回。
2. **扩展性**：工具暴露面 100% 由 `GlobalToolRegistry` 驱动，新增工具（plugin/skill/MCP）无需改 LLM 侧代码。
3. **风险控制**：4 级权限模型作为硬闸门，workspace 边界强制校验，Protected 路径永远需审批 + 二次确认，所有真实执行写审计。
4. **向后兼容**：前端既有 `[Allow]/[Deny]` + `/api/tools/execute` 路径继续可用；`tools_semantic_dispatch` 暂保留但改为 registry 背后的一层 alias。
5. **统一协议**：`runtime::tool::ToolInvoke` 作为统一入口（LLM / Web / CLI / MCP 都走同一个接口）。

---

## 3. 要调整的需求清单

### 3.1 需要改状态并扩口径的需求

| REQ-ID | 原状态 | 调整后 | 调整理由 |
| --- | --- | --- | --- |
| `REQ-LLM-003`（已完成）| 已完成 | **已完成 - 需要补丁** | 当前 tool_use 只支持 1 个工具且结果是纯文本；打补丁通过 REQ-TOOL-007 完成后升级为「多工具 + ToolResult 结构化」 |
| `REQ-TOOL-001`（已完成）| 已完成 | **已完成 - 需要补丁** | `/api/tools/dispatch` 目前只含 computer-use；需要补 registry dispatch fallback |
| `REQ-TOOL-007` | 待开发 | 保留 P0 待开发 | 加载方案、验证矩阵详见 §4 |
| `REQ-TOOL-008` | 待开发 | 保留 P0 待开发 | 加载方案详见 §5 |
| `REQ-CORE-TOOL-001` | 待开发 | **保留 P1 待开发**，范围收敛：只做 runtime 层统一调用接口与权限评估；不改现有 Web 路由，Web 继续作为 client | §6 |
| `REQ-WEB-PROJECT-002`（已完成）| 已完成 | **已完成 - 需要补丁** | workspace 边界判断要从工具内散点调用改为统一中间件；详见 §5.3 |

### 3.2 建议新增的需求（写入 `requirements-management.md`）

| REQ-ID | 名称 | 优先级 | 梯队 | 验收 |
| --- | --- | --- | --- | --- |
| `REQ-TOOL-009` | 工具审批审计与 UI 摘要 | P0 | 第一梯队 | 所有非 ReadOnly 工具调用写入 `computer-use-audit.jsonl`（复用现有 log），前端审批 UI 显示 `tool_name + arg summary + risk tag` |
| `REQ-TOOL-010` | Protected 路径规则表 | P1 | 第一梯队 | 配置化 `[tool.protected_paths]`；默认覆盖 `coolzhu.toml`、`.coolzhu/**`、`%USERPROFILE%/.ssh/**` |
| `REQ-TOOL-011` | Tool Loop 超时与并发控制 | P1 | 第一梯队依赖 | 每工具独立超时、并发上限、异常分类；bash/PowerShell 默认 30s，可配置 |

---

## 4. REQ-TOOL-007：多工具调用适配

### 4.1 代码改动（单向、已按实施顺序）

#### 步骤 T1：定义统一 invocation 模型（runtime 层）

新建 `modules/core-runtime/packages/core-runtime/src/tool.rs`：

```rust
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 统一工具调用请求，LLM / Web / CLI 全走这个
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInvoke {
    pub call_id: String,                       // LLM 的 tool_use_id，或调用方生成的 UUID
    pub tool_name: String,                     // 与 GlobalToolRegistry 的 name 完全一致
    pub input: Value,                          // JSON 参数
    pub caller: ToolCaller,                    // 调用来源
    pub workspace_id: String,                  // 来自 /api/workspace
    pub session_id: Option<String>,            // 当前活动 session
    pub user_authorized: bool,                 // 前端 [Allow] 后为 true
    pub user_confirmed_twice: bool,            // 二次确认开关，Protected / Danger 外部场景必须为 true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ToolCaller { Llm, WebUi, Cli, Mcp, Plugin }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutcome {
    pub call_id: String,
    pub tool_name: String,
    pub status: ToolOutcomeStatus,
    pub output: Value,                         // tool 自身结构化结果（可含 summary、artifacts、errors）
    pub summary_text: String,                  // LLM round-2 回灌的人读文本（必有）
    pub elapsed_ms: u64,
    pub permission_gate: PermissionGateReport, // 审批判定记录
    pub evidence: Option<Value>,               // 截图、审计日志路径、diff 等证据
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ToolOutcomeStatus { Ok, DryRunOnly, Rejected, Timeout, Failed }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGateReport {
    pub required: PermissionMode,              // 从 ToolSpec 来
    pub decision: PermissionDecision,          // allow-auto / allow-approved / deny / require-approval / require-confirm
    pub reason: String,                        // 人可读原因
    pub protected_match: Option<String>,       // 命中的 protected rule id（如果有）
    pub workspace_relative: bool,              // 目标路径是否在 workspace 内
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PermissionDecision {
    AllowAuto,
    AllowApproved,
    RequireApproval,
    RequireConfirm,
    Deny,
}
```

这些类型必须在 `core-runtime` 提供 serde 双向 round-trip 单测。

#### 步骤 T2：`llm_tool_definitions()` 从 registry 生成

`modules/gui-web/packages/web-console/src/main.rs:7728` 改造：

```rust
fn llm_tool_definitions() -> Option<Vec<ToolDefinition>> {
    if !llm_tools_enabled() { return None; }
    let registry = global_tool_registry();
    let mut defs = Vec::new();
    for spec in registry.mvp_tool_specs() {
        if should_expose_to_llm(&spec) == false { continue; } // 黑名单极少数，默认全暴露
        defs.push(ToolDefinition {
            name: spec.name.to_string(),
            description: compose_description(&spec), // 追加 "Permission: ReadOnly" 后缀，给模型做自我约束
            input_schema: spec.input_schema.clone(),
        });
    }
    for plugin in registry.plugin_tools() {
        defs.push(plugin.to_tool_definition());
    }
    diag!("[TOOL-REG] exposed {} tools to LLM", defs.len());
    Some(defs)
}

fn should_expose_to_llm(spec: &ToolSpec) -> bool {
    // 保留钩子；默认 true。后续可按 session.capability 白名单过滤
    true
}
```

- 同时保留旧的 `tools_semantic_dispatch` 作为一个独立 ToolSpec（在 registry 里注册），这样向下兼容不要改 prompt；只是 LLM 现在有 21+ 个工具可选。
- `input_schema` 直接复用 registry 中已有的 JSON schema；如果有缺的（bash、edit_file），在 §4.5 补齐。

#### 步骤 T3：`run_model_tool_dispatch()` 接入 registry

`main.rs:7900` 改造为：

```rust
pub async fn run_model_tool_dispatch(
    tool_name: &str,
    input: &Value,
    ctx: &ToolCallContext,
) -> ApiResult<ToolOutcome> {
    let invoke = ToolInvoke {
        call_id: ctx.call_id.clone(),
        tool_name: normalize_tool_name(tool_name),
        input: input.clone(),
        caller: ToolCaller::Llm,
        workspace_id: ctx.workspace_id.clone(),
        session_id: ctx.session_id.clone(),
        user_authorized: ctx.user_authorized, // 默认 false；ReadOnly 工具会被闸门自动放行
        user_confirmed_twice: ctx.user_confirmed_twice,
    };
    runtime_tool_execute(invoke).await
}
```

`runtime_tool_execute` 新函数（放 `core-runtime/src/tool.rs`）执行顺序：

1. **查找 spec**：`registry.spec_of(name)` → 404 则 `ToolOutcomeStatus::Failed`，reason `"unknown-tool"`。
2. **权限评估**：`evaluate_permission(&invoke, &spec, &protected_rules, &workspace)`（详见 §5）。
3. **闸门分支**：
   - `AllowAuto` / `AllowApproved`：进执行。
   - `RequireApproval` / `RequireConfirm`：返回 `DryRunOnly`，`summary_text="需要用户授权"`；LLM round-2 收到结构化 tool_result，不会以为它成功了。
   - `Deny`：返回 `Rejected`。
4. **执行**：
   - 对于 registry 内建工具：`run_registry_tool(invoke, spec)`，背后走 `GlobalToolRegistry::execute` 但封装成 async + 超时；
   - 对于 computer-use / vision 复合工具：继续走现有 `run_tool_dispatch(ToolDispatchRequest)` / `GroundingRouter::locate`，由专门 adapter 适配 I/O。
5. **审计写入**：无论成功失败，全部 `append_tool_audit_record(&outcome)`（复用 `computer-use-audit.jsonl`，扩展字段）。

#### 步骤 T4：Tool Loop 返回 ToolResult 结构化内容块

`main.rs:3037 TOOL-LOOP-STREAM` 与 `main.rs:6211 TOOL-LOOP` 改造：

```rust
for (tool_use_id, (name, args)) in model_tool_calls {
    let outcome = run_model_tool_dispatch(&name, &parse_args(&args), &ctx).await?;
    tool_result_blocks.push(OutputContentBlock::ToolResult {
        tool_use_id,
        content: serde_json::json!({
            "status": outcome.status,
            "summary": outcome.summary_text,
            "output": outcome.output,
            "permission": outcome.permission_gate,
            "evidence": outcome.evidence,
        }),
        is_error: matches!(outcome.status, ToolOutcomeStatus::Failed | ToolOutcomeStatus::Rejected | ToolOutcomeStatus::Timeout),
    });
}
// round 2：以 assistant tool_use + user tool_result 的标准 messages 序列调用 LLM
```

关键点：
- 必须用 `OutputContentBlock::ToolResult`（`llm-adapter` 已支持的 block type），不要再把工具输出拼成用户文本。
- 并发：当模型一次返回 `n` 个 tool_use，要 `futures::future::join_all` 并发执行（工具之间默认互不依赖）；超时与错误单独返回，不要一个失败拖死全批。
- `is_error=true` 时模型会在 round-2 看到错误并修复；不要在 Rust 端隐式重试。
- 保留诊断：`diag!("[TOOL-LOOP] n={}, parallel=true, ids=[{}]", n, ids.join(","))`。

#### 步骤 T5：超时、并发、异常分类（REQ-TOOL-011）

在 `tool-registry` 里给每个 ToolSpec 新加可选字段：

```rust
pub struct ToolSpec {
    // ... existing ...
    pub default_timeout_ms: u32,        // default 30_000
    pub max_concurrency: u8,            // default 4
    pub cancel_on_deadline: bool,       // default true
}
```

`runtime_tool_execute` 使用 `tokio::time::timeout` + `Semaphore` 强制；超时返回 `ToolOutcomeStatus::Timeout`，`summary_text="tool '{name}' exceeded {ms}ms"`。

### 4.2 工具 schema 补齐

当前 `bash`、`edit_file`、`Agent` 等工具 schema 较简略。补齐标准：
- 必填：`description`、`input.type=object`、`properties`、`required`。
- 高危工具（`PermissionMode::DangerFullAccess`）在 `description` 尾部追加 `"⚠️ 该工具默认需要用户审批"`，以便 LLM 自己减少滥调。
- 对 `bash` / `PowerShell`：强制 `timeout_ms` 为必填（默认 30_000），避免模型给出无超时命令。

### 4.3 向后兼容

- `tools_semantic_dispatch` 仍作为 registry 中的一个工具暴露，prompt/前端无需改动。
- `POST /api/tools/dispatch` 与 `POST /api/tools/execute` 的请求体保持现有字段；内部改为先构造 `ToolInvoke` 再走 `runtime_tool_execute`，输出追加 `permission_gate` 字段（可选，旧 client 忽略即可）。

### 4.4 TDD 矩阵

| 测试 | 覆盖 |
| --- | --- |
| `tool_registry_exposes_all_mvp_specs` | `llm_tool_definitions()` 返回数量 = `mvp_tool_specs().len()` |
| `tool_loop_stream_parallel_two_tools` | 模拟 LLM 返回 2 个 tool_use → ToolResult 2 个，顺序稳定 |
| `tool_loop_is_error_on_rejected` | 权限 Deny 场景 → `is_error=true`，summary 带原因 |
| `tool_timeout_returns_status_timeout` | bash echo `Start-Sleep 60` + timeout 200ms → Timeout |
| `unknown_tool_returns_failed_not_panic` | name="nonexistent" → Failed，无 panic |
| `tool_result_block_schema_roundtrip` | ToolOutcome serde round-trip |

### 4.5 前端 `app.js` 改动

- SSE 解析到 `tool_use` 块时，根据 `permission_gate.decision` 决定是否渲染审批按钮（详见 §5.4）。
- 新增「工具调用日志」抽屉（复用现有工具卡片位置），展示最近 50 次 `ToolOutcome`。

---

## 5. REQ-TOOL-008：4 级权限分级审批

### 5.1 权限等级定义

优先级从高到低（高级别覆盖低级别）：

| 等级 | 规则 | 典型工具 |
| --- | --- | --- |
| 🔒 `Protected` | 触及配置中 `[tool.protected_paths]` 内任一规则 → 永远 `RequireApproval + RequireConfirm`，不区分 workspace 内外 | 任何写入 `coolzhu.toml`、`.coolzhu/**`、`%USERPROFILE%/.ssh/**`、`.git/**` 的操作 |
| `DangerFullAccess` | workspace 内 → `AllowApproved`（第一次需要批，会话内可选"本会话内授权"）；外 → `RequireApproval + RequireConfirm` | bash、PowerShell、REPL、Agent |
| `WorkspaceWrite` | workspace 内 → `AllowAuto`；外 → `RequireApproval` | write_file、edit_file、TodoWrite、NotebookEdit、Config |
| `ReadOnly` | 始终 `AllowAuto` | read_file、glob_search、grep_search、WebFetch、WebSearch、Skill、ToolSearch、Sleep、StructuredOutput 等 |

以上规则由 `evaluate_permission(invoke, spec, rules, workspace)` 实现，位置：`core-runtime/src/permission_gate.rs`。

### 5.2 路径抽取与 workspace 边界

每个工具提供一个可选的 `TargetPathsExtractor`（位于 `tool-registry/src/path_effect.rs`）：

```rust
pub trait TargetPathsExtractor: Send + Sync {
    /// 返回工具将要读/写的绝对路径集合（未归一化）
    fn extract(&self, input: &Value) -> Vec<PathTarget>;
}

pub struct PathTarget {
    pub raw: PathBuf,
    pub access: PathAccess,   // Read / Write / Execute
}
```

默认实现：
- `write_file` / `edit_file` / `NotebookEdit`：取 `path` / `file_path` 字段。
- `read_file` / `glob_search` / `grep_search`：取 `path` 字段（访问粒度 Read）。
- `bash` / `PowerShell` / `REPL`：**无法静态分析命令行**，按整机 workspace 外处理（`workspace_relative=false`），走 `DangerFullAccess` 外部规则。
- `Config`：取 `path` 字段；若指向 `coolzhu.toml` 命中 Protected。

边界判断 `is_path_inside_workspace(path, workspace_root)`：

1. `dunce::canonicalize` 归一化（避免 `\\?\` 前缀与大小写差异）。
2. `!canonical.starts_with(&workspace_canonical)` → `workspace_relative=false`。
3. 显式防御：若 `path.components()` 包含 `..`，即便最终落在 workspace 内也要额外一次 canonicalize 比较（防 symlink 穿越）。
4. Symlink 跟随要禁掉：用 `std::fs::symlink_metadata` 判定，`FileType::is_symlink()` 时视为 `workspace_relative=false` 并在 `reason` 注明 `"symlink-target-unverified"`。

### 5.3 Protected 路径规则表（REQ-TOOL-010）

新增 `coolzhu.toml` 段：

```toml
[tool.protected_paths]
# 规则按列表顺序评估，命中即停
rules = [
  { id = "coolzhu-config",  glob = "**/coolzhu.toml",       access = "any" },
  { id = "coolzhu-data",    glob = "**/.coolzhu/**",        access = "any" },
  { id = "ssh-keys",        glob = "**/.ssh/**",            access = "any" },
  { id = "git-internal",    glob = "**/.git/**",            access = "write" },
  { id = "env-file",        glob = "**/.env*",              access = "any" },
]

[tool.permission]
# 是否允许「本会话内授权」减少重复审批；默认 true，Protected 永远不启用
session_scope_grants = true
# DangerFullAccess 外部调用额外冷却（秒）
danger_external_cooldown_secs = 60
```

- `glob` 使用 `glob::Pattern`；支持 `**` 递归。
- `access = "any" | "read" | "write" | "execute"`：`any` 会拦下 Read；多数规则应该写 `"any"` 以便对 `coolzhu.toml` 的「读 key」也强制审批（避免 LLM 把 API key 读走拼进 prompt）。
- 运行时通过 `GET /api/tools/protected-paths` 返回当前规则表（只读），前端用于展示"这是受保护资源"。

### 5.4 前端审批 UI

改造 `app.js:113` 周边 `[data-role="tool-exec-actions"]`：

1. 收到 SSE `tool-permission-required` 事件（新事件类型，后端在 §4.1 的 `RequireApproval` 分支发送）：
   ```json
   {
     "call_id": "toolu_xxx",
     "tool_name": "bash",
     "risk_tag": "danger-external",
     "reason": "command will run outside workspace",
     "input_summary": "bash: command='npm install -g typescript', cwd='/'",
     "require_confirm": true,
     "protected_rule_id": null
   }
   ```
2. UI 渲染（复用工具卡片位置）：

   ```
   ┌─────────────────────────────────────────────┐
   │ 🔒 bash (DangerFullAccess) — 外部路径         │
   │ 参数: command='npm install -g typescript'    │
   │ 原因: command will run outside workspace     │
   │ [拒绝]  [授权（本会话）]  [授权（单次）]       │
   └─────────────────────────────────────────────┘
   ```
3. 用户点击「授权（单次）」→ `POST /api/tools/approve`，body：
   ```json
   { "call_id": "toolu_xxx", "scope": "once", "confirmed_twice": true }
   ```
4. 若 `require_confirm=true`，点击按钮时先弹 `confirm("确认执行此操作？参数: ...")`，取消则视为 `scope="deny"`。
5. `scope=session` 时后端把 `(session_id, tool_name, risk_tag)` 写入 in-memory grants，有效期至会话切换或 30 min；`scope=once` 立即消费。

**新增 endpoint：**

| Method | Path | 作用 |
| --- | --- | --- |
| `POST` | `/api/tools/approve` | 授权一次 tool_use，body `{call_id, scope, confirmed_twice}` |
| `POST` | `/api/tools/reject` | 显式拒绝，释放 pending call |
| `GET` | `/api/tools/pending` | 查询当前挂起的审批（刷新页面后恢复） |
| `GET` | `/api/tools/protected-paths` | 返回 Protected 规则列表（只读） |
| `GET` | `/api/tools/audit?limit=50` | 返回近期 ToolOutcome（审计用） |

### 5.5 审计（REQ-TOOL-009）

所有非 ReadOnly 工具的 `ToolOutcome` 追加到 `computer-use-audit.jsonl`，每行包含：

```json
{
  "ts": "2026-05-10T12:34:56+08:00",
  "call_id": "toolu_xxx",
  "tool_name": "write_file",
  "caller": "llm",
  "workspace_id": "ws-abc...",
  "session_id": "ses-xxx",
  "input_summary": "write_file path=src/foo.rs len=2148B",
  "permission": {
    "required": "WorkspaceWrite",
    "decision": "AllowAuto",
    "reason": "inside-workspace",
    "protected_match": null,
    "workspace_relative": true
  },
  "status": "Ok",
  "elapsed_ms": 34,
  "evidence": { "diff_hash": "sha256:..." }
}
```

- 原始 input 可能含 key/密码；写 `input_summary` 必须用白名单投影（参数名 + 长度/范围），**禁止**整 JSON 落盘。
- 查询：`/api/tools/audit?limit=50&tool_name=bash&since=...`。

### 5.6 TDD 矩阵

| 测试 | 覆盖 |
| --- | --- |
| `permission_protected_coolzhu_toml` | 写入 `coolzhu.toml` → `Protected.RequireConfirm` |
| `permission_workspace_write_inside` | write_file workspace 内 → `AllowAuto` |
| `permission_workspace_write_outside` | write_file workspace 外 → `RequireApproval` |
| `permission_danger_inside_needs_approval_once` | bash workspace 内 → `AllowApproved`（首次批，session 内后续免批） |
| `permission_danger_outside_confirm_twice` | bash 命令 cwd 外 → `RequireApproval + RequireConfirm` |
| `permission_readonly_always_auto` | read_file → `AllowAuto`，即便 path 在 workspace 外 |
| `permission_symlink_escape_blocked` | path 是指向 workspace 外的 symlink → `workspace_relative=false` |
| `permission_dotdot_escape_blocked` | `path="foo/../../../secret"` → 解析后判外部 |
| `approval_session_scope_survives_new_tool_call` | 同会话第二次调用 bash 自动放行，但 `workspace_id` 变化后失效 |
| `audit_log_never_leaks_secret_bodies` | 写一个含 "SECRET_KEY=xxx" 的 write_file → 审计日志不含 xxx |

---

## 6. REQ-CORE-TOOL-001：统一工具编排（收敛范围）

把原"三端协议大一统"这个 ambitious 目标收敛为：

1. **保留** Web / CLI / MCP 各自的 HTTP / CLI 协议；
2. **统一** 所有入口都调用 `core_runtime::tool::runtime_tool_execute(ToolInvoke) -> ToolOutcome`；
3. **引入** `core_runtime::tool::ToolExecutor` trait，registry 与 computer-use / vision 为其 implementor；
4. **禁止** 任何端口绕过 `runtime_tool_execute` 直接调用 registry 或 computer-use action。

具体映射：

| 入口 | 当前 | 改造后 |
| --- | --- | --- |
| `LLM tool_use` | `run_model_tool_dispatch` 硬编码白名单 | 走 `runtime_tool_execute(invoke{caller=Llm})` |
| `POST /api/tools/dispatch` | `run_tool_dispatch(ToolDispatchRequest)` | 内部构造 `ToolInvoke{caller=WebUi, user_authorized=body.execute}` → `runtime_tool_execute` |
| `POST /api/tools/execute` | 强 `execute=true` | 同上，但要求 `/api/tools/approve` 已登记 grant；未登记则返回 `403 + reason` |
| `CLI` | 单独代码 | CLI 构造 `ToolInvoke{caller=Cli, user_authorized=true}`（CLI 默认假定运行环境已授权）→ `runtime_tool_execute` |
| `MCP` | 插件直跑 | MCP server 把请求包装成 `ToolInvoke{caller=Mcp}` → `runtime_tool_execute` |

迁移策略：
- 先把 `runtime_tool_execute` 作为 adapter（内部仍可以走老路径），保证行为不变；
- 再逐个入口切换；
- 最后删除 `run_model_tool_dispatch` 里 computer-use-only 的 legacy 分支。

---

## 7. 文件级改动清单（交给实现 agent）

### 步骤 A：契约（先立类型，不含行为）

| # | 文件 | 动作 |
| --- | --- | --- |
| A1 | `modules/core-runtime/packages/core-runtime/src/tool.rs`（新建） | `ToolInvoke`、`ToolOutcome`、`ToolCaller`、`PermissionGateReport`、`PermissionDecision` 全部 serde 类型 + 单测 |
| A2 | `modules/core-runtime/packages/core-runtime/src/permission_gate.rs`（新建） | `evaluate_permission`、`is_path_inside_workspace`、`match_protected_rule`；默认规则表常量 |
| A3 | `modules/tooling/packages/tool-registry/src/path_effect.rs`（新建） | `TargetPathsExtractor` trait + 为 20 个内建工具提供默认实现 |
| A4 | `modules/tooling/packages/tool-registry/src/lib.rs` | `ToolSpec` 扩字段 `default_timeout_ms / max_concurrency / cancel_on_deadline`；`permission_specs` 保持不变 |
| A5 | `modules/core-runtime/INTERFACE.md` | 补 `runtime::tool` 稳定接口清单 |

验证：`cargo check -p coolzhu-core-runtime --offline`、`cargo test -p coolzhu-core-runtime --offline`。

### 步骤 B：runtime 执行核心

| # | 文件 | 动作 |
| --- | --- | --- |
| B1 | `modules/core-runtime/packages/core-runtime/src/tool.rs` | 实现 `runtime_tool_execute(invoke)`：查 spec → 评估权限 → Dispatch 到 `ToolExecutor` 或 `registry.execute` → 超时 + 审计 |
| B2 | `modules/core-runtime/packages/core-runtime/src/tool.rs` | 定义 `ToolExecutor` trait：`async fn execute(&self, invoke, spec) -> ToolOutcome`；提供 `RegistryExecutor`、`ComputerUseExecutor`（后者包 `run_tool_dispatch` 当前逻辑）两个 impl |
| B3 | `modules/core-runtime/packages/core-runtime/tests/permission_gate.rs` | §5.6 的 10 个用例 |
| B4 | `modules/core-runtime/packages/core-runtime/tests/tool_timeout.rs` | 模拟 bash sleep，验证 `Timeout` 状态 |

### 步骤 C：LLM 侧接入

| # | 文件 | 动作 |
| --- | --- | --- |
| C1 | `web-console/src/main.rs:7728 llm_tool_definitions` | 按 §4.1 步骤 T2 重写；保留 `should_expose_to_llm` 钩子 |
| C2 | `web-console/src/main.rs:7900 run_model_tool_dispatch` | 改为构造 `ToolInvoke` + 调 `runtime_tool_execute`；移除硬编码白名单 |
| C3 | `web-console/src/main.rs:3037/6211 TOOL-LOOP*` | 改为发 `OutputContentBlock::ToolResult`；支持并发 `join_all`；保留 diag 日志 |
| C4 | `llm-adapter` | 确认 `OutputContentBlock::ToolResult` 已支持；如果 provider 不支持（如 DeepSeek），在 adapter 里降级为"拼 system + 提示"而不是在 runtime 中改 |
| C5 | `web-console/tests/tool_loop_multi_tool.rs` | 固定 fake provider 返回 2 个 tool_use → 2 个 ToolResult，status 正确 |

### 步骤 D：Web API 权限审批 UI

| # | 文件 | 动作 |
| --- | --- | --- |
| D1 | `web-console/src/main.rs` | 新 endpoints：`/api/tools/approve`、`/reject`、`/pending`、`/protected-paths`、`/audit` |
| D2 | `web-console/src/main.rs` | in-memory `PendingApprovals`（按 `call_id`）+ `SessionGrants`（按 session_id）；30 min TTL |
| D3 | `web-console/src/main.rs` SSE | 新事件 `tool-permission-required`、`tool-permission-resolved` |
| D4 | `web-console/src/app.js:113 附近` | 审批面板组件：渲染 `tool_name + risk_tag + input_summary + 3 按钮` |
| D5 | `web-console/index.html` + `styles.css` | 审批面板视觉（与现有 `[Allow]/[Deny]` 风格一致） |
| D6 | `web-console/tests/api_tools_approve.rs` | E2E：发起 tool_use → 收到 pending → approve → outcome 返回 Ok |

### 步骤 E：审计与 Protected 路径配置

| # | 文件 | 动作 |
| --- | --- | --- |
| E1 | `web-console/src/main.rs` `ConfigTool` | 新增 `protected_paths: Vec<ProtectedRule>`、`permission.session_scope_grants`、`danger_external_cooldown_secs` |
| E2 | `coolzhu.toml` 模板 | 写入 §5.3 默认规则表 |
| E3 | `core-runtime` `append_tool_audit_record` | 复用 `ComputerUseAudit::append`；扩字段；**必须**跑 `input_summary` 白名单投影，永远不落 `input` 原 JSON |
| E4 | `web-console/tests/audit_no_secret_leak.rs` | 输入 `write_file(path=.env, content="SECRET=xxx")` → audit.jsonl 不含 `xxx` |

### 步骤 F：文档 & 需求

| # | 文件 | 动作 |
| --- | --- | --- |
| F1 | `docs/requirements-management.md` | REQ-TOOL-007/008 加方案链接；新增 REQ-TOOL-009/010/011；REQ-LLM-003/TOOL-001/CORE-TOOL-001/WEB-PROJECT-002 补"需要补丁"后缀 |
| F2 | `docs/interface-contracts.md` | 新增"工具调用编排"小节：`runtime::tool` 稳定接口列表，审计 schema 版本号 |
| F3 | `modules/tooling/INTERFACE.md` | 新增 `TargetPathsExtractor`、`ToolSpec` 扩展字段稳定接口 |
| F4 | `modules/gui-web/INTERFACE.md` | 新增 5 个 HTTP endpoint 规范 |
| F5 | `docs/work-logs/2026-05-1X-tool-permission-implementation.md` | 落地日志模板 |

---

## 8. 验收矩阵

| 层 | 用例 | 判定 |
| --- | --- | --- |
| 单元 | §4.4 + §5.6 所有 TDD | 全绿 |
| 契约 | `OutputContentBlock::ToolResult` round-trip + SSE 新事件 | 全绿 |
| E2E | 让 LLM 调用 `read_file` + `write_file` + `bash` + `semantic_dispatch` 各一次 | LLM 看到 4 种 `tool_result`，前 2 个 auto，bash 触发审批面板 |
| 人工 | 一次 bash workspace 外命令，UI 出现二次确认弹窗；写 `coolzhu.toml` 强制审批 | UI 行为符合 §5.4 预期；audit.jsonl 可查询 |
| 回归 | 既有 `/api/tools/dispatch` + `/execute` 既有 client 返回结构保持 | 响应 JSON 至少向后兼容（可新增字段，不可删） |
| 安全 | 构造 symlink / `..` / `%USERPROFILE%` 多种路径 | 均被 `is_path_inside_workspace` 拦到正确分支 |

---

## 9. 安全与回滚

- **回滚**：`coolzhu.toml [tool.permission] session_scope_grants = false`，`[tool.protected_paths] rules = []`，并把 `llm_tool_definitions` 换回仅暴露 `tools_semantic_dispatch`（保留 feature flag `coolzhu.toml [model] enable_multi_tool = false`）。
- **退化路径**：如果 provider 不支持 `tool_result` content block，llm-adapter 负责在发送时做 `tool_result → system: "Tool result: ..."` 的文本降级，runtime 保持不变。
- **Protected 路径永远硬生效**：即便 `enable_multi_tool=false`，手工从 Web 触发的 `write_file(coolzhu.toml)` 也要走审批，避免 UI 意外改配置。

---

## 10. 实施顺序速览

```
A (契约 + Registry 扩字段)
 → B (runtime_tool_execute + 权限评估 + 审计 + 超时)
 → C (LLM 侧接入 + Tool Loop ToolResult 结构化)
 → D (Web API 审批 UI + SSE 事件)
 → E (Protected 配置 + 审计 leak 防御)
 → F (文档 & 需求更新)
```

完成后需求状态变更：

| REQ | 旧 | 新 |
| --- | --- | --- |
| REQ-TOOL-007 | 待开发 | 测试中 |
| REQ-TOOL-008 | 待开发 | 测试中 |
| REQ-TOOL-009 | — | 新增（已完成） |
| REQ-TOOL-010 | — | 新增（已完成） |
| REQ-TOOL-011 | — | 新增（已完成） |
| REQ-CORE-TOOL-001 | 待开发 | 开发中（Web 入口已切换，CLI/MCP 余下） |
| REQ-LLM-003 | 已完成 | 已完成（升级到多工具结构化） |
| REQ-TOOL-001 | 已完成 | 已完成（dispatch 走 runtime） |

---

## 11. 给后续 agent 的注意事项

1. **不要**在 `web-console/src/main.rs` 里直接 new 一个 `PermissionGateReport`：那是 runtime 层的决定，任何端口都要经过 `runtime_tool_execute`。
2. **不要**把 tool 原始 `input` JSON 往任何日志/SSE 事件里扔；一律只 emit `input_summary` 白名单字段。
3. **不要**把 `Protected` 规则放内存常量里——必须从 `coolzhu.toml` 读，测试里用 `with_config_override`。
4. 权限判定代码路径必须是 **纯函数**（`evaluate_permission(invoke, spec, rules, workspace) -> PermissionGateReport`），不读 globals，便于单测。
5. 统一 diag 前缀：`[TOOL-REG]`、`[TOOL-GATE]`、`[TOOL-EXEC]`、`[TOOL-LOOP]`、`[TOOL-AUDIT]`。
6. 完成后在 `docs/work-logs/2026-05-1X-tool-permission-implementation.md` 写交付日志，附 §8 每行的执行记录与截图。
