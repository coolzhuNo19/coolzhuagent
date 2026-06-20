# G1 桌宠资源裁切复修与交互复测预检

记录时间：2026-05-07 22:48 +08:00

## 背景

用户在 TC-G1-004~TC-G1-005 复测后继续反馈：桌宠动作帧未变化，真实窗口中小鸟主体出现左侧半边裁切，并要求优先确认动作帧 PNG 资源与原始组图裁切是否准确。

## 排查结论

- `tmp/inspect_pet_png_cropping.ps1` 确认 `pet-actions` 中 `warning-4/5/6.png`、`success-3/4/5.png` 等资源存在左侧直边裁切风险。
- 原始源组图 `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-sprite-sheet.png` 为 5x8 动作组件，旧资源生成/归一化流程保留了已经裁切的 warning/success 后段帧。
- 前端 `frame_offsets` 只能抵消重心漂移，无法恢复已经缺失的像素，因此必须重生成动作帧资源。

## 修复内容

- 新增 `tmp/regenerate_pet_action_frames_from_components.py`，从源组图按连通主体识别 5x8 动作组件，重新生成 `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/*.png`。
- `warning` 使用源组图第 3 行第 2-8 列，`success` 使用源组图第 3 行第 1-8 列，保留现有状态帧数量约定。
- 重新测量动作帧锚点并更新 `pet_action_frame_offsets`。
- `pet_action_frames_share_canvas_and_visual_anchor` 改为检测 PNG 中最大连通主体的中心和底线，避免 sleeping 帧右上角 `Z` 符号把主体锚点判断带偏。
- 新增 `pet_action_frames_have_no_straight_edge_cuts`，覆盖直边裁切回归。

## 自动化验证

- 红灯：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/cargo-test-red-edge-cuts.log`，裁切检测曾因 `warning-4.png` 左侧直边失败。
- 资源重生成：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/regenerate-pet-action-frames.log`。
- 裁切复检：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/post-crop-inspection/summary.log`，`suspect resource frames` 为空。
- 锚点测量：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/anchor-after-regenerate/pet-action-anchor-summary.log`。
- Rust 全量单测：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/cargo-test-full-after-primary-anchor.log`，14 passed。
- Tauri 重启：`tmp/logs/g1-pet-png-resource-fix-20260507-064641/tauri-restart-after-pet-fix.log`，`tauri_ready=true`，PID `27176`。
- 用户复核轮播：`tmp/g1_cycle_pet_states_for_user.ps1` 已以 `DelaySeconds=4`、`Rounds=5` 启动，启动日志 `tmp/logs/g1-pet-png-resource-fix-20260507-064641/pet-state-cycle-launch.log`。

## 本机截图预检

- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-idle-after-resource-fix.png`
- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-blink-after-resource-fix.png`
- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-thinking-after-resource-fix.png`
- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-warning-after-resource-fix.png`
- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-success-after-resource-fix.png`
- `tmp/logs/g1-pet-png-resource-fix-20260507-064641/visual-sleeping-after-resource-fix.png`

预检结论：
- `warning` 气泡和警告角标可见，小鸟主体不再半边裁切。
- `success` 气泡和成功角标可见，动作帧主体完整。
- `sleeping` 主体按小鸟身体对齐，右上角 `Z` 符号不再影响主体锚点判断。
- `idle/blink/thinking` 均可触发气泡，本机截图未见主体裁切。

## 待人工交互复核

- TC-G1-004：用户截图确认 `idle/thinking/sleeping/success/warning` 气泡均可见、位置不遮挡、能自动消退。
- TC-G1-005：用户截图或连续观察确认 `idle/blink/thinking/sleeping/warning/success` 切换时主体中心和底部锚点稳定，无左右平移、无裁切。
