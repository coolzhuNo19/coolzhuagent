# 2026-05-05 语音监听入口与可自动化验证日志

本次按“先推进可落地、可自动化测试需求”的原则处理音频相关事项。真实麦克风持续监听、唤醒词识别和桌面权限确认统一放入后置交互验证批次。

## 实现范围

| 项目 | 结果 |
| --- | --- |
| opencode 参考 | 检查 `opencode/master-project/modules/gui-web/docs/local-tts-stt-plan.md`、`tools/voice_wake.py` 和 `audio.rs` |
| 复用判断 | 当前 codex 已有 `/api/audio/status`、`/api/audio/stt/*`、`/api/audio/tts/speak`，优先复用现有 `audio.rs` |
| 后端状态桥 | 新增 `/api/audio/voice-monitor/status` 与 `/api/audio/voice-monitor/toggle` |
| 音频状态扩展 | `/api/audio/status` 增加 `voice_monitor_available/running/mode/message` |
| 前端入口 | 三合一卡片底部新增“语音监听”开关，复用现有像素图标风格 |
| 布局收紧 | 三合一卡片按钮区按内容高度收紧，监听状态占用底部留白区域 |

## 风险拆分

`opencode` 的 `voice_wake.py` 依赖 `pvporcupine`、`sounddevice`、麦克风权限和 `PICOVOICE_ACCESS_KEY`。这些依赖无法仅靠单元测试保证稳定，因此本次没有直接启动守护进程，也没有让 UI 开关真实占用麦克风。

当前开关是状态桥接：能自动化验证 UI/API 联动，后续接真实监听时只需把 toggle 后端从 dry-run 状态切换为守护进程生命周期管理。

## 后置交互验证池

| 场景 | 需要人工确认 |
| --- | --- |
| 麦克风权限 | 浏览器、Tauri WebView 和 Windows 隐私权限是否允许录音 |
| 唤醒词守护进程 | `voice_wake.py` 依赖安装、key 配置、启动/停止、stdout JSON 事件 |
| 桌宠语音联动 | 唤醒/转写/回复朗读与桌宠状态、气泡显示是否同步 |
| 真实 computer-use | 鼠标点击、右键菜单、拖拽框选和视觉识别闭环 |

## 验证

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo test -p coolzhu-web-console voice_monitor -- --nocapture
```

结果：

| 验证项 | 结果 |
| --- | --- |
| `app.js` 语法检查 | 通过 |
| `voice_monitor` 单测 | 2 passed |

## 下一步

1. 继续推进 `REQ-WEB-SESSION-002`：会话、消息、beads SQLite 化与检索增强。
2. 补 `REQ-DIAG-001/002`：一键健康检查把 Web、LLM、audio、pet、vision 状态集中输出。
3. 将 `REQ-AUDIO-003` 放入交互验证批次，待麦克风权限和依赖确认后再接真实守护进程。
