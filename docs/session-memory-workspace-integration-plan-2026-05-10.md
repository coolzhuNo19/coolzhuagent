# 会话 / 聊天室 / 记忆 / 工作区一体化管理方案

文档版本：v1.0  
创建日期：2026-05-10  
关联需求：`REQ-WEB-PROJECT-002`（已完成 - 需补丁）、`REQ-WEB-SESSION-007`（P1 待开发）、`REQ-MEM-001~005`（已完成 - 需扩容）、`REQ-WEB-CHAT-002/003`（已完成 - 需扩容）、`REQ-CORE-TOOL-001`（部分关联）  
交付对象：实现 agent（拿到文档即可开发）

---

## 1. 现状梳理

### 1.1 四者的当前数据关系

```
workspace (C:\Users\<u>\coolzhuagent)
├── coolzhu.toml                # 配置
├── .coolzhu/
│   ├── attachments/            # 二进制附件
│   └── web-sessions.sqlite3    # 会话/聊天室/bead 存储
└── ...                         # 用户工程代码

                    ┌────────────── workspace_id ──────────────┐
                    │  "ws-<16hex>"（由 workspace 路径哈希）     │
                    └──────────────────────────────────────────┘
                                       │
      ┌────────────────┬───────────────┴──────────────┬─────────────────┐
      ▼                ▼                              ▼                 ▼
  sessions        chat_rooms                  memory_beads       attachments (fs)
   (Agent)         (对话上下文)                (分层记忆)          (独立文件)
      │                │                              │                 │
      ├─ session_      ├─ chat_room_                  │                 │
      │  messages      │  messages                    │                 │
      │  (FK→sess)     │  (FK→room)                   │                 │
      │                │                              │                 │
      └─ FK→sessions   └─ FK→chat_rooms              FK→sessions
         CASCADE          CASCADE                     CASCADE
                                                      (但前端 UI 不触发)
```

### 1.2 代码实地状况（file:line 可验）

| 事项 | 状态 | 证据 |
| --- | --- | --- |
| SQLite `PRAGMA foreign_keys = ON` | ✅ | `web-console/src/main.rs:10036` |
| sessions / chat_rooms / 子表 ON DELETE CASCADE | ✅ 都已声明 | `main.rs:10080/10093/10106` |
| `DELETE /api/sessions/{id}` | ✅ 存在 | `main.rs:2458-2466` |
| **`DELETE /api/chat/rooms/{id}`** | ❌ **不存在** | 路由表仅 `GET/POST/activate` |
| **单条 room/session message 删除** | ❌ 不存在 | — |
| **单条 bead 删除** | ✅ 存在 | `main.rs:2593-2600` |
| workspace 切换是否重载 session 存储 | ❌ **不重载**：`SessionStore` 启动时 load，切换 workspace 后 in-memory 仍是旧 workspace 数据 | `main.rs:9193-9218` |
| LLM 请求是否带历史上下文 | ❌ **不带**：`messages: vec![InputMessage::user_text(prompt)]`，只发本轮 | `main.rs:7669-7696` |
| beads 注入 system prompt | ✅ 但固定取 8 条，无 token 预算、无相关性 | `main.rs:6257-6266`、`core-runtime/src/memory.rs:171-183` |
| 附件删除级联 | ❌ 文件系统孤儿，session/room 删了，`.coolzhu/attachments/*` 还在 | — |
| 自动记忆沉淀 | ✅ 去重+容量裁剪 | `main.rs:7395-7454` |
| `PRAGMA foreign_keys` 对 rewrite 生效？ | ⚠️ 注意：`delete_session` 走 in-memory retain + 全表重写（`save_session_state_to_sqlite`），**没有真正触发 SQL 的 `DELETE FROM sessions WHERE id=?` 闸门**，所以 CASCADE 在这条路径上等同于"全表重写时顺手删了"，单条写失败时不可恢复 | `main.rs:9590-9609`、`10485-10496` |

### 1.3 要解决的 8 个问题

1. **删除 API 残缺**：chatroom 没删除、session/room 内单条消息没删除、bead 有单条删除但无 UI 联动。
2. **删除不真正走 SQL CASCADE**：全表重写让 `FOREIGN KEY ... ON DELETE CASCADE` 不起作用、不可原子化。
3. **workspace 切换 → 记忆/会话数据错位**：同一进程内切换，SessionStore 不随动。
4. **附件孤儿**：session/room 删除不清理 `.coolzhu/attachments/` 对应文件。
5. **LLM 不带历史**：多轮对话完全靠 beads，beads 只是提取出的决策点，多轮细节丢失。
6. **beads 注入无 token 预算、无相关性**：固定 8 条，L4 filter，用户场景下可能塞无关记忆。
7. **记忆模块没有"选 k 最相关"**：`select_prompt_memory_beads` 只按静态排序（pin > layer > confidence > recency），不看当前 query。
8. **删除消息不回收相关 beads**：REQ-MEM-003 自动沉淀是 append-only，消息被删但它衍生的 bead 还在。

---

## 2. 目标架构（三合一 + 一体删除 + 智能上下文）

```
┌─────────────────────────────────────────────────────────────┐
│              WorkspaceScope（新：唯一边界）                  │
│  workspace_path   →  canonical_id (ws-<16hex>)              │
│  store_root       →  active_workspace_path()/.coolzhu/      │
│  sqlite_path      →  <store_root>/web-sessions.sqlite3      │
│  attachment_root  →  <store_root>/attachments/              │
│  audit_path       →  <store_root>/computer-use-audit.jsonl  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼  workspace 切换 → reload_scope()
┌─────────────────────────────────────────────────────────────┐
│              SessionStoreHandle（新：一仓一例）              │
│  • 切换 workspace 时 swap 整个 handle                         │
│  • 内部 SQLite 连接独立，rename 原子                          │
│  • 所有删除走 SQL DELETE（CASCADE 真正生效）                  │
│  • 每次删除后扫描 attachment_root 做 GC                       │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────────┐
            ▼               ▼                   ▼
      Sessions (Agent)  ChatRooms          MemoryBeads
            │               │                   │
            │ CASCADE       │ CASCADE           │ CASCADE / ORIGIN
            ▼               ▼                   ▼
      session_msgs     room_msgs           beads (FK→sessions, FK→origin_message_id)

                            │
                            ▼  每轮对话前
┌─────────────────────────────────────────────────────────────┐
│         ContextBuilder（新：智能上下文装配）                  │
│  输入：current_prompt + session_id + room_id + model_limits  │
│  输出：MessageRequest.messages = [sys, hist..., user]        │
│  策略：                                                      │
│   1) 近程窗口：最近 N 轮消息（按 token 预算从后往前截）         │
│   2) 远程召回：基于当前 prompt 对 beads 做 BM25 + 相关性排序    │
│   3) 总预算：model.context_window * 0.6，留给 output 40%      │
│   4) 分段打印：system(beads) + user/assistant turns + user    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据契约调整

### 3.1 SQLite schema 增量（版本 2）

在 `main.rs:10051` 附近用 `ensure_session_column` / `ALTER TABLE` 升级：

```sql
-- 新增：bead 归因原始消息，用于"删消息 → 连带删 bead"
ALTER TABLE memory_beads ADD COLUMN origin_message_id TEXT NULL;
ALTER TABLE memory_beads ADD COLUMN origin_table TEXT NULL;   -- 'session_messages' | 'chat_room_messages'
ALTER TABLE memory_beads ADD COLUMN token_count INTEGER NULL; -- 估算值，用于 budget

-- 新增：room ↔ attachments 关联（目前靠 JSON 字段判断）
CREATE TABLE IF NOT EXISTS attachment_refs (
    id           TEXT PRIMARY KEY,
    message_id   TEXT NOT NULL,
    message_tbl  TEXT NOT NULL CHECK (message_tbl IN ('session_messages','chat_room_messages')),
    file_name    TEXT NOT NULL,             -- 对应 .coolzhu/attachments/<file_name>
    byte_size    INTEGER NOT NULL,
    created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attach_message ON attachment_refs(message_id);
CREATE INDEX IF NOT EXISTS idx_attach_filename ON attachment_refs(file_name);

-- 新增：FTS5 虚表用于 beads 召回（REQ-MEM-004 升级）
CREATE VIRTUAL TABLE IF NOT EXISTS beads_fts USING fts5(
    summary,
    kind,
    source,
    tokenize = "unicode61 remove_diacritics 2"
);
-- 触发器在 beads insert/update/delete 时自动同步到 beads_fts
```

- 升级通过现有 `ensure_session_column` 扩展；为了幂等，把 migration 脚本写到 `main.rs` 里一个 `apply_migration_v2()` 函数，`PRAGMA user_version` 控制。
- FTS5 是 SQLite 内置模块，`rusqlite` 需要启用 `features=["bundled-sqlcipher"]` 或保持当前 `bundled` + `fts5` feature；**检查 Cargo.toml 现有 feature 标志**并补 `fts5` 如果缺。

### 3.2 schema_version

```rust
const SESSION_SCHEMA_VERSION: u32 = 2;

fn apply_migrations(conn: &Connection) -> rusqlite::Result<()> {
    let current: u32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if current < 1 { migration_v1(conn)?; }
    if current < 2 { migration_v2(conn)?; }
    conn.execute_batch(&format!("PRAGMA user_version = {}", SESSION_SCHEMA_VERSION))?;
    Ok(())
}
```

`REQ-PACK-005`（升级回滚）的 schema 版本化承诺由此落地。

### 3.3 新/改 REST endpoint

| Method | Path | 作用 | 归属 REQ |
| --- | --- | --- | --- |
| `DELETE` | `/api/chat/rooms/{room_id}` | 删除 chatroom（CASCADE 消息；级联扫附件 GC；级联 bead 回收） | **新**：REQ-WEB-SESSION-007 |
| `DELETE` | `/api/chat/rooms/{room_id}/messages/{msg_id}` | 单条 room 消息删除；级联衍生 bead | **新**：REQ-WEB-SESSION-007 |
| `DELETE` | `/api/sessions/{sid}/messages/{msg_id}` | 单条 session 消息删除；级联衍生 bead | **新**：REQ-WEB-SESSION-007 |
| `POST` | `/api/workspace/reload` | 显式重载 workspace 数据（workspace 切换后调用） | **新**：REQ-WEB-PROJECT-002 补丁 |
| `GET` | `/api/sessions/{sid}/context-preview?room_id=&prompt=` | 预览当前轮会发给 LLM 的 messages + token 估算 | **新**：调试用 |
| `POST` | `/api/sessions/{sid}/beads/purge` | 按 query/layer/time 批删 bead | **新**：治理用 |
| `GET` | `/api/attachments/gc/preview` | 返回孤儿附件文件清单 | **新**：运维 |
| `POST` | `/api/attachments/gc/run?dry_run=true` | 执行孤儿附件清理 | **新**：运维 |

### 3.4 配置扩展 `coolzhu.toml`

```toml
[context]
# LLM 请求组装策略
window_turns = 12                 # 最近若干轮完整消息（含 user+assistant）
window_token_budget = 6000        # 近程窗口 token 上限
memory_token_budget = 1500        # 远程 bead 召回 token 上限
token_per_char_fallback = 0.5     # 估算：字符数 × 系数（中文均值）；后续替换真 tokenizer
output_reserve_ratio = 0.4        # 给 output 保留的比例
relevance_k = 8                   # bead 召回数量上限（FTS5 初筛）
relevance_min_score = 0.05        # BM25 最低阈值

[attachment]
gc_orphan_after_secs = 86400      # 孤儿附件超过 24h 才清理
gc_dry_run_by_default = true
```

---

## 4. WorkspaceScope：唯一边界（补 REQ-WEB-PROJECT-002）

### 4.1 核心类型

```rust
pub struct WorkspaceScope {
    pub workspace_path: PathBuf,
    pub workspace_id: String,
    pub store_root: PathBuf,          // .coolzhu
    pub sqlite_path: PathBuf,
    pub attachment_root: PathBuf,
    pub audit_path: PathBuf,
    pub config: ConfigModel,          // 冻结快照：创建 scope 时加载
}

static ACTIVE_SCOPE: OnceLock<RwLock<Arc<WorkspaceScope>>> = OnceLock::new();

pub fn active_scope() -> Arc<WorkspaceScope> { /* ... */ }
```

### 4.2 切换流程

`POST /api/workspace` 改造后：

```
1) 校验 path 在 allowed_roots
2) canonicalize；生成新 workspace_id
3) 若与当前相同 → 直接返回
4) 构造新 WorkspaceScope（读新 coolzhu.toml、创建目录、打开新 SQLite）
5) 旧 SessionStore.flush() 并 close
6) 原子替换 ACTIVE_SCOPE
7) 启动新的 SessionStoreHandle
8) 清掉 chat SSE pending state（发事件通知前端刷新）
9) 返回新 workspace + identity
```

**关键点**：步骤 6 是原子 `RwLock::write()`，期间所有 in-flight 请求要么用旧 scope 跑完要么排队；不允许"一半请求看新 scope、一半看旧"。

### 4.3 SSE 事件

新事件 `workspace-changed`：

```json
{ "event": "workspace-changed", "workspace_id": "ws-newhex",
  "path": "C:\\Users\\u\\proj2", "reload_required": ["sessions","rooms","agents","attachments"] }
```

前端监听该事件后自动 `GET /api/sessions`、`GET /api/chat/rooms`、`GET /api/agents` 重绘。

---

## 5. 删除闭环（REQ-WEB-SESSION-007 落地）

### 5.1 统一删除流水线

所有 delete API 底层走同一个 `cascade_delete(target)` 函数：

```rust
pub enum DeleteTarget {
    Session(String),
    ChatRoom(String),
    SessionMessage { session_id: String, message_id: String },
    RoomMessage { room_id: String, message_id: String },
    Bead { session_id: String, bead_id: String },
}

pub struct DeleteReport {
    pub deleted_rows: HashMap<&'static str, usize>,  // 每表删除计数
    pub purged_beads: Vec<String>,                   // 连带删的 bead id
    pub gc_attachments: Vec<String>,                 // 计划中的孤儿附件
    pub gc_run: bool,                                // 是否真删
}

pub async fn cascade_delete(target: DeleteTarget, opts: DeleteOptions) -> DeleteReport;
```

### 5.2 事务化 SQL 删除（不再全表重写）

以 `DeleteTarget::ChatRoom(room_id)` 为例：

```sql
BEGIN IMMEDIATE;
  -- 先记下牵涉的 attachment_refs（稍后 GC）
  INSERT INTO _pending_gc_attachments
    SELECT file_name FROM attachment_refs
    WHERE message_tbl='chat_room_messages'
      AND message_id IN (SELECT id FROM chat_room_messages WHERE room_id=?1);

  -- 连带删衍生 bead（origin_table=chat_room_messages）
  DELETE FROM memory_beads
  WHERE origin_table='chat_room_messages'
    AND origin_message_id IN (SELECT id FROM chat_room_messages WHERE room_id=?1);

  -- 删 room（messages 通过 FK CASCADE 自动删）
  DELETE FROM chat_rooms WHERE id=?1;
COMMIT;
```

`memory_beads.origin_table` 不能做 SQL FK（两个可能的父表），所以用 trigger + explicit delete 覆盖：

```sql
CREATE TRIGGER IF NOT EXISTS trg_room_msg_cascade_beads
AFTER DELETE ON chat_room_messages
BEGIN
  DELETE FROM memory_beads
  WHERE origin_table='chat_room_messages' AND origin_message_id=OLD.id;
END;
```

session 消息同理。这样无论前端走批量删 room 还是单条删 message，bead 都会跟着走。

### 5.3 附件 GC

`attachment_refs` 表被 CASCADE 清空后，`file_name` 可能仍被别的消息引用。流程：

1. 事务内把要检查的 `file_name` 插到 `_pending_gc_attachments`（临时表）。
2. 事务结束后，异步任务：
   ```sql
   SELECT file_name FROM _pending_gc_attachments
   WHERE file_name NOT IN (SELECT file_name FROM attachment_refs);
   ```
3. 对每个孤儿 `file_name`：判断创建时间 `< now - gc_orphan_after_secs`，再物理删除 `.coolzhu/attachments/<file_name>`。
4. `_pending_gc_attachments` 清空。

**安全阀**：`POST /api/attachments/gc/run?dry_run=true` 默认预览；生产环境由用户显式触发 `dry_run=false`，避免误删。

### 5.4 前端确认 UI

- 删除 chatroom：二级弹窗 `"确认删除聊天室 <name>？这会连带删除 <n> 条消息和 <k> 条记忆 bead。"`（数字由 `GET /api/chat/rooms/{id}/impact` 预览返回）。
- 删除单条消息：一级确认 `"删除这条消息？"`，点确认后发 DELETE。删除 assistant 消息时提示"衍生记忆将一并删除"。
- 删除 bead：一级确认 `"删除这条记忆？"`。
- 所有确认弹窗在前端走同一个组件 `confirmCascadeDelete({title, impact, on_confirm})`，impact 走 `GET /api/.../impact` 预览。

### 5.5 `/api/workspace/reload` 的一致性

workspace 切换会让"删除请求"刚好打到旧 scope，切换完在新 scope 下又"看到没删"。解决办法：

- `cascade_delete` 开始时读 `Arc::clone(ACTIVE_SCOPE)`，整个事务都用这份 Arc；workspace 切换只 swap root，不 drop 还在用的 Arc。
- 新请求拿到的是新 scope，所以不会越权访问旧数据库（旧 Arc 被释放后 SQLite 连接一起关）。

---

## 6. LLM 上下文注入（REQ-MEM-004 升级）

### 6.1 当前不足

- `agent_message_request_with_images` 只发当前 user turn；上下文全靠 system prompt 里 8 条静态 bead。
- 多轮对话的细节（用户让改的具体 bug、工具执行结果、刚刚引用的代码片段）完全丢失。
- Beads 选择不看 query，相关性为 0。

### 6.2 新装配流程 `ContextBuilder`

```rust
pub struct ContextRequest<'a> {
    pub session: &'a PersistedSession,
    pub room_id: Option<&'a str>,
    pub current_user_text: &'a str,
    pub attachments: &'a [AttachmentRef],
    pub model_limits: ModelLimits,   // context_window, max_output_tokens
    pub config: &'a ConfigContext,
}

pub struct ContextAssembly {
    pub system: String,
    pub messages: Vec<InputMessage>,
    pub beads_used: Vec<MemoryBeadRef>,
    pub history_turns: usize,
    pub estimated_tokens: TokenBreakdown,
    pub truncated: bool,
}

pub fn build_context(req: ContextRequest) -> ContextAssembly;
```

### 6.3 三段式装配

```
┌────────────────── system ──────────────────┐
│  agent.system_prompt                       │
│  [Workspace] ws-xxxx, path=...             │
│  [Memory beads (high-relevance)]           │
│   - [L1, score=0.72] 用户偏好 tail call   │
│   - [L2, score=0.61] 决策: 用 FTS5 做召回  │
│   ...                                      │
└────────────────────────────────────────────┘
┌──────────── history (ordered) ─────────────┐
│  user:    前一轮                            │
│  asst:    前一轮                            │
│  user:    更早                              │
│  ...（在 window_token_budget 内最近 N 轮）   │
└────────────────────────────────────────────┘
┌──────────── current user turn ─────────────┐
│  user: current_user_text (含 image_urls)   │
└────────────────────────────────────────────┘
```

### 6.4 token 预算分配

`ModelLimits.context_window` 来自 `llm-adapter` 的模型元数据（扩展一份 `model_catalog.rs` 静态表，缺失时给 8192 默认值）。

- `output_budget = context_window * output_reserve_ratio`（config 默认 0.4）
- `input_budget = context_window - output_budget`
- `system_budget = 1200`（agent system prompt）
- `memory_budget = memory_token_budget`（默认 1500）
- `window_budget = min(window_token_budget, input_budget - system_budget - memory_budget - current_user_tokens)`

不足时的策略：
1. 先裁 history（保最新）。
2. 再裁 beads（按相关性从低到高删）。
3. agent system prompt 永远保留。
4. 极端情况下只保留 current user turn，记录 `truncated=true`，SSE 发 `context-truncated` 警告事件给前端展示"历史已截断"。

### 6.5 相关性召回（替代静态 top-8）

```
bead_candidates  = fts5_search(query=current_user_text, k=relevance_k, layer != L4)
scored           = [(b, bm25_score) for b in bead_candidates if bm25_score >= relevance_min_score]
scored          += pinned_beads(session)  # pin 永远进入
scored          += recent_beads(session, layer in [L1,L2], hours=2)  # 最新决策/偏好
ranked           = unique_by_id(scored).sort_by(pinned DESC, score DESC, layer_rank ASC)
chosen           = take_until_budget(ranked, budget=memory_budget)
```

`fts5_search` 用新 `beads_fts` 虚表 + `MATCH query_string`。如果 query 是空/太短（<3 字符），fallback 到现有静态排序以兼容。

### 6.6 历史窗口取数

```rust
fn fetch_window(room_id: &str, budget: u32) -> Vec<Message> {
    // 倒序取最近 N 轮
    let msgs = query_room_messages_desc_paginated(room_id, limit=window_turns*2);
    let mut picked = Vec::new();
    let mut used_tokens = 0;
    for m in msgs {
        let t = estimate_tokens(&m.text);
        if used_tokens + t > budget { break; }
        picked.push(m); used_tokens += t;
    }
    picked.reverse();
    picked
}
```

**成对截取原则**：如果一轮的 assistant 被截掉但它配对的 user 还在，保留；但如果 user 被截掉 assistant 还在，也要丢（避免让模型看到"凭空冒出来的回答"）。由 `pair_align()` 辅助函数负责。

### 6.7 tokenizer 估算

短期用字符数 × 系数（中文≈0.5 token/char，英文≈0.25，混合≈0.4）。接入 `llm-adapter` 提供的 provider-specific tokenizer 作为 trait：

```rust
pub trait TokenEstimator: Send + Sync {
    fn estimate(&self, text: &str) -> u32;
}
```

Anthropic 系给 `~0.29 tok/char`，DeepSeek 中文 `~0.55`，OpenAI 英文 `~0.25`。`llm-adapter` 根据 provider_kind 返回对应 estimator；缺省降级到 `CharCoefficient(0.4)`。

### 6.8 API 打通

改造 `agent_message_request_with_images`（`main.rs:7669`）：

```rust
async fn agent_message_request_with_images(
    agent: &AgentSessionDto, user_text: &str, image_urls: Vec<String>,
    session_id: &str, room_id: Option<&str>, tools: Option<_>, ...
) -> MessageRequest {
    let assembly = context_builder::build_context(ContextRequest{
        session: lookup_session(session_id)?,
        room_id, current_user_text: user_text, attachments: ...,
        model_limits: model_limits_for(&agent.provider, &agent.model),
        config: &active_scope().config.context,
    });
    diag!("[CTX] beads={}, turns={}, tokens≈{}, truncated={}",
          assembly.beads_used.len(), assembly.history_turns,
          assembly.estimated_tokens.total, assembly.truncated);

    MessageRequest {
        model: agent.model.clone(),
        max_tokens: output_budget_for(&agent.model),
        system: Some(assembly.system),
        messages: assembly.messages,   // now includes history + current turn
        tools, tool_choice, reasoning_effort, stream,
    }
}
```

`/api/sessions/{sid}/context-preview` 也调同一个 builder，方便前端调试。

---

## 7. 记忆自动沉淀补丁（REQ-MEM-003 扩容）

### 7.1 origin 归因

`persist_auto_memory_beads`（`main.rs:7395`）里每次 `add_memory_bead` 时额外填 `origin_message_id` 和 `origin_table`，让消息删除时能精准 CASCADE。

### 7.2 token 估算

沉淀 bead 时顺手估算 `token_count`，写入表；`select_prompt_memory_beads` 的预算分配用这个字段。

### 7.3 自动分层策略增强

当前 kind → layer 静态映射。补一条：`tool-summary` 如果 `status=Failed`（接 §REQ-TOOL-007 的 ToolOutcome）→ 降层到 L3（archive 即将），避免失败经验污染 prompt；`status=Ok` → L2（decision）。

### 7.4 去重签名

当前 `memory_bead_signature(layer,kind,source,summary)` 已存在，保留。补一个"语义重复"二级过滤：新 bead 如果与最近 20 条中有 `summary` BM25 分数 > 0.8，合并（追加 `evidence`，不新插）。

---

## 8. 文件级改动清单

### 步骤 S：Schema & Scope

| # | 文件 | 动作 |
| --- | --- | --- |
| S1 | `web-console/src/main.rs` | 实现 `apply_migration_v2`；`memory_beads` 扩 3 列 + `attachment_refs` + FTS5 + triggers |
| S2 | `web-console/src/main.rs` | 新 `WorkspaceScope` 结构 + `ACTIVE_SCOPE` 静态；把 `active_workspace_path`/`session_store` 改为 `active_scope().xxx` |
| S3 | `web-console/src/main.rs` `api_set_workspace` | 按 §4.2 流程重写；SSE 发 `workspace-changed` |
| S4 | `web-console/src/main.rs` | 新 endpoint `POST /api/workspace/reload` |
| S5 | `web-console/tests/workspace_switch_reload.rs` | 创建 ws-A 放 2 个 session → 切到 ws-B → `/api/sessions` 返回 ws-B 数据；切回 ws-A 数据仍在 |

### 步骤 D：删除闭环

| # | 文件 | 动作 |
| --- | --- | --- |
| D1 | `web-console/src/main.rs` 新建 `cascade_delete.rs` 模块 | `DeleteTarget/Options/Report`；SQL 事务实现 |
| D2 | `web-console/src/main.rs` | 新路由：`DELETE /api/chat/rooms/:id`、`DELETE /api/chat/rooms/:rid/messages/:mid`、`DELETE /api/sessions/:sid/messages/:mid` |
| D3 | `web-console/src/main.rs` `api_delete_session` / `api_session_delete_bead` | 改走 `cascade_delete`，去掉全表重写路径 |
| D4 | `web-console/src/main.rs` | Impact 预览路由：`GET /api/chat/rooms/:id/impact`、`GET /api/sessions/:sid/messages/:mid/impact` |
| D5 | `web-console/src/main.rs` | 附件 GC：`GET /api/attachments/gc/preview`、`POST /api/attachments/gc/run` |
| D6 | `app.js` + `index.html` + `styles.css` | `confirmCascadeDelete` 组件；挂接聊天室/消息/bead 菜单 |
| D7 | `web-console/tests/cascade_delete.rs` | 10 用例：见 §10 |

### 步骤 C：ContextBuilder

| # | 文件 | 动作 |
| --- | --- | --- |
| C1 | `core-runtime/src/context_builder.rs`（新） | `build_context`、`fetch_window`、`pair_align`、`TokenBreakdown` |
| C2 | `core-runtime/src/memory.rs` | `select_prompt_memory_beads_by_query(beads, query, &session_fts, budget_tokens)`；兼容旧签名作为 fallback |
| C3 | `llm-adapter/src/model_catalog.rs`（新） | 每个 provider_kind × model 的 `context_window/max_output/tok_per_char` |
| C4 | `web-console/src/main.rs:7669` | 改用 `context_builder::build_context`；diag |
| C5 | `web-console/src/main.rs` | 新 endpoint `GET /api/sessions/:sid/context-preview` |
| C6 | `web-console/src/main.rs` | 新 endpoint `POST /api/sessions/:sid/beads/purge` |
| C7 | `web-console/tests/context_assembly.rs` | 5 用例：预算分配、历史截断、成对对齐、pin 保留、低分 bead 淘汰 |

### 步骤 M：记忆沉淀补丁

| # | 文件 | 动作 |
| --- | --- | --- |
| M1 | `web-console/src/main.rs:7395 persist_auto_memory_beads` | 追加 `origin_message_id/origin_table/token_count` |
| M2 | `core-runtime/src/memory.rs` | 语义重复二级过滤 |
| M3 | `web-console/src/main.rs` | tool-summary 失败 → L3 |
| M4 | `core-runtime/tests/memory_origin_cascade.rs` | 删 assistant 消息 → 衍生 bead 自动清 |

### 步骤 F：文档 & 需求

| # | 文件 | 动作 |
| --- | --- | --- |
| F1 | `docs/requirements-management.md` | REQ-WEB-SESSION-007 → 测试中；REQ-WEB-PROJECT-002 标"补丁"；REQ-MEM-004 标"升级相关性召回"；新增 REQ-MEM-006（bead 归因）REQ-WEB-PROJECT-003（workspace reload） |
| F2 | `docs/interface-contracts.md` | 新增"删除流水线"、"上下文装配"两节 |
| F3 | `docs/work-logs/2026-05-1X-session-memory-integration.md` | 落地日志模板 |

---

## 9. 前端交互细化

### 9.1 聊天室面板

- 每个 chat_room 条目右侧加「⋮」菜单：`激活 / 重命名 / 删除`。
- 激活 = 旧路径 `POST /api/chat/rooms/:id/activate`。
- 删除 = `confirmCascadeDelete` + `DELETE /api/chat/rooms/:id`。
- 删除成功后用 SSE 推 `chat-room-deleted` 事件通知其它标签页。

### 9.2 消息项

- 悬浮显示「复制 / 删除」。删除要求区分：
  - 删 user 消息：提示"对应的 assistant 回复与衍生记忆也会被删除"→ 级联删 user 与其后第一个 assistant。
  - 删 assistant 消息：仅删自身 + 衍生 bead。
- 删除后本地列表立即移除，不等待网络（乐观更新），失败则回滚。

### 9.3 bead 面板

- 每条 bead 右侧「pin / 编辑 / 删除」。
- 新增"记忆治理"tab：按 layer 聚合、按 session 聚合、批删按钮 → 调 `/api/sessions/:sid/beads/purge`。

### 9.4 Context 预览

诊断卡片新增"上下文预览"按钮：调 `GET /api/sessions/:sid/context-preview?room_id=&prompt=<当前输入框内容>` → 展示：

```
system (1120 tok) + beads(6, 982 tok) + history(8 turns, 3021 tok) + user(342 tok) = 5465 tok
context_window=8192, output_reserved=3277, remaining=-550 ⚠
```

如果出现负数（超预算）用 ⚠ 标红，同时前端在发送前也做客户端一次 check。

---

## 10. 验收矩阵

| 层 | 用例 | 断言 |
| --- | --- | --- |
| 单元 | `cascade_delete_chat_room` | 删 room → messages 清零、衍生 bead 清零、attachment_refs 清零 |
| 单元 | `cascade_delete_session` | 删 session → session_messages、beads 全清；pin bead 也清 |
| 单元 | `cascade_delete_user_message_also_deletes_paired_assistant` | user 删了，它下一条 assistant 自动删 |
| 单元 | `cascade_delete_leaves_other_room_attachments` | 两个 room 共享同一附件文件，删其中一个 room，文件仍在 |
| 单元 | `workspace_switch_swaps_session_store` | `/api/sessions` 前后内容变化 |
| 单元 | `workspace_switch_is_atomic` | 切换期间并发请求要么旧要么新，从不混用 |
| 单元 | `context_builder_respects_token_budget` | context_window=4096 时 total ≤ 4096-reserve |
| 单元 | `context_builder_trims_history_not_pin_bead` | 超预算时 pin bead 保留，history 先截 |
| 单元 | `fts5_bead_recall_top_k_relevance` | query="视觉点击" 时返回的 beads 都含相关词；打分降序 |
| 单元 | `auto_bead_includes_origin_message_id` | 对话结束后产生的 bead `origin_message_id` 非空 |
| 单元 | `deleting_assistant_message_deletes_its_bead` | trigger 生效 |
| 契约 | `/api/workspace/reload` 返回 `{status:"ok", workspace_id}` | — |
| E2E | 删 room 弹窗 → 确认 → 列表刷新 + audit 日志一行 | 前后端联通 |
| E2E | LLM 多轮对话后 `context-preview` 能看到历史 | — |
| 手动 | workspace A 建 3 session → 切到 B → 切回 A，session 仍在 | 断言通过 |
| 手动 | 反复切换 workspace 100 次（脚本） | 无内存泄漏（RSS 平稳） |

---

## 11. 风险与回滚

1. **FTS5 迁移失败**：如果用户环境 SQLite 不含 FTS5 扩展，`apply_migration_v2` 回退到 "no-fts" 模式；`select_prompt_memory_beads_by_query` 自动降级到静态排序。配置键 `[context] use_fts5 = "auto"`（`auto | on | off`）。
2. **token 估算不准**：`CharCoefficient` 是粗估；可能导致超预算后被 provider 4xx。对此：request 前用 provider SDK 的 `count_tokens`（若支持）复核一次，超了再裁一次。provider 不支持时，用保守系数 `0.6`。
3. **级联删误伤**：Impact 预览是必须前置的；后端在 `cascade_delete` 里默认 `dry_run=false` 但接受 `?dry_run=true` query 参数，前端可按需走 dry_run 再 commit。审计日志记录所有 cascade_delete 的 deleted_rows。
4. **workspace 切换时 SSE 长连接**：旧 workspace 的 SSE 连接要 `close(code=4010)`，客户端自动重连后拿到新 scope 的数据。
5. **回滚**：`PRAGMA user_version=1` + 删除新列（用 `DROP TABLE attachment_refs + beads_fts`）即可回退到当前版本；但这会丢掉 `origin_message_id` 信息，回退脚本放 `modules/gui-web/resources/schema-rollback-v2-to-v1.sql`。

---

## 12. 实施顺序速览

```
S (schema + WorkspaceScope)
  → M (memory 沉淀补丁，立即受益于 origin)
  → D (cascade_delete 闭环 + 前端删除 UI)
  → C (ContextBuilder + FTS5 召回)
  → F (文档 & 需求更新)
```

完成后需求状态变更：

| REQ | 旧 | 新 |
| --- | --- | --- |
| REQ-WEB-SESSION-007 | 待开发 | 测试中 |
| REQ-WEB-PROJECT-002 | 已完成 | 已完成（+ reload 补丁） |
| REQ-MEM-003 | 已完成 | 已完成（+ origin + token_count） |
| REQ-MEM-004 | 已完成 | 已完成（+ FTS5 相关性召回） |
| REQ-MEM-006（新） | — | 测试中（bead origin 归因） |
| REQ-WEB-PROJECT-003（新） | — | 测试中（workspace 切换 reload） |
| REQ-WEB-CTX-001（新） | — | 测试中（LLM 历史上下文装配） |

---

## 13. 给后续 agent 的注意事项

1. **绝不可**在 `delete_session` / `delete_chat_room` 里做全表重写；一律 SQL 事务 + CASCADE + trigger。
2. **绝不可**让 `memory_beads.origin_*` 字段泄漏到 LLM context——这是内部审计字段，`render_prompt_memory_context` 不渲染它。
3. **绝不可**跳过 token 预算发 LLM 请求；即便 config 缺失也要兜底到 `CharCoefficient(0.5)` + `context_window=8192`。
4. workspace 切换是**全局事件**，涉及 session_store / attachment_root / audit_path / config 四份状态；任何"我只切一部分"的实现都是错的。
5. 所有 diag 前缀统一：`[WS-SCOPE]`、`[CASCADE]`、`[CTX]`、`[MEM-FTS]`、`[ATTACH-GC]`。
6. 前端 `confirmCascadeDelete` 是唯一删除入口，PR 审查时直接 `grep 'DELETE /api/chat/rooms' app.js` 应只在该组件内出现。
