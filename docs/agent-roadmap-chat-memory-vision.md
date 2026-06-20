# COOLZHU AGENT 聊天室、会话、记忆与视觉联调路线

更新日期: 2026-05-05

## 范围

本文基于 `opencode/master-project-docs`、当前 `modules/gui-web`、`modules/gui-desktop`、`modules/computer-use` 与 `modules/vision` 的实现状态，收敛四条优先主线:

- 聊天室功能
- 会话管理功能
- 记忆系统功能
- 内视觉 + Computer Use 闭环

## 优先级

| 优先级 | 需求 | 价值 | 当前状态 | 推荐落点 |
| --- | --- | --- | --- | --- |
| P0 | Web 聊天室最小闭环 | 所有 Agent 交互入口 | 已有 `/api/chat/send`、消息渲染、任务列表 | `gui-web` + `core-runtime` |
| P0 | 会话 CRUD 与消息历史 | 多 Agent/多模型隔离基础 | 已有 `/api/sessions` 与分页消息 | `gui-web`，后续下沉 `core-runtime` |
| P0 | 内视觉截图 + Computer Use dry-run | 安全执行前置能力 | 已有截图、坐标矩阵、闭环 profile、safe-click-test | `gui-web` + `vision` + `computer-use` |
| P1 | 会话记忆 beads 持久化 | 长期记忆与上下文压缩基础 | 已补 `GET/POST /api/sessions/{id}/beads` | 先 `gui-web`，再抽到 `core-runtime` |
| P1 | 桌宠状态联动 | Web/桌面启动体验与可见反馈 | Web 启动会拉起桌宠，Tauri 支持 `--pet` | `gui-web` + `gui-desktop` |
| P1 | 多媒体/链接消息 | 视觉理解、设计稿、截图诊断入口 | 文档已有方案，代码仅有附件 DTO | `gui-web` 优先，CLI/desktop 跟进 |
| P2 | 真实 LLM 流式响应 | 从 mock 分发进入真实 Agent | 当前为最小分发模拟 | `llm-adapter` + `core-runtime` |
| P2 | MCP 工具统一调度 | 把 CLI/插件/Computer Use 统一成工具调用 | MCP 文档完整，Web 尚未统一调度 | `core-runtime` + `tooling` |

## 方案选型

| 方向 | 推荐方案 | 取舍 |
| --- | --- | --- |
| 聊天室 | 先保留原生 HTML/JS + Axum API，消息协议改为结构化 DTO | 体积小、便于快速联调；富文本编辑器等稳定后再引入 |
| 会话管理 | 短期 JSON 文件存储，长期 SQLite 或 sled | JSON 便于调试；多窗口并发和全文检索阶段需要数据库 |
| 记忆系统 | beads 分层: pinned/profile/task/decision/chat | 可渐进接入向量检索；当前先做确定性 CRUD 和摘要沉淀 |
| 内视觉 | 本地截图 + vision-service API + ROI 元数据 | 避免先接复杂视频流；截图和 ROI 足够支撑闭环验收 |
| Computer Use | 默认 dry-run，真实输入必须通过 safe-click-test/显式 execute | 先保证安全边界，再开放真实执行 |
| 桌宠联动 | Tauri 单实例 + `--pet` 唤起 + `pet-status` 事件 | Web 服务可独立启动，桌宠失败不阻塞主服务 |

## 技术路线

1. 聊天室
   - 定义 `ChatMessageDto` 为唯一前后端协议，包含 `id/role/author/kind/content/attachments/created_at`。
   - `/api/chat/send` 只负责任务编排与消息落库；真实模型调用放到 `core-runtime ConversationRuntime`。
   - 前端消息列表支持选择历史、附件展示、任务摘要和工具调用消息。
   - 验收: 发送消息后用户消息、Agent 摘要、工具任务列表均出现；刷新后历史可分页恢复。

2. 会话管理
   - 保留 `SessionStore` 对外 API，内部从 JSON 平滑迁移为数据库。
   - 会话模型、Provider、API Key 引用、消息、beads 必须同会话隔离。
   - API Key 明文不进消息历史，后续用 Windows DPAPI 或本机密钥环保存。
   - 验收: 新建/保存/删除/激活会话后，消息历史和 beads 不串会话。

3. 记忆系统
   - 当前阶段: `GET/POST /api/sessions/{id}/beads` 支持持久化读写。
   - 下一阶段: 聊天消息生成 `chat` bead，人工固定生成 `pinned` bead，任务完成生成 `decision/task` bead。
   - 再下一阶段: beads 下沉 `core-runtime`，提供检索接口 `query_memory(session_id, query, limit)`。
   - 验收: 发送消息能沉淀摘要；重启 Web 后 beads 仍存在；模型上下文构建能包含 pinned beads。

4. 内视觉 + Computer Use
   - `/api/capture` 生成当前桌面截图，记录路径、尺寸、hash。
   - `/api/computer-use/profile` 做截图、锚点映射、ROI、输入 dry-run、前后图 diff。
   - `/api/computer-use/closed-loop` 作为联调入口，真实输入默认关闭。
   - 验收: FHD/QHD/缩放场景下锚点坐标稳定；dry-run 不移动鼠标；safe-click-test 只点击自建测试窗口。

5. 桌宠联动
   - Web 服务启动后调用 `coolzhu-tauri-shell.exe --pet`。
   - Tauri shell 读取 `COOLZHU_GUI_WEB_URL` 指向当前 Web 地址。
   - 聊天发送、任务执行、成功/失败后通过桌面命令或后续本地事件总线设置 `thinking/success/warning/idle`。
   - 验收: 启动 Web 或 desktop 后桌宠可见；双击桌宠切换控制台；Web 端缺少 Tauri 可执行文件时服务不失败。

## 多模块联调方案

| 联调链路 | 输入 | 模块链路 | 输出 | 失败降级 |
| --- | --- | --- | --- | --- |
| 聊天发送 | 用户文本/附件 | `gui-web -> core-runtime -> llm-adapter` | assistant 消息、任务摘要 | 返回本地 task-summary |
| 记忆沉淀 | 用户消息/任务结果 | `gui-web -> SessionStore -> core-runtime memory` | bead 列表更新 | 只写 JSON，不阻塞聊天 |
| 视觉分析 | 截图请求 | `gui-web -> vision-service` | 截图元数据、视觉摘要 | 返回截图路径和待识别状态 |
| Computer Use | 操作意图 | `gui-web -> computer-use -> vision confirm` | 坐标、ROI、diff、执行结果 | dry-run 或拒绝真实输入 |
| 桌宠状态 | 服务启动/任务状态 | `gui-web -> tauri-shell -> pet-mini.html` | 桌宠动作变化 | 记录 warn，不影响 Web |
| MCP 工具 | 工具调用请求 | `core-runtime MCP -> tooling/plugin-system` | JSON-RPC 工具结果 | 标记 tool-call error 消息 |

## 验收标准

| 功能 | 必须通过 |
| --- | --- |
| 布局 | Web 控制台按 V2 百分比定位，左侧五卡、右侧四卡、中央聊天、底部输入栏无重叠 |
| 聊天室 | 发送、选择历史、加载更早、任务列表、附件链接渲染可用 |
| 会话 | CRUD、激活、分页历史、模型/Provider 保存可用 |
| 记忆 | beads API 可读写，重启后仍存在，前端 Agent 状态卡可显示 |
| 视觉 | 截图 API 返回真实文件元数据，缺少权限时给出可读错误 |
| Computer Use | profile/closed-loop dry-run 有坐标、ROI、耗时阶段；真实输入必须显式启用 |
| 桌宠 | Web 启动尝试拉起桌宠；desktop 启动直接创建桌宠；单实例 `--pet` 不强制弹控制台 |
| 回归 | `cargo check -p coolzhu-web-console`、Tauri shell manifest check、关键 memory 单测通过 |

