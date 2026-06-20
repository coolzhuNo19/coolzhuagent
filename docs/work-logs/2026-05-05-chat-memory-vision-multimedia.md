# 2026-05-05 聊天室、记忆、内视觉与多媒体接入日志

## 范围

本次收口按 P0 到 P2 顺序推进，重点覆盖：

- Web 聊天室真实流式回复与会话历史恢复。
- 分层 beads 记忆规则下沉到 `core-runtime`。
- 内视觉 + Computer Use 安全闭环与工具侧语义调度。
- 聊天室多媒体预览与附件索引。
- Web GUI 启动后拉起桌宠，并由桌宠切换 Web 控制台显隐。

## 功能实现

| 方向 | 实现内容 | 关键文件 | 状态 |
| --- | --- | --- | --- |
| 真实流式聊天 | `POST /api/chat/send/stream` 优先使用真实模型 SSE，前端支持 `message_delta`、`reasoning`、`done`、`error` 等事件；失败时回退到普通发送接口 | `modules/gui-web/packages/web-console/src/main.rs`、`src/app.js` | 已完成并通过真实模型冒烟 |
| 会话聊天室 | 支持聊天室列表、聊天室激活、按聊天室读取消息；切换 agent 后保留聊天室历史，回复和推理卡片不再因切换会话清空 | `modules/gui-web/packages/web-console/src/main.rs`、`src/app.js` | 已完成基础闭环 |
| Agent 配置适配 | `agent-test001`、`agent-test002` 使用 Alibaba Bailian 兼容模式，模型映射为 `glm-5`，只暴露 key 状态不暴露明文 | `modules/gui-web/packages/web-console/src/main.rs` | 已完成诊断 |
| 分层 beads 记忆 | 新增 `MemoryLayer`、层级归一、查询匹配、prompt 记忆选择；L4 原始归档默认不进入 prompt | `modules/core-runtime/packages/core-runtime/src/memory.rs`、`src/lib.rs` | 已完成基础规则 |
| 记忆 API | 保留 `GET/POST /api/sessions/{id}/beads` 与 `GET /api/sessions/{id}/beads/query`，prompt 注入改用 runtime 规则 | `modules/gui-web/packages/web-console/src/main.rs` | 已完成基础读写 |
| 内视觉工具调度 | 新增 `POST /api/tools/dispatch`，按用户语义路由到 vision、computer-use、vision-computer-use 场景；默认 dry-run | `modules/gui-web/packages/web-console/src/main.rs` | 已完成基础路由 |
| 安全点击靶场 | safe-click 覆盖全屏安全区域，支持随机三位数目标、随机窗口位置、可选视觉定位，默认几何回退 | `modules/gui-web/packages/web-console/src/main.rs` | 已完成冒烟 |
| 多媒体消息 | 前端支持图片、视频、音频、文档、链接预览；后端提供聊天室附件索引和全局附件索引 | `modules/gui-web/packages/web-console/src/main.rs`、`src/app.js`、`src/styles.css` | 已完成基础展示 |
| 桌宠联动 | Web 服务启动时写入当前 Web GUI URL 并尝试拉起 Tauri 桌宠；桌宠双击切换加载该 URL 的控制台 WebView 显隐 | `modules/gui-web/packages/web-console/src/main.rs`、`modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`、`ui/pet-mini.html` | 已完成代码链路确认 |

## 真实模型验证

`agent-test001` 与 `agent-test002` 当前均走真实 provider 配置：

| 项 | 结果 |
| --- | --- |
| provider kind | `alibaba-bailian` |
| base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| model | `glm-5` |
| API key | session key present，仅记录状态 |

已使用 `agent-test002` 进行 SSE 冒烟，返回中包含 `message_delta`、`reasoning`、`done`，未出现后端错误。

## 多模块联调链路

| 链路 | 输入 | 模块 | 输出 | 降级策略 |
| --- | --- | --- | --- | --- |
| 聊天发送 | 文本、附件、目标 agent | `gui-web -> llm-adapter -> provider` | 用户消息、assistant 消息、推理片段 | SSE 失败回退 `/api/chat/send` |
| 记忆注入 | session beads、用户 query | `gui-web -> core-runtime memory` | prompt memory beads | L4 跳过，不阻塞聊天 |
| 工具语义调度 | 自然语言操作意图 | `gui-web -> tools dispatch -> vision/computer-use` | dry-run 或执行计划 | 默认 dry-run |
| 视觉点击闭环 | 屏幕截图、目标数字 | `gui-web -> vision -> computer-use` | 识别点位、点击结果、截图证据 | 视觉不可用时几何回退 |
| 桌宠入口 | Web 服务启动、双击桌宠 | `gui-web -> tauri-shell` | Web 控制台显隐、桌宠状态 | 找不到 Tauri 可执行文件时只记录 warn |
| 附件索引 | 聊天消息附件 | `gui-web SessionStore` | 按房间或全局附件列表 | 按扩展名/MIME 做保守分类 |

## 验证记录

已执行并通过：

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo test -p coolzhu-core-runtime memory
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
cargo test -p coolzhu-llm-adapter
```

已完成接口冒烟：

- `POST /api/chat/send/stream`：真实模型流式回复。
- `POST /api/computer-use/safe-click-test`：随机/指定数字靶场点击命中。
- `GET /api/chat/rooms/{room_id}/attachments`：图片、视频、文档分类返回。
- `GET /api/attachments/index`：全局附件索引返回。

## 已知风险

| 风险 | 影响 | 下一步 |
| --- | --- | --- |
| 会话和记忆仍以 JSON store 为主 | 多窗口并发、全文检索和迁移能力有限 | P1 下沉 SQLite/FTS 存储 |
| 视觉定位可回退几何点 | 无法证明所有点击都由真实视觉识别得出 | 接入本地 VLM/OCR 后把 `use_visual_grounding=true` 纳入强验收 |
| `desktop-console` 与 Web GUI 未完全同构 | 后续若保留两套 GUI 会增加 API 接入成本 | 推荐以 Web GUI + Tauri shell 为主，desktop-console 只保留专项桌面能力 |
| 桌宠切换的是 Tauri WebView 控制台 | 不是外部浏览器标签页，无法由浏览器自身关闭标签 | 当前满足加载 Web GUI 和双击显隐；如必须外部浏览器，需要另建窗口句柄跟踪方案 |
| 多媒体当前偏展示和索引 | 上传、缩略图、富文本编辑、视频转码仍缺 | P2 继续做上传存储和富文本编辑器 |

## 后续任务

1. 将会话、消息、beads 从 JSON store 迁移到 SQLite，补唯一索引、分页和全文检索。
2. 为 beads 增加自动沉淀：聊天摘要、决策、工具执行结果、用户固定记忆。
3. 将 `/api/tools/dispatch` 接入统一工具注册中心，形成 LLM function/tool calling 可调用协议。
4. 扩大内视觉验收场景到浏览器、Windows 原生应用、系统弹窗，目标数字随机化并强制视觉确认。
5. 完成富文本输入、附件上传、缩略图抽取、图片/视频预览和索引检索。
