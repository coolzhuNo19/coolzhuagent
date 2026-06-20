# 2026-05-07 G1 桌宠动作帧锚点补偿修复

记录时间：2026-05-07 06:32 +08:00

## 背景

用户复测反馈桌宠动作帧再次出现左右平移，没有锚定中心点。该问题由上一轮脚本化状态触发和 payload frames 循环播放稳定暴露，根因是动作帧资源只做了画布/alpha 外接框中心归一，未约束主体视觉重心。

## 排查证据

- 用户截图：`C:\Users\zhupu\Pictures\Screenshots\屏幕截图 2026-05-07 062057.png`
- 归档目录：`tmp/logs/g1-interaction-20260507-054320/screenshots/user-20260507-anchor-regression`
- 测量脚本：`tmp/measure_pet_action_anchors.ps1`
- 测量日志：`tmp/logs/pet-anchor-analysis-20260507-062358`

测量结论：

- `success` alpha 重心漂移 9.615px，渲染到 128px 后约 4.8px。
- `warning` alpha 重心漂移 7.709px，渲染到 128px 后约 3.9px。
- `thinking` alpha 重心漂移 4.505px，渲染到 128px 后约 2.3px。

## 修复内容

- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - `PetStatus` 增加 `frame_offsets` 字段。
  - 新增 `pet_action_frame_offsets`，按动作帧序列返回渲染尺度下的水平补偿值。
  - 新增 `pet_action_frame_offsets_stabilize_visual_centroid` 单测，验证补偿后的视觉重心漂移不超过 1px。
- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 新增 `activeFrameOffsets` 和 `applyFrame`。
  - 每帧更新 `src` 时同步应用 `translateX(offset)`，抵消资源帧内部视觉重心漂移。

## TDD 记录

红灯：

- 命令：`cargo test --offline pet_action_frame_offsets_stabilize_visual_centroid`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/cargo-test-red-anchor-offsets.log`
- 结果：失败，缺少 `pet_action_frame_offsets`。

绿灯：

- 命令：`cargo test --offline pet_action_frame_offsets_stabilize_visual_centroid`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/cargo-test-green-anchor-offsets.log`
- 结果：PASS。

回归：

- 命令：`cargo fmt`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/cargo-fmt.log`
- 结果：PASS。
- 命令：`cargo test --offline`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/cargo-test-full.log`
- 结果：13 passed。
- 命令：`tmp/check_pet_mini_html_js.ps1`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/js-check/node-check.log`
- 结果：PASS。
- 命令：`tmp/g1_restart_tauri_after_pet_fix.ps1`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/restart-tauri-after-anchor-fix-run.log`
- 结果：`tauri_ready=true`。
- 命令：`tmp/g1_trigger_pet_state.ps1 -State success` / `-State warning`
- 日志：`tmp/logs/g1-pet-anchor-fix-20260507-062924/trigger-success-anchor-test.log`、`trigger-warning-anchor-test.log`
- 结果：PASS。

## 需求状态

- `REQ-DESK-PET-005`：`开发中` -> `待交互验证`

## 备份

- 修复前备份目录：`tmp/backups/g1-pet-anchor-regression-pre-20260507-062157`
- 原因排查备份目录：`tmp/backups/g1-pet-anchor-regression-cause-20260507-062559`
- 修复后备份目录：`tmp/backups/g1-pet-anchor-offset-fix-post-20260507-063302`
