# 2026-05-05 beads 会话与记忆层落地方案

## 背景

当前聊天室、会话配置和 beads 分层规则已经有基础链路：会话数据保存在 Web JSON store，`core-runtime` 提供层级归一、查询匹配和 prompt 选取规则，聊天完成后会自动沉淀部分 assistant 回复为 beads。

本轮目标是先把会话级 beads 做成可验证、可治理的闭环，再进入工具卡片后端接入。SQLite 和 runtime 统一服务作为后续增强，不阻塞当前 GUI 调试。

## 范围

| 需求 | 本轮处理 |
| --- | --- |
| `REQ-MEM-002` | 会话级 beads CRUD/API 先在 Web store 完整闭环；runtime/SQLite 下沉保留后续项 |
| `REQ-MEM-003` | 聊天回复、推理和工具摘要自动沉淀 beads，增加去重和容量上限 |
| `REQ-MEM-004` | 提供 prompt 记忆预览 API，验证 L1-L3 选取、L4 默认不进 prompt |
| `REQ-MEM-005` | 支持 pin、更新、删除等基础治理动作 |
| `REQ-WEB-UI-002` | 顺手修复三合一卡片输入框/下拉框右侧溢出 |

## API 设计

| API | 方法 | 用途 |
| --- | --- | --- |
| `/api/sessions/{session_id}/beads` | `GET` | 获取当前会话 beads 与汇总信息 |
| `/api/sessions/{session_id}/beads` | `POST` | 新增或按签名去重更新 bead |
| `/api/sessions/{session_id}/beads/query` | `GET` | 按关键词、layer、kind、prompt_only 查询 beads |
| `/api/sessions/{session_id}/beads/summary` | `GET` | 返回 layer/kind/pinned/prompt 候选统计 |
| `/api/sessions/{session_id}/beads/prompt` | `GET` | 返回 prompt 注入候选和渲染后的记忆上下文 |
| `/api/sessions/{session_id}/beads/{bead_id}` | `PATCH` | 更新 summary/kind/layer/source/pinned/confidence |
| `/api/sessions/{session_id}/beads/{bead_id}` | `DELETE` | 删除指定显式 bead |

## 规则

- 默认最多保留 `256` 条显式 beads。
- 新增 bead 使用 `layer + kind + source + summary` 作为去重签名。
- 命中重复 bead 时不新增，只提升 pinned/confidence。
- 容量裁剪优先保留 pinned、prompt 价值更高层级、高置信度、较新的 beads。
- prompt 预览使用 `core-runtime` 的 `select_prompt_memory_beads`，默认跳过 L4。
- 自动沉淀来源标记为 `chat-room:auto-extract`。

## 验收标准

| 项 | 标准 |
| --- | --- |
| 三合一卡片 | 会话名称、Provider、模型、Key 引用输入/下拉框不越过卡片右边界 |
| 查询 | 能按 `layer=L2`、`kind=decision`、关键词检索 |
| 治理 | 能新增、更新 pinned/confidence、删除显式 bead |
| 去重 | 重复 summary/kind/source/layer 不产生重复 bead |
| prompt | `prompt` API 返回的上下文不包含 L4，并按 pin/layer/confidence 选取 |
| 自动沉淀 | 流式和非流式聊天完成后都能为目标会话沉淀 assistant/tool/reasoning beads |

## 风险

| 风险 | 处理 |
| --- | --- |
| JSON store 并发能力有限 | 本轮只做单机 GUI 调试闭环；SQLite/FTS 放入下一阶段 |
| 自动沉淀质量粗糙 | 先做确定性摘要和去重，后续引入模型摘要和人工确认 |
| 删除默认派生 beads 语义不清 | 本轮只允许治理显式 beads；默认派生 beads 不写入 store |
