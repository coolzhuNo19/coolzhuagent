# 当前目录功能完成度

更新日期：2026-05-05

本表按当前 `C:\Users\zhupu\Desktop\codex` 仓库实际代码和可验证链路评估。完成度是工程可用度估算，包含功能实现、测试覆盖、跨模块联调和迁移风险，不等同于代码行数。

## 总览

| 目录 | 核心职责 | 当前完成度 | 状态 | 主要缺口 |
| --- | --- | ---: | --- | --- |
| `modules/gui-web` | Web 控制台、卡片 UI、聊天/会话/API 聚合 | 75% | 主线开发中 | 富文本编辑、上传存储、SQLite 会话库、更多 E2E |
| `modules/gui-desktop` | 桌面入口、桌宠、Tauri WebView、旧桌面控制台 | 55% | 分流整理中 | `desktop-console` 未与 Web GUI 同构，安装包和单实例联调待补 |
| `modules/core-runtime` | 会话运行时、权限、MCP、记忆规则 | 65% | 主线开发中 | 记忆服务持久化、会话 runtime 所有权、工具调用编排 |
| `modules/llm-adapter` | Provider 适配、真实模型调用、流式输出 | 70% | 可用增强中 | provider 矩阵、重试/限流、成本统计、结构化 tool call |
| `modules/computer-use` | 鼠标键盘、安全点击、分辨率映射 | 60% | 安全闭环开发中 | OCR/VLM 视觉确认、应用场景矩阵、真实执行审计 |
| `modules/vision` | 截图、视觉模型请求、坐标解析 | 45% | 基础可用 | 本地 VLM 服务管理、OCR、视频/外摄像头能力 |
| `modules/tooling` | 工具注册、插件系统、命令路由 | 50% | 基础可用 | 与 Web 工具调度统一、工具 schema、权限审计 |
| `modules/cli` | 命令行入口 | 35% | 待增强 | 聊天室、记忆、多媒体、工具调用与 Web 能力未对齐 |
| `modules/diagnostics` | 诊断工具和健康检查 | 40% | 基础可用 | 安装环境诊断、provider/模型诊断、打包迁移体检 |
| `src` | 根 workspace 聚合库 | 60% | 稳定 | 继续保持薄聚合，避免业务逻辑回流 |
| `tests` | 跨模块 smoke 和手工验证说明 | 55% | 持续补充 | Web E2E、桌宠双击、视觉真实点击、迁移安装测试 |
| `docs` | 架构、接口、需求、日志 | 70% | 已补齐主文档 | 需随功能变更保持同步，补验收模板 |
| `.coolzhu` | 本地运行数据、插件和会话存储 | 45% | 开发态可用 | 数据迁移、密钥保护、用户数据备份恢复 |
| `tmp` | 临时文件和测试输出 | 20% | 临时目录 | 需要清理策略和打包排除规则 |
| `target` | Rust 编译产物 | 不评估 | 生成目录 | 打包时排除，仅保留 release 产物 |

## 模块细节

### `modules/gui-web`

已完成：

- V2 布局思路下的主控制台卡片、聊天区、推理区和输入区。
- 配置/会话/Agent 状态合并卡片的基础功能接入。
- 真实 LLM SSE 流式回复、推理片段刷新、普通发送回退。
- 聊天室、会话消息、beads、附件索引、内视觉、Computer Use、安全点击等 API。
- 图片、视频、音频、文档、链接的基础预览。
- Web 服务启动时拉起桌宠并写入当前控制台 URL。

待完成：

- 输入框富文本化：引用回复、粘贴图片、上传文件、消息草稿。
- 会话/消息/beads SQLite 化，支持分页、全文检索和备份恢复。
- 前端 E2E：聊天室切换、流式显示、附件预览、卡片响应式布局。

### `modules/gui-desktop`

已完成：

- `tauri-shell` 桌宠透明窗口、动画、拖动、关闭、托盘和双击切换控制台。
- 控制台窗口加载当前 Web GUI URL，不再打开旧 desktop-console 页面。
- Web 服务启动时可通过 `--pet` 拉起桌宠。

待完成：

- 明确 `desktop-console` 是否退役；推荐主 GUI 保留 Web GUI + Tauri shell。
- 补安装包内 Tauri shell、Web 后端、静态资源和配置目录的路径发现。
- 桌宠状态与聊天/工具执行事件的双向联动仍需 API 化。

### `modules/core-runtime`

已完成：

- 基础 runtime、权限、MCP、session、conversation、usage 等模块骨架。
- 分层 beads 记忆规则、prompt 选择和查询匹配。

待完成：

- 将 Web 的 `SessionStore` 迁入 runtime service。
- 记忆 beads 的 SQLite/FTS/向量检索、自动摘要、去重和生命周期管理。
- 统一工具调用编排和 LLM tool calling 协议。

### `modules/llm-adapter`

已完成：

- 真实 provider 调用链路可用。
- `agent-test001`、`agent-test002` 已验证 Alibaba Bailian 兼容模式。
- 流式输出已接入 Web SSE。

待完成：

- provider 适配矩阵、模型别名规则、错误分类、重试和超时策略。
- token 使用量、成本、速率限制和 tracing。
- 结构化 tool call 与多模态输入统一协议。

### `modules/computer-use`

已完成：

- 分辨率用例、锚点映射、鼠标点击、safe-click 靶场。
- Web 侧闭环接口和工具语义调度的基础接入。

待完成：

- 必须由真实视觉识别确认点击点位的强验收模式。
- 覆盖 Windows 原生应用、浏览器页面、系统对话框和多显示器。
- 执行审计、权限开关、危险动作拦截。

### `modules/vision`

已完成：

- 截图路径、视觉请求构造、相对坐标解析。
- 可被 Web 内视觉接口和 safe-click 调用。

待完成：

- 本地 VLM/OCR 服务启动、健康检查和模型切换。
- 图片、视频帧、网页截图、外部摄像头的统一视觉输入。
- 视觉结果结构化：目标框、置信度、来源、截图证据。

### `modules/tooling`

已完成：

- 工具注册、插件系统、命令路由和兼容性测试骨架。

待完成：

- 把 `/api/tools/dispatch` 纳入统一工具注册中心。
- 工具 schema、权限、dry-run/execute 策略和审计日志。
- CLI/Web/LLM 三侧共用同一套工具调用协议。

### `modules/cli`

已完成：

- CLI workspace package 已接入。

待完成：

- 对齐 Web 聊天室、会话、记忆、多媒体、工具调用能力。
- 提供打包后无 GUI 环境的诊断和恢复命令。

### `modules/diagnostics`

已完成：

- 诊断 package 已接入 workspace。

待完成：

- 新增一键体检：端口、模型 provider、API key 状态、Tauri shell、WebView2、数据目录、截图权限。
- 打包迁移后的环境校验和修复建议。

## 推荐下一步

1. P0 收尾：固定 Web GUI 为唯一主控制台，完成桌宠双击显隐的自动化/半自动验收。
2. P1 主线：SQLite 会话库 + beads 记忆服务 + provider/tool call 协议。
3. P1 工程化：Windows 安装包、数据目录迁移、配置导入导出、诊断体检。
4. P2 体验：富文本、多媒体上传与缩略图、搜索索引、视频预览。
5. P2 安全：内视觉真实识别验收矩阵、权限开关、执行审计。
