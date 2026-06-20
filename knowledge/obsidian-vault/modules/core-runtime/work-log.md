---
title: "Core Runtime work-log"
source:
  - "modules/core-runtime/INTERFACE.md"
  - "docs/session-memory-workspace-integration-plan-2026-05-10.md"
  - "docs/context-management-analysis-2026-05-30.md"
  - "docs/context-compaction-threshold-benchmark-2026-05-31.md"
  - "docs/code-audit-context-tools-goal-2026-05-31.md"
  - "docs/work-logs/2026-06-07-video-multiround-memory.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Core Runtime work-log

## 迁移工作记录

- 上下文管理从固定窗口截断走向动态预算、compact 摘要和高价值 bead 沉淀。
- Goal、多 Agent、工具和视频异步链路都在向 core-runtime 收敛，需防止 web-console 巨型文件继续承载核心业务。
- 代码隐患审查排除了若干误判，真实次要隐患包括部分模型上下文容量登记偏小。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。
