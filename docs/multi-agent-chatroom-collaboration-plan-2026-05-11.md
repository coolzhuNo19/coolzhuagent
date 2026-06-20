# 聊天室多 Agent 协作方案（Roster / @寻址 / 任务流转）

文档版本：v1.0  
创建日期：2026-05-11  
关联需求：`REQ-WEB-CHAT-007`（多 agent 互相感知 + 指令驱动流转，新增；P1）  
依赖：`REQ-WEB-SESSION-001 ~ 007`（会话 CRUD / 持久化 / 级联删除）、`REQ-WEB-CHAT-001 ~ 003`（真实 LLM 聊天室 / 多 agent 历史 / 回复引用转发）、`REQ-TOOL-007/008`（工具调用 + 审批闸门）、Phase A/B/C 已完成内容。

本文件**只出方案**，代码由后续 Phase D1/D2/D3 实现。

---

## 0. 场景与价值

用户持有 N 个已保存的会话（对象 A/B/C，每个有独立 provider/model/reasoning_effort/角色 prompt），希望在同一聊天室里让他们互相协作：

- **场景**：用户让 **A** 出「设计文档」→ A 写完后**主动**把成品发给 **B** 让 B 开发。
- **触发语义**：用户在 prompt 中写 `"设计 xx 方案文档后，将文档发给 B 通知 B 进行代码开发"` — LLM A 按约定的指令发起 handoff → B 接管。
- **现状差距**：
  - 已有 `target_agent_ids: Vec<String>` 支持一次消息送多 agent（REQ-WEB-CHAT-003），但每个 agent 独立生成回复，互不感知；
  - 没有 agent 间消息流转通道；
  - LLM 不知道"其它 agent 存在"，自然不会发起 handoff。

本方案让用户在聊天室就能**声明角色分工**，并由 LLM 按约定在 agent 之间投递消息，形成可追踪、可撤销、有配额的任务链。

---

## 1. 核心概念

### 1.1 Agent Roster（花名册）

聊天室里"所有可选 agent"的汇总信息，由后端实时计算并随每次 chat dispatch 推给 LLM。字段：

```rust
pub struct AgentRosterEntry {
    pub id: String,            // session.id，LLM 寻址时用
    pub name: String,          // 会话名，用户可见
    pub display_name: String,  // UI 显示名
    pub provider: String,
    pub model: String,
    pub model_type: String,    // text / vision / video / audio / embedding
    pub role_summary: String,  // 从 system_prompt 抽摘要（前 140 char）
    pub enabled: bool,         // 停用 agent 仍在 roster 但 available=false
    pub available: bool,       // selectable && enabled && api_key_status != "missing"
    pub last_active_ms: u64,   // 聊天室内最近一次出声时间
}

pub struct AgentRoster {
    pub workspace_id: String,
    pub chat_room_id: String,
    pub generated_at: u64,
    pub me: String,                        // 当前生成 LLM 视角下的 self.id，避免自己 @ 自己
    pub peers: Vec<AgentRosterEntry>,      // 不含 self
    pub schema_version: u32,               // Phase D1 = 1
}
```

### 1.2 @寻址语法

LLM 在回复中可以写约定字符串让后端识别并投递消息到 peer。**两层语义**（由简到全）：

| 层 | 语法示例 | 适用场景 | 解析器 |
| --- | --- | --- | --- |
| L1 纯文本提示 | `"请 @B 开始开发"` | 用户、LLM 临时提及 | 正则扫 `@<name>` |
| L2 指令块 | <code>```handoff<br>to: B<br>intent: "按刚才的方案开发"<br>attach: last_assistant<br>```</code> | LLM 明确发起任务流转 | 解析 fenced code block，语言标签 `handoff` |
| L3 工具调用 | LLM 调 `chat.handoff(to, intent, attach)` | 与工具调用闸门同构、可审批 | `run_model_tool_dispatch` path B |

本方案**同时支持 L2 和 L3**：L2 用于无工具模型（只能输出文本）；L3 用于启用工具调用的 session（与 `REQ-TOOL-007` 审批链打通）。L1 仅在 UI 做高亮，不触发投递，避免"看上去 @了就发"的误解。

### 1.3 Handoff（交接）

一次 A → B 的消息投递单元：

```rust
pub struct HandoffInvoke {
    pub id: String,                    // handoff-<ms>-<rand>
    pub chat_room_id: String,
    pub from_agent_id: String,         // 发起方
    pub to_agent_id: String,           // 接收方
    pub intent: String,                // A 给 B 的任务描述（必填）
    pub attach: HandoffAttachment,     // 附带的前文消息
    pub originating_user_msg_id: String, // 最上游用户消息，用于防环
    pub depth: u8,                     // handoff 链深度（初始 0，每轮 +1）
    pub created_at: u64,
}

pub enum HandoffAttachment {
    /// 把 A 最后一条 assistant 消息整体附上
    LastAssistant,
    /// 把指定 message id 列表附上
    Explicit(Vec<String>),
    /// 不附上下文，仅 intent
    None,
}
```

### 1.4 任务链与防环

同一 `originating_user_msg_id` 下的 handoff 链构成一个任务链。规则：

- **`max_handoff_depth = 4`**（`coolzhu.toml [chat.collaboration] max_handoff_depth`）
- **去重**：同一 `(chat_room_id, from, to, intent_hash)` 1 分钟内只投递一次（防 LLM 抖动重发）
- **禁自环**：`from == to` 直接拒绝
- **禁回环**：链路中任一 hop 的 `to` 再出现即拒绝（`A→B→A` 不允许，需要用户发新消息才能重新启动）
- **配额**：同一 `originating_user_msg_id` 下 handoff 总数 ≤ `max_handoffs_per_turn = 8`

触发任一限制 → handoff 状态 = `Rejected { reason }`，在聊天室里显示一条系统消息，LLM 下一轮能看到失败原因。

---

## 2. 端到端流程

```
user: "设计 xx 方案文档后，将文档发给 B 通知 B 进行代码开发"
  └─ POST /api/chat/send[/stream]   target_agent_ids=[A]
      ├─ 后端生成 AgentRoster，注入 A 的 system prompt
      ├─ LLM A 生成 "设计文档 + handoff{to:B, intent:'按方案开发', attach:LastAssistant}"
      ├─ 后端扫出 handoff 指令：
      │   1) 校验 roster 中 B 存在且 available
      │   2) 校验 depth / 去重 / 配额
      │   3) 审批闸门（见 §5）
      │   4) 落 HandoffInvoke 到 handoff_chain 表 + audit jsonl
      │   5) 前端 SSE 推 `chat-handoff-fired`
      │   6) 自动给 B 发起 chat dispatch（target_agent_ids=[B], originating_user_msg_id=原始）
      ├─ B 收到 intent + attachment，继续 Tool Loop
      │    B 可继续 handoff 给 C（depth+1）
      └─ 任务链终止条件：
          - 任一 agent 返回纯 text 无 handoff
          - depth >= max_handoff_depth
          - 累计 handoff >= max_handoffs_per_turn
```

---

## 3. 数据契约

### 3.1 新 SQLite 表（Schema v3）

```sql
CREATE TABLE IF NOT EXISTS chat_handoffs (
    id                        TEXT PRIMARY KEY,
    chat_room_id              TEXT NOT NULL,
    from_agent_id             TEXT NOT NULL,
    to_agent_id               TEXT NOT NULL,
    intent                    TEXT NOT NULL,
    intent_hash               TEXT NOT NULL,   -- sha256(intent) 前 16 char，用于去重
    attach_kind               TEXT NOT NULL,   -- 'last-assistant' | 'explicit' | 'none'
    attach_refs               TEXT,            -- JSON array of message_id（attach_kind='explicit' 时）
    originating_user_msg_id   TEXT NOT NULL,
    depth                     INTEGER NOT NULL,
    status                    TEXT NOT NULL,   -- 'pending' | 'delivered' | 'rejected' | 'completed'
    rejected_reason           TEXT,
    created_at                INTEGER NOT NULL,
    delivered_at              INTEGER,
    completed_at              INTEGER,
    FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);
CREATE INDEX idx_handoffs_chain ON chat_handoffs(originating_user_msg_id, depth);
CREATE INDEX idx_handoffs_room  ON chat_handoffs(chat_room_id, created_at DESC);
```

Schema v2 → v3 升级：`apply_session_migration_v3()` 新增表 + 索引；`PRAGMA user_version=3`。旧库读数表不存在时返回空 roster / 空 handoff chain，不阻塞启动。

### 3.2 新 HTTP 端点

| Method | Path | 作用 |
| --- | --- | --- |
| `GET` | `/api/chat/rooms/{room_id}/roster` | 返回 `AgentRoster`；workspace + room 维度 |
| `GET` | `/api/chat/rooms/{room_id}/handoffs?since=&limit=` | 列出最近 handoff（审计/UI 展示） |
| `POST` | `/api/chat/rooms/{room_id}/handoffs/manual` | 用户手工触发 handoff（不经 LLM），body：`{from, to, intent, attach}` |
| `POST` | `/api/chat/rooms/{room_id}/handoffs/cancel` | 取消未投递的 handoff（pending 状态） |
| SSE 新事件 | `chat-roster-updated` | session 新增/删除/激活时广播，触发前端重拉 |
| SSE 新事件 | `chat-handoff-fired` | 一条 handoff 投递成功 |
| SSE 新事件 | `chat-handoff-rejected` | handoff 被闸门拒绝 |
| SSE 新事件 | `chat-handoff-completed` | 任务链 depth=0 的根 handoff 最终 completed |

### 3.3 `AgentRoster` 在 system prompt 中的嵌入

每次 LLM 请求（round 0）在 `build_agent_system_prompt` 末尾追加：

```
你是 COOLZHU AGENT 中的会话 Agent：<self.name>。
模型：<provider> / <model>
记忆 beads：
<bead-1>
...

# 聊天室协作（REQ-WEB-CHAT-007）
当前你的 agent_id = "<self.id>"，同房间的其它 agent：
- id="ag-b" name="B" role="全栈开发工程师" model="claude-opus-4.6"
- id="ag-c" name="C" role="测试工程师"     model="deepseek-reasoner"

你可以通过以下任一方式把消息转交给 peer（仅当用户明确要求你转交时使用；不要擅自转交）：

方式一（L2 文本块）：在回复末尾追加一个 fenced code block，语言标记 `handoff`：
```handoff
to: ag-b              # 或 to: B（会按 name fuzzy 匹配）
intent: 请按上面的方案开发
attach: last_assistant  # 可选：last_assistant / none / message_id:<id>,<id>
```

方式二（L3 工具调用，启用 `enable_llm_tools` 时可用）：
调用工具 `chat_handoff(to, intent, attach)`。

约束：depth ≤ 4；不要转给自己；不要转给未列出的 agent。
```

Prompt 注入控制：
- `chat.collaboration.enable_handoff = true`（默认 true）关闭时完全不追加，向后兼容老会话
- `chat.collaboration.prompt_verbosity = "full" | "compact" | "none"`；默认 `compact`（约 120 token）

---

## 4. 解析与执行

### 4.1 `parse_handoff_directives(assistant_text) -> Vec<HandoffDirective>`

纯函数，只解析不执行。两条路径：

1. **Fenced block**：正则 `` ```handoff\n(.*?)```/s ``；内部用宽松 key:value YAML 解析
2. **JSON block**：兼容 `` ```json\n{"handoff": {...}}\n``` ``，给倾向 JSON 的模型用

容错：
- `to:` 允许 `<id>` 精确、`<name>` 按花名册 fuzzy 匹配（大小写不敏感、首次命中）
- 未匹配到 → `HandoffDirective { resolved_to: None, raw_to: "xxx" }` → 路由时拒绝并解释
- `attach:` 默认 `last_assistant`

### 4.2 `chat_handoff` 工具（REQ-TOOL-007 家族扩展）

与 §1.2 L3 对应。新 `ToolSpec`：

```rust
ToolSpec {
    name: "chat_handoff",
    description: "将当前聊天室内的任务交接给另一个 peer agent。仅在用户明确要求转交时使用。",
    input_schema: json!({
        "type": "object",
        "properties": {
            "to":     {"type": "string", "description": "peer 的 id 或 name"},
            "intent": {"type": "string", "description": "你希望 peer 做什么"},
            "attach": {"type": "string", "enum": ["last_assistant", "none", "message_ids"]},
            "attach_message_ids": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["to", "intent"]
    }),
    required_permission: PermissionMode::WorkspaceWrite,  // 与聊天室同级 write 权限
}
```

由 `run_model_tool_dispatch` path B 走 runtime，落 `tool-audit.jsonl`。工具 handler 构造 `HandoffInvoke` 并调度 `chat_dispatch_handoff()`。

### 4.3 投递执行 `chat_dispatch_handoff(invoke) -> HandoffOutcome`

```
1. 权限闸门（§5）+ 防环 + 配额校验
2. 校验 to_agent_id 在 roster 里 available
3. 事务写入 chat_handoffs (status='pending')
4. 构造 B 的 inbound ChatMessageDto：
     role='user', author='@<from.name> via handoff', target=<to.display_name>,
     content = "[来自 <from.name> 的任务]\n" + intent + "\n\n[附带上下文]\n" + attach_text
5. 模拟一次 "target_agent_ids=[to]" 的 chat dispatch
     共享 originating_user_msg_id / depth+1 / 继承 audit trace id
6. LLM B 响应后，按相同 parse_handoff_directives 提取可能的下一跳
7. 更新 handoff status='delivered', delivered_at=now()
```

**SSE 推事件时机**：
- 第 3 步成功 → `chat-handoff-fired`
- 第 5 步 B 响应完成 → `chat-handoff-completed`（depth=0 根节点才发 completed）
- 任一校验失败 → `chat-handoff-rejected`

---

## 5. 权限与审批

Handoff 是消息跨 agent 投递，**视为 `WorkspaceWrite` 档操作**（不碰文件系统但改聊天室状态）。4 级闸门映射：

| 场景 | Decision | 行为 |
| --- | --- | --- |
| 同 workspace 且 `roster.target.available = true` 且未触发防环 | `AllowAuto` | 直接投递 |
| `target.available = false`（api_key 缺失/disabled） | `Deny` | rejected，SSE 告知 |
| 单轮 handoff 数 > `max_handoffs_per_turn` | `Deny` | rejected |
| depth > `max_handoff_depth` | `Deny` | rejected |
| `chat.collaboration.require_handoff_approval = true`（默认 false） | `RequireApproval` | 进 pending，复用 Phase C-2 `PendingApprovals` + SSE `tool-permission-required`（特殊 `kind="chat-handoff"`） |

复用既有 `PendingApprovals / api_tools_approve / api_tools_reject`：新增 `call_id = handoff.id`，`tool_name = "chat_handoff"`，前端面板无需改代码。

---

## 6. 前端

### 6.1 Roster 感知

- 聊天室顶部新增"成员条"：头像列表，`available=false` 用灰度；点击成员卡显示 role_summary + model
- 订阅 SSE `chat-roster-updated` 自动刷新（会话新增 / 删除 / 激活 active_session_id 变更都触发）
- 会话 CRUD（POST/PUT/DELETE `/api/sessions`）后端在 `persist_session_state` 后主动广播

### 6.2 消息流渲染

| 类型 | 渲染 |
| --- | --- |
| 正常 `assistant` | 保持不变 |
| assistant 回复内包含 handoff 指令 | 尾部挂"→ 已转交给 **B**"徽章；点击定位到 handoff 详情抽屉 |
| 系统生成的 `handoff_inbound` 消息 | `author="@A via handoff"`，带虚线左边框，显示 `from.name → to.name (depth=k)` |
| 系统生成的 `handoff_rejected` 消息 | 红底；显示 reason |

### 6.3 任务链抽屉

侧边"任务链"tab：按 `originating_user_msg_id` 聚合，树形展示 A → B → C 的 hops、耗时、status。可点击节点跳回聊天流对应消息。

### 6.4 手工流转按钮

消息选中后可点"转交" → 弹出对话框选 peer + 写 intent → 调 `POST /api/chat/rooms/{id}/handoffs/manual`。用于用户"我决定让 B 接手"的显式动作。

---

## 7. 配置（`coolzhu.toml`）

```toml
[chat.collaboration]
enable_handoff = true            # 关闭后 roster/parse/dispatch 全部跳过
prompt_verbosity = "compact"     # full | compact | none
max_handoff_depth = 4
max_handoffs_per_turn = 8
handoff_dedup_window_secs = 60   # 同 intent_hash 60s 内去重
require_handoff_approval = false # true 时每次 handoff 进审批面板
allow_name_fuzzy_match = true    # false 则 to 必须是精确 id
```

未写段时用这里的默认值；`enable_handoff=false` 视为完全未启用该特性。

---

## 8. 审计与诊断

- **审计**：每次 handoff invoke/deliver/reject/complete 都写一行到 `.coolzhu/tool-audit.jsonl`（caller=`collab`，tool_name=`chat_handoff`），复用 Phase C-6 日志通道；前端审计表格自动可见
- **诊断**：`/api/diagnostics/health` 补 `chat_collaboration` 子检查：
  - `roster_generation_works`（给定 active room 能生成非空 roster）
  - `handoff_dedup_window` 常量值回显
  - `max_depth / max_per_turn` 回显
- **`/api/chat/rooms/{id}/handoffs?limit=N`**：handoff 查询端点，前端任务链抽屉消费

---

## 9. 分阶段落地计划

| Phase | 范围 | TDD 数 | 备注 |
| --- | --- | --- | --- |
| **D1** Roster 契约 + `/roster` 端点 + SSE `chat-roster-updated` | 不改 LLM 路径 | 4 | 零回归风险 |
| **D2** system prompt 注入 + `parse_handoff_directives` + 任务链表 | Schema v3 + 解析器 | 6 | 只生成 directive，不投递 |
| **D3** `chat_dispatch_handoff` 投递 + 闸门 + SSE 新事件 | 真实跨 agent 调度 | 8 | 核心闭环 |
| **D4** 前端成员条 + 消息流渲染 + 任务链抽屉 | 纯前端 | 0（+ node --check） | 手工验收 |
| **D5** `chat_handoff` 工具 + 审批模式（require_handoff_approval=true）| 工具调用路径 | 4 | 与 REQ-TOOL-007 对齐 |

每阶段独立 commit + 备份 + work-log。

---

## 10. TDD 矩阵（示例）

| 阶段 | 测试 | 断言 |
| --- | --- | --- |
| D1 | `roster_endpoint_lists_peers_excluding_self` | 聊天室 3 agent → `GET /roster` 对每个 me 返回 2 个 peer |
| D1 | `roster_marks_disabled_agents_as_unavailable` | disabled/缺 key 的 agent `available=false` |
| D1 | `session_delete_broadcasts_chat_roster_updated` | `DELETE /api/sessions/:id` 后 SSE 收到 `chat-roster-updated` |
| D2 | `parse_handoff_fenced_yaml_basic` | `to: B\nintent: foo` → Directive{raw_to="B", intent="foo", attach=LastAssistant} |
| D2 | `parse_handoff_fenced_yaml_invalid_is_skipped` | 破损块不 panic，返回空 |
| D2 | `resolve_raw_to_fuzzy_matches_name_case_insensitive` | roster 有 "B-dev" → raw_to="b-DEV" 命中 |
| D3 | `handoff_self_loop_rejected` | from==to → Deny |
| D3 | `handoff_depth_exceeds_max_rejected` | depth=4 再转 → Deny |
| D3 | `handoff_cycle_detected` | A→B→A → Deny |
| D3 | `handoff_per_turn_quota_enforced` | 同 user_msg 根 8 次后 Deny |
| D3 | `handoff_dedup_window_blocks_repeat` | 同 intent_hash 60s 内第 2 次 Deny |
| D3 | `handoff_delivers_and_runs_target_chat_dispatch` | A 发 handoff → B 生成回复 → audit 两条 |
| D3 | `handoff_audit_jsonl_entry_format` | 写入 `tool-audit.jsonl`，caller="collab" |
| D5 | `chat_handoff_tool_requires_workspace_write` | bash path 外 → RequireApproval |
| D5 | `chat_handoff_tool_enqueues_pending_when_flag_on` | `require_handoff_approval=true` → pending 队列 |

---

## 11. 风险与回滚

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| LLM 以为"每次都要转交"刷爆任务链 | 中 | `max_handoff_depth=4` + `max_handoffs_per_turn=8` 硬闸门；prompt 明确"仅用户要求时转交" |
| Prompt 注入让上下文膨胀 | 低 | `prompt_verbosity="compact"` 默认；roster 只送 `id/name/role/model`，role_summary 140 char 截断 |
| A/B 循环对聊 | 低 | depth + cycle 检测；且 handoff 不会把 `attach` 自动外带到下下跳（每跳只能看到前一跳的 intent + attach） |
| 用户误操作导致 handoff 扩散到私密会话 | 中 | roster 只含**当前聊天室**挂接的 agent（见 §12）；删除 agent 立刻从 roster 移除 |
| 前端成员条刷新抖动 | 低 | `chat-roster-updated` 事件内含 `generated_at`，前端按递增值去重 |
| 回滚 | — | `enable_handoff=false` 一行配置即全禁；schema v3 新表不影响 v2 读路径 |

---

## 12. Roster 范围规则

**关键决策**：roster 只含「当前 chat_room 已出现过 或 被 active_session_id 指向」的 agent，不把 workspace 下所有保存会话都塞进来。原因：

- 用户可能在同一 workspace 保存 20+ 会话；全量 roster 让 prompt 爆炸
- 清晰的"房间成员"心智：加入 / 退出由"在聊天室发过消息"或"被用户 Invite"驱动

补一个手工加入 API：`POST /api/chat/rooms/{id}/members` body `{session_id}`。删除对偶 `DELETE .../members/{session_id}`。初始 roster 来自已有消息的 `target_agent_ids` 去重聚合。

---

## 13. 下一任 agent 提醒

1. Phase D1 开工前先跑通 `GET /api/chat/rooms/{id}/roster` 的 TDD；此端点 stub 可以先返回所有 active session 的 agent，不急着实装成员表
2. `parse_handoff_directives` 是**纯函数**，放 `modules/core-runtime/packages/core-runtime/src/collab.rs`（新模块）；web-console 只做 HTTP shell
3. `chat_dispatch_handoff` 必须走 `runtime_tool_execute` 才能复用审批 + 审计链；不要绕过闸门直连 `run_tool_dispatch`
4. Prompt 注入必须**可关**（`prompt_verbosity="none"`）；老测试里不带 roster 的 system prompt 不能失败
5. `diag!` 前缀：`[COLLAB-ROSTER]` / `[COLLAB-HANDOFF]` / `[COLLAB-GATE]` / `[COLLAB-AUDIT]`
6. 所有新测试用 `config_test_guard()` 串行化（Phase C-5 已建立的锁）防并发污染

---

结论：本方案用"roster + @寻址 + handoff 调度 + 任务链防环"4 件套让 A/B/C 在聊天室里变成可编排的分工角色；与既有 tool/审批/审计链路完全复用，不引入新的权限模型。整体工作量约 5 个 D-phase，推荐串行落地。
