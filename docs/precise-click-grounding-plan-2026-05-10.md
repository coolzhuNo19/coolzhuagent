# 精准点击 Grounding 根治方案

文档版本：v1.0  
创建日期：2026-05-10  
作者：架构设计（交付给实现 agent）  
关联需求：`REQ-VIS-001`、`REQ-VIS-004`、`REQ-VIS-005`、`REQ-VIS-006`、`REQ-CU-002`、`REQ-TOOL-005`、`REQ-CU-005`  
目标场景：ShowUI 无法精确定位 Windows 任务栏开始按钮（以及同类系统控件、小目标、文字按钮）

---

## 1. 问题定性

当前 `api_tool_execute` 链路（`modules/gui-web/packages/web-console/src/main.rs:4651`）存在 4 处根因：

| 序号 | 根因 | 证据 |
| --- | --- | --- |
| R1 | `showui-2b` 属于 2B 参数轻量 VLM，对 OS 标志性控件（开始按钮、托盘图标、最小化三连）先验不足，`confidence≈0.35` 一致。 | `2026-05-10-dpi-anchor-analysis.md`、`2026-05-10-unresolved-issues.md` |
| R2 | `target_anchor_for_taskbar` 固定几何 `(0.45*w, 0.96*h)`，Win10/Win11/任务栏侧贴场景全错。 | `main.rs:6362` |
| R3 | Windows 一级 UI 元素（开始按钮、任务栏、系统托盘等）是 UI Automation 一等公民，位置由 shell 权威提供，不应交给 VLM 猜。 | 现有代码完全未接入 UIA |
| R4 | 本地 8GB VRAM 无法稳定同跑 Qwen + ShowUI；仅靠本地模型能力封顶。 | `2026-05-07-g1-vlm-showui-interaction.md` |

**根治思路**：放弃"单 VLM 包打天下"，改为**多 backend 串联的 grounding 路由器**，由一个统一入口 `POST /api/vision/locate` 按能力优先级逐级尝试：

1. `uia`：Windows UI Automation（本地原生，权威、零成本、零延迟）
2. `local_vlm`：本地 ShowUI/Qwen（零成本，离线，适合内容区目标）
3. `remote_vlm`：远端高能力 VLM（智谱 GLM-4.6V / GLM-4.1V-Thinking、Qwen-VL-Max、OpenAI-compatible VLM），适合复杂/小/罕见目标
4. `verify`：跨 backend 一致性校验（当多 backend 结果差异 > 阈值时，由远端多模态模型对截图做最终裁决）

任一层成功且通过置信度闸门即返回；真实点击前必须通过 `verify_cursor_on_target`（已存在）二次视觉确认。

---

## 2. 架构总览

```
┌───────────────────────────── Web API ──────────────────────────────┐
│  POST /api/vision/locate            # 统一 grounding 入口           │
│  POST /api/tools/execute            # 真实点击入口（已存在，重写）  │
│  GET  /api/vision/locate/backends   # 列出可用 backend 与健康状态    │
│  POST /api/vision/locate/verify     # 对 (x,y) 做多模态裁决          │
└────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
             ┌──────────── GroundingRouter ────────────┐
             │  pipeline:                              │
             │    1. UIA resolver                      │
             │    2. Local VLM (ShowUI / Qwen)         │
             │    3. Remote VLM (智谱 / Qwen-VL-Max)    │
             │    4. Cross-backend verify              │
             │  策略：置信度闸门 + 区域裁剪 + 多次采样   │
             └─────────────────────────────────────────┘
                  │           │            │
                  ▼           ▼            ▼
            ┌───────┐   ┌───────────┐ ┌──────────────┐
            │ uia-  │   │ local-vlm │ │ remote-vlm   │
            │resolv │   │ backend   │ │ backend      │
            └───────┘   └───────────┘ └──────────────┘
                ▲              ▲               ▲
                │              │               │
           Win32 UIA     showui-2b /       智谱 glm-4.6v /
           COM 接口      qwen2.5-vl-3b    glm-4.1v-thinking /
                                         qwen-vl-max /
                                         OpenAI-compatible
```

模块拆分（按 `docs/repository-structure.md` 目录规范）：

- `modules/vision/packages/vision-service`：新增 `GroundingRouter`、`UiaResolver`、`RemoteVlmBackend`、`LocateRequest/Response`。
- `modules/vision/packages/uia-resolver`：新 crate，专门封装 Windows UI Automation，仅 Windows 目标编译。
- `modules/gui-web/packages/web-console`：新增 3 个 HTTP 端点，`api_tool_execute` 改为调用 `POST /api/vision/locate`。
- `coolzhu.toml`：新增 `[vision.router]` 段。

---

## 3. 数据契约

以下结构放在 `modules/vision/packages/vision-service/src/locate.rs`（新文件），前端与 HTTP API 使用对应 DTO 镜像。

### 3.1 请求

```rust
/// 统一 grounding 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocateRequest {
    /// 自然语言或结构化目标
    pub target: LocateTarget,
    /// 使用哪些 backend；None = 使用 config 默认 pipeline
    #[serde(default)]
    pub backends: Option<Vec<BackendId>>,
    /// 最低可接受置信度（落到任何单 backend 之下都会尝试下一个）
    #[serde(default = "default_min_confidence")]
    pub min_confidence: f32,         // 默认 0.55
    /// 是否在返回前做跨 backend 一致性校验
    #[serde(default)]
    pub cross_verify: bool,          // 默认 false
    /// ROI 裁剪提示，可选；为空时使用全屏截图
    #[serde(default)]
    pub region_hint: Option<RegionHint>,
    /// 若前端已捕获截图，可直接传路径；否则服务端自动 capture_desktop
    #[serde(default)]
    pub capture_path: Option<String>,
    /// 超时上限（毫秒），整体 pipeline 级别
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,             // 默认 15000
    /// 追加诊断（返回每层 backend 的原始响应、耗时、截图片段）
    #[serde(default)]
    pub diagnostics: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum LocateTarget {
    /// 自然语言描述，交给 VLM/UIA 同时尝试
    #[serde(rename = "natural")]
    Natural { text: String },
    /// 系统控件 ID，强制走 UIA
    #[serde(rename = "system")]
    System { id: SystemControlId },
    /// 指定 AutomationId / ClassName / Name 的 UIA 查询
    #[serde(rename = "uia")]
    Uia {
        automation_id: Option<String>,
        class_name: Option<String>,
        name: Option<String>,
        control_type: Option<String>,
    },
}

/// 已知系统控件白名单。未列入的控件必须走 Uia 显式查询或 Natural 回退。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SystemControlId {
    StartButton,
    TaskbarSearchBox,
    TaskView,
    Taskbar,
    SystemTray,
    NotificationCenter,
    DesktopPeek,
    TaskbarClock,
    WindowMinimizeButton,
    WindowMaximizeButton,
    WindowCloseButton,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RegionHint {
    /// 相对坐标 [0,1]，左上 + 宽高
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    /// 语义锚区，便于日志
    pub anchor_kind: Option<RegionAnchorKind>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RegionAnchorKind {
    TaskbarBottom,
    TaskbarLeft,
    TaskbarRight,
    TaskbarTop,
    SystemTray,
    ActiveWindowTitleBar,
    ActiveWindowClientArea,
    DesktopFull,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BackendId {
    Uia,
    LocalVlm,
    RemoteVlm,
}

fn default_min_confidence() -> f32 { 0.55 }
fn default_timeout_ms() -> u64 { 15_000 }
```

### 3.2 响应

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocateResponse {
    pub status: LocateStatus,
    pub target_description: String,
    /// 最终选定的点击点（物理像素，与 SetCursorPos 坐标系一致）
    pub point: Option<PointPx>,
    /// 可选：如果 backend 返回了 bbox，给出物理像素矩形
    pub bbox: Option<BBoxPx>,
    /// 置信度（归一化 0..1）
    pub confidence: f32,
    /// 最终选定的 backend
    pub chosen_backend: Option<BackendId>,
    /// 每层 backend 的尝试结果（一律返回，便于审计）
    pub attempts: Vec<BackendAttempt>,
    /// 使用的截图路径（router 全程共享一张截图）
    pub capture_path: String,
    /// 屏幕尺寸 + DPI
    pub screen: ScreenInfo,
    /// 整体耗时
    pub elapsed_ms: u64,
    /// 降级原因（例如：UIA 未命中，VLM 置信度不足）
    pub degradation_reason: Option<String>,
    /// 人类可读说明
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum LocateStatus {
    /// 成功并通过置信度闸门
    Ok,
    /// 所有 backend 返回结果，但置信度/一致性不足
    LowConfidence,
    /// 所有 backend 均失败
    NotFound,
    /// 因超时或 backend 全不可用
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendAttempt {
    pub backend: BackendId,
    pub status: AttemptStatus,
    pub point: Option<PointPx>,
    pub bbox: Option<BBoxPx>,
    pub confidence: Option<f32>,
    pub raw_response: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub elapsed_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AttemptStatus { Ok, Skipped, Failed, LowConfidence }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct PointPx { pub x: i32, pub y: i32 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct BBoxPx { pub x: i32, pub y: i32, pub width: i32, pub height: i32 }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct ScreenInfo {
    pub logical_width: u32,
    pub logical_height: u32,
    pub dpi_scale: f32,
}
```

### 3.3 配置契约（`coolzhu.toml`）

在 `ConfigVision` 下新增嵌套段：

```toml
[vision.router]
# pipeline 顺序，router 按数组顺序尝试
pipeline = ["uia", "local_vlm", "remote_vlm"]
min_confidence = 0.55
cross_verify = true           # 当 UIA 和 VLM 给出点距离 > tolerance 像素时触发
cross_verify_tolerance_px = 24
timeout_ms = 15000

[vision.router.uia]
enabled = true                # 非 Windows 平台自动禁用

[vision.router.local_vlm]
enabled = true
base_url = "http://127.0.0.1:8000/v1"
model = "showui-2b"
timeout_seconds = 60
sample_count = 3              # ShowUI 多次采样取中位数
confidence_floor = 0.35       # 低于此值视为 LowConfidence

[vision.router.remote_vlm]
enabled = true
# 可填多个，router 按顺序尝试
[[vision.router.remote_vlm.providers]]
name = "智谱-glm46v"
provider = "ZhipuAi"
base_url = "https://open.bigmodel.cn/api/paas/v4"
model = "glm-4.6v-flash"
api_key_ref = "zhipu_default" # 引用 session 或 secret store 中的 key 名；禁止明文
confidence_floor = 0.6
max_tokens = 256

[[vision.router.remote_vlm.providers]]
name = "阿里-qwen-vl-max"
provider = "AlibabaBailian"
base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
model = "qwen-vl-max"
api_key_ref = "bailian_default"
confidence_floor = 0.6
max_tokens = 256
```

对应 Rust 结构：

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConfigVisionRouter {
    #[serde(default = "default_pipeline")]
    pub pipeline: Vec<BackendId>,
    #[serde(default = "default_min_confidence")]
    pub min_confidence: f32,
    #[serde(default)]
    pub cross_verify: bool,
    #[serde(default = "default_cross_verify_tolerance")]
    pub cross_verify_tolerance_px: u32,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub uia: UiaRouterConfig,
    #[serde(default)]
    pub local_vlm: LocalVlmRouterConfig,
    #[serde(default)]
    pub remote_vlm: RemoteVlmRouterConfig,
}
```

---

## 4. 三层 Backend 接口

### 4.1 UIA Resolver（`modules/vision/packages/uia-resolver`）

新 crate，只在 `cfg(windows)` 下启用，其它平台提供 stub 返回 `AttemptStatus::Skipped`。

```rust
pub trait UiaResolver: Send + Sync {
    /// 基于白名单 System 控件直接查找
    fn resolve_system(&self, id: SystemControlId) -> Result<UiaHit, UiaError>;

    /// 基于 AutomationId/ClassName/Name 查询
    fn resolve_query(&self, query: &UiaQuery) -> Result<UiaHit, UiaError>;

    /// 基于自然语言（使用 name/AccessibleName/help 全文匹配 + 类型过滤）
    fn resolve_natural(&self, text: &str, hint: Option<RegionAnchorKind>)
        -> Result<Vec<UiaHit>, UiaError>;

    /// 给 debug/健康检查用
    fn enumerate_taskbar(&self) -> Result<Vec<UiaHit>, UiaError>;
}

pub struct UiaHit {
    pub automation_id: Option<String>,
    pub class_name: Option<String>,
    pub name: Option<String>,
    pub control_type: String,
    pub bounding_rect: BBoxPx,          // 物理像素
    pub is_offscreen: bool,
    pub is_enabled: bool,
    pub confidence: f32,                // UIA 直接命中给 0.99；按 name 模糊匹配给 0.80
}
```

系统控件 → UIA 查询映射（实现提示）：

| SystemControlId | Win10 查询 | Win11 查询 |
| --- | --- | --- |
| `StartButton` | `ClassName=Start` 下第一个 `ControlType=Button` | `ClassName=Start` 或 `AutomationId=StartButton`（shell window `Shell_TrayWnd`） |
| `Taskbar` | `ClassName=Shell_TrayWnd` | 同左 + `Shell_SecondaryTrayWnd` |
| `SystemTray` | `ClassName=TrayNotifyWnd` | `ClassName=TrayNotifyWnd` |
| `TaskbarSearchBox` | `AutomationId=SearchApp` 或 `ClassName=Windows.UI.Input.InputSite` | `AutomationId=SearchApp` |
| `TaskbarClock` | `ClassName=TrayClockWClass` | 同左 |
| `TaskView` | `AutomationId=TaskViewButton` | 同左 |
| `WindowCloseButton` | 活动窗口 `ControlType=TitleBar` 下 `Name=关闭` 或 `Name=Close` | 同左 |

实现提示：
- 使用 `windows` crate 的 `UI::Accessibility::IUIAutomation`；`CoInitializeEx` / `CoCreateInstance`。
- Windows 版本检测：`RtlGetVersion` 或 `GetVersionExW` → 11 判定 `BuildNumber >= 22000`。
- BoundingRect 默认是物理像素，和 `SetCursorPos` 一致；当 DPI 感知关闭时需要乘 `dpi_scale`。Resolver 读取 `GetDpiForWindow(HWND)` 明确。
- 禁止跨 session 访问；以当前用户 session 为准。
- 返回 `Vec<UiaHit>` 时按 `is_offscreen=false, is_enabled=true, control_type=Button` 优先排序。

### 4.2 Local VLM Backend

基于现有 `modules/vision/packages/vision-service` 的 ShowUI/Qwen 接入扩展：

```rust
pub trait LocalVlmBackend: Send + Sync {
    fn kind(&self) -> LocalVlmKind;
    fn health(&self) -> LocalVlmHealth;
    fn locate(&self, req: &LocalVlmLocateRequest) -> Result<LocalVlmLocateResult, VisionError>;
}

pub struct LocalVlmLocateRequest<'a> {
    pub capture: &'a Path,
    pub target_text: &'a str,
    pub region_hint: Option<&'a RegionHint>,
    pub sample_count: u8,
    pub timeout: Duration,
}

pub struct LocalVlmLocateResult {
    pub points: Vec<PointPx>,           // 所有有效采样
    pub median_point: Option<PointPx>,  // 聚类后中位数
    pub cluster_radius_px: Option<u32>,
    pub confidence: f32,
    pub bbox: Option<BBoxPx>,
    pub model: String,
    pub raw_responses: Vec<String>,
    pub elapsed_ms: u64,
}
```

关键实现要求（解决 R1 的采样策略问题）：
1. **区域裁剪**：当 `region_hint` 给出时（例如 `TaskbarBottom`），把截图裁到相对区域再送模型；模型侧输出的 [0,1] 坐标按裁剪区反映射回全屏像素。
2. **Prompt 多样化**：`sample_count` 默认 3，每次用不同 prompt 变体（中/英/结构化），减少"系统偏上"现象。
3. **聚类**：对所有采样点做 DBSCAN（`eps = min(width,height)*0.04`, `min_samples=2`），取最大簇质心；孤立点丢弃，confidence = `cluster_size / sample_count`。
4. **禁止伪造 bbox**：ShowUI point-only 时 `bbox=None`，`confidence` 不超过 `confidence_floor`。

### 4.3 Remote VLM Backend

新结构，集成到 `llm-adapter` 的 provider 协议上（已是 OpenAI-compatible）：

```rust
pub struct RemoteVlmBackend {
    providers: Vec<RemoteVlmProvider>,
}

pub struct RemoteVlmProvider {
    pub name: String,
    pub provider_kind: api::ProviderKind,
    pub base_url: String,
    pub model: String,
    pub api_key_ref: String,           // 仅保存引用名，启动时从 secret store 解析
    pub confidence_floor: f32,
    pub max_tokens: u32,
}

impl RemoteVlmBackend {
    pub async fn locate(
        &self,
        capture: &Path,
        target: &str,
        region_hint: Option<&RegionHint>,
        screen: ScreenInfo,
    ) -> Result<BackendAttempt, VisionError>;
}
```

Prompt 模板（使用结构化输出，避免自由文本解析）：

```
System:
You are a GUI grounding engine. You receive a screenshot and a natural-language
target description. Return a SINGLE JSON object and nothing else.

Schema:
{
  "found": boolean,
  "point_relative": [number, number]  | null,   // [x,y] in [0,1], origin = top-left
  "bbox_relative":  [x, y, w, h]       | null,  // relative to screenshot
  "confidence":     number,                      // 0..1
  "label":          string                       // short human label
}

Rules:
- Coordinates are normalized 0..1 against the screenshot size.
- If target is ambiguous or not visible, set found=false and explain in "label".
- Prefer the centroid of the most specific clickable element.

User:
Target: {target}
{region_note if region_hint else ""}
```

`{region_note}` 示例：`The target is expected inside the bottom taskbar strip (y > 0.90). Ignore matches outside this band.`

实现要点：
- 使用 `llm-adapter` 的 `ProviderClient::send_message`，走 `InputMessage::user_text_with_image_urls`（已存在，见 `main.rs:6475`）。
- 结果按 JSON 解析失败时，触发一次带"Return only JSON"的重试；二次失败标记 `AttemptStatus::Failed`。
- 把响应 `point_relative × (logical_width, logical_height)` 映射到物理像素（`×dpi_scale`）。
- API key 必须从 `secret_store_resolve(api_key_ref)` 读取，禁止写入日志；日志只记录 `key_source, key_len`。

### 4.4 GroundingRouter 主流程（伪代码）

```rust
pub async fn locate(req: LocateRequest, ctx: &RouterContext) -> LocateResponse {
    let capture = ensure_capture(req.capture_path.clone()).await?;
    let screen  = read_screen_info();
    let pipeline = req.backends.clone()
        .unwrap_or_else(|| ctx.config.pipeline.clone());

    let mut attempts = Vec::new();
    let mut best: Option<BackendAttempt> = None;
    let deadline = Instant::now() + Duration::from_millis(req.timeout_ms);

    for backend in pipeline {
        if Instant::now() >= deadline {
            attempts.push(BackendAttempt::skipped(backend, "pipeline-deadline"));
            continue;
        }
        let attempt = match backend {
            BackendId::Uia       => ctx.uia.try_locate(&req, &capture, screen).await,
            BackendId::LocalVlm  => ctx.local.try_locate(&req, &capture, screen).await,
            BackendId::RemoteVlm => ctx.remote.try_locate(&req, &capture, screen).await,
        };
        attempts.push(attempt.clone());
        if attempt.status == AttemptStatus::Ok
            && attempt.confidence.unwrap_or(0.0) >= req.min_confidence
        {
            best = Some(attempt);
            if !req.cross_verify { break; }
            // cross_verify：继续尝试下一层，若两个点距离 > tolerance，则退到 remote 裁决
            if attempts.len() >= 2 && is_consistent(&attempts, ctx.config.cross_verify_tolerance_px) {
                break;
            }
        }
    }

    let (status, chosen, degradation) = finalize(&attempts, req.min_confidence);
    LocateResponse { status, point: chosen.as_ref().and_then(|a| a.point), ..}
}
```

`finalize` 规则：
- 至少一个 `Ok` 且 `confidence ≥ min_confidence` → `LocateStatus::Ok`。
- 所有 `Ok` 的 confidence 均低于闸门 → `LowConfidence`，但返回置信度最高的 attempt 作为候选。
- 所有 `Failed` → `NotFound`。
- 全部 `Skipped`（backend 禁用 / 超时） → `Unavailable`。

---

## 5. HTTP API 规范

### 5.1 `POST /api/vision/locate`

请求体（`LocateRequest` 的 JSON 镜像，字段名保持 `snake_case`）：

```json
{
  "target": { "kind": "system", "id": "start-button" },
  "backends": ["uia", "local_vlm", "remote_vlm"],
  "min_confidence": 0.55,
  "cross_verify": true,
  "region_hint": null,
  "capture_path": null,
  "timeout_ms": 15000,
  "diagnostics": true
}
```

响应示例（UIA 直接命中）：

```json
{
  "status": "ok",
  "target_description": "system.start-button",
  "point": { "x": 12, "y": 1432 },
  "bbox": { "x": 0, "y": 1412, "width": 48, "height": 48 },
  "confidence": 0.99,
  "chosen_backend": "uia",
  "attempts": [
    {
      "backend": "uia",
      "status": "ok",
      "point": { "x": 12, "y": 1432 },
      "bbox": { "x": 0, "y": 1412, "width": 48, "height": 48 },
      "confidence": 0.99,
      "model": "windows-uiautomation",
      "elapsed_ms": 18
    }
  ],
  "capture_path": "C:/Users/zhupu/coolzhuagent/captures/latest-desktop.png",
  "screen": { "logical_width": 1707, "logical_height": 960, "dpi_scale": 1.5 },
  "elapsed_ms": 62,
  "notes": ["uia-resolved from Shell_TrayWnd/Start"]
}
```

### 5.2 `GET /api/vision/locate/backends`

返回：

```json
{
  "backends": [
    { "id": "uia", "enabled": true, "status": "ready",
      "platform_supported": true, "version": "Windows 11 22631" },
    { "id": "local_vlm", "enabled": true, "status": "ready",
      "base_url": "http://127.0.0.1:8000/v1", "model": "showui-2b" },
    { "id": "remote_vlm", "enabled": true, "status": "ready",
      "providers": [
        { "name": "智谱-glm46v", "model": "glm-4.6v-flash", "has_api_key": true },
        { "name": "阿里-qwen-vl-max", "model": "qwen-vl-max", "has_api_key": false,
          "status": "missing-api-key" }
      ]
    }
  ],
  "pipeline": ["uia", "local_vlm", "remote_vlm"],
  "cross_verify": true
}
```

### 5.3 `POST /api/vision/locate/verify`

对任意 `(x,y)` 做"点是否在目标上"多模态裁决（替换现有内嵌的 `verify_cursor_on_target`）：

```json
{
  "point": { "x": 12, "y": 1432 },
  "target": "Windows 开始按钮",
  "capture_path": null,
  "move_cursor": true,
  "provider_hint": "remote_vlm"
}
```

响应：

```json
{
  "verdict": "pass",
  "confidence": 0.92,
  "reasoning": "Cursor overlaps the Start icon in bottom-left taskbar.",
  "capture_path": ".../verify-cursor.png",
  "provider": "智谱-glm46v",
  "model": "glm-4.6v-flash",
  "elapsed_ms": 940
}
```

### 5.4 `POST /api/tools/execute` 改造

保持现有路由与请求体 `ToolDispatchRequest`（向后兼容），新增字段：

```rust
struct ToolDispatchRequest {
    // ... existing ...
    #[serde(default)]
    system_control: Option<SystemControlId>,    // 显式走 UIA
    #[serde(default)]
    region_hint: Option<RegionHint>,
    #[serde(default)]
    min_confidence: Option<f32>,
    #[serde(default)]
    require_visual_verify: Option<bool>,        // 默认 true
}
```

内部流程必须改为：

1. 调用 `POST /api/vision/locate` 而非 `grounding_median_point`。
2. 若 `system_control = Some(_)` 或 intent 命中系统控件关键字（"开始按钮|start button|任务栏|taskbar|托盘|system tray|最小化|close window"），router 的 `target` 强制使用 `LocateTarget::System`；关键字表放到 `modules/vision/packages/vision-service/src/system_control_intent.rs` 并加单测。
3. `LocateResponse.status != Ok` → 不执行点击，返回 `ToolDispatchResponse.status = "locate-failed"`，携带 `attempts` 供前端展示。
4. `require_visual_verify=true` 时调用 `/api/vision/locate/verify`，`verdict != pass` 也不执行点击。
5. 点击后再 `capture_desktop`，把前后截图写入 audit 日志（路径从 `coolzhu.toml [computer_use] audit_log_path`）。

---

## 6. 文件级改动清单

按 agent 实施顺序组织，每步都有明确入口与可验证产物。

### 步骤 A：契约与配置（不引入新依赖，先让编译通过）

| # | 文件 | 动作 |
| --- | --- | --- |
| A1 | `modules/vision/packages/vision-service/src/locate.rs`（新建） | 实现 §3 的 `LocateRequest/Response/BackendAttempt/...` 纯类型 + serde，补 10+ 单元测试覆盖 serde round-trip |
| A2 | `modules/vision/packages/vision-service/src/lib.rs` | `pub mod locate;` 并 re-export 类型 |
| A3 | `modules/gui-web/packages/web-console/src/main.rs:688` | 在 `ConfigVision` 下加 `#[serde(default)] router: ConfigVisionRouter`，并补 `Default` |
| A4 | `modules/gui-web/packages/web-console/src/main.rs` | 新增 `impl From<ConfigVisionRouter> for RouterConfig` 以及 `RouterConfig` 本体（内部不使用 `ConfigVision` 的字段，便于后续独立测试） |
| A5 | `coolzhu.toml`（示例模板） | 写入 §3.3 默认段；`modules/vision/resources/local-vlm/coolzhu-local-vlm.template.json` 同步更新 |

验证：`cargo check -p coolzhu-vision-service --offline`、`cargo test -p coolzhu-vision-service --offline`。

### 步骤 B：UIA Resolver（Windows-only）

| # | 文件 | 动作 |
| --- | --- | --- |
| B1 | `modules/vision/packages/uia-resolver/Cargo.toml`（新 crate） | `[target.'cfg(windows)'.dependencies] windows = { version = "0.58", features = ["Win32_UI_Accessibility", "Win32_System_Com", "Win32_Graphics_Gdi", "Win32_UI_HiDpi", "Win32_UI_WindowsAndMessaging"] }` |
| B2 | `modules/vision/packages/uia-resolver/src/lib.rs` | 实现 `UiaResolver` trait、`SystemControlId → UiaQuery` 映射、Win10/Win11 版本分支；非 Windows stub 返回 `Err(UiaError::UnsupportedPlatform)` |
| B3 | `modules/vision/packages/uia-resolver/src/windows_impl.rs` | `CoInitializeEx + CUIAutomation.CreateTrueCondition/FindFirst`；实现 `enumerate_taskbar` 用于诊断 |
| B4 | `modules/vision/packages/uia-resolver/tests/start_button.rs` | 手工交互测试脚本（仅本机运行），枚举任务栏并打印，验证 `StartButton.bounding_rect` 与光标移动后截图一致 |
| B5 | `modules/vision/INTERFACE.md` | 新增 `uia-resolver` crate 说明与稳定接口清单 |

验证：`cargo check -p coolzhu-uia-resolver`；手动：`cargo run -p coolzhu-uia-resolver --example taskbar_dump`（新增 example）→ 打印的 `StartButton` 矩形中心对齐任务栏开始图标。

### 步骤 C：Local VLM Backend 升级

| # | 文件 | 动作 |
| --- | --- | --- |
| C1 | `modules/vision/packages/vision-service/src/local_backend.rs`（新建） | 把 `main.rs:6380 grounding_median_point` 的能力抽到此处；新增区域裁剪、DBSCAN 聚类、prompt 变体 |
| C2 | `modules/vision/packages/vision-service/src/lib.rs` | 导出 `LocalVlmBackend`、`LocalVlmKind::{ShowUi, Qwen}` |
| C3 | `modules/vision/packages/vision-service/tests/local_backend_cluster.rs` | TDD：固定输入 `points=[(600,170),(614,173),(1552,882)]` → 聚类后 median=(607,171)，第三点作为离群丢弃 |
| C4 | `modules/vision/packages/vision-service/tests/region_crop.rs` | TDD：region_hint=TaskbarBottom(y=0.85..1.0) 裁剪时坐标反映射正确 |

验证：`cargo test -p coolzhu-vision-service --offline`。

### 步骤 D：Remote VLM Backend

| # | 文件 | 动作 |
| --- | --- | --- |
| D1 | `modules/vision/packages/vision-service/src/remote_backend.rs`（新建） | `RemoteVlmBackend::locate`，参数通过 `llm-adapter` 的 `ProviderClient` 发请求；结果严格按 §4.3 JSON schema 解析 |
| D2 | `modules/llm-adapter/packages/llm-adapter/src/providers/mod.rs` | 若当前 `ProviderKind` 缺 VLM-capable 模型清单，补静态表；无 provider_kind → `Err(ApiError::UnsupportedFeature)` |
| D3 | `modules/vision/packages/vision-service/tests/remote_backend_parse.rs` | TDD：给 7 类真实/异常响应（纯 JSON、含围栏 ```json、无围栏但前缀含自然语言、空对象、found=false、confidence>1、bbox 越界），验证解析与 clamp |
| D4 | `modules/vision/packages/vision-service/tests/remote_backend_secret.rs` | TDD：api_key 从 `api_key_ref` 解析；日志断言不包含原始 key 字符 |

验证：`cargo test -p coolzhu-vision-service --offline`；对 D3/D4 做 `offline`-only（不打网络）。

### 步骤 E：GroundingRouter 与 HTTP API

| # | 文件 | 动作 |
| --- | --- | --- |
| E1 | `modules/vision/packages/vision-service/src/router.rs`（新建） | 实现 §4.4 主流程，含 cross_verify、deadline、`BackendAttempt` 组装 |
| E2 | `modules/vision/packages/vision-service/tests/router_pipeline.rs` | TDD：注入 fake UIA / local / remote，覆盖：<br>1) UIA OK 直接返回 <br>2) UIA Skipped + local 0.4 低于闸门 → remote 0.7 接管 <br>3) 全失败 → NotFound <br>4) cross_verify：UIA=(10,1430), local=(600,170) → 不一致，触发 remote 裁决 |
| E3 | `modules/gui-web/packages/web-console/src/main.rs` | 新增 3 个 handler：`api_vision_locate`、`api_vision_locate_backends`、`api_vision_locate_verify`；注册到 `.route(...)`（第 205 行附近），对齐现有风格 |
| E4 | `modules/gui-web/packages/web-console/src/main.rs:4651 api_tool_execute` | 删除 `grounding_median_point` 内联调用，改为走 `GroundingRouter::locate`；保留 `verify_cursor_on_target` 但其实现改为调用 router 的 remote_vlm 裁决接口 |
| E5 | `modules/gui-web/packages/web-console/tests/api_vision_locate.rs`（新建） | TDD：Axum app 起在 fake provider，发 `{"kind":"system","id":"start-button"}` → 200 + `chosen_backend=uia` |
| E6 | `modules/gui-web/INTERFACE.md` | 补三条端点与请求/响应示例；标注 `/api/tools/execute` 新增字段 |

验证：`cargo test -p coolzhu-web-console --offline`；跨模块：`cargo test --test module_linkage_smoke --offline`。

### 步骤 F：前端与 Diagnostics

| # | 文件 | 动作 |
| --- | --- | --- |
| F1 | `modules/gui-web/packages/web-console/src/app.js` | Tool execute 调用时可携带 `system_control`；失败态展示 `attempts` 面板 |
| F2 | `modules/gui-web/packages/web-console/index.html` | Computer Use 卡片新增"Grounding backend"下拉（自动/UIA/Local/Remote） |
| F3 | `modules/diagnostics/packages/diagnostics/src/lib.rs` | 健康检查新增 `vision_router`：UIA 可用性（仅 Windows）、local_vlm `GET /v1/models`、remote_vlm 每个 provider `has_api_key` |
| F4 | `tests/manual-visual-confirmation.md` | 新增"开始按钮 UIA→VLM 兜底"交互用例：列出 5 个目标（Start、搜索、任务视图、托盘时钟、活动窗口关闭），每个目标给出期望 backend 与接受像素误差 |

验证：启动 `cargo run -p coolzhu-web-console -- --open`，在 UI 上触发；人工核对 5 个系统控件的光标落点。

### 步骤 G：需求状态与日志

| # | 文件 | 动作 |
| --- | --- | --- |
| G1 | `docs/requirements-management.md` | `REQ-CU-002` 从"测试中"推进；新增 `REQ-VIS-007 Grounding Router` 条目并关联 `REQ-VIS-005` |
| G2 | `docs/work-logs/2026-05-1X-grounding-router-implementation.md` | 落地日志模板，记录每步测试命令与截图证据 |
| G3 | `docs/module-completion-status.md` | `vision` 45%→55%，`computer-use` 60%→70% 预期 |

---

## 7. TDD 验证矩阵（验收闸门）

实现 agent 必须在每步提交前跑通对应测试，并把日志落到 `tmp/logs/grounding-router-YYYYMMDD/`。

| 层级 | 测试 | 目标 |
| --- | --- | --- |
| 单元 | `vision-service locate serde` | 请求/响应全字段 round-trip |
| 单元 | `vision-service local_backend_cluster` | DBSCAN 聚类 + 离群剔除正确 |
| 单元 | `vision-service region_crop` | 区域裁剪 + 坐标反映射正确 |
| 单元 | `vision-service remote_backend_parse` | 7 类异常响应解析 |
| 单元 | `vision-service remote_backend_secret` | api_key 不落日志 |
| 单元 | `vision-service router_pipeline` | 4 场景 pipeline 判定 |
| 契约 | `web-console api_vision_locate` | Axum app → 200 响应 |
| 契约 | `web-console api_tool_execute_uia_wins` | system_control=start-button 时，执行路径走 UIA 分支 |
| 跨模块 | `module_linkage_smoke` | 保持原有用例不回归 |
| 手动 | `manual-visual-confirmation.md` 新用例 | 5 个系统控件光标落点误差 < 6 px |
| 手动 | 远端 VLM 真实裁决 | 在 UIA 被关闭时，remote VLM 对"开始按钮"返回的点相对 UIA 结果 < 24 px |

远端 VLM 真实联调要求：
- 必须使用 `coolzhu.toml` 中配置的 `智谱-glm46v` 或 `阿里-qwen-vl-max`；
- 手动记录每次 latency、tokens、返回 JSON；
- 连续 20 次对"开始按钮"做 `LocateRequest`（UIA 关闭的情况下）：成功率 ≥ 95%，中位 latency < 2.5s。

---

## 8. 安全与审计

1. **API key 仅以 `*_ref` 名字在配置中出现**，真实值从 `secret store`（当前 `session_api_key` / `resolve_api_key_ref`）取；日志与响应禁止透出 key。
2. **Remote VLM 截图隐私**：`POST /api/vision/locate` 当 `backend=remote_vlm` 被命中时，响应 `notes` 必须含 `"screenshot uploaded to {provider_name}"`。
3. **真实点击闸门**：`api_tool_execute` 只能在满足"router.status=ok ∧ confidence ≥ min_confidence ∧ verify.verdict=pass"时调用 `execute_mouse_action`；任何一项不满足都要写审计 `computer-use-audit.jsonl`（reason/attempts/screenshot 路径）。
4. **默认不上传截图**：`coolzhu.toml` 初始值 `remote_vlm.enabled=true` 但 `pipeline=["uia","local_vlm"]`，用户显式加入 `"remote_vlm"` 才会触发上传；UI 上给明确提示。

---

## 9. 迁移与回滚

- 旧的 `grounding_median_point` 暂保留一个 deprecated wrapper，内部转调 `GroundingRouter::locate` 的 `LocalVlm-only` 模式；至下个迭代删除。
- 新字段 `system_control / region_hint / min_confidence / require_visual_verify` 均可选，默认值保持旧行为。
- 回滚方式：`coolzhu.toml` 把 `[vision.router] pipeline = ["local_vlm"]` + `cross_verify=false` 即恢复旧链路（不经过 UIA 与 Remote）。

---

## 10. 实施顺序速览

```
A (契约) → B (UIA) → C (Local 升级) → D (Remote) → E (Router+API) → F (前端/诊断) → G (文档/状态)
```

每一步完成即提交独立 commit，commit message 格式：

```
feat(vision/router): step-X <summary>

Refs: REQ-VIS-007, REQ-CU-002
Tests: <cargo test 命令清单>
Rollback: revert this commit; coolzhu.toml 保持 pipeline=["local_vlm"]
```

完成全部 7 步后，在 `docs/work-logs/2026-05-1X-grounding-router-implementation.md` 写入最终验收记录（含截图、5 系统控件命中误差、远端联调统计），并把 `REQ-CU-002` / `REQ-VIS-007` 状态推进到"已完成"。

---

## 11. 给后续 agent 的额外指南

1. **阅读顺序**：先看 §1 → §2 总览 → §3 数据契约 → §5 HTTP API，理解外壳；再按 §6 步骤 A→G 顺序实施。
2. **不要跨步实现**：每步内的新类型只服务当前步骤，不要提前在类型上加"以后可能用到"的字段。
3. **不要改既有 INTERFACE.md 之外的公共接口**；若必须改，新开一条需求并先提交 contracts change。
4. **所有 diag! 日志前缀统一**：`[GROUND-ROUTER]`、`[GROUND-UIA]`、`[GROUND-LOCAL]`、`[GROUND-REMOTE]`、`[GROUND-VERIFY]`，便于后续问题定位。
5. **禁止**：伪造 bbox；在 key 泄露风险下"为了通过测试"写明文 key；跳过 §7 手动验证直接把状态打成"已完成"。
