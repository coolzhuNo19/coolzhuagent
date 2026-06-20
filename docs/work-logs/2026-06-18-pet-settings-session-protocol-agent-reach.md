# 2026-06-18 桌宠闭眼帧、设置按钮、会话协议与 Agent Reach 安装工作记录

## 背景

本轮按用户批注方案实施：

1. 修复桌宠闭眼帧缩小，不拉伸原图；优先使用现有生成链路按原图约束重新裁切/定标。
2. 统一排查设置窗口按钮：Gemma 本地模型、ShowUI、工具详情、TTS/STT 相关按钮。
3. 设置类后端闸口从散落环境变量迁移到 `coolzhu.toml` 配置项。
4. API 会话协议按“C 方案”根治，统一 OpenAI-compatible endpoint/session 形态。
5. 安装 Agent Reach。

风险变更前已备份源码：

- `tmp/backups/20260618-222135-pet-settings-session-protocol-pre`
- 备份日志：`tmp/logs/20260618-222135-backup.log`

## 主要改动

### 1. 桌宠 blink 闭眼帧尺寸稳定

涉及文件：

- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/generated-sheets-20260617/stabilize_pet_frames.py`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/blink-0.png` ~ `blink-5.png`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/blink.png`

处理方式：

- `blink` 改为只生成/播放 6 个稳定闭眼帧，与 runtime theme 保持一致。
- 使用 per-frame height crop scale，按站立角色高度约束重新生成，不通过 CSS 或非等比拉伸修正。
- 生成前清理旧 blink 孤儿帧，避免历史帧继续被 metrics/theme 误引用。
- 新增/更新 `pet_blink_active_frames_match_idle_character_scale` 测试，验证 blink 活跃帧中位角色高度与 idle 中位高度误差不超过 3%，并校验 metrics 帧数与 runtime 帧数一致。

视觉验证产物：

- `output/verification/pet-idle-blink-scale-contact-20260618.png`

### 2. 设置窗口按钮绑定与错误反馈

涉及文件：

- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/styles.css`
- `modules/gui-web/packages/web-console/src/main.rs`

处理方式：

- 修复 `requestJson`：字符串 body 自动补 `Content-Type: application/json`；非 JSON 错误响应也能带状态/正文反馈，避免按钮失败被吞。
- 重写本地模型服务切换渲染：
  - `chat` / `vision` / `off` 按钮切换时禁用按钮并显示“切换中”。
  - 切换后使用返回状态刷新，并按目标模式轮询确认。
  - 失败时回显明确错误，不再静默。
- ShowUI 顶部启动按钮统一绑定 `toggleShowUiService`。
- 工具详情按钮错误状态从“complete”修正为 `error`，并新增错误样式，避免工具失败仍显示完成态。
- TTS 手动朗读按钮补充 `data-action="tts-speak"` 并绑定 `ttsSpeakLastMessage`；音频状态加载失败时禁用/提示。
- 会话模型类型保留配置值，`image`/`图像`/`图片` 不再被模型名推断覆盖成文本。

补充前端验证：

- 启动本地 web-console：`http://127.0.0.1:8765/`
- Computer Use 插件尝试失败，错误为：
  - `Package subpath './dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js' is not defined by "exports" ... @oai/sky\package.json`
- 因插件内部导出错误，无法完成“真实 computer-use 模拟用户输入”验收；已按规范记录阻塞。
- 作为补充验证，使用真实前端页面 + fetch 拦截 + DOM MouseEvent 事件触发按钮绑定：
  - 验证 `local-models/switch` 发出 `{"mode":"chat"}` 与 `{"mode":"vision"}`。
  - 验证 ShowUI 服务按钮发出 `{"enabled":true}`。
  - 验证工具详情 modal 可打开。
  - 验证 `tts-speak` 按钮存在且状态可用。

补充验证产物：

- `output/verification/web-console-smoke-20260618.json`
- `output/verification/web-console-smoke-20260618.png`
- 失败诊断留档：`output/verification/web-console-smoke-20260618.error.json` / `.error.png`

### 3. 后端配置闸口迁移到 config

涉及文件：

- `modules/gui-web/packages/web-console/src/main.rs`
- `docs/development-standard.md`

处理方式：

- `session.chat_idempotency_window_ms` 迁移到 `coolzhu.toml` 配置读取。
- `tool.execution.command_gate_enabled` 迁移到 `coolzhu.toml` 配置读取。
- 移除/替换本轮触及链路中的业务环境变量闸口读取，避免前端设置被全局环境变量盖住。
- 开发规范补充：
  - 用户可见功能最终验收必须启动真实前端并通过 computer-use 模拟用户输入。
  - TDD 只覆盖基础功能和协议/安全必要契约，避免过度测试设计。
  - 新增业务配置/开关不得依赖 `COOLZHU_*`、`CLAW_*` 等自定义环境变量，应 config-first。

固定串检查：

- 日志：`tmp/logs/20260618-final-business-env-grep.log`
- 结果：目标业务环境变量固定串未命中。

### 4. API 会话协议 “C 方案”

涉及文件：

- `modules/llm-adapter/packages/llm-adapter/src/resolver.rs`
- `modules/llm-adapter/packages/llm-adapter/src/lib.rs`
- `modules/llm-adapter/packages/llm-adapter/src/error.rs`
- `modules/llm-adapter/packages/llm-adapter/src/providers/openai_compat.rs`
- `modules/llm-adapter/packages/llm-adapter/src/providers/claw_provider.rs`
- `modules/llm-adapter/packages/llm-adapter/src/client.rs`
- `modules/gui-web/packages/web-console/src/main.rs`

处理方式：

- 新增 `EndpointResolver`，集中解析 OpenAI-compatible / Anthropic / media endpoint：
  - root host 自动拼接 `/v1/...`。
  - base URL 已带 `/v1` 或完整 endpoint 时去重。
  - 自定义 base path 只拼 tail endpoint。
  - unsupported audio/embedding 返回 `UnsupportedCapability`。
- OpenAI-compatible client 支持 optional API key：
  - 本地兼容端点无 key 时不再写入假 key。
  - 无 key 时不发送 `Authorization` header。
- OpenAI tool result payload 去掉非标准 `is_error` 字段，保持 OpenAI 协议标准 shape。
- Anthropic messages endpoint 也走 resolver，避免 `/v1/messages` 重复。
- web-console 持久化会话转 agent session 时保留配置的 `model_type`，不再仅凭模型名推断。

TDD 红绿记录：

- RED：`tmp/logs/20260618-llm-protocol-red.log`
  - 预期失败：缺少 `EndpointResolver`。
- RED：`tmp/logs/20260618-web-model-type-red.log`
  - 预期失败：配置为 image 的会话被推断成 text。
- GREEN：
  - `tmp/logs/20260618-final-llm-lib-tests.log`
  - `tmp/logs/20260618-final-llm-cargo-check.log`
  - `tmp/logs/20260618-final-web-model-type-test.log`

### 5. Agent Reach 安装

安装位置：

- venv：`C:\Users\zhupu\.agent-reach-venv`
- CLI：`C:\Users\zhupu\.agent-reach-venv\Scripts\agent-reach.exe`
- Agent skill：`C:\Users\zhupu\.agents\skills\agent-reach`
- Codex skill：`C:\Users\zhupu\.codex\skills\agent-reach`
- mcporter 全局配置：`C:\Users\zhupu\.mcporter\mcporter.json`
- yt-dlp 配置：`C:\Users\zhupu\AppData\Roaming\yt-dlp\config`

安装说明：

- 首次 pip 安装因网络慢超时，重试成功；未要求手动下载。
- `mcporter config add` 默认误写 workspace `config/mcporter.json`，已清理并改用全局配置路径。
- 当前 `agent-reach --version`：`Agent Reach v1.5.0`
- `agent-reach doctor`：6/13 个渠道可用。
- GitHub 渠道仍需用户手动安装 GitHub CLI：
  - `https://cli.github.com`

验证日志：

- `tmp/logs/20260618-final-agent-reach-version.log`
- `tmp/logs/20260618-final-agent-reach-doctor.log`

## 最终验证命令与结果

全部命令均设置超时，日志写入 `tmp/logs/`。

| 范围 | 命令结果 | 日志 |
| --- | --- | --- |
| 桌宠 pet 测试 | `32 passed; 0 failed` | `tmp/logs/20260618-final-pet-tests.log` |
| llm-adapter lib 测试 | `72 passed; 0 failed` | `tmp/logs/20260618-final-llm-lib-tests.log` |
| llm-adapter cargo check | `Finished dev profile` | `tmp/logs/20260618-final-llm-cargo-check.log` |
| web app JS 语法 | exit 0 | `tmp/logs/20260618-final-web-app-node-check.log` |
| web model_type 测试 | `1 passed; 0 failed` | `tmp/logs/20260618-final-web-model-type-test.log` |
| web llm_tool_definitions | `5 passed; 0 failed` | `tmp/logs/20260618-final-web-llm-tool-definitions-test.log` |
| web_bind 测试 | `1 passed; 0 failed` | `tmp/logs/20260618-final-web-bind-tests.log` |
| web-console cargo check | `Finished dev profile` | `tmp/logs/20260618-final-web-console-check.log` |
| 业务环境变量固定串检查 | 无命中 | `tmp/logs/20260618-final-business-env-grep.log` |
| Agent Reach doctor | 6/13 channels available | `tmp/logs/20260618-final-agent-reach-doctor.log` |

## 未完成/需用户侧处理

1. Computer Use 插件当前内部导出错误，无法执行真实 Windows 前端输入验收；本轮已用 DOM 事件烟测补充验证按钮绑定，但不等价于 computer-use。
2. Agent Reach GitHub 渠道需安装 `gh` CLI 后再运行 doctor：
   - 下载地址：`https://cli.github.com`
3. Codex 新安装的 `agent-reach` skill 通常需要重启 Codex 后才会在新会话中被发现。

