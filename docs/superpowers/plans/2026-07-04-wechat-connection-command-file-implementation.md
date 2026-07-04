# 微信连接命令、白名单与文件闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 ClawBot/iLink 通道升级为可在真实微信中选择聊天室、会话和模型，按群成员白名单继承聊天室授权，完整执行命令与文件操作，并通过 `/help` 展示所有可验收命令的“微信连接”能力。

**Architecture:** 保留内部 `clawbot_*` 数据表、API 路径和 Provider 兼容层，新增微信命令注册表、授权判定、命令执行、文件/审批四个边界。所有入站消息先标准化并经群成员白名单与能力交集门禁，再进入命令执行或模型会话；执行结果统一写入终态和发件箱，Provider 只负责微信协议转换与投递。前端只消费同一后端登录快照、真实目录和授权数据，不自行推断状态。

**Tech Stack:** Rust/Axum/Rusqlite/Serde，原生 JavaScript/HTML/CSS，Node.js iLink Provider，Tauri/WebView2，PowerShell 验收脚本。

---

## Task 0：建立回滚点并记录基线

**Files:**
- Create: `tmp/backups/wechat-connection-20260704/`
- Create: `tmp/wechat-connection-baseline.txt`

- [ ] 复制以下风险文件到 `tmp/backups/wechat-connection-20260704/`，保持原目录层级：
  - `modules/gui-web/packages/web-console/src/main.rs`
  - `modules/gui-web/packages/web-console/src/app.js`
  - `modules/gui-web/packages/web-console/src/styles.css`
  - `modules/gui-web/packages/web-console/index.html`
  - `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
  - `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`
  - `modules/gui-web/packages/clawbot-sidecar/src/lib.rs`
  - `scripts/clawbot-ilink-provider.mjs`
- [ ] 运行基线命令并把退出码、失败用例和当前分支写入 `tmp/wechat-connection-baseline.txt`：

```powershell
cargo test -p coolzhu-web-console --offline
cargo test -p coolzhu-clawbot-sidecar --offline
node --check scripts/clawbot-ilink-provider.mjs
```

预期：语法检查通过；若全量测试有既存失败，仅记录，不借本功能修改无关代码。

## Task 1：建立单一命令注册表并让 `/help` 完整可验收

**Files:**
- Create: `modules/gui-web/packages/web-console/src/wechat_command.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Test: `modules/gui-web/packages/web-console/src/wechat_command.rs`

- [ ] 先编写失败测试，约束命令名唯一、别名不冲突、每项均有语法/说明/能力/分类，且 `/help` 分页合并后与注册表逐项一致。
- [ ] 定义不依赖前端的注册表模型：

```rust
pub struct WechatCommandSpec {
    pub name: &'static str,
    pub aliases: &'static [&'static str],
    pub category: WechatCommandCategory,
    pub syntax: &'static str,
    pub summary: &'static str,
    pub required_capability: WechatCapability,
    pub examples: &'static [&'static str],
    pub implementation: WechatCommandAvailability,
}

pub enum WechatCommandAvailability {
    Available,
    FeatureGated(&'static str),
}
```

- [ ] 注册设计规格第 6.2 节全部命令；未打通的构建能力必须保留在目录中并显示“当前不可用：原因”，不得伪装成功。
- [ ] 从注册表生成 `/help`、`/commands` 和 `/help <命令>`；按 UTF-8 字符长度分页，每页带 `微信连接命令 第 N/M 页`，不得截断单个命令条目。
- [ ] 将 `parse_clawbot_command` 改为先查注册表，再解析参数；未知 `/xxx` 返回结构化未知命令，不回退为模型消息。
- [ ] 扩展 `/api/channels/clawbot/commands`，直接返回同一注册表的分类、语法、能力和可用状态，前端与微信不再维护两份目录。
- [ ] 运行：

```powershell
cargo test -p coolzhu-web-console wechat_command --offline
cargo build -p coolzhu-web-console --offline
```

预期：命令注册表测试通过，`/help` 合并结果包含所有注册命令，后端成功构建。

## Task 2：扩展群聊消息身份并实现成员白名单/能力交集

**Files:**
- Create: `modules/gui-web/packages/web-console/src/wechat_authorization.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `scripts/clawbot-ilink-provider.mjs`
- Test: `modules/gui-web/packages/web-console/src/wechat_authorization.rs`

- [ ] 先写默认拒绝、未 @拒绝、群管理员无隐式越权、只读不可写、聊天室 `full-access` 仍受成员能力约束的失败测试。
- [ ] 向入站消息增加带 `#[serde(default)]` 的兼容字段：`conversation_id`、`sender_id`、`sender_name`、`is_group`、`mentioned_bot`、`mentions`；旧的 `peer_id/peer_name` 保留为会话维度。
- [ ] 定义能力集合：`chat`、`status`、`tools.read`、`tools.write`、`files.read`、`files.write`、`tasks.control`、`approvals.resolve`、`bindings.admin`。
- [ ] 新增 SQLite 表保存群聊成员授权，主键使用 `account_id + group_id + member_id`，记录预设、细分能力、启用状态、创建者和更新时间；旧绑定的 `allowlisted=true` 不自动给所有群成员授权。
- [ ] 实现固定判定顺序：账号在线 → 群绑定启用 → 确实 @机器人 → 成员在白名单 → 命令能力满足 → 聊天室权限允许。返回 `Allow` 或带稳定错误码的 `Deny`，拒绝路径绝不进入模型/工具。
- [ ] 增加 API：
  - `GET /api/channels/clawbot/groups/{group_id}/members`
  - `PUT /api/channels/clawbot/groups/{group_id}/members/{member_id}`
  - `DELETE /api/channels/clawbot/groups/{group_id}/members/{member_id}`
  - `POST /api/channels/clawbot/groups/{group_id}/members/import`
- [ ] Provider 的 `mapInbound` 从 iLink payload 中分别提取群 ID、实际发送者 ID、群成员昵称和 @ 列表；不确定字段保留原始 payload 摘要用于诊断，不用群 ID 冒充成员 ID。
- [ ] 运行：

```powershell
cargo test -p coolzhu-web-console wechat_authorization --offline
node --check scripts/clawbot-ilink-provider.mjs
```

预期：所有拒绝测试证明模型调用计数为 0；合法成员只获得能力交集。

## Task 3：把目录与选择命令接到真实运行数据

**Files:**
- Create: `modules/gui-web/packages/web-console/src/wechat_command_runtime.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_channel.rs`
- Test: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] 写集成测试，使用临时 SQLite 创建两个聊天室、两个会话、两个模型和绑定，验证编号选择与 ID 选择得到同一结果。
- [ ] 建立命令执行上下文，只暴露窄接口读取 `SessionStore`、`ChatRoomListResponse`、模型 capability catalog、任务/Goal 状态、登录快照和 gateway metrics，避免把巨型 `main.rs` 业务复制到通道模块。
- [ ] 实现 P0 实时命令：`/ping`、`/whoami`、`/status [detail]`、`/rooms`、`/room`、`/sessions`、`/use`、`/new`、`/models`、`/model`、`/targets`、`/target`、`/workspace`、`/cwd`、`/tasks`、`/task`、`/continue`、`/stop`、`/queue status`、`/permissions`、`/errors`、`/reconnect`。
- [ ] `/compact`、`/steer`、`/logs`、`/notify` 等能力只有在真实后端路径接通后才标记 `Available`；否则返回注册表中的明确禁用原因。
- [ ] 所有列表结果生成稳定编号快照；选择命令必须校验该快照仍属于同一 `account_id + peer_id`，防止目录变化后选错对象。
- [ ] 替换 `api_clawbot_gateway_inbound_dispatch` 中 `state.apply_command` 的占位分支，调用真实 command runtime；命令成功或失败均写入 inbox 终态并入 outbox，禁止再交给模型解释失败。
- [ ] 运行：

```powershell
cargo test -p coolzhu-web-console clawbot_command --offline
cargo test -p coolzhu-web-console clawbot_gateway --offline
```

预期：列表来自临时真实存储；占位文案测试反向保证不再出现。

## Task 4：统一请求终态、错误码与防递归看护

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/clawbot-sidecar/src/lib.rs`
- Test: `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`

- [ ] 写状态迁移测试：`received -> authorized -> running -> succeeded|denied|cancelled|failed`，审批路径增加 `awaiting_approval`；任何终态不得重新进入 dispatch。
- [ ] SQLite 采用兼容迁移：新增 `request_state`、`error_code`、`request_id`、`parent_request_id` 字段，不删除旧 `state/result_json`；启动时检查列再 `ALTER TABLE`。
- [ ] 定义结构化结果：

```rust
pub struct WechatCommandResult {
    pub request_id: String,
    pub state: WechatRequestState,
    pub code: String,
    pub summary: String,
    pub details: Vec<String>,
    pub artifacts: Vec<WechatArtifactRef>,
    pub retryable: bool,
}
```

- [ ] 以 `request_id + operation_fingerprint` 做业务幂等；业务失败永久终止。Provider 发送失败允许初次发送后最多重试 2 次，复用同一 outbox 项，不创建新模型请求。
- [ ] 增加会话级连续失败熔断：同一命令指纹在窗口内重复失败直接回放终态，明确提示人工修改参数或 `/reconnect`，不得让模型递归调用 compute use/文件工具。
- [ ] 运行 gateway 与 sidecar 的 retry/dead-letter 测试。

## Task 5：实现文件读取、上传写入、审批与产物回传

**Files:**
- Create: `modules/gui-web/packages/web-console/src/wechat_file.rs`
- Modify: `modules/gui-web/packages/web-console/src/clawbot_gateway.rs`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/clawbot-sidecar/src/lib.rs`
- Test: `modules/gui-web/packages/web-console/src/wechat_file.rs`

- [ ] 先写路径穿越、符号链接逃逸、敏感目录、超限文件、无权限写入、审批内容被替换等失败测试。
- [ ] 复用现有附件存储和 `sanitize_attachment_file_name`，但文件命令必须先 `canonicalize` 授权根和目标父目录，再验证目标位于授权根；仅文件名清理不能替代路径授权。
- [ ] 实现 `/file list`、`/file info`、`/file get`、`/file put`、`/file write`；写入使用临时文件 + 原子替换，并记录 SHA-256、大小、调用成员、聊天室和请求 ID。
- [ ] 普通聊天室写入生成不可变审批快照，`/approve <ID> once|always`、`/deny <ID>` 只能由具备 `approvals.resolve` 的成员处理；`full-access` 仅在成员同时有 `files.write/tools.write` 时免批。
- [ ] 实现 `/artifact latest`、`/artifact <ID>`、`/diff`、`/tests`，只回传任务显式登记的产物，不扫描整个工作区。
- [ ] 将发件箱从 `body: String` 兼容扩展为 `WechatOutboundPayload::{Text, File}`，旧记录按 Text 读取；文件项带本地受控路径、展示名、MIME、大小和校验值。
- [ ] 运行文件、审批、outbox 目标测试。

## Task 6：打通 iLink 入站附件和出站文件

**Files:**
- Modify: `modules/gui-web/packages/clawbot-sidecar/src/lib.rs`
- Modify: `scripts/clawbot-ilink-provider.mjs`
- Modify: `scripts/test-clawbot-ilink-provider.ps1`
- Create: `scripts/test-clawbot-ilink-provider-file.ps1`

- [ ] 扩展 Provider trait 为 `send_message(payload)`，保留 `send_text` 兼容包装；sidecar 根据 outbox payload 调用文本或文件端点。
- [ ] Provider 把 iLink 入站 `file_item/image_item` 转为带 media ID、文件名、MIME、大小、校验信息的标准附件，并在受控缓存目录下载/解密。
- [ ] 实现 `/send_file`：请求上传 URL，AES-128-ECB/PKCS7 加密，上传 CDN，再以 `file_item` 发送；所有协议错误返回可诊断错误码，不降级为“发送成功”。
- [ ] 用本地 mock iLink 服务验证上传、下载、加密块大小、文件元数据和 sidecar ACK/FAIL；真实协议不可用时功能开关保持关闭，`/help` 显示具体禁用原因。
- [ ] 运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-clawbot-ilink-provider.ps1
powershell -ExecutionPolicy Bypass -File scripts/test-clawbot-ilink-provider-file.ps1
cargo test -p coolzhu-clawbot-sidecar --offline
```

## Task 7：把控制台统一为“微信连接”并改为真实选择器

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`
- Test: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] 先写嵌入资源测试：用户可见字符串不含 `ClawBot/clawbot`，标签、标题、ARIA 和空状态均为“微信连接”；内部 ID/API 可继续使用 `clawbot`。
- [ ] 保持“顶部全局栏—中部标签页眉—主体—底部状态栏”的总布局；中部子标签为“连接、绑定、群成员、命令、文件、任务、审批、诊断”。
- [ ] 二维码卡片严格按同一后端快照显示：未登录显示二维码和倒计时；扫码中显示确认状态；已登录隐藏二维码并显示账号、在线状态、刷新和退出；错误显示最近错误与重试。
- [ ] 用 `/api/chat/rooms`、`/api/sessions`、模型 capability API 和目标 Agent API 填充可搜索选择器，保存绑定后回读并核对实际配置。
- [ ] `/help` 面板直接渲染命令注册表 API，按分类显示语法、能力和可用状态；提供复制命令和模拟执行，但不得手写命令清单。
- [ ] 增加群成员白名单表格、预设/细分能力编辑、批量导入、待审批、文件传输、任务/产物和诊断事件视图。
- [ ] `node --check src/app.js` 后重新执行 `cargo build -p coolzhu-web-console --offline`，确保编译期内联资源已更新。

## Task 8：自动化、真实控制台与真实微信逐项验收

**Files:**
- Create: `docs/testing/wechat-connection-command-acceptance-2026-07-04.md`
- Create: `docs/work-logs/2026-07-04-wechat-connection-command-file.md`
- Modify: `scripts/package-safety.ps1`

- [ ] 运行完整最小验证：

```powershell
cargo test -p coolzhu-web-console --offline
cargo test -p coolzhu-clawbot-sidecar --offline
cargo build -p coolzhu-web-console -p coolzhu-clawbot-sidecar --offline
node --check scripts/clawbot-ilink-provider.mjs
```

- [ ] 启动 web-console、sidecar 与 Provider；使用 Computer Use 从“微信连接”窗口完成二维码登录、聊天室/会话/模型选择、成员授权、刷新后状态保持、审批和文件列表操作。
- [ ] 真实微信先发送 `/help`，保存所有分页；以注册表为基准逐项验收 P0 命令，记录 `通过/预期拒绝/预期禁用/失败`、请求 ID、微信回执和控制台事件。
- [ ] 真实验证：未授权群成员 @机器人不调用模型；聊天成员能聊天但不能写文件；操作者能在授权范围内调用工具；审批人能批准/拒绝；业务失败不递归；Provider 断线恢复只补发一次。
- [ ] 真实验证 `/file get` 返回本地样例文件，微信附件经 `/file put` 写入授权路径并回传最终文件，校验 SHA-256 一致。
- [ ] 运行安装包安全检查，确认排除 `.coolzhu/web-sessions*`、微信凭据、登录快照、当前模型会话配置和 API key；重新生成 Windows 安装包并记录路径与哈希。
- [ ] 更新 work-log，逐条列出完成、未完成、外部协议阻塞和回滚路径，不以自动化测试替代真实微信验收。

## 阶段验收边界

- **阶段 A（Task 0–2）：** `/help` 全量目录、群成员身份和能力门禁可自动验证，默认拒绝且不调用模型。
- **阶段 B（Task 3–4）：** 微信目录/选择/状态命令读取真实数据，所有请求有唯一终态，失败不递归。
- **阶段 C（Task 5–6）：** 文本、附件、文件写入、审批、产物与重试闭环在 mock 和真实 iLink 中通过。
- **阶段 D（Task 7–8）：** “微信连接”前端、二维码/登录状态、白名单和完整命令目录使用 Computer Use 与真实微信逐项验收；安全安装包可交付。
