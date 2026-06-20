# 2026-05-05 UI 拆分、多媒体与工程路径方案记录

本次根据新需求先落地低风险、可自动化验证项，并把需要方案评估或人工验证的内容纳入需求管理。

## 已落地

| 项目 | 结果 |
| --- | --- |
| 语音监听独立卡片 | 从“配置 / 会话 / Agent 状态”三合一卡片移出，改为左侧底部独立小卡片，无标题框 |
| 三合一卡片隔离 | 会话配置区域不再承载语音监听开关，降低配置表单布局被影响的风险 |
| 桌宠状态协议 | `pet_status` / `set_pet_action` 返回 `bubble` 和 `frames`，支持自动化检查 |
| 桌宠气泡 UI | `pet-mini.html` 可消费 `pet-status` 事件中的 `bubble` 字段显示状态气泡 |
| 桌宠资源映射 | `warning` 和 `success` 改为独立动作帧，不再映射到 blink/idle |

## 新增需求方案

### REQ-WEB-MEDIA-005 消息发送文件按钮

方案：

1. 前端 composer 增加文件按钮和隐藏 file input。
2. 先把文件作为附件元数据进入消息发送 payload。
3. 后端补本地附件存储目录、文件大小/MIME 白名单、附件索引写入。

风险：

- 本地文件路径不应直接暴露给模型或聊天室 HTML。
- 上传目录需限定在 workspace 数据目录或应用数据目录。
- 大文件、视频、音频需要异步索引和预览降级。

自动化先行：

- URL/附件元数据渲染、附件索引 API、非法 MIME 拒绝。
- 真正 OS 文件选择器放入人工交互验证。

### REQ-WEB-MEDIA-006 聊天室音频富文本播放

方案：

1. 扩展 `isAudioUrl`，识别 `mp3/wav/ogg/webm/m4a/flac`。
2. `renderAttachments` 对 `audio` 生成 `<audio controls preload="metadata">`。
3. Markdown URL 或附件元数据都走同一 attachment 渲染路径，避免重复显示。

风险：

- 外部音频 URL CORS/Range 支持不稳定。
- 音频控件点击必须继续避开消息选中逻辑。
- 自动播放不能默认开启。

自动化先行：

- DOM 渲染测试、`interactiveMessageSelector()` 包含 audio 控件、附件 kind 分类测试。

### REQ-WEB-PROJECT-001 工程目录路径切换

方案：

1. 后端新增 workspace registry，允许用户选择或输入 workspace。
2. 路径必须规范化并经过 allowlist / recent workspaces 校验。
3. 会话、beads、附件、工具执行日志按 workspace_id 分区。
4. 工具调用必须绑定当前 workspace 权限上下文，切换 workspace 后刷新工具根目录和记忆检索上下文。

风险：

- 路径越权：不能通过 `..`、符号链接或 UNC 路径逃逸到未授权目录。
- 记忆串用：不同工程的 beads 不能默认混入 prompt。
- 聊天串用：聊天室和附件索引应明确属于 workspace 或全局。
- 工具执行：CLI、文件读写、computer-use 相关工具需要 workspace-scoped permission。

建议：

- 先做只读路径切换和目录预览。
- 再做 workspace 级会话/记忆绑定迁移。
- 最后开放工具执行上下文切换。

## 后置交互验证

| 场景 | 原因 |
| --- | --- |
| 文件选择器 | 浏览器/WebView 权限和用户操作不可纯单测覆盖 |
| 真实音频文件播放 | 解码器、CORS、设备输出需要人工确认 |
| 工程路径选择 | 涉及真实文件系统权限和用户确认 |
| 桌宠双击/拖动/窗口置顶 | Tauri 窗口行为需要桌面交互验证 |

## 自动化验证

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo test -p coolzhu-web-console voice_monitor -- --nocapture
cargo test -p coolzhu-web-console
cargo test --manifest-path modules\gui-desktop\packages\tauri-shell\src-tauri\Cargo.toml pet_ -- --nocapture
cargo check --manifest-path modules\gui-desktop\packages\tauri-shell\src-tauri\Cargo.toml
```

结果：

| 验证项 | 结果 |
| --- | --- |
| Web JS 语法检查 | 通过 |
| Web 语音监听状态单测 | 2 passed |
| Web console 全量测试 | 94 passed |
| Tauri shell 桌宠状态单测 | 3 passed |
| Tauri shell cargo check | 通过 |
