# 2026-05-15 工具权限安全组闭环：REQ-TOOL-008/009/010

时间：2026-05-15 00:46 +08:00  
范围：`REQ-TOOL-008` 工具权限分级审批、`REQ-TOOL-009` 工具审批审计与 UI 摘要、`REQ-TOOL-010` Protected 路径规则表  
备份：`tmp/backups/20260515-tool-permission-008-010-close/`

## 背景

`REQ-VIS-008` / Precise-Click Grounding 已闭环后，需求管理表下一优先级转入工具权限组。复查 `tool-permission*` 工作日志后确认：

- `REQ-TOOL-008` 已有审批 API、SSE 事件、前端审批浮层，剩真实 Web UI 交互确认。
- `REQ-TOOL-009` 已有 `.coolzhu/tool-audit.jsonl`、`/api/tools/audit`、前端审计表，剩 UI 刷新与脱敏复核。
- `REQ-TOOL-010` 已有 `[tool.protected_paths]` 规则配置与 TDD，剩 diagnostics 输出解析失败。

## 代码变更

### `modules/gui-web/packages/web-console/src/main.rs`

- 新增 `workspace_config_health_check()` / `workspace_config_health_check_for()`。
- `/api/diagnostics/health` 新增检查项 `config.coolzhu_toml`：
  - `ok`：显示 `coolzhu.toml` 解析成功、protected 规则模式、rules/extra_rules 数量。
  - `error`：显示 `coolzhu.toml` 解析失败，并提示修复 `[tool.protected_paths] rules/extra_rules`。
- `load_workspace_config_at()` 遇到 malformed `coolzhu.toml` 时改为使用默认配置运行，但不再覆盖原文件，保留现场给 diagnostics 和用户修复。
- 新增 2 条 TDD：
  - `diagnostics_config_health_reports_toml_parse_failure`
  - `load_workspace_config_keeps_malformed_config_for_diagnostics`

### `tmp/tool-permission-acceptance.ps1`

新增 API 验收脚本，覆盖：

- `GET /api/state` 服务可达。
- `GET /api/tools/protected-paths` 包含 `coolzhu-config`。
- `GET /api/diagnostics/health` 包含 `config.coolzhu_toml`。
- `glob_search` ReadOnly 自动执行且不进入 pending。
- `write_file coolzhu.toml` 命中 Protected，返回 `dry-run-only` 并进入 pending。
- `/api/tools/audit` 同时出现 `ok` 与 `dry-run-only` 记录，secret probe 不泄露。
- `/api/tools/reject` 与 `/api/tools/approve` 能消费 pending。

### `tmp/tool-permission-ui-cdp-check.mjs`

新增 Headless Edge + CDP 的真实 Web UI 验收脚本，覆盖：

- 页面存在审批浮层和审计表 DOM。
- 页面上下文触发 Protected `write_file` 后，SSE/pending 能渲染审批浮层。
- 审批浮层显示工具名和受影响的 `coolzhu.toml` 路径。
- 点击“拒绝”后面板隐藏并清空 active call。
- 审计表刷新后显示 protected write 的 `dry-run-only` 行。
- 审计 UI 不显示 raw secret probe。
- 点击“授权本次”后面板隐藏并清空 active call。

## 验证记录

日志均在 `tmp/logs/`：

- `tool010-diagnostics-config-health-20260514.log`：定向测试通过。
- `tool010-diagnostics-load-preserve-20260514.log`：定向测试通过。
- `tool010-diagnostics-cargo-fmt-20260515.log`：`cargo fmt --all` 通过。
- `tool010-diagnostics-web-console-tests-20260515.log`：`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`，207 passed。
- `tool010-diagnostics-web-console-check-20260515.log`：`cargo check -p coolzhu-web-console --offline` 通过，仅保留既有 unused warnings。
- `tool-permission-app-js-node-check-20260515.log`：`node --check app.js` 通过。
- `tool-permission-acceptance-20260514.log`：API 验收通过。
- `tool-permission-ui-cdp-20260515.log`：UI CDP 验收通过。

验收产物：

- API summary：`tmp/verification-runs/tool-permission-20260515-003218/summary.md`
- UI summary：`tmp/verification-runs/tool-permission-ui-20260514-164613/summary.md`
- UI 截图：
  - `tmp/verification-runs/tool-permission-ui-20260514-164613/approval-panel.png`
  - `tmp/verification-runs/tool-permission-ui-20260514-164613/audit-table.png`

## 需求状态

- `REQ-TOOL-008`：`测试中 -> 已完成`
- `REQ-TOOL-009`：`测试中 -> 已完成`
- `REQ-TOOL-010`：`测试中 -> 已完成`

需求统计同步更新：

- 已完成：59 -> 62
- 测试中：8 -> 5

## 剩余风险与下一步

- `REQ-TOOL-011` 仍需真实 LLM 多 tool_use 交互复核，重点确认多工具并发后的 ToolResult 数量、顺序和审计记录。
- `REQ-CORE-TOOL-001` 仍需真实 MCP 工具交互复核，重点确认 MCP `tools/call` 前置 runtime 闸门在真实外部 server 下仍能拦截越界写入。
- 完成以上两个工具安全闸门后，主线转入 `REQ-WEB-SESSION-007`、`REQ-WEB-CTX-001`、`REQ-MEM-006`、`REQ-WEB-CHAT-007` 的会话/记忆/协同闭环。
