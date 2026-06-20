---
title: "CLI API 接口"
source:
  - "modules/cli/INTERFACE.md"
  - "docs/mcp-cli-terminal-analysis-2026-05-30.md"
  - "docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md"
  - "docs/hard-requirements-implementation-plan-2026-05-10.md"
  - "docs/current-issues-and-unfinished-requirements-2026-05-31.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# CLI API 接口

## 职责边界

命令行入口，用于文本交互、调试、兼容命令和无 GUI 环境运行。

## 稳定接口 / 当前入口

| 接口/命令 | 用途 |
| --- | --- |
| `package: coolzhu-command-line` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `bin: coolzhu-cli` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `cargo run -p coolzhu-command-line -- --help` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `future: CLI constructs ToolInvoke{caller=Cli}` | 迁移自源接口文档，作为当前 vault 的导航入口。 |
| `future: shared MCP/runtime/session core` | 迁移自源接口文档，作为当前 vault 的导航入口。 |

## 接口审查清单

- JSON 字段、HTTP 路由、DTO、公有函数签名、tool schema、视觉坐标语义变化都视为接口变更。
- 新字段保持可选或提供默认值；字段删除先标记 deprecated。
- 接口变更必须同步对应模块 `INTERFACE.md`、前端消费点和联调测试。
