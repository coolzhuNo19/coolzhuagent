# 2026-05-05 桌宠双击切换修复

## 问题

桌宠双击显示/隐藏 Web GUI 的交互出现回归，表现为双击不再稳定触发控制台切换。

## 原因

- `pet-mini.html` 和 `pet.html` 都使用了“按下后延时启动原生拖拽”的策略。
- 这会吞掉双击第二次点击，导致 `dblclick` 很难稳定触发。

## 修复

- 将桌宠拖拽逻辑改为“鼠标移动超过阈值才触发拖拽”。
- 保留双击事件监听，用于触发 `toggle_console`。
- 同步修复 `pet-mini.html` 和 `pet.html`，避免两个入口逻辑分叉。

## 验证

- `cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml --offline`
- `cargo check --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml --offline -q`

## 说明

- 功能链路已恢复到可编译、可测试状态。
- 仍保留 `REQ-DESK-PET-002` 为 `待交互验证`，需要在真实桌宠窗口中确认双击显示/隐藏效果。
