# 高难度未开发需求落地实施方案

文档版本：v1.0  
创建日期：2026-05-10  
交付对象：实现 agent（拿到文档即可开发并验证）

---

## 0. 文档定位

本方案覆盖当前 `requirements-management.md` 中实施难度最高、外部依赖最多的 7 类未开发需求：

| 序号 | 需求 | 优先级 | 状态 | 关键难点 |
| --- | --- | --- | --- | --- |
| §1 | `REQ-DESK-PET-003` 桌宠状态联动 | P1 | 开发中 | 跨进程事件总线 |
| §2 | `REQ-AUDIO-003` 唤醒词守护进程 | P2 | 待开发 | Python/Picovoice 集成、麦克风权限 |
| §3 | `REQ-VIS-009` + `REQ-VIS-010` 持续监控 + 关键词触发 | P2 | 待开发 | 后台截图、VLM 成本、工具权限联动 |
| §4 | `REQ-PACK-007/008/001/003` 环境检测 + 首启动向导 + NSIS 安装包 | P1 | 待开发 | 安装期/启动期双轨诊断 |
| §5 | `REQ-PACK-013` + `REQ-PACK-012/004` 模型资源随包/分包下载 | P1 | 待开发 | 11GB+ 模型体积 |
| §6 | `REQ-PACK-009` 加密资源镜像与完整性校验 | P1 | 待开发 | 签名验证 + 密钥管理 |
| §7 | `REQ-PACK-010` 在线授权激活与机器指纹绑定 | P1 | 待开发 | 服务端 + 隐私最小化 |

另附轻量方案：`REQ-LLM-004` 重试/限流/成本统计、`REQ-CLI-001/002` CLI 对齐、`REQ-PACK-002/005` 迁移与回滚。

本方案与已有方案文档的关系：
- §3 依赖 `precise-click-grounding-plan-2026-05-10.md` 的 GroundingRouter。
- §3 依赖 `tool-calling-permission-plan-2026-05-10.md` 的权限闸门。
- §4/§5 依赖 `session-memory-workspace-integration-plan-2026-05-10.md` 的 WorkspaceScope。

---

## 1. REQ-DESK-PET-003：桌宠状态联动（含事件总线）

### 1.1 现状

- `tauri-shell` 桌宠已实现 idle/blink/thinking/sleeping/warning/success 帧（`REQ-DESK-PET-004/005` 已完成）。
- 无跨进程事件通道：Web 后端有事件（chat send / reasoning / tool exec），桌宠不知情。
- 现有 `spawn_blocking` 只等桌宠退出，没有双向。

### 1.2 方案：本地 JSONL 事件流 + tray HTTP

**思路**：既然 Web 服务已经绑了 127.0.0.1:9865，桌宠直接订阅一个 SSE 通道即可。不要引入额外消息中间件。

#### 1.2.1 服务端（web-console）

新增 endpoint：

| Method | Path | 作用 |
| --- | --- | --- |
| `GET` | `/api/events/stream` | SSE 多事件通道（pet / chat / tool / system） |
| `GET` | `/api/events/pet/state` | 拉取当前桌宠状态，供新连接入场 |

事件类型（`PetEvent`）：

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PetEvent {
    Idle { reason: &'static str },
    Thinking { tag: String, since_ms: u64 },
    Blink { duration_ms: u32 },
    Warning { summary: String, ttl_ms: u32 },
    Success { summary: String, ttl_ms: u32 },
    Sleeping { scheduled_at: String },
}
```

发射规则（由 `PetBus::emit(event)` 唯一入口调用）：

| 触发点（file:line） | 事件 |
| --- | --- |
| `agent_chat_response` 流式开始 | `Thinking{tag: agent.name}` |
| 流式 token delta 每 800ms | `Blink{duration_ms:200}`（心跳） |
| 流式 finish | `Success{summary: first_line, ttl_ms: 3000}` |
| 流式 error / provider 4xx/5xx | `Warning{summary: error_class, ttl_ms: 5000}` |
| `run_tool_dispatch` `execute_allowed=true` 前 | `Thinking{tag: "tool:" + tool_name}` |
| tool execute 成功 | `Success` |
| tool execute 失败 / `Rejected` / `Timeout` | `Warning` |
| 无活跃会话 120s | `Idle{reason: "no-activity"}` |
| 系统时钟 23:00-07:00 | `Sleeping` |

`PetBus` 只广播到最新状态 + SSE 订阅者；写本地 `tmp/pet-events.log` 用于回放调试。

#### 1.2.2 桌宠端（tauri-shell）

- 启动参数新增 `--web-url http://127.0.0.1:9865`。
- 内部 tokio task：`reqwest::Client::get("{web_url}/api/events/stream").eventsource()`。
- 断线重连：指数退避，上限 30s。
- 每条 `PetEvent` 用 Tauri `app_handle.emit_to("pet-window", "pet:event", payload)` 派发到 webview 动画层。
- 动画层当前已支持状态切换，只需在 `onStateChange` 里接 `pet:event` 事件。

#### 1.2.3 桌宠 → Web 反向（可选）

桌宠双击切换控制台已经通过 `--toggle-console` 自行处理。本轮**不做**反向通道，避免复杂度。未来需要时（例如"桌宠点了就暂停对话"），增加 `POST /api/events/pet/intent`。

### 1.3 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `web-console/src/pet_bus.rs`（新） | `PetBus` 实现（tokio broadcast channel），`emit` API，SSE handler |
| 2 | `web-console/src/main.rs` | 注册路由 `/api/events/stream` `/api/events/pet/state`；在 §1.2.1 列出的发射点插入 `PetBus::emit(...)` |
| 3 | `gui-desktop/packages/tauri-shell/src/main.rs` | 启动时 spawn `PetEventSubscriber`；维护连接状态 |
| 4 | `gui-desktop/packages/tauri-shell/src/pet_subscriber.rs`（新） | SSE 订阅 + 指数退避 |
| 5 | `gui-desktop/packages/tauri-shell/resources/pet.html` + `pet.js` | 接 Tauri event `pet:event` 映射到动画 state |
| 6 | `web-console/tests/pet_bus.rs` | TDD：向 bus emit 3 事件 → SSE 订阅者收到 3 条 |
| 7 | `tests/manual-visual-confirmation.md` | 新增"桌宠状态联动"手动用例：发送消息 → Thinking；出错 → Warning |

### 1.4 验收

- 单元：`cargo test -p coolzhu-web-console --offline` 包含 pet_bus 用例绿。
- E2E：`cargo run -p coolzhu-web-console -- --open` + 桌宠运行；发送消息桌宠进入 Thinking；模型 key 错误时 Warning。
- 状态变更闭环：REQ-DESK-PET-003 从 `开发中` → `测试中`（待手动 2 设备交互验证后 → `已完成`）。

---

## 2. REQ-AUDIO-003：唤醒词持续监听守护进程

### 2.1 现状

- STT/TTS 已完成；UI 已有"语音监听"toggle。
- 缺持久后台唤醒词 daemon；缺事件流回传 UI。
- Picovoice 需要 `PICOVOICE_ACCESS_KEY`（免费 tier 可用），依赖 Python `pvporcupine` 或 Rust `porcupine-rs`。

### 2.2 方案：Rust 直连 porcupine + 备用 openWakeWord

两条后端，按配置选择：

| 后端 | 依赖 | 离线 | 延迟 | 推荐度 |
| --- | --- | --- | --- | --- |
| `porcupine` | `porcupine-rs` crate + 免费 key | 需联网激活一次 | ~50ms | **默认**（工程稳定） |
| `openwakeword` | Python 子进程 + onnxruntime | 完全离线 | ~150ms | 无 key 时降级 |

#### 2.2.1 生命周期

```
WakeWordDaemon
  ├── start(word, backend)  → enters Running
  ├── tick() 周期从麦克风读 20ms PCM，送 backend.process(pcm)
  ├── detected(confidence) → emit AudioEvent::Detected
  ├── error → emit Error; 重试 3 次退化 Stopped
  └── stop() → release mic
```

#### 2.2.2 配置

```toml
[audio.wake_word]
enabled = false                    # 默认关，用户点 toggle 才启动
backend = "porcupine"              # porcupine | openwakeword
word = "kouluzhu"                  # Picovoice 专有关键词或自训练
porcupine_access_key_ref = "picovoice_key"  # secret store 引用
openwakeword_model_path = "resources/openwakeword/kouluzhu.onnx"
sample_rate = 16000
sensitivity = 0.5
cooldown_ms = 1500                 # 连续触发间隔
```

#### 2.2.3 事件

扩展现有 `/api/audio/status` + SSE `/api/events/stream`：

```rust
enum AudioEvent {
    WakeStarted { backend: String, word: String },
    WakeDetected { ts: String, confidence: f32 },
    WakeError { reason: String },
    WakeStopped,
}
```

每次 `WakeDetected` 在 UI 上显示气泡 + 写 audit 日志。

#### 2.2.4 路由与权限

| Method | Path | 作用 |
| --- | --- | --- |
| `POST` | `/api/audio/wake/start` | 启动 daemon（body: backend, word, sensitivity） |
| `POST` | `/api/audio/wake/stop` | 停止 |
| `GET` | `/api/audio/wake/status` | 当前状态 + 最近 10 次 detection |
| `POST` | `/api/audio/wake/test` | 本地测试一条 16kHz wav，返回 confidence（不启动 daemon） |

权限：`/wake/start` 在 `tool-permission-required` 流程之外，属于 UI 直接授权（首次要求弹窗确认"允许访问麦克风"）。

### 2.3 麦克风权限

Windows 通过 `cpal` 访问麦克风；首次失败时 UI 提示：`Settings → Privacy & security → Microphone → Allow desktop apps to access microphone` 并给出快捷链接 `ms-settings:privacy-microphone`。

### 2.4 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/audio/packages/wake-word/Cargo.toml`（新 crate） | `porcupine = "1.9"`, `cpal = "0.15"`, `hound`, `onnxruntime` |
| 2 | `modules/audio/packages/wake-word/src/lib.rs` | `WakeWordBackend` trait、`PorcupineBackend`、`OpenWakeBackend`、`WakeWordDaemon` |
| 3 | `modules/audio/packages/wake-word/src/mic_stream.rs` | `cpal` 采集 → 16kHz mono PCM ring buffer |
| 4 | `modules/audio/INTERFACE.md` | 新 crate 说明 |
| 5 | `web-console/src/main.rs` | 路由 + 事件接入 `PetBus`（Wake Detected → `PetEvent::Blink`） |
| 6 | `app.js` | toggle 按钮状态、气泡显示、麦克风权限引导 |
| 7 | `modules/audio/packages/wake-word/tests/fixtures/hey_kouluzhu_16k.wav` | 录 3 条触发音 + 3 条无关音；`test=wake_word_detects_positive` |
| 8 | `docs/requirements-management.md` | REQ-AUDIO-003 → 测试中（daemon + 事件完成；人工 daily-use 交互验证后 → 已完成） |

### 2.5 验收

- 单元：fixtures wav 正样本 confidence > 0.6，负样本 < 0.3。
- 手动：用户说"口橘猪"（或自选 word）→ UI 气泡 + 桌宠 blink；静音 60 秒无误触。
- 下线：daemon 占用 ≤ 1% CPU、内存 < 80MB、不影响 STT/TTS。

---

## 3. REQ-VIS-009 + REQ-VIS-010：持续监控 + 关键词触发

### 3.1 整体思路

把"持续监控"拆成两层：**采集层**（纯截图）与**识别层**（可开关、可限流）。这样即使 VLM 成本/精度不达标，采集层也能独立运行做回放分析。

### 3.2 采集层（REQ-VIS-009）

#### 3.2.1 MonitoringRoi

```rust
pub enum MonitoringRoi {
    FullScreen,
    Region { x: u32, y: u32, w: u32, h: u32 },   // 物理像素
    WindowByTitleRegex(String),                    // 跟随活动窗口
}

pub struct MonitoringConfig {
    pub enabled: bool,
    pub roi: MonitoringRoi,
    pub interval_ms: u32,           // 最小 3000，最大 600_000
    pub dedupe_hash_threshold: u8,  // 相邻帧 pHash 差 <= 此值视为相同，丢弃
    pub max_frames_per_minute: u8,  // 硬上限
    pub retention_frames: u32,      // 落盘保留多少帧
    pub store_dir_override: Option<PathBuf>,
}
```

#### 3.2.2 无 CMD 窗口采集

当前 `capture_desktop` 走 `powershell -File`，每次弹 CMD 窗口，不能高频用。改为：

- **Rust 直调 GDI/DXGI**：新增 `modules/vision/packages/capture-native`，使用 `windows` crate 的 `Graphics::Gdi::BitBlt` 或 `Graphics::Capture::GraphicsCaptureSession`（UWP API，现代 Windows 推荐）。
- 返回 `image::RgbaImage`，直接写 PNG。
- 完全无 stdout/stderr 弹窗。

#### 3.2.3 路由

| Method | Path | 作用 |
| --- | --- | --- |
| `POST` | `/api/monitoring/start` | body: MonitoringConfig |
| `POST` | `/api/monitoring/stop` | 停止 |
| `GET` | `/api/monitoring/status` | 状态 + 最近帧路径 |
| `GET` | `/api/monitoring/frames?since=&limit=` | 历史帧清单 |
| `POST` | `/api/monitoring/roi/from-drag` | 从前端拖拽框选结果登记 ROI |

#### 3.2.4 限流

- `tokio_util::time::DelayQueue` 节流到 `interval_ms`。
- pHash 用 `img_hash` crate，相邻帧差 ≤ 阈值直接跳过；节省磁盘与后续识别成本。
- `max_frames_per_minute` 触发时停止采集 60s，写 `[MON-RATE] exceeded` 诊断。

### 3.3 识别层（REQ-VIS-010）

#### 3.3.1 规则模型

```rust
pub struct KeywordRule {
    pub id: String,
    pub keywords: Vec<String>,        // 任一命中即触发
    pub intent: String,               // 传给 semantic_dispatch 的 intent 文本
    pub require_user_approval: bool,  // true = 触发审批；false 必须是 ReadOnly
    pub cooldown_secs: u32,           // 避免连续触发
    pub scope_hint: Option<RegionAnchorKind>,  // 识别只看 ROI
    pub enabled: bool,
}
```

配置：

```toml
[[monitoring.keyword_rules]]
id = "meeting-record-alert"
keywords = ["录制已停止", "Recording stopped"]
intent = "写一条桌面通知：会议录制已停止"
require_user_approval = false
cooldown_secs = 30
enabled = true
```

#### 3.3.2 调度

每采集到一帧：

1. `beads_fts_like_rule_filter`：先用关键词集合做便宜的早退检查（对 ROI 做 OCR 或把关键词先编译成正则，匹配不到直接跳过 VLM）。
2. 通过时再调 `POST /api/vision/describe-screen`（已存在）或 `POST /api/vision/locate` 的 OCR capability（`REQ-VIS-006` 已预留）。
3. 对比 VLM 返回文本，keyword 命中 → 查 cooldown → 命中则 emit `monitoring-rule-matched` 事件。
4. 按规则 → 构造 `ToolInvoke{tool_name: "tools_semantic_dispatch", input: {intent, execute: require_user_approval ? false : true}, caller: ToolCaller::Mcp}`（作为自动触发源，不等价于 LLM 主动调用）→ 走 `runtime_tool_execute`（§tool-calling-permission-plan §4）。
5. 权限闸门同步工作：`require_user_approval=true` 或工具本身非 ReadOnly 时，前端审批面板弹出。

#### 3.3.3 成本与隐私

- `monitoring.cost_budget`：单日最大 VLM 调用次数（默认 400 次 ≈ $0.5 等级）。
- 默认 **不** 把截图发远端，除非 `remote_vlm_enabled=true` 且用户在 UI 显式勾选"允许上传监控截图"。
- 审计：每次规则触发写 `monitoring-audit.jsonl`，含 `rule_id / frame_hash / matched_keywords / dispatch_outcome`，**截图正文不入日志**。

### 3.4 前端

- 内视觉卡片新增"监控"tab：
  - 开关、间隔滑块、ROI 选择（全屏/拖拽/窗口标题）
  - 规则表编辑器（关键词 chip、intent 文本、冷却、审批开关）
  - 最近 10 次触发日志
- 拖拽 ROI：用已有截图点击捕获逻辑，增加 `mousedown → mousemove → mouseup` 记录矩形，提交 `POST /api/monitoring/roi/from-drag`。

### 3.5 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/vision/packages/capture-native/`（新 crate） | GDI/DXGI 截图，无 CMD 窗口 |
| 2 | `modules/vision/packages/vision-service/src/monitoring.rs`（新） | `MonitoringEngine` + pHash 去重 + 节流 + 持久化 |
| 3 | `web-console/src/main.rs` | 5 条路由 + SSE 事件 + 规则触发调用 `runtime_tool_execute` |
| 4 | `web-console/src/main.rs` | `ConfigMonitoring` + `coolzhu.toml` 默认 |
| 5 | `app.js` + `index.html` | 监控 tab UI + 规则编辑 + ROI 拖拽 |
| 6 | `web-console/tests/monitoring_rules.rs` | 规则触发 + cooldown + 审批联动 3 用例 |
| 7 | `docs/requirements-management.md` | REQ-VIS-009 → 测试中；REQ-VIS-010 → 测试中 |

### 3.6 验收

- 单元：60s 内注入 20 帧相同截图，pHash 去重后仅 1 帧入队。
- 单元：规则命中后 `cooldown_secs` 内不二次触发。
- E2E：目标文字出现在屏幕 → OCR 识别 → 规则触发 → 审批面板弹出 → 授权 → 工具执行 → 桌宠 Success。

---

## 4. REQ-PACK-007/008/001/003：环境检测 + 首启动向导 + NSIS 安装包

### 4.1 设计总纲

安装期与启动期复用同一套**检查清单（CheckList）**，只是**动作**不同：安装期走 NSIS 原生脚本，启动期走 Rust 后端。这样 `REQ-DIAG-001/002` 已完成的检查逻辑可以直接被 NSIS 调用。

### 4.2 CheckList 通用定义

```rust
pub struct EnvCheckItem {
    pub id: &'static str,
    pub label: &'static str,
    pub stage: EnvStage,             // Install | FirstRun | Runtime
    pub severity: Severity,          // Block | Warn | Info
    pub detect: fn() -> EnvResult,
    pub fix_hint: &'static str,      // 人可读修复建议
    pub auto_fix: Option<fn() -> EnvResult>,
}

pub enum EnvResult { Pass, Fail{reason: String}, Skipped{reason: String} }
```

#### 4.2.1 完整检查表（33 项）

| 组 | ID | 检测 | 严重度 |
| --- | --- | --- | --- |
| OS | `os-version` | Windows 10.0.19041+ | Block |
| OS | `os-arch` | x86_64 | Block |
| OS | `dpi-awareness` | 支持 per-monitor v2 | Info |
| Runtime | `webview2-runtime` | Evergreen or Fixed 105+ | Block |
| Runtime | `vcredist-x64` | 2015-2022 redist | Block |
| Runtime | `net-desktop-6` | 可选，TTS 用 | Warn |
| Hardware | `cpu-cores` | ≥ 2 | Warn |
| Hardware | `ram-gb` | ≥ 8 | Warn |
| Hardware | `disk-free-gb` | workspace 盘 ≥ 20 | Block |
| Hardware | `gpu-vram-mb` | local VLM 建议 ≥ 8000 | Warn |
| Hardware | `microphone` | 枚举到输入设备 | Info |
| Hardware | `camera` | 枚举到视频设备 | Info |
| Network | `outbound-http` | HTTPS 任一测试域通 | Warn |
| Network | `port-9865` | 未被占用 | Block |
| Network | `proxy-detect` | 读取系统代理 | Info |
| Perms | `workspace-writable` | 默认 workspace 可写 | Block |
| Perms | `data-dir-writable` | `.coolzhu/` 可写 | Block |
| Perms | `mic-permission` | 麦克风系统开关 | Warn |
| Provider | `provider-zhipu` | base_url + key 可 ping | Warn |
| Provider | `provider-bailian` | 同上 | Warn |
| Provider | `provider-deepseek` | 同上 | Warn |
| Assets | `pet-frames` | 桌宠资源可读 | Block |
| Assets | `vision-launcher` | `start-local-vlm.ps1` 存在 | Warn |
| Assets | `vision-weights` | ShowUI/Qwen 权重存在（可选） | Warn |
| Config | `coolzhu-toml-schema` | 解析通过 | Block |
| Config | `config-schema-version` | 不比程序新 | Warn |
| Data | `sqlite-open` | 当前 DB 可打开 | Block |
| Data | `sqlite-fts5` | FTS5 扩展可用 | Warn |
| Data | `attachments-dir-size-mb` | `<` warn_mb | Info |
| License | `activation-token` | 已激活 | Warn |
| License | `fingerprint-hash` | 与服务器一致 | Info |

### 4.3 NSIS 安装包（REQ-PACK-001）

#### 4.3.1 构建链

```
build/
  nsis/
    installer.nsi        # 主脚本
    preflight.nsh        # 调 coolzhu-diag-preflight.exe 做 Install-stage 检查
    webview2_install.nsh
    vcredist_install.nsh
    ui.nsh               # MUI2 自定义页面
```

#### 4.3.2 preflight 动作

1. 启动 `coolzhu-diag-preflight.exe --stage=install --json` → 返回 `EnvCheckReport`。
2. NSIS 解析 JSON，`Block` 失败 → Abort 并提示。
3. `Warn` 失败 → 弹窗让用户选"继续 / 查看建议"。
4. 自动安装：若 `webview2-runtime` fail → 自动下载 Evergreen bootstrap 运行；`vcredist-x64` fail → 静默安装。

#### 4.3.3 安装内容

```
%LOCALAPPDATA%\CoolzhuAgent\
  ├─ bin\coolzhu-web-console.exe
  ├─ bin\coolzhu-tauri-shell.exe
  ├─ bin\coolzhu-diag-preflight.exe
  ├─ bin\coolzhu-cli.exe
  ├─ resources\pet\*.png
  ├─ resources\local-vlm\*.ps1
  ├─ resources\skills\*
  ├─ config\coolzhu.default.toml
  └─ VERSION
```

首次启动自动把 `config\coolzhu.default.toml` 复制到 `%USERPROFILE%\coolzhuagent\coolzhu.toml`（已存在则不覆盖）。

#### 4.3.4 卸载

- 默认保留 `%USERPROFILE%\coolzhuagent\`（用户数据）。
- 卸载界面给勾选框"同时删除用户数据目录"，默认不勾。
- 关闭所有已运行进程：`taskkill /IM coolzhu-*.exe /F`。

### 4.4 首启动向导（REQ-PACK-003/008）

启动 web-console 时，若 `%USERPROFILE%\coolzhuagent\.coolzhu\first-run-completed` 不存在：

1. 路由前置中间件拦截所有非 `/api/first-run/*` 请求 → 返回 503 + JSON `{"first_run":true, "wizard_url":"/first-run"}`。
2. 前端 `index.html` 检测 `first_run=true` 时挂载 Wizard 组件。
3. Wizard 页面步骤：
   - **欢迎** → 概述、隐私声明。
   - **环境检测** → 调 `/api/first-run/checks` 展示 `EnvCheckReport`；Block 项给 Fix 按钮调用 `auto_fix`。
   - **Workspace** → 默认 `%USERPROFILE%\coolzhuagent`，可改，写入 `coolzhu.toml`。
   - **Provider 配置** → 选 provider、填 key（本地 ≥2 个可选跳过）。
   - **视觉 profile** → 选"本地 ShowUI / 远端 GLM / 两者"，自动写 `[vision.router] pipeline`。
   - **桌宠 & 语音** → 勾选是否开启。
   - **完成** → 写入 `first-run-completed` 文件。

首启动专属 endpoints：

| Method | Path | 作用 |
| --- | --- | --- |
| `GET` | `/api/first-run/state` | 返回是否已完成 |
| `GET` | `/api/first-run/checks` | 跑 FirstRun stage 的 CheckList |
| `POST` | `/api/first-run/autofix` | body: `{id}`，调用 `auto_fix` |
| `POST` | `/api/first-run/commit` | body: 完整向导数据，写入 config 并置完成位 |

### 4.5 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/diagnostics/packages/diagnostics/src/checks/mod.rs` | `EnvCheckItem`、`EnvCheckReport`、33 项 detect 实现 |
| 2 | `modules/diagnostics/packages/diagnostics/src/bin/preflight.rs` | `coolzhu-diag-preflight` CLI（输出 JSON） |
| 3 | `build/nsis/installer.nsi` | NSIS 主脚本 |
| 4 | `build/nsis/preflight.nsh` | 解析 JSON、条件分支 |
| 5 | `web-console/src/first_run.rs`（新） | Wizard 路由 + 中间件 |
| 6 | `app.js` + 新 `first-run.html` | Wizard 步骤 UI |
| 7 | `docs/packaging-and-device-migration.md` | 更新安装流程图 |
| 8 | `tests/manual-install-verification.md` | 干净 Win10/Win11 VM 测试脚本 |

### 4.6 验收

- `cargo run -p coolzhu-diagnostics --bin preflight -- --stage=install` 在当前机器返回有效 JSON。
- NSIS 构建出 `coolzhu-setup-x64.exe`（< 120MB，不含模型权重）。
- 干净 Win11 VM 双击安装 → 首启动向导完整走完 → 能聊天 + 桌宠运行。
- Block 项在安装期确实被拦（人为造：把 WebView2 卸掉）。

---

## 5. REQ-PACK-013 + REQ-PACK-012/004：模型资源策略

### 5.1 问题盘点

- Qwen2.5-VL-3B ≈ 7.0 GB、ShowUI-2B ≈ 4.1 GB，合计 11GB+。
- 安装包若内置 → 下载慢、CDN 成本高、不同用户需求不同。
- 远端 VLM 已作为兜底（见 `precise-click-grounding-plan`），因此"不强制内置"是可行路径。

### 5.2 三种模式并存

| 模式 | 安装包 | 首启动后动作 | 适用 |
| --- | --- | --- | --- |
| `core-only` | 不含权重 | 启动即可用（远端 VLM） | 默认；网络正常用户 |
| `on-demand` | 不含权重 | Wizard 勾选"下载 ShowUI"→后台下载+校验+落盘 | 需要本地 grounding 的用户 |
| `bundled-mirror` | 内置加密镜像 | 首启动解压到 `%USERPROFILE%\coolzhuagent\.coolzhu\vision\models\` | 离线交付客户 |

Wizard 中让用户选模式。默认 `core-only`。

### 5.3 Resource Manifest

```toml
# resources/manifest.toml
schema_version = 1

[[resources]]
id = "showui-2b"
version = "2024-05-01"
size_bytes = 4_100_000_000
sha256 = "abc123..."
urls = [
  "https://cdn.coolzhu.example/models/showui-2b-240501.zst",
  "https://mirror1.example/showui-2b-240501.zst",
]
target = "vision/models/showui-2b"
required_for = ["local-grounding"]
min_disk_gb = 6
encryption = "age"          # age | none
signature = "ed25519:..."

[[resources]]
id = "qwen2.5-vl-3b"
...
```

Manifest 本体也签名（ed25519 detached）。

### 5.4 Downloader

```rust
pub struct ResourceDownloader {
    pub manifest_path: PathBuf,
    pub cache_root: PathBuf,
    pub max_concurrent: u8,
}

pub async fn download(&self, id: &str, progress: impl Fn(Progress)) -> Result<PathBuf, DownloadError>;
pub async fn verify(&self, id: &str) -> Result<(), VerifyError>;
pub async fn remove(&self, id: &str) -> Result<(), DownloadError>;
pub async fn scan_installed(&self) -> Vec<InstalledResource>;
```

特性：
- 分片下载：`range`; 失败断点续传；≤ 3 次重试。
- 校验：SHA256 + 可选 ed25519 签名。
- 压缩：`.zst` + `zstd` decompress；省 ~30% 体积。
- 加密（bundled-mirror）：`age` 对称密钥，密钥由 §7 的机器指纹派生。
- 缓存：`cache_root` 下保留 `.part` 与 `.ready`；未完成自动清理。

### 5.5 Web API

| Method | Path | 作用 |
| --- | --- | --- |
| `GET` | `/api/resources/manifest` | 返回 manifest + 已安装列表 |
| `POST` | `/api/resources/download` | body `{id, accept_license}` |
| `POST` | `/api/resources/cancel` | body `{id}` |
| `DELETE` | `/api/resources/{id}` | 删除已安装资源 |
| `GET` | `/api/resources/{id}/progress` | SSE：`progress/done/error` |

### 5.6 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/vision/packages/resource-manager/`（新 crate） | manifest 解析、downloader、verifier |
| 2 | `resources/manifest.toml` + `resources/manifest.sig` | 随安装包 |
| 3 | `web-console/src/main.rs` | 5 条路由 |
| 4 | `app.js` | Wizard 集成 + 模型管理面板 |
| 5 | `docs/packaging-and-device-migration.md` | 补"三模式"章节 |

### 5.7 验收

- 断电再开：`.part` 断点续传能继续。
- SHA 校验失败：自动删除并报错。
- 同时下两个资源：并发受 `max_concurrent=1` 限制。
- 干净机 `core-only` 模式：安装包 < 120MB，启动可聊天，grounding 自动使用远端。

---

## 6. REQ-PACK-009：加密资源镜像与完整性校验

### 6.1 目标

- **篡改检测**：任何二进制、资源、配置模板被替换，启动时能识别。
- **抬高攻击成本**：核心资源加密存储，不是明文。
- **不承诺**不可破解；攻击者获得运行中的进程内存，模型权重最终可被读出。

### 6.2 方案

#### 6.2.1 Build-time 产物签名

```
dist/
  coolzhu-web-console.exe
  coolzhu-tauri-shell.exe
  resources/manifest.toml
  integrity.toml        # 每个文件的 sha256 + 尺寸
  integrity.sig         # 对 integrity.toml 的 ed25519 签名
pub_keys/
  release.pub.pem       # 内嵌到 exe 中的 public key
```

构建过程（`scripts/sign-release.ps1`）：
1. `cargo build --release`。
2. 计算所有 `.exe`、`resources/**`、`manifest.toml` 的 SHA256，生成 `integrity.toml`。
3. 用 CI 里的 `ed25519` 私钥对 `integrity.toml` 签名，得到 `integrity.sig`。
4. 公钥 `release.pub.pem` 已在 build.rs 阶段 `include_bytes!` 进二进制。

#### 6.2.2 Runtime 校验

启动流程：
1. `read integrity.toml` + `integrity.sig` → 用内嵌公钥 verify。verify 失败 → 报告 `tamper-manifest-signature`，进入安全模式（只允许跑诊断）。
2. 遍历 `integrity.toml`，sha256 逐项校验。mismatch → 报 `tamper-{id}`，进入安全模式。
3. 校验通过继续启动。

安全模式下：
- 只保留 `/api/diagnostics/health`、`/first-run/checks`、`/resources/*` 端点。
- 聊天、工具、点击全部禁用。
- UI 显示红色"完整性校验失败"横幅，给"一键修复"按钮（调 `POST /api/resources/repair`，重新下载）。

#### 6.2.3 加密镜像（可选）

仅 `bundled-mirror` 模式使用：
- 模型权重和大资源以 `age` 加密存放在 `resources/encrypted/`。
- 解密密钥由"机器指纹 hash（§7）+ 出厂 secret（内嵌二进制的 KDF salt）"派生。
- 启动时解密到 `%TEMP%\coolzhu-secure-cache\`，运行中持有句柄；进程退出 unmap。
- 不能阻止 memory dump，但可阻止"拷贝资源盘走人"。

### 6.3 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/diagnostics/packages/integrity/`（新 crate） | `verify_integrity_manifest`、`IntegrityReport` |
| 2 | `scripts/sign-release.ps1` | 构建 + 签名 |
| 3 | `build.rs` | `include_bytes!("release.pub.pem")` |
| 4 | `web-console/src/main.rs` | 启动前调 `verify_integrity_manifest`；失败进安全模式 |
| 5 | `web-console/src/main.rs` | `/api/resources/repair` 重新下载并 re-verify |
| 6 | `docs/packaging-and-device-migration.md` | 补完整性校验小节 |
| 7 | `tests/manual-tamper-test.md` | 故意改一个资源 → 启动进安全模式 |

### 6.4 验收

- 改一字节资源文件 → 启动进入安全模式。
- 删除 integrity.sig → 启动 Abort。
- 正常发行版 → 启动时完整性 check ≤ 200ms。

---

## 7. REQ-PACK-010：在线授权激活与机器指纹绑定

### 7.1 范围定义

- 激活：用户输入激活码或登录账号 → 服务端颁发 `LicenseToken`。
- 绑定：`LicenseToken` 限定设备 slot（默认 3 台）。
- 隐私最小化：**不上传原始硬件 ID**，只上传 `fingerprint_hash`。
- 本地保护：`LicenseToken` 用 Windows DPAPI `CryptProtectData(SCOPE_CURRENT_USER)` 加密。

### 7.2 机器指纹

聚合下列属性，做 sha256：

```
components = sha256(
  machine_guid ||                       # HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
  cpu_vendor_brand ||                   # __cpuid
  primary_mac_oui ||                    # 网卡首 3 字节 OUI（不是整个 MAC，更稳定 + 更隐私）
  disk_drive_serial ||                  # 系统盘序列号
  install_salt                          # 首次安装时随机生成的 salt，写 DPAPI
)
fingerprint_hash = base64url(components)
```

关键点：
- 只传 `fingerprint_hash`；服务端**无法反推**原始值。
- `install_salt` 本地独立，同一物理机重装后 hash 变化 → 触发"解绑旧槽 + 绑定新槽"流程。
- 不依赖 MAC 全量（用户换网卡/虚拟网卡波动），改用 OUI。

### 7.3 激活流程

```
用户输入激活码 / 登录
    │
    ▼
POST https://license.coolzhu.example/api/v1/activate
body: { code | credentials, fingerprint_hash, client_version, platform }
    │
    ▼
服务端：校验 → 分配 device_slot → 签发 LicenseToken (ed25519)
    │
    ▼
客户端：
  - 存 LicenseToken（DPAPI 加密）到 %USERPROFILE%\coolzhuagent\.coolzhu\license.bin
  - 存 fingerprint_hash 到同目录
  - 启动正常流程
```

`LicenseToken` 是一份 JWS：

```json
{
  "iss": "license.coolzhu.example",
  "sub": "user_xxx",
  "aud": "coolzhu-desktop",
  "iat": 1800000000,
  "exp": 1831536000,                     // 1 年
  "entitlements": ["core", "vlm-remote"],
  "device_slot": "slot_3",
  "fingerprint_hash": "..."
}
```

### 7.4 运行时校验

启动时：
1. 读 `license.bin` → DPAPI 解密 → 解析 JWS → ed25519 verify（公钥内嵌）。
2. `fingerprint_hash` 当前计算值 vs token 里的值 一致 → 通过。
3. 不一致：本地允许 7 天 grace period，期间写 `[LICENSE] fingerprint drift` 诊断并后台尝试 `POST /api/v1/refresh`。
4. `exp` 到期前 14 天自动刷新；失败给 UI 警告。

### 7.5 离线 grace

- 连续 14 天无法连激活服务：进入"只读模式"（可聊天，不可用远端 VLM 等 entitled 功能）。
- UI 醒目展示"授权即将过期，请联网激活"。

### 7.6 解绑与迁移

Web UI 新增"授权管理"页面：
- 查看当前槽位：`GET /api/license/status`。
- 解绑当前设备：`POST /api/license/unbind` → 调服务端 `/api/v1/unbind` → 本地删 `license.bin`。
- 迁移：在旧设备解绑 → 新设备重新激活。
- 支持"强制解绑"（用户无法登陆旧设备）：邮箱确认链接，24 小时 cooldown。

### 7.7 服务端（规划）

- 技术栈：Cloudflare Workers + KV + D1（或等价：Rust + axum + Postgres）。
- Endpoints：`/activate`、`/refresh`、`/unbind`、`/status`、`/admin/slots`。
- 不存储原始硬件 ID；数据库只有 `user_id / fingerprint_hash / device_slot / issued_at`。
- Rate limit：30 req/min/IP。

### 7.8 文件级清单

| # | 文件 | 动作 |
| --- | --- | --- |
| 1 | `modules/license/packages/license-client/`（新 crate） | fingerprint 计算、JWS verify、DPAPI wrap |
| 2 | `modules/license/packages/license-server/`（新 crate） | 可选实现：axum 基础框架 |
| 3 | `web-console/src/main.rs` | 启动前调 license 校验；只读模式开关 |
| 4 | `web-console/src/main.rs` | `/api/license/{activate,refresh,status,unbind}` |
| 5 | `app.js` | 激活页面 + 授权管理 |
| 6 | `docs/packaging-and-device-migration.md` | 授权与隐私章节 |
| 7 | `docs/license-privacy-statement.md` | 用户可读隐私说明（fingerprint 是什么、能反推吗） |

### 7.9 验收

- 干净环境首启动强制走激活流程。
- 同一激活码在 4 台机器激活 → 第 4 台被拒。
- 换机重装：7 天 grace 内正常，超时后阻塞。
- `license.bin` 被拷贝到另一台 → DPAPI 解密失败，走重新激活。
- 服务端宕机 14 天：本地只读模式运行，不 crash。

---

## 8. 其他轻量方案

### 8.1 REQ-LLM-004：重试、限流、成本统计（P2）

- `llm-adapter` 引入 `RetryPolicy { max: 3, backoff: exponential, retry_on: [429, 5xx, timeout] }`。
- `RateLimiter`：per-provider token bucket，默认 60 req/min。
- `UsageAccumulator`：每次调用累加 `input_tokens / output_tokens / cost_estimated_usd`，按 provider/session 聚合；新 `/api/usage?session_id=` 返回。
- 成本价从 `model_catalog.rs`（`session-memory-workspace-integration-plan` §6.7）扩展 `cost_per_1k_input_usd / cost_per_1k_output_usd`。

### 8.2 REQ-CLI-001/002：CLI 对齐（P2）

- CLI 使用与 Web 同一个 SQLite 数据目录（`active_scope().sqlite_path`）。
- `coolzhu chat --agent <id> "msg"` → 构造 `ToolInvoke{caller=Cli}` → 调 `agent_message_request_with_images`（本地模式）或调 `/api/chat/send`（远程模式，连同一进程）。
- `coolzhu diag`：打包 `preflight --stage=runtime` 的输出。

### 8.3 REQ-PACK-002/005：数据迁移与升级回滚（P2）

- 导出：`coolzhu migrate export --dest D:\backup.zip`，内容：`coolzhu.toml + .coolzhu/` 整包；`license.bin` 不导出（迁移后重激活）；API key 以 `<missing-on-export>` 占位。
- 导入：`coolzhu migrate import --src D:\backup.zip --workspace E:\new\coolzhuagent`。
- 升级回滚：每次升级前 `copy .coolzhu/ .coolzhu-backup-v{prev}/`，失败（启动失败 + preflight Block）时自动回滚。

---

## 9. 优先级排序（强烈建议实施顺序）

```
Phase 1（≤ 2 周）
  §1 桌宠事件总线（REQ-DESK-PET-003）
  §4.2 CheckList + preflight CLI（REQ-PACK-007）
  §4.4 首启动向导后端（REQ-PACK-008）

Phase 2（2–4 周）
  §4.3 NSIS 安装包（REQ-PACK-001/003）
  §5 资源管理三模式（REQ-PACK-013/012/004）
  §8.1 REQ-LLM-004
  §8.3 REQ-PACK-002/005（导出导入）

Phase 3（4–6 周）
  §3 监控 + 关键词触发（REQ-VIS-009/010，需 §tool-calling 落地后）
  §2 唤醒词（REQ-AUDIO-003）
  §8.2 CLI 对齐（REQ-CLI-001/002）

Phase 4（6–10 周）
  §6 完整性校验（REQ-PACK-009）
  §7 在线授权（REQ-PACK-010）— 需要服务端基础设施
```

Phase 4 之前 REQ-PACK-010 服务端可以先做 MVP（Cloudflare Worker + KV）；客户端先以"用户输入激活码即可"的 stub 接入，便于回归。

---

## 10. 验收与风险总览

| 需求 | 类型 | 主要风险 | 缓解 |
| --- | --- | --- | --- |
| §1 桌宠 | 实时性 | SSE 断线 | 指数退避 + 本地持久事件日志 |
| §2 唤醒词 | 依赖 | Picovoice 限额 | openWakeWord 备胎 |
| §3 监控 | 成本 | VLM 费用 | 早退 + 预算上限 + 默认本地 OCR |
| §4 安装 | 兼容 | Win10/Win11 差异 | CheckList 明确分支 |
| §5 资源 | 体积 | 下载失败 | 多源 CDN + 断点续传 |
| §6 完整性 | 误报 | 合法更新被误判 | 升级前重新签名 |
| §7 授权 | 隐私 | 机器指纹质疑 | 只 hash 不原值 + 公开隐私声明 |

---

## 11. 给后续 agent 的注意事项

1. **不要**把用户原始硬件 ID（MachineGuid、完整 MAC）写日志或发服务端，仅允许 hash。
2. **不要**让 Wizard 的 Block 项被绕过；严重项一定 block。
3. **不要**在 NSIS 里写 Rust 业务逻辑，所有 detect 一律走 preflight CLI → JSON。
4. **不要**在监控规则里静默调用非 ReadOnly 工具而不走权限闸门；必须经过 `runtime_tool_execute`。
5. **不要**把 `%LOCALAPPDATA%\CoolzhuAgent\bin\` 写到 `coolzhu.toml` 里；程序应在运行时通过 `env::current_exe()` 推导。
6. 统一 diag 前缀：`[PET-BUS]`、`[WAKE]`、`[MON]`、`[PREFLIGHT]`、`[RES-DL]`、`[INTEG]`、`[LICENSE]`。
7. 每个阶段完成后到 `docs/work-logs/2026-05-1X-<topic>.md` 写落地日志，附测试截图与 Block 项日志样例。
