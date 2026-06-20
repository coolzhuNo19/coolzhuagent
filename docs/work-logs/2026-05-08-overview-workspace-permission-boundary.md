# 2026-05-08 总览指标与 Workspace 权限边界

记录时间：2026-05-08 20:50 +08:00

## 背景

用户反馈总览卡片底部仍显示 health error 调试信息，并提出工程目录默认路径与 Agent 文件权限边界需要绑定到用户设置的 workspace。按照优先级先处理 P0：

- `REQ-WEB-OVERVIEW-001`：总览卡片指标重构。
- `REQ-WEB-PROJECT-002`：默认 workspace 与当前聊天室环境隔离。

## 修改内容

### REQ-WEB-OVERVIEW-001

- 后端 `/api/state` 增加 `overview` 聚合字段：
  - `active_agent_count`：已配置、启用且可选的用户 Agent 会话数。
  - `vision_agent`：优先选择已配置的多模态 Agent，会回退到系统视觉 Agent。
  - `chat_room_count`：当前聊天室数量。
- 前端总览卡片移除 `/api/diagnostics/health` 调用和 `diagnostics-health` 渲染块。
- 总览卡片显示项改为：
  - 已激活 Agent 数
  - 视觉 Agent
  - 聊天室个数
- `/api/web/cards` 审计中总览卡片 endpoint 改为只依赖 `/api/state`。

### REQ-WEB-PROJECT-002

- 默认 workspace 改为用户目录下 `coolzhuagent`，启动时自动创建目录。
- workspace 设置允许在用户目录及显式 `COOLZHU_ALLOWED_WORKSPACES` 白名单下切换。
- `core.read_file`、`core.glob_search`、`core.grep_search` dry-run 在 Web 层先将路径解析到当前 active workspace 内。
- 文件工具拒绝：
  - 指向当前 workspace 外的绝对路径。
  - `..` 越界路径。
  - 绝对 glob pattern 或带 `..` 的 pattern。

## TDD 与验证

新增/更新测试：

- `web_frontend_overview_uses_business_metrics_without_health_debug`
- `overview_metrics_count_agent_sessions_chat_rooms_and_pick_vision_agent`
- `default_workspace_path_uses_user_coolzhuagent_directory`
- `workspace_tool_paths_are_scoped_to_selected_workspace`
- `workspace_glob_patterns_reject_parent_or_absolute_escape`

执行日志：

- 红灯：`tmp/logs/overview-red-20260508.log`
- 绿灯：`tmp/logs/overview-green-20260508.log`
- 红灯：`tmp/logs/workspace-red-20260508.log`
- 绿灯：`tmp/logs/workspace-green-20260508.log`
- 全量：`tmp/logs/web-console-test-20260508.log`
- 格式化：`tmp/logs/cargo-fmt-20260508.log`

验证结果：

- `cargo fmt --all` 通过。
- `cargo test -p coolzhu-web-console --offline` 通过，133 项测试全部通过。

## 备份

本次相关文件与日志已备份到：

- `tmp/backups/overview-workspace-20260508-2050`

## 待人工/交互确认

- 打开 Web 控制台后确认总览卡片不再显示 health debug 文案，且显示新的三项业务指标。
- 双击或编辑工程目录路径后，确认目录树刷新到用户选择目录。
- 后续继续联动验证：聊天室内容、记忆 beads、附件索引是否完全按 `workspace_id` 隔离。

