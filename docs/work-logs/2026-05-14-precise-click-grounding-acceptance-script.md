# 2026-05-14 Precise-Click Grounding Acceptance Script

时间：2026-05-14 01:35:00 +08:00

## 背景

`REQ-VIS-008` 与 Precise-Click Grounding Router 主体代码已经进入 `测试中`，剩余阻塞项是真实桌面窗口交互验收。用户要求编写脚本运行验收测试，并由用户录屏反馈；录屏开始与结束快捷键为 `Alt+F9`，需要插入测试开始和结束。

## 新增脚本

- `tmp/precise-click-grounding-acceptance.ps1`

脚本特性：

- 默认写入产物到 `tmp/verification-runs/precise-click-grounding-<timestamp>/`。
- 执行日志写入 `tmp/logs/precise-click-grounding-acceptance-<timestamp>.log`。
- 默认不执行真实键鼠输入；真实操作必须显式传入：
  - `-EnableRealInput`
  - `-IAcknowledgeRealInput`
- 默认会在测试开始和结束各发送一次 `Alt+F9`，用于录屏开始/结束。
- 可用 `-NoRecordingHotkey` 跳过录屏快捷键。
- 可用 `-PreflightOnly` 只跑服务和 grounding backend 健康检查。
- 每个用例都会保存 request / response / error artifact，并汇总到：
  - `summary.json`
  - `summary.md`

## 覆盖用例

- `PC-PRE-001`：`GET /api/state`，确认 Web 服务可访问。
- `PC-PRE-002`：`GET /api/vision/grounding/backends`，确认 grounding backend 端点可访问。
- `PC-GR-001`：`POST /api/vision/locate`，用 UIA 定位 Windows Start button。
- `PC-GR-002`：不存在的 UIA 目标必须失败，确认不会回退固定锚点。
- `PC-SAFE-001`：安全靶场视觉点击，要求 marker 命中。
- `PC-SAFE-002`：安全右键菜单靶场，要求目标菜单项命中。
- `PC-SAFE-003`：安全拖拽框选靶场，要求 marker 命中。
- `PC-WIN-001`：发送 `Win+E`，验证常用 Windows 热键操作。
- `PC-BR-000`：打开本地浏览器测试页。
- `PC-BR-001`：定位浏览器页面中的 `TARGET-472 GREEN CONFIRM` 按钮。
- `PC-BR-002`：浏览器地址栏 `Ctrl+L`，粘贴本地测试页 URL 并回车。
- `PC-BR-003`：浏览器页面搜索 `Ctrl+F`，搜索 `TARGET-472`。

## 推荐执行命令

预检：

```powershell
powershell -ExecutionPolicy Bypass -File tmp\precise-click-grounding-acceptance.ps1 -PreflightOnly -NoRecordingHotkey -NonInteractive
```

正式录屏验收：

```powershell
powershell -ExecutionPolicy Bypass -File tmp\precise-click-grounding-acceptance.ps1 -EnableRealInput -IAcknowledgeRealInput
```

自动连续执行，不逐项等待：

```powershell
powershell -ExecutionPolicy Bypass -File tmp\precise-click-grounding-acceptance.ps1 -EnableRealInput -IAcknowledgeRealInput -NonInteractive -CaseDelaySeconds 3
```

## 验证结果

预检时 Web 服务未启动，首次运行得到连接失败，随后通过已有 `tmp/start-web-project003-frontend-refresh.ps1` 拉起 `http://127.0.0.1:9865` 后重新预检。

通过记录：

- `tmp/logs/precise-click-acceptance-preflight-after-server-20260514.log`
- `tmp/verification-runs/precise-click-grounding-20260514-013433/summary.md`

结果：

- `PC-PRE-001` PASS
- `PC-PRE-002` PASS
- `PC-PRE-ONLY` PASS

## 状态

- `REQ-VIS-008` 保持 `测试中`。
- 等待用户运行正式录屏验收后反馈结果。
- 如果 `PC-GR-001/002`、`PC-SAFE-001~003`、`PC-BR-001~003` 通过，可将 Precise-Click Grounding 真实交互验收闭环并推进 `REQ-VIS-008` 到 `已完成`。
