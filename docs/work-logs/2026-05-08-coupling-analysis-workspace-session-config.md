# 2026-05-08 工程目录卡与配置/会话/Agent 卡片耦合分析

记录时间：2026-05-08

## 范围

本次分析聚焦两个问题：
1. 工程目录卡片修改路径不生效 —— 涉及 `modules/gui-web/packages/web-console/src/main.rs` 中的 `WorkspaceState` 与多个子系统的耦合关系
2. 配置/会话/Agent 状态卡片新增思考程度和自定义模型端点后后端配置功能失效 —— 涉及 session CRUD、SQLite 迁移、LLM 调用链路

分析覆盖文件：
- `modules/gui-web/packages/web-console/src/main.rs`（约 13687 行）
- `modules/gui-web/packages/web-console/src/app.js`（约 2582 行）
- `modules/gui-web/packages/web-console/index.html`
- `modules/llm-adapter/packages/llm-adapter/src/providers/mod.rs`
- 各备份目录用于回退对比

---

## 问题一：工程目录卡片修改路径不生效

### 现象还原链路

1. 前端工程目录卡片双击（`app.js:97` → `beginWorkspaceEdit:183`）
2. 用户输入新路径，Enter 提交（`app.js:201-203`）
3. `saveWorkspacePath:213` POST 到 `/api/workspace`（`main.rs:494`）
4. 后端 `resolve_allowed_workspace:641` 校验路径，更新 `WorkspaceState.current:501`
5. 前端收到响应后更新路径文字和目录树（`app.js:225-226`）

**表象：路径文字确实变了，目录树也刷新了，但"路径切换不生效"。**

### 根因分析

`WorkspaceState.current` 仅被以下函数消费（即 **正确响应 workspace 变更** 的子系统）：

| 函数 | 行号 | 功能 |
|---|---|---|
| `api_state()` | 240 | 返回 `workspace` 显示字符串和 `project_entries` 目录树 |
| `active_workspace_path()` | 554 | 统一入口，读 Mutex |
| `workspace_response()` | 561 | `/api/workspace` GET 响应 |
| `scan_project_entries()` | 505 | 扫描目录项 |
| `resolve_workspace_tool_path()` | 668 | 工具文件读写安全边界 |
| `workspace_identity()` | (调用处) | workspace_id 生成 |

**以下 8 个关键子系统完全不使用 `active_workspace_path()`，它们使用进程当前目录 `env::current_dir()` 或 `codex_project_root()`，变更 workspace 对这些系统无效果：**

| # | 函数 | 行号 | 使用的路径 | 影响 |
|---|---|---|---|---|
| 1 | `default_session_sqlite_path()` | 8093 | `env::current_dir()/.coolzhu/web-sessions.sqlite3` | **CRITICAL** 会话/聊天记录/memory beads 存储 |
| 2 | `default_session_store_path()` | 8080 | `env::current_dir()/.coolzhu/web-sessions.json` | **CRITICAL** 会话 JSON 备份 |
| 3 | `attachment_store_dir()` | 5225 | `{session_db_parent}/.coolzhu/attachments/` | **HIGH** 文件附件存储 |
| 4 | `plugin_source_roots()` | 1847 | `codex_project_root()/.coolzhu/plugins/` | **HIGH** 插件目录发现 |
| 5 | `skill_source_roots()` | 1868 | `codex_project_root()/.coolzhu/skills/` | **HIGH** Skill 目录发现 |
| 6 | `resolve_api_key_ref()` | 6426 | `env::current_dir()` 解析相对路径 Key 文件 | **HIGH** API Key 文件定位 |
| 7 | `build_diagnostics_health()` | 5831 | `codex_project_root()` 作为诊断 workspace 展示 | **HIGH** 诊断页 workspace 与实际不同步 |
| 8 | `computer_use_audit_log_path()` | 3316 | `{session_db_parent}` 为根 → 实际是 `env::current_dir()` | **MEDIUM** audit log 路径 |

### 耦合影响矩阵

```
                        ┌─────────────────┐
                        │  WorkspaceState  │  ← 仅被 /api/state、/api/workspace、
                        │  .current        │     工具路径安全边界消费
                        └────────┬────────┘
                                 │ ❌ 不消费
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐          ┌──────▼──────┐         ┌─────▼──────┐
    │ Session   │          │ Attachment  │         │ Plugin/    │
    │ SQLite    │          │ Store       │         │ Skill Cat. │
    │ (行8093)  │          │ (行5225)    │         │ (行1847,   │
    │           │          │             │         │  行1868)   │
    └───────────┘          └─────────────┘         └────────────┘
      使用: env::cwd()        使用: env::cwd()        使用: codex_root()
```

**结论：当前 workspace 切换仅实现了"路径展示 + 目录树预览 + 工具安全围栏"，会话数据、附件、插件/Skill、诊断、API Key 解析均未跟随切换。**

### 额外发现

- `codex_project_root():1887` 向上遍历目录树查找 `.coolzhu` + `modules` + `Cargo.toml` 标记，始终返回 codex 仓库根目录，与 workspace 概念正交。
- `opencode_master_project_root():1908` 硬编码了 `C:\Users\zhupu\Desktop\opencode\master-project`，迁移到其他机器必然失败。
- `allowed_workspace_roots():595-596` 新增加了 `user_home_dir()` 到允许根目录（对比备份版本缺少此项），但影响较小。

---

## 问题二：配置/会话/Agent 状态卡片 —— 思考程度与自定义端点

### 数据流全链路分析

#### 1. 前端表单 → 后端保存（链路完整，无明显缺陷）

```
index.html (行89-94)
  └─ <select data-role="session-reasoning-effort"> → low/medium/high/xhigh
  └─ <input data-role="session-base-url"> → 自定义 base URL
  └─ <input data-role="session-endpoint"> → 自定义 endpoint

app.js:768 sessionPayloadFromForm()
  └─ reasoning_effort, base_url, endpoint 全部抓取

app.js:840 saveSelectedSession()
  └─ PATCH /api/sessions/{id} 发送以上三字段

main.rs:2028 api_update_session()
  └─ UpsertSessionRequest { base_url, endpoint, reasoning_effort } 全部 Option
  └─ update_session:8511 逐字段更新（仅 Some 时覆盖）

main.rs:8481 create_session()
  └─ 同样正确处理三字段
```

#### 2. SQLite 持久化（链路完整）

```
initialize_session_schema():9009
  └─ CREATE TABLE sessions (..., base_url TEXT, endpoint TEXT,
                            reasoning_effort TEXT NOT NULL DEFAULT 'medium')

ensure_session_column():9081-9083
  └─ ALTER TABLE ADD COLUMN（对旧数据库迁移，通过 PRAGMA table_info 判断）

save_session_state_to_sqlite():9350
  └─ INSERT INTO sessions 包含 base_url, endpoint, reasoning_effort ✓

read_session_state_from_sqlite():9114-9138
  └─ SELECT ... base_url, endpoint, reasoning_effort FROM sessions ✓
```

#### 3. 会话 → Agent → LLM 调用（存在缺陷）

```
default_agent_sessions():9858
  └─ 遍历 session_store 中所有会话
  └─ PersistedSession::to_agent_session():10200
      └─ AgentSessionDto { base_url, endpoint, reasoning_effort } ✓ 正确传递

prepare_chat_dispatch():2646
  └─ 调用 default_agent_sessions() 获取 Agent 列表 ✓

agent_chat_response():5362
  └─ provider_client_for_agent():6706
      └─ effective_agent_base_url():9814 ← ⚠️ 存在缺陷
      └─ agent_message_request():6720 → reasoning_effort:6733 ✓
```

### 发现的关键缺陷

#### 缺陷 A：`effective_agent_base_url()` 中端点依赖 base_url（行9814-9832）

```rust
fn effective_agent_base_url(agent: &AgentSessionDto) -> Option<String> {
    let base_url = agent.base_url.as_deref()?.trim().trim_end_matches('/');
    // ────────────── ↑ ? 运算符：base_url 为 None 时直接返回 None
    if base_url.is_empty() {
        return None;
    }
    let endpoint = agent.endpoint.as_deref().map(str::trim).filter(|v| !v.is_empty());
    Some(match endpoint {
        Some(endpoint) => format!("{}/{}", base_url, endpoint.trim_start_matches('/')...),
        None => base_url.to_string(),
    })
}
```

**问题**：如果用户仅设置了 `endpoint` 但未设置 `base_url`，`endpoint` 被完全忽略 —— 因为 `?` 运算符在 `base_url` 为 `None` 时提前返回。用户的行为预期可能是"我只想改 endpoint 路径后缀"，但实际上 endpoint 脱离了 base_url 就无法生效。当前设计下这是一个**静默失败**——无警告、无错误、LLM 直接回退到默认 provider 路由。

**影响**：用户填写了自定义 endpoint 但调用仍然走默认 provider，表现为"配置失效"。

#### 缺陷 B：`updateModelOptions()` 自动填充可能覆盖用户值（app.js:755-765）

```js
if (baseUrl && !baseUrl.value && provider === "Ollama (本地)") {
    baseUrl.value = "http://127.0.0.1:11434/v1";
}
if (baseUrl && !baseUrl.value && provider === "OpenAI-compatible (自定义)") {
    baseUrl.value = "http://127.0.0.1:8000/v1";
}
if (endpoint && !endpoint.value && ...) {
    endpoint.value = "chat/completions";
}
```

**触发链**：
1. 用户加载已有会话（`loadSessions:276` → `setSessionForm:781`）
2. `setSessionForm` 设置 provider → 触发 `updateModelOptions()`
3. `updateModelOptions` 仅在字段为空时自动填充默认值
4. 随后 `setSessionForm` 用会话数据覆盖 base_url/endpoint（行796-797）

**当前实际行为**：会话数据覆盖在自动填充之后，顺序正确，不会丢失用户数据。
**但存在隐患**：如果用户在 form 上手动改 provider 后再保存，`updateModelOptions()` 可能会重新自动填充并覆盖用户手动输入的值（需在修改 provider 之前先清空 base_url/endpoint 才能触发自动填充）。

#### 缺陷 C：`api_state()` 的配置显示与 session 配置是两个独立信息源

```
refreshState():144
  └─ /api/state → state.models.reasoning (来自 CLAW_REASONING_MODEL 环境变量)
  └─ /api/state → state.models.vision (来自 CLAW_LOCAL_VISION_MODEL 环境变量)
  └─ setText("config.provider", state.models.reasoning)   ← 卡片上显示的"配置"
  └─ setText("config.model", state.models.vision)         ← 卡片上显示的"配置"

loadSessions():276
  └─ /api/sessions → session.provider, session.model, 
                     session.base_url, session.endpoint, 
                     session.reasoning_effort
  └─ setSessionForm(active)                               ← 表单中的会话设置
```

**问题**：卡片上"配置"区域显示的是**系统环境变量级别的模型配置**（`models.reasoning` / `models.vision`），而实际发起 LLM 调用使用的是**会话级别的配置**。两者没有关联，也没有互相反映。用户修改了会话的 `base_url`/`endpoint`/`reasoning_effort`，但卡片上"配置"区域不变化，产生"配置没生效"的错觉。

#### 缺陷 D：思考程度 `reasoning_effort` 的传递链路正常但缺乏验证

```
前端表单 → sessionPayloadFromForm:776 → normalize_reasoning_effort:9799
  └─ "低" → "low", "中" → "medium", "高" → "high", "超高" → "xhigh"
  └─ 保存到 SQLite reasoning_effort 列 ✓
  └─ AgentSessionDto.reasoning_effort ✓
  └─ MessageRequest.reasoning_effort:6733 ✓
  └─ ProviderClient.stream_message() → 实际 LLM API 调用 ✓
```

此链路代码完整，但如果 provider 不支持 `reasoning_effort` 参数（如某些 OpenAI-compatible 实现），**服务端可能忽略或报错**。当前没有任何日志记录 reasoning_effort 是否被实际应用。

### 耦合影响关系总结

```
        前端卡片 "配置 / 会话 / Agent 状态"
       ┌────────────┬───────────────┐
       │            │               │
  系统环境变量    会话表单          Agent 状态
  /api/state      /api/sessions    /api/agents
  (行239)         (行2011)          (行1975)
       │            │               │
  仅用于展示      写入 SQLite      从 session_store 读取
  models.reasoning (行9350)        default_agent_sessions()
  models.vision                    (行9858)
       │            │               │
       │       PATCH 更新           │
       │       (行2028)             │
       │            │               │
       │       effective_agent_     │
       │       base_url() ← ⚠缺陷A  │
       │            │               │
       └────────────┴───────┬───────┘
                            │
                    实际 LLM 调用
                    provider_client_for_agent()
                    (行6706)
```

**模块间耦合关系**：
- `SessionStore` ↔ SQLite ↔ `env::current_dir()`：会话数据强绑定进程启动目录
- `AgentSessionDto` ↔ `PersistedSession` ↔ `SessionSummaryDto`：三个 DTO 之间字段需要严格同步
- `provider_client_for_agent` ↔ `effective_agent_base_url` ↔ `session_api_key`：自定义端点路由依赖 agent DTO 完整传递
- 前端 `updateModelOptions` ↔ provider change 事件 ↔ setSessionForm 时序：自动填充与用户输入的竞态风险

---

## 对比备份版本分析

### 问题一相关

| 备份版本 | WorkspaceState | allowed_roots | 差异 |
|---|---|---|---|
| `computer-use-audit-gate-20260508-0817` | 相同 | 无 `user_home_dir()` push | 当前版本增加了 HOME 到允许根 |
| `overview-workspace-20260508-2050` | 相同 | 相同 | 无差异 |
| `web-project-workspace-identity-20260506-073636` | 相同 | 无 `user_home_dir()` push | 早期版本 |

**结论**：workspace 架构从开始就仅服务于路径展示和工具安全边界，从未改动过会话/附件/插件等子系统的路径绑定。`user_home_dir()` 的加入是最新的微调。

### 问题二相关

| 备份版本 | base_url/endpoint/reasoning_effort | 差异 |
|---|---|---|
| `web-card-state-completion-20260506-073317` | 已包含三字段在 PersistedSession 和 SQLite schema | 字段齐全 |
| `web-card-api-audit-20260506-001615` | session-agent 卡片审计标记 ready | 审计状态 |
| `dependent-diag-media-20260506-220005` | app.js 和 index.html 备份包含完整 session-agent-card | 前端结构一致 |

**结论**：三字段在近期版本中均已正确实现 CRUD，代码本身无明显缺失。功能"失效"的主要原因是设计层面的耦合问题（缺陷 A/B/C），而非代码缺陷。

---

## 建议修复方向（不改代码，仅供确认）

### 问题一：workspace 切换

1. **P0**：`default_session_sqlite_path()` 和 `default_session_store_path()` 改为基于 `active_workspace_path()` 而非 `env::current_dir()`
   - 风险：workspace 切换到空目录时，旧会话数据不可见（需考虑数据迁移或 workspace-scoped session 隔离设计）
2. **P1**：`attachment_store_dir()` 跟随 workspace
3. **P2**：`plugin_source_roots()` / `skill_source_roots()` 是否应跟随 workspace 需产品决策（当前设计可能故意将 plugins/skills 绑定到 codex 仓库而非用户项目）
4. **P2**：修复 `opencode_master_project_root()` 硬编码路径，仅依赖环境变量
5. **P3**：`build_diagnostics_health()` 同步使用 `active_workspace_path()`

### 问题二：配置/会话/Agent

1. **P0**：修复 `effective_agent_base_url()` 中 endpoint 脱离 base_url 的静默失败 —— 当仅设 endpoint 未设 base_url 时返回错误而非静默回退
2. **P1**：`api_state()` 的 `models` 字段扩展为包含当前 active session 的实际配置（或至少标注"系统默认"与"会话覆盖"的区别）
3. **P2**：`updateModelOptions()` 增加脏检测 —— 如果用户已手动修改 base_url/endpoint，切换 provider 时不再自动填充
4. **P2**：增加 reasoning_effort 实际生效的日志/诊断反馈

---

## 需要用户确认的现象

在继续深入分析前，请确认以下现象以校准分析方向：

### 问题一确认
1. 修改工程目录路径后，刷新页面（F5），路径是否还原为默认 `~/coolzhuagent`？
2. 修改路径后，新建的会话是否仍然出现在旧路径的会话列表中？
3. 修改路径后，插件和 Skill 工具列表是否不变？（预期不变——它们读的是 codex 仓库根）

### 问题二确认
4. "后端配置功能失效"具体表现为：
   - A) 保存会话后刷新页面，base_url/endpoint/reasoning_effort 字段恢复默认值？
   - B) 保存成功但 LLM 调用仍然使用默认 provider 而非自定义端点？
   - C) 保存操作本身报错？
   - D) SQLite 数据库文件损坏或无法读取？
5. 是否仅在设置了自定义 endpoint（但未设置 base_url）时失效？还是同时设置了 base_url 也失效？
6. 思考程度设置为"高"或"超高"后，LLM 回复质量是否有可感知的变化？
