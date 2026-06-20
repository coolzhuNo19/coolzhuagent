# 2026-05-06 桌宠双击与动作帧锚点修复

记录时间：2026-05-06 00:07:49 +08:00

## 关联需求

- `REQ-DESK-PET-002`：桌宠双击切换 Web 控制台。
- `REQ-DESK-PET-005`：桌宠动作帧画布与中心锚点一致。

## 问题

- 用户反馈桌宠双击不弹出 Web UI。
- 桌宠在不同行为动作之间切换时，帧大小和中心位置显示不一致，视觉上会跳动。

## TDD 过程

红灯：

- 新增 `pet_mini_has_manual_double_click_fallback`，要求 `pet-mini.html` 存在手动双击兜底。
- 新增 `pet_action_frames_share_canvas_and_visual_anchor`，直接读取 PNG 透明像素边界，要求所有动作帧为 `256x256`，中心接近 `x=128`，底部接近 `y=216`。
- 初次运行日志：`tmp/tauri_pet_tdd_red.log`，失败点为缺少 `handlePetDoubleClick`，以及 `idle-0.png center_x 131.5` 偏离锚点。

绿灯：

- `pet-mini.html` 增加基于 `mouseup` 的双击检测，不再完全依赖浏览器 `dblclick`。
- `toggle_console` 决策调整为：控制台不可见、最小化或未聚焦时优先弹出/聚焦；只有已可见、未最小化且已聚焦时才隐藏。
- 使用 `tmp/normalize_pet_frames.ps1` 将 `idle/blink/thinking/sleeping/warning/success` PNG 帧平移到统一锚点。
- 复测日志：`tmp/tauri_pet_test_2.log`，8 项单测通过。

## 修改文件

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/*.png`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml`
- `modules/gui-desktop/docs/desktop-pet-action-api.md`
- `docs/requirements-management.md`
- `tests/manual-visual-confirmation.md`

## 验证

- `cargo fmt --all`
- `cargo check --offline`
- `cargo test --offline`
- PNG 边界检测：`tmp/analyze_pet_frames_after.log`

结果：

- `cargo check --offline` 通过，日志：`tmp/tauri_pet_check_2.log`。
- `cargo test --offline` 通过，8 项测试全部成功，日志：`tmp/tauri_pet_test_2.log`。
- 自动检测确认所有动作帧为 `256x256`，主体中心为 `127.5-128.5`，底部基线均为 `216`。

## 待人工验证

- 启动真实 Tauri 桌宠窗口后，双击桌宠主体应弹出并聚焦 Web 控制台。
- 控制台已聚焦时再次双击桌宠应隐藏控制台。
- 拖动桌宠后再次双击不应被拖拽状态吞掉。
- 依次触发六类动作状态，真实窗口中主体不应明显跳动或裁切。

人工验证步骤已同步到 `tests/manual-visual-confirmation.md`。

## 回滚方式

- 恢复本次修改的 `pet-mini.html`、`src-tauri/src/main.rs`、`src-tauri/Cargo.toml`、`ui/assets/pet-actions` 资产和相关文档。
- 本次备份路径：`tmp/backups/desktop-pet-fixes-20260506-000912`，便于快速对照恢复。
