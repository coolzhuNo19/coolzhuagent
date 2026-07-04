# 微信已有会话与聊天室路由 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让微信 `/new` 与 `/use` 只选择已有会话，并让前端只能保存稳定的 session-id 与 room-id。

**Architecture:** 保留现有微信目录快照作为编号解析来源，在 web-console 后端增加“编号 / 稳定 ID / 唯一名称”解析器；`/new` 复用与 `/use` 相同的选择函数，不再触碰会话创建路径。微信连接管理页使用现有 `/api/sessions` 和 `/api/chat/rooms` 数据渲染受控下拉框，后端保存绑定时再次规范化和校验 ID。

**Tech Stack:** Rust、Axum、Serde、原生 JavaScript/HTML、Cargo tests、Computer Use

---

## 文件结构

- `modules/gui-web/packages/web-console/src/wechat_command_runtime.rs`：目录编号、稳定 ID、唯一名称及歧义错误。
- `modules/gui-web/packages/web-console/src/wechat_command.rs`：`/new`、`/use`、`/room` 帮助契约。
- `modules/gui-web/packages/web-console/src/clawbot_channel.rs`：命令解析类型与兼容别名。
- `modules/gui-web/packages/web-console/src/main.rs`：真实命令执行、绑定规范化、后端与前端契约测试。
- `modules/gui-web/packages/web-console/index.html`：聊天室与会话受控选择框。
- `modules/gui-web/packages/web-console/src/app.js`：下拉选项、失效状态、绑定卡片可读信息。
- `modules/gui-web/packages/web-console/src/styles.css`：选择框与失效状态沿用管理页视觉样式。

### Task 1: 唯一目录选择器

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/wechat_command_runtime.rs`

- [ ] **Step 1: 写入歧义名称失败测试**

新增测试，两个条目使用同一标签但不同 ID，按标签选择必须返回 `selector_ambiguous`，错误文本包含两个稳定 ID；按编号和 ID 仍能分别选中。

```rust
#[test]
fn duplicate_labels_require_number_or_stable_id() {
    let mut runtime = WechatCommandRuntime::default();
    runtime.publish_snapshot(
        "wx-main",
        "peer-a",
        WechatCatalogKind::Sessions,
        vec![entry("session-a", "GLM5.2"), entry("session-b", "GLM5.2")],
    );

    let error = runtime
        .resolve_selector("wx-main", "peer-a", WechatCatalogKind::Sessions, "GLM5.2")
        .expect_err("重复名称不得默认选择第一项");
    assert_eq!(error.code, "selector_ambiguous");
    assert!(error.message.contains("session-a"));
    assert!(error.message.contains("session-b"));
}
```

- [ ] **Step 2: 运行红灯测试**

Run: `cargo test -p coolzhu-web-console duplicate_labels_require_number_or_stable_id --offline`

Expected: FAIL；当前实现会静默返回第一项。

- [ ] **Step 3: 实现唯一标签解析**

在 `resolve_selector` 中按“编号 → 稳定 ID → 唯一标签”解析。标签候选多于一个时返回 `selector_ambiguous`，并列出候选 ID；不得对 `detail`（Provider / 模型）做匹配。

```rust
let label_matches = snapshot
    .entries
    .iter()
    .filter(|entry| entry.label.eq_ignore_ascii_case(selector))
    .collect::<Vec<_>>();
if label_matches.len() > 1 {
    return Err(WechatCommandRuntimeError {
        code: "selector_ambiguous",
        message: format!(
            "名称 {selector} 对应多个项目：{}。请使用目录编号或稳定 ID。",
            label_matches.iter().map(|entry| entry.id.as_str()).collect::<Vec<_>>().join(", ")
        ),
    });
}
```

- [ ] **Step 4: 运行绿灯测试与现有目录测试**

Run: `cargo test -p coolzhu-web-console wechat_command_runtime::tests --offline`

Expected: 全部通过。

### Task 2: `/new` 改为已有会话选择别名

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/wechat_command.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: 把旧创建测试改成不新增对象的回归测试**

将 `clawbot_new_creates_real_session_and_updates_current_binding` 改为 `clawbot_new_selects_existing_session_without_creating_one`。准备两个 Provider 下模型同名的会话，先发布 `/sessions` 快照，再执行 `/new 2`；断言会话数量不变、绑定指向第二个 session-id、回执包含“未创建新会话”。

```rust
let before_count = super::session_store().lock().expect("session store").state.sessions.len();
let _ = super::clawbot_session_catalog(
    &message,
    crate::wechat_command_runtime::WechatCatalogKind::Sessions,
    "可用模型会话",
).expect("publish sessions");
let result = super::execute_clawbot_command_runtime(
    &message,
    &crate::clawbot_channel::ClawbotCommand::Registered {
        command_id: "new".to_string(),
        arguments: "2".to_string(),
    },
    Some("full-access"),
).await.expect("/new 应选择已有会话");
assert_eq!(super::session_store().lock().expect("session store").state.sessions.len(), before_count);
assert!(result.message.contains("未创建新会话"));
```

- [ ] **Step 2: 运行红灯测试**

Run: `cargo test -p coolzhu-web-console clawbot_new_selects_existing_session_without_creating_one --offline`

Expected: FAIL；当前 `/new` 调用 `create_session`，数量增加或触发上限错误。

- [ ] **Step 3: 提取唯一的真实选择函数**

在 `main.rs` 增加 `clawbot_select_existing_session(message, selector, compatibility_alias)`：

1. 空选择器返回 `selector_required` 并提示 `/sessions`。
2. 数字使用 `WechatCatalogKind::Sessions` 快照。
3. 非数字先按当前存储中的完整 session-id 匹配；再按唯一会话名称匹配；不匹配模型字段。
4. 确认会话仍存在后，只更新 `binding.default_session_id`。
5. `/new` 回执附加“兼容命令：未创建新会话”。

删除 `clawbot_create_session`，并把 `NewTurn`、`UseSessionOrModel`、注册命令 `new` 全部接到这个选择函数。`NewTurn` 无选择器时只返回提示。

- [ ] **Step 4: 更新命令解析与帮助**

`/new <选择器>` 解析为与 `/use` 相同的会话选择命令，并保留命令 ID `new` 以便授权和回执识别。命令表改为：

```rust
command!("use", ["use"], Session, "/use <编号、会话ID或唯一会话名>", "选择已有模型会话", BindingsAdmin, "选择器：来自最近一次 /sessions", ["/use 2", "/use session-123"], WechatCommandAvailability::Available),
command!("new", ["new"], Session, "/new <编号、会话ID或唯一会话名>", "选择已有模型会话（/use 兼容别名）", BindingsAdmin, "不会创建会话或清空历史", ["/new 2", "/new session-123"], WechatCommandAvailability::Available),
```

- [ ] **Step 5: 增加模型同名与空参数测试**

验证两个 Provider 的模型都叫 `glm-5.2` 时，按编号选择正确对象；直接输入模型名但不是唯一会话名时失败；`/new` 空参数不改变绑定。

- [ ] **Step 6: 运行后端绿灯回归**

Run: `cargo test -p coolzhu-web-console clawbot_ --offline`

Expected: ClawBot 测试全部通过。

### Task 3: 保存绑定时规范化稳定 ID

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: 写入绑定规范化失败测试**

为 `normalize_clawbot_binding_routes` 增加测试：唯一会话名和聊天室名被转换为真实 ID；模型名、重复名称和不存在对象返回 400；已经是稳定 ID 时保持不变。

- [ ] **Step 2: 运行红灯测试**

Run: `cargo test -p coolzhu-web-console clawbot_binding_routes_normalize_only_unique_names_and_ids --offline`

Expected: FAIL，因为规范化函数尚不存在。

- [ ] **Step 3: 实现并接入保存 API**

新增纯函数，分别对 `chat_room_id` 与 `default_session_id` 执行“ID 优先、唯一名称其次、其余拒绝”；错误文本必须说明模型名不能唯一标识会话。`api_clawbot_upsert_binding` 在加锁写入前调用该函数，持久化结果只包含稳定 ID。

- [ ] **Step 4: 运行绿灯测试**

Run: `cargo test -p coolzhu-web-console clawbot_binding_routes_normalize_only_unique_names_and_ids --offline`

Expected: PASS。

### Task 4: 前端受控选择器与失效状态

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: 写入前端契约失败测试**

扩展 `clawbot_management_window_is_embedded_in_frontend_shell`：断言聊天室与会话控件为 `select`，会话标签是“发送到会话”，并且 `app.js` 包含 `renderClawbotBindingSelectors` 与 Provider / 模型标签格式。

- [ ] **Step 2: 运行红灯测试**

Run: `cargo test -p coolzhu-web-console clawbot_management_window_is_embedded_in_frontend_shell --offline`

Expected: FAIL；当前是自由文本输入框。

- [ ] **Step 3: 将输入框改为下拉框**

`index.html` 使用空选项开头的 `select`：

```html
<select data-role="clawbot-room-id"><option value="">请选择聊天室</option></select>
<select data-role="clawbot-session-id"><option value="">请选择已配置会话</option></select>
```

- [ ] **Step 4: 渲染与保存稳定 ID**

在 `app.js` 增加 `renderClawbotBindingSelectors(binding)`，从 `chatRoomRegistry.rooms` 和 `sessionRegistry.sessions` 生成选项；会话文本为 `${name} — ${provider} / ${model}`，值分别是 room-id 与 session-id。旧绑定值找不到时插入禁用的“绑定失效”选项，不把模型名自动改成任意会话。

`renderClawbotWindow`、`loadSessions`、`loadChatRooms` 与 `fillClawbotBindingForm` 调用该函数；`currentClawbotBindingPayload` 保持读取控件值，因此只提交稳定 ID。绑定卡片显示可读名称、Provider / 模型及稳定 ID。

- [ ] **Step 5: 补齐样式并运行绿灯测试**

让 `select` 继承 `.config-field` 中现有输入样式，失效选项使用告警色。再次运行前端契约测试，Expected: PASS。

### Task 5: 编译、部署和真实闭环

**Files:**
- Verify: `modules/gui-web/packages/web-console/src/main.rs`
- Verify: `modules/gui-web/packages/web-console/src/app.js`
- Verify: `modules/gui-web/packages/web-console/index.html`

- [ ] **Step 1: 完整回归**

Run: `cargo test -p coolzhu-web-console clawbot_ --offline`

Expected: 全部通过。

- [ ] **Step 2: 离线构建**

停止占用 `target/debug/coolzhu-web-console.exe` 的旧进程后运行：

`cargo build -p coolzhu-web-console --offline`

Expected: exit 0；仅允许记录既有 warning，不得有 error。

- [ ] **Step 3: 重启真实运行链路**

重启 web-console，保留 iLink provider 与 sidecar 登录状态；确认 `/api/sessions` 仍是 10 个对象，绑定保存为真实 session-id。

- [ ] **Step 4: Computer Use 前端验收**

在“微信连接”页验证聊天室和会话下拉框、Provider / 模型标签、保存后刷新保持，以及失效绑定提示。

- [ ] **Step 5: 真实微信验收**

用户依次发送 `/sessions`、`/new <GLM5.2 对应编号>`、`/status` 和普通消息。验收：会话总数始终为 10；绑定变为所选 session-id；回复来自所选会话并进入“测试环境”聊天室。
