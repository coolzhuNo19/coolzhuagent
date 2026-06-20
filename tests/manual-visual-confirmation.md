# 人工视觉确认测试设计

以下测试涉及截图、视觉识别、真实鼠标输入或 GUI 视觉变化，默认不进入自动化测试通过条件，需要人工确认。

## 1. Web 控制台视觉闭环 dry-run

涉及模块：

- `gui-web`
- `computer-use`
- `vision`

步骤：

```powershell
cargo run -p coolzhu-web-console -- --open
Invoke-RestMethod `
  -Uri http://127.0.0.1:8765/api/computer-use/closed-loop `
  -Method Post `
  -Body '{"execute":false,"confirm_after":true,"roi_radius":64}' `
  -ContentType 'application/json'
```

人工确认：

- 返回截图路径可打开。
- 返回 screen 尺寸与当前桌面截图一致。
- point 位于预期桌面区域。
- ROI 覆盖目标附近小区域。

## 2. 真实点击安全靶场

涉及模块：

- `gui-web`
- `computer-use`
- Windows 输入注入

步骤：

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8765/api/computer-use/safe-click-test `
  -Method Post `
  -Body '{"startup_delay_ms":2500,"marker_timeout_ms":5000}' `
  -ContentType 'application/json'
```

人工确认：

- 屏幕短暂出现 `COOLZHU SAFE INPUT TEST` 靶场窗口。
- 鼠标移动到靶场按钮附近。
- marker 返回 `hit` 时说明真实点击链路通过。
- 如果 marker 为 `timeout`，优先检查 DPI-aware、窗口置顶和物理坐标映射。

## 3. 本地 VLM grounding

涉及模块：

- `vision`
- `computer-use`

步骤：

```powershell
cargo run -p coolzhu-vision-service --bin coolzhu-vision-smoke -- --showui-ground <image-path> "目标控件描述"
```

人工确认：

- 输出 relative_point 在 `[0,1]` 范围内。
- 转换后的物理坐标落在目标控件附近。

## 4. 桌宠双击与动作帧稳定性

涉及模块：

- `gui-desktop`
- Tauri WebView 桌宠窗口
- Web 控制台窗口

步骤：

```powershell
cd modules/gui-desktop/packages/tauri-shell/src-tauri
cargo run --offline -- --pet
```

人工确认：

- 桌宠窗口出现后，连续双击桌宠主体，Web 控制台应弹出并加载当前 Web GUI URL。
- 控制台已最小化或被其他窗口遮挡时，双击桌宠应优先弹出并聚焦控制台。
- 控制台已经可见且聚焦时，再次双击桌宠应隐藏控制台。
- 依次触发 `idle/blink/thinking/sleeping/warning/success` 状态，主体中心和底部锚点不应明显跳动，且没有顶部或侧边裁切。
- 拖动桌宠后再双击，拖动不应吞掉后续双击弹出行为。
