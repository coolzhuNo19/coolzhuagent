# G1 桌宠气泡与双击隐藏复修

时间：2026-05-07 23:25 +08:00

## 问题

用户确认动作帧平移问题已修复，同时反馈：
- 桌宠显示两个气泡，左侧为 `TC-G1 ...` 测试状态文案，右侧为空气泡贴图。
- `idle` 状态右侧气泡窗无内容。
- 双击桌宠可以显示 WebView 控制台，再次双击不能隐藏 WebView 控制台。

## 根因

- `pet-mini.html` 在 payload 同时包含 `bubble` 和 `message` 时同时显示图片气泡和文本气泡，导致双气泡。
- `idle/blink` 映射到 `assets/pet-bubbles/idle.png`，该贴图本身是空气泡效果，和文本气泡叠加后显得像无内容的右侧气泡窗。
- `console_toggle_decision` 只有在控制台可见、未最小化且已聚焦时才隐藏；从桌宠再次双击时，控制台常常可见但不聚焦，因此逻辑继续 present 而不是 hide。

## 修改

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 文本气泡存在时隐藏并清空 `bubbleImage`。
  - `idle/blink` 默认贴图映射改为 `null`。
  - `hideBubble` 同步清空图片 src 和文本内容。
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - `pet_bubble_asset("idle"|"blink")` 改为 `None`。
  - `console_toggle_decision` 改为控制台可见且未最小化时直接隐藏，不再要求控制台聚焦。
  - 新增 `pet_mini_text_bubble_suppresses_image_bubble`，更新气泡状态和 toggle 决策单测。
- `tmp/g1_trigger_pet_state.ps1`、`tmp/g1_cycle_pet_states_for_user.ps1`
  - 默认/轮播文案改为 ASCII `status <state>`，移除 `TC-G1` 前缀和中文参数，避免测试文案污染正式观感。
- 新增辅助脚本：
  - `tmp/list_coolzhu_windows.ps1`
  - `tmp/double_click_pet_window.ps1`

## TDD 与验证

- 红灯：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/cargo-test-red-all.log`，3 个失败覆盖 idle/blink 空气泡、文本气泡独占显示和可见未聚焦控制台再次双击隐藏。
- 绿灯：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/cargo-test-green-all-2.log`，15 passed。
- JS 检查：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/check-pet-mini-html-js.log`。
- Tauri 重启：`tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/tauri-restart-after-pet-fix.log`，`tauri_ready=true`，PID `16696`。
- 单气泡截图：
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/visual-idle-single-bubble.png`
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/visual-warning-single-bubble.png`
- 双击脚本预检：
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/window-list-after-doubleclick-show.log`：控制台 `visible=True`
  - `tmp/logs/g1-pet-bubble-toggle-fix-20260507-2303/window-list-after-doubleclick-hide.log`：控制台 `visible=False`

## 备份

- 修复前备份：`tmp/backups/g1-pet-bubble-toggle-pre-20260507-2303`
- 修复后备份：`tmp/backups/g1-pet-bubble-toggle-post-20260507-2326`

## 待人工确认

- 双击桌宠显示 WebView 控制台，再次双击隐藏 WebView 控制台。
- 状态气泡只显示一个有效气泡，不再有右侧空白气泡，不再显示 `TC-G1` 测试前缀。
