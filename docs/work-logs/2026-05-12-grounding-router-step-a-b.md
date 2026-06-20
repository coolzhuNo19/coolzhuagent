# 2026-05-12 - Grounding Router 实施 Step A+B

## Step A: 契约与配置

### 新增文件
- `modules/vision/packages/vision-service/src/locate.rs` (199行)
  - `LocateRequest/Response`、`LocateTarget` (natural/system/uia 三种)、`SystemControlId` (12个系统控件)、`BackendId` (Uia/LocalVlm/RemoteVlm)
  - 8个 serde round-trip 测试全部通过

### 修改文件
- `modules/vision/packages/vision-service/src/lib.rs`: +1行 (`pub mod locate;` + re-exports)
- `modules/vision/packages/vision-service/Cargo.toml`: +1行 (`serde` with derive)
- `modules/gui-web/packages/web-console/src/main.rs`:
  - `ConfigVision` 增加 `router: Option<ConfigVisionRouter>` 字段
  - 新增 `ConfigVisionRouter`、`UiaRouterConfig`、`LocalVlmRouterConfig`、`RemoteVlmRouterConfig`、`RemoteVlmProviderConfig` 结构体（与另一 agent 的代码合并）
  - `Default for ConfigVision` 增加 `router: None`

### 测试结果
- vision-service: 8 locate tests passed
- web-console: 173 tests passed (包含另一 agent 新增的 31 个)

## Step B: UIA Resolver

### 新增 crate
- `modules/vision/packages/uia-resolver/` (完整新 crate)
  - `Cargo.toml`: 依赖 coolzhu-vision-service (定位类型)、serde
  - `src/lib.rs` (125行): `UiaHit`、`UiaError`、`resolve_system_control()`、PowerShell UIA 脚本查询

### 实现方式
- 采用 PowerShell + .NET UIAutomation 脚本（与项目 `send_mouse_action` 模式一致）
- 脚本写入临时文件后以 `-File` 执行，避免命令行转义问题
- `StartButton` 策略：`Shell_TrayWnd` → `StartButton` AutomationId (Win11) / `Start` ClassName (Win10 fallback)
- 返回 `UiaHit` 含完整 bounding_rect、confidence=0.99

### 关键测试
- `resolve_start_button` 测试通过: `BBoxPx { x: 0, y: 1368, width: 83, height: 72 }`
- 中心点 (41, 1404) — Windows 开始按钮的真实坐标

### 问题与修复
- 初始尝试 `windows` crate 0.58 → API 不兼容（VARIANT/HSTRING 变更）→ 改用 PowerShell
- PowerShell 三元运算符 `? :` 在 PS 5.1 不存在 → 改用 `if/else`
- `New-Object` 构造器参数错误 → 从 int ID 改为 `[AutomationElement]::*Property` 静态字段
- 管道符 `|` 在 `-Command` 模式被解析 → 改为 `-File` 模式 + 临时文件

### workspace 变更
- `Cargo.toml`: 增加 `modules/vision/packages/uia-resolver` 成员

### 下一步: Step E (Router + API)
