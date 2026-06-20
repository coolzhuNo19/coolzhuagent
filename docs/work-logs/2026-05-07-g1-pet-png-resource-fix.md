# G1 桌宠动作帧 PNG 资源裁切复修

时间：2026-05-07 22:53 +08:00

## 问题

用户复测桌宠后反馈真实窗口仍出现动作帧左右平移，并在最新截图中看到小鸟主体被左侧裁掉。上一轮 `frame_offsets` 只能修正不同动作帧的视觉重心漂移，无法恢复 PNG 中已经缺失的像素。

## 根因

- `tmp/inspect_pet_png_cropping.ps1` 检测到 `warning-4/5/6.png`、`success-3/4/5.png` 等资源左边缘可见像素比例异常，说明资源帧本身存在直边裁切。
- 原始源组图 `pet-sprite-sheet.png` 包含 5x8 动作组件，旧资源生成/归一化流程对 `warning/success` 的部分帧使用了已经裁切的中间资源，后续再做居中只会把裁切结果居中。
- sleeping 帧包含右上角 `Z` 符号，不能用整张透明包围盒中心判断主体小鸟是否居中，需要检测最大连通主体。

## 修改

- 新增 `tmp/regenerate_pet_action_frames_from_components.py`，从源组图按连通主体重新生成 `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/*.png`。
- `warning` 使用源组图第 3 行第 2-8 列，`success` 使用源组图第 3 行第 1-8 列，保留当前状态帧数量。
- 更新 `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`：
  - 重新写入新资源测量后的 `pet_action_frame_offsets`。
  - 增加 `pet_action_frames_have_no_straight_edge_cuts`，防止 PNG 左右直边裁切回归。
  - `pet_action_frames_share_canvas_and_visual_anchor` 改用最大连通主体检测中心和底线，避免 sleeping 的 `Z` 符号干扰主体锚点。
- 新增 `tmp/capture_desktop_screenshot.ps1`，用于本机桌面截图预检。
- 新增 `tmp/g1_cycle_pet_states_for_user.ps1`，用于用户侧截图复核时自动轮播 `idle/blink/thinking/sleeping/warning/success`。
- 更新 `docs/requirements-management.md`，记录 `REQ-DESK-PET-004/005` 本机预检结果和待用户截图复核状态。
- 新增 `docs/interactive-test-plans/2026-05-07-g1-pet-resource-retest.md`，记录 TC-G1-004/005 复修证据和待人工复核项。

## TDD 与验证

- 红灯：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/cargo-test-red-edge-cuts.log`，裁切测试曾因 `warning-4.png` 左侧直边失败。
- 资源重生成：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/regenerate-pet-action-frames.log`。
- 裁切复检：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/post-crop-inspection/summary.log`，`suspect resource frames` 为空。
- 锚点测量：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/anchor-after-regenerate/pet-action-anchor-summary.log`。
- 单项测试：
  - `cargo test --offline pet_action_frames_have_no_straight_edge_cuts`
  - `cargo test --offline pet_action_frame_offsets_stabilize_visual_centroid`
  - `cargo test --offline pet_action_frames_share_canvas_and_visual_anchor`
- 全量测试：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/cargo-test-full-after-primary-anchor.log`，14 passed。
- Tauri 重启：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/tauri-restart-after-pet-fix.log`，`tauri_ready=true`，PID `27176`。
- 用户复核轮播：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/pet-state-cycle-launch.log`，后台脚本每 4 秒切换一次状态，共 5 轮后自动结束。
- 本机截图预检：
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-idle-after-resource-fix.png`
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-blink-after-resource-fix.png`
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-thinking-after-resource-fix.png`
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-warning-after-resource-fix.png`
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-success-after-resource-fix.png`
  - `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-sleeping-after-resource-fix.png`

## 备份

- 修复前备份：`tmp/backups/g1-pet-png-resource-fix-pre-20260507-064517`
- 修复后备份：`tmp/backups/g1-pet-png-resource-fix-post-20260507-225500`

## 待人工确认

- TC-G1-004：用户截图确认 `idle/thinking/sleeping/success/warning` 气泡均可见、位置不遮挡、能自动消退。
- TC-G1-005：用户截图或连续观察确认 `idle/blink/thinking/sleeping/warning/success` 切换时主体中心和底部锚点稳定，无左右平移、无裁切。
