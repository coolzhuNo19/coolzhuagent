# 微信群成员识别与操作授权 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有“微信连接”窗口和 iLink gateway 上实现事件驱动的微信群发现、操作管理员认领、群成员角色授权、群命令与可审计清理闭环。

**Architecture:** iLink provider 只负责把官方字段标准化；Rust gateway 以 SQLite 为群、已识别成员、私聊联系人和操作管理员的事实来源。群消息进入现有 preview/dispatch 前先完成身份观察，再由“操作管理员或成员角色 × 聊天室授权”统一判定；前端只调用受约束 API，不自行推导权限。现有 `ClawbotConversationBinding` 继续兼容私聊，群记录保存权威路由副本，使退群清理可在 SQLite 事务内撤销路由、成员授权和待发消息。

**Tech Stack:** Rust、Axum、rusqlite、serde、原生 JavaScript/HTML/CSS、Node.js ESM 测试、Tauri/WebView2、Computer Use。

---

## 文件结构与责任

- 新建 `modules/gui-web/packages/web-console/src/wechat_group.rs`：群、联系人、操作管理员、生命周期、观察结果与 mention 判定等领域类型；不直接访问数据库。
- 修改 `modules/gui-web/packages/web-console/src/wechat_authorization.rs`：角色能力矩阵及统一鉴权；普通成员只允许 `none/chat_member/operator`，管理员由账号级绑定计算。
- 修改 `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`：SQLite 表、事件观察、管理员认领、群查询、成员角色更新和事务清理。
- 修改 `modules/gui-web/packages/web-console/src/clawbot_channel.rs`：允许 gateway 为群消息注入权威绑定，并补充群命令映射。
- 修改 `modules/gui-web/packages/web-console/src/wechat_command.rs`：注册 `/members`、`/member`、`/group current`、`/group detach`。
- 修改 `modules/gui-web/packages/web-console/src/main.rs`：API、入站观察、鉴权、命令执行和前端契约测试。
- 修改 `scripts/lib/clawbot-ilink-message.mjs` 与 `scripts/test-clawbot-ilink-message.mjs`：兼容官方 `group_id + from_user_id` 群身份。
- 修改 `modules/gui-web/packages/web-console/index.html`、`src/app.js`、`src/styles.css`：“微信连接”管理员、已加入群和已识别成员管理区。

## Task 0：建立可回滚基线

**Files:**
- Create: `tmp/backups/wechat-group-auth-20260705/`
- Inspect: `modules/gui-web/packages/web-console/`
- Inspect: `scripts/lib/clawbot-ilink-message.mjs`

- [ ] **Step 1: 记录两个 Git 工作区的基线状态**

Run:

```powershell
git status --short | Set-Content -Encoding utf8 tmp/analysis-wechat-group-root-status.txt
git -C modules/gui-web status --short | Set-Content -Encoding utf8 tmp/analysis-wechat-group-gui-status.txt
```

Expected: 两份记录存在；不得清理或覆盖其中已有改动。

- [ ] **Step 2: 备份本轮将修改的源码**

Run:

```powershell
$dst = 'tmp/backups/wechat-group-auth-20260705'
New-Item -ItemType Directory -Force "$dst/scripts/lib", "$dst/scripts", "$dst/web-console/src" | Out-Null
Copy-Item scripts/lib/clawbot-ilink-message.mjs "$dst/scripts/lib/"
Copy-Item scripts/test-clawbot-ilink-message.mjs "$dst/scripts/"
Copy-Item modules/gui-web/packages/web-console/src/wechat_authorization.rs "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/src/clawbot_gateway.rs "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/src/clawbot_channel.rs "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/src/wechat_command.rs "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/src/main.rs "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/index.html "$dst/web-console/"
Copy-Item modules/gui-web/packages/web-console/src/app.js "$dst/web-console/src/"
Copy-Item modules/gui-web/packages/web-console/src/styles.css "$dst/web-console/src/"
```

Expected: 备份路径仅位于已忽略的 `tmp/`，不进入安装包或 Git 提交。

## Task 1：修复 iLink 官方群身份标准化

**Files:**
- Modify: `scripts/test-clawbot-ilink-message.mjs`
- Modify: `scripts/lib/clawbot-ilink-message.mjs`

- [ ] **Step 1: 写官方字段形态的失败测试**

在测试中新增无 `sender_id` 的群消息：

```javascript
const officialGroup = normalizeIlinkInboundIdentity({
  group_id: 'group-official',
  from_user_id: 'member-official',
  is_group: true,
  mentions: [{ user_id: 'bot-main' }],
}, 'bot-main');
assert.equal(officialGroup.peerId, 'group-official');
assert.equal(officialGroup.conversationId, 'group-official');
assert.equal(officialGroup.senderId, 'member-official');
assert.equal(officialGroup.mentionedBot, true);

const removed = normalizeIlinkGroupEvent({
  group_id: 'group-official',
  event_type: 'bot_removed',
  target_user_id: 'bot-main',
}, 'bot-main');
assert.equal(removed, 'bot_removed');
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node scripts/test-clawbot-ilink-message.mjs`

Expected: FAIL，`senderId` 实际为 `null`。

- [ ] **Step 3: 最小修复群成员兜底顺序与兼容群事件**

群分支的 `senderId` 保持显式 sender 字段优先，并把 `fromUserId` 作为官方兜底：

```javascript
const senderId = isGroup
  ? firstText(
      message.sender_id,
      message.senderId,
      message.actual_sender_id,
      message.actualSenderId,
      message.member_id,
      message.memberId,
      fromUserId,
    )
  : fromUserId;
```

新增 `normalizeIlinkGroupEvent(message, botAccountId)`，只接受可验证的 `bot_added/bot_removed`（以及明确等价字段），并要求事件目标为空或等于当前 bot；未知事件返回 `null`。provider 的 `mapInbound()` 把结果写入 `ClawbotInboundMessage.group_event`。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `node scripts/test-clawbot-ilink-message.mjs`

Expected: `iLink inbound identity normalization: PASS`。

## Task 2：建立群、联系人和操作管理员领域模型

**Files:**
- Create: `modules/gui-web/packages/web-console/src/wechat_group.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/wechat_authorization.rs`

- [ ] **Step 1: 写角色矩阵与 mention 判定失败测试**

测试必须覆盖：`None` 无能力、`ChatMember` 只有对话/状态、`Operator` 有工具和文件读写但没有任务/审批、操作管理员拥有全部角色能力；结构化 mention 优先，文本只接受配置别名的明确 `@别名` 前缀。

```rust
#[test]
fn operator_cannot_control_tasks_or_approvals() {
    let caps = WechatCapabilitySet::for_preset(WechatMemberPreset::Operator);
    assert!(caps.tools_write && caps.files_write);
    assert!(!caps.tasks_control && !caps.approvals_resolve && !caps.bindings_admin);
}

#[test]
fn configured_alias_requires_explicit_prefix() {
    let aliases = vec!["ClawBot".to_string(), "库珠".to_string()];
    assert!(resolve_bot_mention(false, " @ClawBot 继续", &aliases));
    assert!(!resolve_bot_mention(false, "请问 ClawBot 在吗", &aliases));
}
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
cargo test -p coolzhu-web-console --offline operator_cannot_control_tasks_or_approvals
cargo test -p coolzhu-web-console --offline configured_alias_requires_explicit_prefix
```

Expected: FAIL，缺少 `None`/群领域模型且当前 Operator 仍允许任务控制。

- [ ] **Step 3: 实现领域类型与兼容反序列化**

新增以下稳定类型：

```rust
pub enum WechatGroupLifecycleState { AwaitingConfirmation, Active, SyncLimited, Removed }
pub enum WechatGroupEventKind { BotAdded, BotRemoved }
pub struct WechatObservedContact { pub account_id: String, pub peer_id: String, pub peer_name: Option<String>, pub first_seen_at_ms: u64, pub last_seen_at_ms: u64 }
pub struct WechatOperationAdministrator { pub account_id: String, pub peer_id: String, pub peer_name: Option<String>, pub bot_mention_aliases: Vec<String>, pub claimed_at_ms: u64, pub updated_at_ms: u64 }
pub struct WechatGroupRecord { pub account_id: String, pub group_id: String, pub group_name: Option<String>, pub first_seen_at_ms: u64, pub last_seen_at_ms: u64, pub lifecycle_state: WechatGroupLifecycleState, pub sync_evidence: String, pub binding: Option<ClawbotConversationBinding> }
pub fn resolve_bot_mention(structured: bool, text: &str, aliases: &[String]) -> bool;
```

`WechatMemberPreset` 新增 `None`；保留旧 `Collaborator/Administrator` 的反序列化兼容，但普通成员 API 不再允许设置它们。修正 Operator 能力矩阵。`ClawbotInboundMessage` 增加带 `#[serde(default)]` 的 `group_event: Option<WechatGroupEventKind>`，保证旧 sidecar payload 仍能反序列化。

- [ ] **Step 4: 把模块接入 crate 并确认 GREEN**

在 `main.rs` 顶部加入 `mod wechat_group;`，运行：

```powershell
cargo test -p coolzhu-web-console --offline operator_cannot_control_tasks_or_approvals
cargo test -p coolzhu-web-console --offline configured_alias_requires_explicit_prefix
```

Expected: 两项 PASS。

## Task 3：SQLite 事件观察、管理员认领和群清理

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`
- Modify: `modules/gui-web/packages/web-console/src/wechat_authorization.rs`
- Use: `modules/gui-web/packages/web-console/src/wechat_group.rs`

- [ ] **Step 1: 写 gateway 失败测试**

测试六个行为：私聊观察产生联系人；首条群消息产生 active 群和默认 `None` 成员；管理员只能从已观察私聊联系人认领；明确移出事件触发群清理；终态发送错误触发群清理；群清理删除成员授权、撤销权威绑定、将待发 outbox 置为 dead letter 并保留墓碑。

```rust
#[test]
fn observed_group_member_defaults_to_none_and_preserves_role_on_next_message() {
    let store = ClawbotGatewayStore::open_in_memory().unwrap();
    store.observe_group_identity("wx-main", "group-1", Some("测试群"), "member-1", Some("甲"), 100).unwrap();
    let first = store.group_member_grant("wx-main", "group-1", "member-1").unwrap().unwrap();
    assert_eq!(first.preset, WechatMemberPreset::None);
    let mut operator = first.clone();
    operator.preset = WechatMemberPreset::Operator;
    operator.capabilities = WechatCapabilitySet::for_preset(operator.preset);
    store.upsert_group_member_grant(&operator).unwrap();
    store.observe_group_identity("wx-main", "group-1", Some("测试群"), "member-1", Some("甲"), 200).unwrap();
    assert_eq!(store.group_member_grant("wx-main", "group-1", "member-1").unwrap().unwrap().preset, WechatMemberPreset::Operator);
}
```

- [ ] **Step 2: 运行失败测试并确认 RED**

Run: `cargo test -p coolzhu-web-console --offline observed_group_member_defaults_to_none_and_preserves_role_on_next_message`

Expected: FAIL，观察与群表方法尚不存在。

- [ ] **Step 3: 添加持久化表与方法**

`initialize()` 新增：

```sql
CREATE TABLE IF NOT EXISTS clawbot_contacts (... PRIMARY KEY(account_id, peer_id));
CREATE TABLE IF NOT EXISTS clawbot_operation_administrators (... PRIMARY KEY(account_id));
CREATE TABLE IF NOT EXISTS clawbot_groups (... PRIMARY KEY(account_id, group_id));
CREATE TABLE IF NOT EXISTS clawbot_group_audit (...);
CREATE TABLE IF NOT EXISTS clawbot_denial_notices (... PRIMARY KEY(account_id, group_id, member_id, code));
```

实现 `observe_direct_contact`、`observe_group_lifecycle`、`observe_group_identity`、`list_contacts`、`operation_administrator`、`claim_operation_administrator`、`clear_operation_administrator`、`list_groups`、`group_record`、`upsert_group_binding`、`detach_group_transaction`、`claim_denial_notice_window`。`BotAdded` 可以在没有成员 ID 的系统事件中确认群，普通群消息仍要求成员 ID；`BotRemoved` 直接进入事务清理。另实现 `is_terminal_group_send_error`，只把“群不存在、机器人不在群、无发送权限”等明确终态归类为自动清理证据；网络超时、provider 离线和普通重试错误只能进入 `sync_limited` 或现有重试队列。所有复合写操作使用 `unchecked_transaction()` 并在提交前完成校验。

- [ ] **Step 4: 跑 gateway 测试与回归测试**

Run:

```powershell
cargo test -p coolzhu-web-console --offline observed_group_member_defaults_to_none_and_preserves_role_on_next_message
cargo test -p coolzhu-web-console --offline group_detach_cascades_and_keeps_audit_tombstone
cargo test -p coolzhu-web-console --offline terminal_group_send_error_detaches_but_network_error_does_not
cargo test -p coolzhu-web-console --offline group_member_grants_are_scoped_persisted_and_revocable
```

Expected: 四项 PASS。

## Task 4：把观察与管理员鉴权接入真实入站调度

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/wechat_authorization.rs`

- [ ] **Step 1: 写 dispatch/auth 失败测试**

覆盖：群身份缺失 `group_member_identity_missing`；未 @ 产生 `bot_mention_unconfirmed` 且无 outbox；操作管理员无需普通 grant；普通 None 成员不调度；Operator 的任务命令被拒绝；聊天室 read-only 拒绝写；同一无权限提示在窗口内只入队一次。

```rust
#[test]
fn operation_administrator_uses_admin_caps_but_still_obeys_room_scope() {
    let mut input = context(WechatCapability::TasksControl);
    input.is_operation_administrator = true;
    assert_eq!(evaluate_wechat_authorization(&input), WechatAuthorizationDecision::Allow { requires_approval: false });
    input.required = WechatCapability::FilesWrite;
    input.room_scope = WechatRoomPermissionScope::ReadOnly;
    assert!(matches!(evaluate_wechat_authorization(&input), WechatAuthorizationDecision::Deny { code: "room_permission_denied", .. }));
}
```

- [ ] **Step 2: 运行失败测试并确认 RED**

Run: `cargo test -p coolzhu-web-console --offline operation_administrator_uses_admin_caps_but_still_obeys_room_scope`

Expected: FAIL，鉴权上下文还没有 `is_operation_administrator`。

- [ ] **Step 3: 在 preview 前观察身份并注入群权威绑定**

`api_clawbot_inbound_dispatch` 的顺序固定为：登记 inbox → 拒绝递归 → 处理明确 `BotAdded/BotRemoved` 生命周期事件 → 验证普通群消息的群/成员身份 → 观察联系人或群成员 → 读取群权威绑定 → preview → 解析结构化或别名 mention → 读取管理员/成员角色 → 鉴权 → repeated-failure guard → 命令或模型执行。生命周期事件只更新状态或清理，不进入模型/命令调度。`api_clawbot_outbox_fail` 在普通重试更新后检查终态发送错误；只有分类器确认终态且目标是已知群时才调用事务清理。

给 `ClawbotChannelState` 增加：

```rust
pub fn preview_inbound_with_binding(
    &self,
    message: ClawbotInboundMessage,
    binding_override: Option<&ClawbotConversationBinding>,
) -> ClawbotInboundPreview;

pub fn remove_binding(&mut self, account_id: &str, peer_id: &str) -> bool;
```

群记录存在时只使用其权威绑定；`removed` 群不回退到 JSON 旧绑定。

- [ ] **Step 4: 实现限流拒绝反馈和权限交集**

无权限且明确 @ 时通过 `claim_denial_notice_window(..., 5 * 60_000)` 决定是否排队一条说明；未 @ 永远不写 outbox。`read-only/workspace-write/full-access` 三种聊天室授权必须逐一映射，不再把 read-only 当 workspace-write。

- [ ] **Step 5: 运行聚焦测试**

Run:

```powershell
cargo test -p coolzhu-web-console --offline clawbot_group_dispatch_gate
cargo test -p coolzhu-web-console --offline clawbot_group_message_without_mention_is_silent
cargo test -p coolzhu-web-console --offline clawbot_group_identity_missing_fails_closed
```

Expected: 全部 PASS。

## Task 5：补齐微信群命令闭环

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/wechat_command.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: 写命令目录与执行器失败测试**

```rust
#[test]
fn help_lists_group_member_commands_and_roles() {
    let help = render_help_pages(command_registry(), 10_000).join("\n");
    for syntax in ["/members", "/member <成员ID> operator|chat|none", "/group current", "/group detach"] {
        assert!(help.contains(syntax), "missing {syntax}");
    }
}
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cargo test -p coolzhu-web-console --offline help_lists_group_member_commands_and_roles`

Expected: FAIL，命令尚未注册。

- [ ] **Step 3: 注册并实现命令**

注册：

```rust
command!("members", ["members"], Permission, "/members", "查看当前群已识别成员与角色", Status, "仅群聊可用", ["/members"], WechatCommandAvailability::Available),
command!("member.set", ["member"], Permission, "/member <成员ID> operator|chat|none", "设置已识别成员角色", BindingsAdmin, "成员ID与角色均必填", ["/member member-1 operator"], WechatCommandAvailability::Available),
command!("group.current", ["group", "current"], Room, "/group current", "查看当前群绑定与同步状态", Status, "仅群聊可用", ["/group current"], WechatCommandAvailability::Available),
command!("group.detach", ["group", "detach"], Room, "/group detach", "确认已移出并清理当前群", BindingsAdmin, "仅操作管理员可用", ["/group detach"], WechatCommandAvailability::Available),
```

执行器使用当前群身份，不允许跨群修改；`member.set` 拒绝把操作管理员降级；`group.detach` 调用 SQLite 清理并删除内存/JSON 兼容绑定。

`render_help_pages()` 与 `render_command_help()` 根据 capability 追加明确的最小角色说明：`Status/Chat -> 聊天成员`、工具或文件能力 -> `操作员`、任务/审批/绑定管理 -> `操作管理员`。这样 `/help` 同时展示命令、能力和角色要求。

- [ ] **Step 4: 运行命令测试**

Run:

```powershell
cargo test -p coolzhu-web-console --offline help_lists_group_member_commands_and_roles
cargo test -p coolzhu-web-console --offline clawbot_group_commands_enforce_operation_administrator
```

Expected: PASS。

## Task 6：提供管理 API 与“微信连接”完整前端

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [ ] **Step 1: 写 API/前端契约失败测试**

契约必须包含：联系人、管理员、群列表、群详情/路由、成员角色、群清理 API，以及管理员选择框、群卡片列表、成员角色下拉框和“确认已移出并清理”按钮。

```rust
#[test]
fn web_frontend_exposes_wechat_group_administration_controls() {
    for marker in [
        "clawbot-administrator-select",
        "clawbot-administrator-claim",
        "clawbot-group-list",
        "clawbot-group-member-list",
        "clawbot-group-detach",
    ] {
        assert!(WEB_INDEX_HTML.contains(marker), "missing {marker}");
    }
}
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cargo test -p coolzhu-web-console --offline web_frontend_exposes_wechat_group_administration_controls`

Expected: FAIL，页面标记尚不存在。

- [ ] **Step 3: 增加受约束 API**

路由：

```text
GET    /api/channels/clawbot/contacts?account_id=...
GET    /api/channels/clawbot/administrator?account_id=...
PUT    /api/channels/clawbot/administrator
DELETE /api/channels/clawbot/administrator?account_id=...
GET    /api/channels/clawbot/groups?account_id=...
GET    /api/channels/clawbot/groups/{group_id}?account_id=...
PUT    /api/channels/clawbot/groups/{group_id}/binding
POST   /api/channels/clawbot/groups/{group_id}/detach
GET    /api/channels/clawbot/groups/{group_id}/members?account_id=...
PUT    /api/channels/clawbot/groups/{group_id}/members/{member_id}
```

管理员认领必须验证联系人已被真实私聊观察；普通成员角色接口只接受 `none/chat_member/operator`；群操作均校验登录账号和路径身份一致。

- [ ] **Step 4: 实现前端状态与交互**

`clawbotChannel` 增加 `contacts/administrator/groups/selectedGroupId/groupMembers`。刷新窗口后按登录账号并行读取三类数据；选群后再读取成员。UI 显示协议限制说明、群状态、同步证据、路由、已识别成员数，并允许：认领/撤销管理员、设置群路由、切换成员角色、确定性清理群。

事件处理器必须直接调用 API，并在成功后重新读取服务器状态；不得只改 DOM 假装成功。

- [ ] **Step 5: 完成当前武侠玻璃风布局**

沿用 `.clawbot-card`、青绿边框、金色标题和现有三栏上下结构；窄屏只允许管理区内部滚动，不把二维码和登录状态挤出可视区。所有按钮保留明确中文标签，窗口标题继续显示“微信连接”，不得恢复“ClawBot”用户可见标题。

- [ ] **Step 6: 运行契约测试与格式检查**

Run:

```powershell
cargo test -p coolzhu-web-console --offline web_frontend_exposes_wechat_group_administration_controls
cargo fmt -p coolzhu-web-console -- --check
```

Expected: PASS；无格式差异。

## Task 7：编译、回归与真实界面验收

**Files:**
- Verify: `modules/gui-web/packages/web-console/`
- Write: `docs/work-logs/2026-07-05-wechat-group-membership-authorization.md`

- [ ] **Step 1: 运行全部聚焦测试**

Run:

```powershell
node scripts/test-clawbot-ilink-message.mjs
cargo test -p coolzhu-web-console --offline wechat_authorization
cargo test -p coolzhu-web-console --offline clawbot_group
cargo test -p coolzhu-web-console --offline web_frontend_exposes_wechat_group_administration_controls
```

Expected: 所有聚焦测试 PASS。

- [ ] **Step 2: 按仓库硬约束构建**

Run: `cargo build -p coolzhu-web-console --offline`

Expected: exit code 0。若 Windows 报 `os error 5`，先确认旧 `coolzhu-web-console.exe` 正在锁文件，再停止该进程后重跑；不能把锁文件问题误报成源码编译失败。

- [ ] **Step 3: 运行 web-console 全量测试并记录既有失败边界**

Run: `cargo test -p coolzhu-web-console --offline`

Expected: 新增测试全部通过；若仍仅出现已知 `audio::tests::test_cleanup_temp_audio_no_files` 或布局基线失败，必须在 work-log 中逐项记录，不宣称全绿。

- [ ] **Step 4: 部署新编译资源并用 Computer Use 验证 Tauri 页面**

确认实际 Tauri shell 使用的 `package/bin/coolzhu-web-console.exe` 已替换为本轮新构建，再从用户界面依次验证：二维码仍可见；管理员区域可加载；群列表为空时提示准确；管理员只能从已识别联系人选择；页面没有 JavaScript 错误；窗口标签仍为“微信连接”。

- [ ] **Step 5: 真实微信群验收**

由用户在手机微信完成加群和发消息，Computer Use 观察 Tauri：首条明确 @ 消息创建 active 群和默认无权限成员；设置聊天成员/操作员/无权限后验证能力矩阵；未 @ 静默；操作管理员任务/审批受聊天室权限约束；移出群后若协议无事件，点击“确认已移出并清理”并验证群记录、成员授权和待发队列已清理且审计墓碑保留。

- [ ] **Step 6: 写 work-log**

记录测试命令、通过/失败数量、真实微信账号的脱敏标识、群同步证据、协议没有提供的能力、人工验收步骤和剩余阻塞；不得写入 token、Cookie、二维码或当前模型会话配置。

## 提交边界

当前根仓库和 `modules/gui-web` 嵌套仓库均已有大量未提交/未跟踪改动，且本轮涉及的 ClawBot 文件中有既有未跟踪文件。因此实施期间先保留精确基线和备份，不自动提交包含既有用户改动的源码。完成验证后只在能够精确证明 staged 内容归属本轮时提交；否则交付文件清单和验证证据，由用户决定何时整理提交。
