# 2026-05-18 视觉实验窗口原生 Grounding API 接入

## 时间

- 开始：2026-05-18 08:33
- 闭环：2026-05-18 08:43

## 关联需求

- `REQ-WEB-WIN-007`：视觉实验独立窗口
- `REQ-VIS-008`：Vision Agent / Grounding Backend 职责分离
- `REQ-CU-*`：Computer Use 动作链路

## 修改内容

- 视觉实验窗口 Locate 卡片新增目标输入框。
- 新增安全预演按钮：
  - `Router locate`：调用 `POST /api/vision/locate`
  - `Verify point`：调用 `POST /api/vision/locate/verify`
- 右侧摘要区新增 Grounding backends：
  - 调用 `GET /api/vision/grounding/backends`
  - 展示 UIA / local VLM / remote VLM 状态、模型或版本
- 右侧摘要区新增 Vision tool service：
  - 调用 `GET /api/vision/tool-service/capabilities`
  - 展示 describe / ocr / grounding 预留能力结构
- 新增 locate response 渲染：
  - status
  - chosen_backend
  - point / bbox / confidence
  - attempts trace
  - degradation reason
- 保持真实输入默认关闭，不新增真实鼠标点击入口。
- 新增静态契约测试：
  - `web_frontend_vision_window_uses_native_grounding_router_api`
- 新增 Edge CDP 截图脚本：
  - `tmp/capture-vision-window-cdp.mjs`
  - `tmp/run-vision-window-capture.ps1`

## 验证结果

- `tmp/run-office-scene-validation.ps1`：通过
  - `cargo fmt --package coolzhu-web-console`
  - `node --check modules\gui-web\packages\web-console\src\app.js`
  - `tmp\check-web-ui-d2-inner-contract.ps1`
  - `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`
  - `cargo build -p coolzhu-web-console --offline`
- UI 启动：`tmp/start-office-scene-ui.ps1`，PID `22672`
- Edge CDP 截图：`tmp/web-ui-vision-window-1920x1080.png`
- 截图采集指标：
  - active window = `vision`
  - backendsVisible = `3`
  - firstBackend = `uia / ready / Windows`
  - capabilitiesHasContent = `true`
  - locateButton = `true`
  - verifyButton = `true`

## 备份

- 修改前备份：`tmp/backups/web-vision-native-20260518-083322-pre`
- 修改后备份：`tmp/backups/web-vision-native-20260518-085326-post`

## 待人工确认

- `Router locate` 和 `Verify point` 是否需要列入下一轮交互测试脚本。当前自动截图只验证能力列表和按钮接入，没有触发真实 locate 请求。
