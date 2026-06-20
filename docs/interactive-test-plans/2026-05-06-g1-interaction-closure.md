# G1 交互性测试闭环执行单

更新时间：2026-05-06

## 范围

本执行单用于闭环 `docs/requirements-management.md` 的 G1 交互性测试项：

| 用例 | 需求 | 目标 |
| --- | --- | --- |
| TC-G1-001 | `REQ-WEB-UI-002` | 浏览器 Web-GUI 与 Tauri WebView 控制台显示一致 |
| TC-G1-002 | `REQ-DESK-PET-001` | Web 服务启动后真实拉起桌宠窗口 |
| TC-G1-003 | `REQ-DESK-PET-002` | 桌宠双击显示/隐藏 Web 控制台 |
| TC-G1-004 | `REQ-DESK-PET-004` | 桌宠状态气泡位置、文本/图片和自动消退符合预期 |
| TC-G1-005 | `REQ-DESK-PET-005` | 桌宠动作帧切换时中心和底部锚点稳定 |
| TC-G1-006 | `REQ-VIS-001` | 本地 VLM/OCR 对真实桌面目标返回 point/bbox/confidence 和截图证据 |

## 记录要求

- 测试日志建议放到 `tmp/logs/g1-interaction-YYYYMMDD-HHMMSS/`。
- 截图建议放到同一目录或其 `screenshots/` 子目录。
- 每个用例记录 `PASS`、`FAIL` 或 `BLOCKED`。
- `FAIL` 必须记录复现步骤、截图路径和日志路径；失败项回到 `开发中` 修复后复测。
- `BLOCKED` 用于缺少本地 VLM/OCR endpoint、无法启动 Tauri shell、无法打开 WebView 调试工具等外部条件不足。

## 准备步骤

1. 关闭已有 `coolzhu-web-console`、`CoolzhuAgent`、`coolzhu-tauri-shell` 进程。
2. 新建日志目录：

```powershell
New-Item -ItemType Directory -Force -Path tmp\logs\g1-interaction-manual\screenshots
```

3. 启动 Web 服务并保留日志。若使用开发态运行：

```powershell
cargo run -p coolzhu-web-console --offline *> tmp\logs\g1-interaction-manual\web-console.log
```

4. 如果 Web 服务没有自动拉起桌宠，可在另一个 PowerShell 窗口直接启动 Tauri shell：

```powershell
cargo run --manifest-path modules\gui-desktop\packages\tauri-shell\src-tauri\Cargo.toml -- --pet *> tmp\logs\g1-interaction-manual\tauri-shell.log
```

5. 记录 Web URL，默认优先检查 `http://127.0.0.1:8765/`。

## TC-G1-001：WebView 与浏览器显示一致性

关联需求：`REQ-WEB-UI-002`

操作：

1. 用 Edge/Chrome 打开 Web URL。
2. 通过桌宠双击打开 Tauri WebView 控制台。
3. 在相同分辨率和系统缩放下，对比以下区域：
   - 三合一卡片。
   - 工程目录卡片。
   - 测试实验室卡片。
   - 底部消息输入栏。
4. 分别截取浏览器和 WebView 控制台截图。

通过标准：

- 字体大小、行高、滚动条、卡片边界和输入栏没有明显错位。
- 文本不溢出、不重叠、不被按钮或容器遮挡。
- 卡片内部滚动不影响整页布局。

失败记录：

| 字段 | 内容 |
| --- | --- |
| 浏览器截图 |  |
| WebView 截图 |  |
| 分辨率/缩放 |  |
| 失败区域 |  |

## TC-G1-002：Web 服务启动拉起桌宠

关联需求：`REQ-DESK-PET-001`

操作：

1. 关闭已有桌宠和 Web 服务。
2. 启动 `coolzhu-web-console`。
3. 观察 10 秒内是否出现透明桌宠窗口。
4. 如果桌宠未出现，检查 `web-console.log` 是否只有可读 warn，且 Web GUI 仍能打开。

通过标准：

- 找到 Tauri shell 时，桌宠窗口出现且不影响 Web GUI 启动。
- 找不到 Tauri shell 时，Web 服务继续运行，日志中有可读 warn，不崩溃。

失败记录：

| 字段 | 内容 |
| --- | --- |
| 桌宠是否出现 |  |
| Web 是否可用 |  |
| 日志路径 |  |
| 截图路径 |  |

## TC-G1-003：桌宠双击切换控制台

关联需求：`REQ-DESK-PET-002`

操作：

1. 桌宠窗口可见时，连续双击桌宠主体。
2. 确认 WebView 控制台显示并获得焦点。
3. 最小化或遮挡 WebView 控制台后，再次双击桌宠。
4. 再双击一次，确认控制台隐藏。
5. 轻微移动鼠标后双击，确认拖拽阈值不会吞掉双击。

通过标准：

- 第一次双击显示/聚焦控制台。
- 控制台被遮挡或最小化时，双击优先弹出/聚焦。
- 再次双击可隐藏控制台。
- 双击不会被普通 `mousedown/mouseup` 或轻微移动误判为拖拽。

失败记录：

| 字段 | 内容 |
| --- | --- |
| 第一次双击结果 |  |
| 遮挡/最小化后结果 |  |
| 再次双击隐藏结果 |  |
| 日志/截图/录屏 |  |

## TC-G1-004：桌宠状态气泡

关联需求：`REQ-DESK-PET-004`

操作：

1. 通过双击桌宠触发 `thinking`、`success`、`idle` 状态。
2. 如果可打开 Tauri WebView 调试控制台，可执行以下命令补充触发 `warning`、`sleeping` 等状态：

```javascript
await window.__TAURI__.core.invoke("set_pet_action", { state: "warning", message: "测试 warning 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "sleeping", message: "测试 sleeping 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "thinking", message: "测试 thinking 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "success", message: "测试 success 气泡" })
```

3. 每个状态截图一次，记录是否遮挡主体、是否超出窗口、是否能自动消退或按预期保持。

通过标准：

- 气泡不遮挡桌宠主体关键区域。
- 气泡图片/文本不裁切、不闪烁、不越界。
- 状态切换时旧气泡能被新状态正确替换。

阻塞判定：

- 如果无法触发某个状态且没有调试入口，将该状态记为 `BLOCKED`，并记录“需要补交互测试触发入口”。

## TC-G1-005：动作帧中心和底部锚点稳定

关联需求：`REQ-DESK-PET-005`

操作：

1. 依次触发 `idle`、`blink`、`thinking`、`sleeping`、`warning`、`success`。
2. 每个状态保持至少 3 秒。
3. 观察桌宠主体水平中心、底部脚点/基线和窗口尺寸是否稳定。
4. 对 `thinking`、`warning`、`success` 各截一张图；如可录屏，补 5-10 秒短录屏。

通过标准：

- 状态切换时窗口尺寸不变。
- 主体水平中心无明显跳动。
- 底部锚点无明显上浮/下沉。
- 动作帧不裁切，不出现透明边界导致的视觉偏移。

失败记录：

| 字段 | 内容 |
| --- | --- |
| 失败状态 |  |
| 跳动方向/幅度 |  |
| 截图/录屏 |  |
| 是否可稳定复现 |  |

## TC-G1-006：本地 VLM/OCR 命中率

关联需求：`REQ-VIS-001`

前置条件：

- 本地 OpenAI-compatible VLM/OCR endpoint 可访问。
- 默认 endpoint 为 `http://127.0.0.1:8001/v1`，默认模型为 `qwen2.5-vl-3b`；如不同，请记录实际 `base_url` 和 `model`。

操作：

1. 打开一个目标清晰的窗口，例如 Web GUI 的“发送”按钮或工具卡片标题。
2. 调用找目标 API：

```powershell
$body = @{
  target = "Web GUI 中的发送按钮"
  use_model = $true
  base_url = "http://127.0.0.1:8001/v1"
  model = "qwen2.5-vl-3b"
  timeout_seconds = 180
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8765/api/vision/find-target" -ContentType "application/json" -Body $body |
  ConvertTo-Json -Depth 12 > tmp\logs\g1-interaction-manual\vision-find-target.json
```

3. 调用屏幕描述 API：

```powershell
$body = @{
  prompt = "Describe visible windows, buttons and likely clickable targets on the current desktop."
  use_model = $true
  base_url = "http://127.0.0.1:8001/v1"
  model = "qwen2.5-vl-3b"
  timeout_seconds = 180
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8765/api/vision/describe-screen" -ContentType "application/json" -Body $body |
  ConvertTo-Json -Depth 12 > tmp\logs\g1-interaction-manual\vision-describe-screen.json
```

通过标准：

- `find-target` 返回 `grounding.point` 或 `grounding.bbox`。
- `confidence` 存在且达到测试记录中约定阈值；如模型不返回 confidence，需要记录为协议缺口。
- `capture.path` 指向真实截图证据。
- `backend.error` 为空，或错误分类可读并能定位 endpoint/model/API key 问题。

失败记录：

| 字段 | 内容 |
| --- | --- |
| base_url/model |  |
| find-target JSON |  |
| describe-screen JSON |  |
| 截图路径 |  |
| 失败类型 | endpoint 不可达 / 无 grounding / 坐标错误 / confidence 缺失 / 其他 |

## 汇总记录

| 用例 | 结果 | 证据路径 | 备注 |
| --- | --- | --- | --- |
| TC-G1-001 |  |  |  |
| TC-G1-002 |  |  |  |
| TC-G1-003 |  |  |  |
| TC-G1-004 |  |  |  |
| TC-G1-005 |  |  |  |
| TC-G1-006 |  |  |  |
