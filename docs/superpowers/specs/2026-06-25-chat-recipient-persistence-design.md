# 聊天发送对象持久化设计

## 问题

Web Console 启动时，`loadAgents()` 使用 `/api/agents.active_agent_ids` 勾选发送对象。后端的 `active_agent_ids` 实际由当前活动会话生成，因此活动会话为 GLM5.2 时，用户之前选择的接收者会被覆盖为 GLM5.2。

## 设计

- 发送对象是独立于“当前活动会话”的前端选择状态。
- 使用 `localStorage` 按 `workspace + chat room` 保存已选择的 Agent ID 列表。
- Agent 列表刷新时，优先恢复当前 workspace/聊天室下仍然存在且可选择的接收者。
- 当前聊天室没有保存记录时，才使用 `/api/agents.active_agent_ids` 作为首次默认值。
- 用户勾选、点击频道 Agent、切换聊天室时立即保存或恢复。
- workspace 切换沿用现有 `activeWorkspaceKey`，不同工程不会串接收者。
- 已删除或禁用的 Agent 自动从恢复结果中过滤；过滤后为空时回退当前活动会话或第一个可选 Agent。

## 边界

- 不修改 SQLite schema 和后端 API。
- 不改变消息发送协议；`target_agent_ids` 继续由已勾选复选框生成。
- 本轮不启动 Web Console，自动化验证后由用户在 Windows 重启后人工确认。

## 验收

1. 在聊天室 A 选择非 GLM5.2 接收者，重载页面后仍保持。
2. 聊天室 A/B 可保存不同接收者。
3. workspace 切换后接收者状态隔离。
4. 保存的 Agent 已不存在时不会产生无效目标，并安全回退。

