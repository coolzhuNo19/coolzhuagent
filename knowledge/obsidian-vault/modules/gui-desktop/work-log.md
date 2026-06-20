---
title: "GUI Desktop / 桌宠 work-log"
source:
  - "modules/gui-desktop/INTERFACE.md"
  - "docs/desktop-pet-clawd-integration-and-new-features-2026-05-31.md"
  - "docs/desktop-pet-review-and-filedrop-2026-06-04.md"
  - "docs/clawd-on-desk-port-analysis-2026-05-31.md"
  - "docs/work-logs/2026-06-18-pet-settings-session-protocol-agent-reach.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# GUI Desktop / 桌宠 work-log

## 迁移工作记录

- clawd-on-desk 核心事件→状态→帧动画→悬浮窗链路已迁移，排除了多主题、多 CLI hooks、多 agent 追踪等不适用能力。
- 2026-06-03 落地过超人飞行和空闲表演；2026-06-16 最新口径已切换为银白金属 Q 版武侠侠客并替换旧动作。
- 桌宠文件拖放采用 HTML5 路径，原生 WM_DROPFILES 失败方案已废弃。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。
