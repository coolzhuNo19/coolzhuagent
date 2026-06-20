---
title: "Vision work-log"
source:
  - "modules/vision/INTERFACE.md"
  - "docs/vision-tool-service-plan-2026-05-08.md"
  - "docs/showui-vision-agent-separation-plan-2026-05-12.md"
  - "docs/showui-vs-uidetr-realtime-vision-eval-2026-05-30.md"
  - "docs/realtime-vision-voice-completion-analysis-2026-06-04.md"
  - "docs/work-logs/2026-06-08-local-vision-stack-and-agnes-understanding.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# Vision work-log

## 迁移工作记录

- 本地视觉栈已围绕 UI-DETR、ShowUI、Qwen/Gemma 等资源做多轮评估；8GB 显存限制要求本地资源按需拉起。
- 2026-06-08 推进了 agnes 理解层、误触发修复、视觉会话可配和实时视觉理解 API。
- 视觉语音实时链路已有大量验收截图与 recorder 证据，仍需避免“视觉理解请求误点桌面”。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。
