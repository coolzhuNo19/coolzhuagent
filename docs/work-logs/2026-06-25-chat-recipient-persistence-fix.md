# 2026-06-25 Web Console 发送对象持久化修复

## 任务

修复每次打开 Web Console 后，会话发送对象被重新锁定到 GLM5.2 的问题。按用户要求，本轮不使用 Compute Use，完成代码和自动验证后由用户重启 Windows 人工确认。

关联需求：`REQ-WEB-WIN-003`

## 根因

Web Console 启动时执行 `loadAgents()`：

1. 后端 `/api/agents` 把 `session_store.active_session_id()` 转换为 `active_agent_ids`。
2. 前端 `renderAgentOptions(selectable, registry.active_agent_ids)` 每次都把 `active_agent_ids` 设为发送对象。
3. 前端此前没有保存用户选择的发送对象。

因此，只要当前激活会话是 GLM5.2，重新打开 Web Console 就会覆盖用户上次选择。这里混淆了两个不同状态：

- 当前激活会话：后端运行态，可作为首次使用的默认值。
- 聊天发送对象：用户在具体 workspace、具体聊天室中的界面选择，应独立持久化。

## 修改

模块：`modules/gui-web/packages/web-console`

- 新增 localStorage 命名空间 `coolzhu.chat.recipients.v1.`。
- 存储键由 workspace key 和 chat room id 共同组成，避免工作区、聊天室之间串值。
- 用户勾选发送对象或单选目标后立即保存。
- 加载 Agent、加载聊天室、切换聊天室后恢复对应聊天室的发送对象。
- 恢复时只接受当前仍存在且可选择的 Agent ID。
- 没有有效持久值时，才依次回退到后端 `active_agent_ids` 和首个可选 Agent。
- 后端会话激活逻辑保持不变，避免扩大修改风险。

## TDD 与验证

所有运行命令均设置超时，输出记录在 `tmp/logs`。

### RED

- 新增 `chat_recipient_selection_is_persisted_per_workspace_and_room` 回归契约。
- 修改前测试按预期失败，缺少 `coolzhu.chat.recipients.v1.`。
- 日志：`tmp/logs/chat-recipient-red.log`

### GREEN

- 定向测试：1 passed，0 failed。
- 日志：`tmp/logs/chat-recipient-green.log`

### 回归

- `node --check packages/web-console/src/app.js`：通过。
  - `tmp/logs/chat-recipient-node-check.log`
- `cargo fmt --all -- --check`：通过。
  - `tmp/logs/chat-recipient-fmt-check.log`
- `cargo test -p coolzhu-web-console --no-fail-fast -- --test-threads=1`：541 passed，0 failed。
  - `tmp/logs/chat-recipient-full-test.log`
- `cargo check -p coolzhu-web-console`：通过；保留 29 个既有未使用代码警告。
  - `tmp/logs/chat-recipient-cargo-check.log`
- `package.ps1 all -Configuration debug`：通过。
  - 新 Web Console 二进制已复制到 `package/bin/coolzhu-web-console.exe`。
  - 旧二进制已按时间戳备份到 `package/backup/coolzhu-web-console.exe/`，并执行最近 10 份保留策略。
  - 用户启动入口 `package/COOLZHU-AGENT.exe` 已存在。
  - `tmp/logs/chat-recipient-package-all.log`

## 人工验收步骤

Windows 重启后：

1. 启动 `package/COOLZHU-AGENT.exe` 并打开 Web Console。
2. 在聊天室 A 将发送对象从 GLM5.2 改为另一个 Agent。
3. 关闭并重新打开 Web Console，确认聊天室 A 仍选中该 Agent。
4. 切换聊天室 B，设置不同发送对象；在 A/B 间切换，确认两者互不覆盖。
5. 再次关闭并打开 Web Console，确认两间聊天室分别恢复。

## 之前任务状态

### 大文件附件上传

已完成并提交：

- gui-web：`df30f95 fix(web): stabilize uploads and local model chat`
- 根目录文档：`ec44538 docs: record upload and local model recovery`

结果：

- 根因位于本地 Axum multipart body 上限，不是远端模型协议。
- 配置上限固定为 32 MiB。
- 3 MiB 实际上传通过，超过 32 MiB 返回 413。

### 本地模型会话链路

已完成并包含在上述提交：

- 修复本地模型 8192 context 与历史 262K 覆盖值冲突。
- 本地模型最大输出限制为 2048。
- 小上下文本地模型不再注入不必要的工具协议。
- 增加否定式搜索保护、`/health` 就绪检查和关键链路日志。
- 实际会话返回 `LOCAL_CHAIN_OK`。

### 仍待确认/处理

- 上述两项的前端视觉与交互由用户人工确认。
- 之前 package 启动曾被 8765 端口幽灵监听进程阻塞；本轮未启动应用，也不宣称该独立问题已解决。

## 风险与回滚

- 修改仅影响前端发送对象选择状态，不改变后端 active session、会话协议或消息发送 API。
- localStorage 读取失败会安全回退，不阻断聊天。
- 如需回滚，可回退 gui-web 本轮提交；已有 package 备份可恢复上一版 `coolzhu-web-console.exe`。
