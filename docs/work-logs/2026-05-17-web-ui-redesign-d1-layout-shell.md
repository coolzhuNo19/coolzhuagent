# 2026-05-17 Web GUI 多窗口重构 D1 布局骨架

## 背景

根据 `REQ-WEB-UI-010`，新 Web GUI 先锁定 1920x1080 / 16:9 的上下两区布局，再逐步迁移真实功能。本轮目标是建立 D1 布局骨架，并移除当前已裁剪的外视觉和语音监控前端入口。

## 备份

- 原 Web UI 完整目录备份：`tmp/backups/web-ui-original-20260517-0008-pre/web-console`
- 本轮修改后备份：`tmp/backups/web-ui-redesign-d1-20260517-0215-post/web-console`

## 修改内容

- `index.html`
  - 重构为上下两区：上区默认 24%，下区默认 76%。
  - 上区包含 Agent 总览、Logo、任务卡片。
  - 下区新增多窗口 dock：工程目录、设置、聊天室、浏览器、多媒体、终端、任务授权、记忆知识、视觉实验、诊断日志。
  - 聊天室默认展开，保留既有聊天室、消息列表、附件、TTS/STT 输入条和 handoff 控件。
  - 新增所有窗口折叠后的 `agent-office-scene` 3D/像素办公室占位。
  - 删除外视觉卡片和语音监听卡片，保留 TTS/STT。
- `src/styles.css`
  - 新增 `--top-region-ratio: 24%`、`--bottom-region-ratio: 76%`。
  - 新增多窗口 dock、窗口标题栏、折叠/展开状态、顶部卡片和下区工作台样式。
  - 修复顶部左侧 Agent 总览卡被旧 `.overview-card` 绝对定位污染的问题。
  - 修复左上总览卡行布局，让 `已激活 Agent 数` 不再硬折行。
- `src/app.js`
  - 新增 `initializeWorkbenchWindows()`，支持点击切换窗口、双击当前窗口标题折叠为全折叠场景。
  - 停止加载外视觉能力接口。
  - 音频状态只更新 `audio.stt` 与 `audio.tts`，不再维护 voice monitor 前端状态。
- `src/main.rs`
  - 更新 Web 卡片审计，不再把外视觉和语音监听列为前端卡片。
  - 更新前端契约测试，确认外视觉/语音监控入口已移除且 TTS/STT 保留。

## 验证

- `tmp/ui-redesign-contract-check.ps1`：PASS。
- `node --check modules/gui-web/packages/web-console/src/app.js`：PASS。
- `tmp/ui-redesign-visual-check.ps1`：PASS，生成截图 `tmp/ui-redesign-d1-1920x1080.png`。
- `cargo fmt -p coolzhu-web-console`：PASS。
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`：234 passed。

## 待确认

- 当前 D1 只锁定布局骨架和窗口结构，视觉效果等待人工确认。
- D2 需要继续迁移窗口内真实功能和交互细节，尤其是设置窗口、工程目录 IDE 窗口、任务/授权窗口的深层布局。

