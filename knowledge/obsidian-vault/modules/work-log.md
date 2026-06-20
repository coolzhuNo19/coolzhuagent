---
title: "modules 一级目录 work-log"
source:
  - "docs/module-completion-status.md"
  - "docs/interface-contracts.md"
  - "docs/repository-structure.md"
  - "docs/requirements-management.md"
  - "modules/gui-web/INTERFACE.md"
  - "modules/gui-desktop/INTERFACE.md"
  - "modules/computer-use/INTERFACE.md"
  - "modules/vision/INTERFACE.md"
  - "modules/llm-adapter/INTERFACE.md"
  - "modules/tooling/INTERFACE.md"
  - "modules/core-runtime/INTERFACE.md"
  - "modules/diagnostics/INTERFACE.md"
  - "modules/cli/INTERFACE.md"
status: "migrated"
migrated_at: "2026-06-19T00:00:00+08:00"
---
# modules 聚合 work-log

## 迁移工作记录

- gui-web：Web-GUI 从卡片主界面演进为多窗口工作台；工程、设置、聊天、任务、记忆、媒体、视觉、日志、浏览器和终端窗口已形成 D2 首版。
- gui-desktop：clawd-on-desk 核心事件→状态→帧动画→悬浮窗链路已迁移，排除了多主题、多 CLI hooks、多 agent 追踪等不适用能力。
- computer-use：精准点击根治方案确认单 VLM 不可靠，系统控件优先走 UIA，内容区目标再走本地/远端 VLM。
- vision：本地视觉栈已围绕 UI-DETR、ShowUI、Qwen/Gemma 等资源做多轮评估；8GB 显存限制要求本地资源按需拉起。
- llm-adapter：真实 provider、流式输出、reasoning effort、model_type、图文输入已可用，但自定义 OpenAI-compatible 表单和协议矩阵仍需收口。
- tooling：工具注册表已具备内置工具与插件基础，长期目标是 LLM/Web/CLI/MCP 都走 runtime_tool_execute。
- core-runtime：上下文管理从固定窗口截断走向动态预算、compact 摘要和高价值 bead 沉淀。
- diagnostics：Harness 对照分析把命令门控、结构化进度注入、idempotency、场景化脚本验证列为重点。
- cli：CLI 当前完成度较低，主要作为 workspace package 和未来无 GUI 入口。

## 本次 vault 迁移说明

- 仅整理/迁移有效内容到 `knowledge/obsidian-vault`，未删除或改写 `docs/` 原文档。
- 每份迁移文档已添加 `title/source/status/migrated_at` frontmatter，便于 Obsidian/MCP 检索。
- 后续新工作仍按项目规范回写需求表和 work-log，再同步到 vault。
