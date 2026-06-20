# G1 桌宠气泡与双击切换复测预检

记录时间：2026-05-07 23:25 +08:00

## 用户反馈

- 动作帧平移问题已修复，`REQ-DESK-PET-005` 可转已完成。
- 轮播截图里出现两个气泡：左侧 `TC-G1 ...` 文案气泡、右侧空气泡。
- `idle` 状态右侧气泡窗无内容。
- 双击桌宠可以显示 WebView 控制台，再次双击不能隐藏 WebView 控制台。

## 确认

- 左侧 `TC-G1 ...` 来自测试轮播脚本传入的调试 message，不是正式默认文案。
- 左侧文本气泡本身是正式能力：后续真实状态消息会用该气泡显示短文本。
- 右侧空气泡是当前前端同时渲染默认气泡贴图和文本气泡导致的，应修复为单一有效气泡。

## 修复

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 文本气泡存在时隐藏并清空 `bubbleImage`，避免双气泡叠加。
  - `idle/blink` 不再使用默认空贴图气泡。
  - `hideBubble` 同步清空图片 src 和文本内容。
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - `pet_bubble_asset("idle"|"blink")` 改为 `None`。
  - `console_toggle_decision` 改为控制台只要可见且未最小化，再次 toggle 就隐藏，不再依赖控制台是否聚焦。
  - 新增/更新单测覆盖文本气泡独占显示、idle/blink 空气泡移除、可见未聚焦窗口再次双击隐藏。
- `tmp/g1_trigger_pet_state.ps1` 与 `tmp/g1_cycle_pet_states_for_user.ps1`
  - 默认/轮播文案改为 ASCII `status <state>`，避免 `TC-G1` 和中文参数影响正式观感。

## 自动化验证

- 红灯：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/cargo-test-red-all.log`，3 个失败覆盖气泡贴图、文本独占和未聚焦隐藏。
- 绿灯：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/cargo-test-green-all-2.log`，15 passed。
- JS 检查：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/check-pet-mini-html-js.log`。
- Tauri 重启：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/tauri-restart-after-pet-fix.log`，PID `16696`。

## 本机预检

- 单气泡截图：
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/visual-idle-single-bubble.png`
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/visual-warning-single-bubble.png`
- 双击脚本预检：
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/window-list-after-doubleclick-show.log`：`COOLZHU AGENT 控制台 visible=True`
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/window-list-after-doubleclick-hide.log`：`COOLZHU AGENT 控制台 visible=False`

## 待人工复核

- TC-G1-003 复测：双击桌宠显示 WebView，再次双击隐藏 WebView。
- TC-G1-004 复测：`idle/blink/thinking/sleeping/warning/success` 只显示一个有效气泡；没有右侧空白气泡；状态文案不再出现 `TC-G1`。

## 人工复核结果

复核时间：2026-05-07 23:30 +08:00

- TC-G1-003：PASS。用户确认双击桌宠可以显示 WebView，再次双击可以隐藏 WebView。
- TC-G1-004：PASS。用户确认气泡复测通过，单气泡渲染正常。
- 需求状态：`REQ-DESK-PET-002`、`REQ-DESK-PET-004` 转为 `已完成`。
