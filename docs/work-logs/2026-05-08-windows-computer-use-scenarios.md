# Windows Computer Use dry-run 场景补齐

时间：2026-05-08 08:25-08:31 +08:00

## 关联需求

- `REQ-CU-004`：Windows 应用内操作场景
- `REQ-CU-006`：鼠标动作原语补齐
- `REQ-CU-005`：执行审计与权限

## 背景

`REQ-CU-004` 要求覆盖记事本、文件选择框、系统确认弹窗等 Windows 应用内操作。当前仍保持真实输入禁用，本轮先补底层 dry-run 场景矩阵和 Web 报告名称，真实 Windows 应用 E2E 后续交互验证。

## 实施内容

1. TDD 红灯
   - 在 `computer-use-core` 新增 `windows_app_matrix_covers_editor_dialog_and_confirm`。
   - 先断言 Windows 目标枚举和默认场景存在：
     - `WindowsNotepadEditor` / `windows-notepad-editor`
     - `WindowsFileDialogInput` / `windows-file-dialog-path`
     - `WindowsSystemConfirmButton` / `windows-system-confirm`
   - 红灯结果：目标枚举不存在，编译失败，符合预期。

2. 实现
   - `UiTargetKind` 新增：
     - `WindowsNotepadEditor`
     - `WindowsFileDialogInput`
     - `WindowsSystemConfirmButton`
   - `default_regression_scenarios()` 新增：
     - `windows-notepad-editor`：向记事本文本区输入文本，锚点 `(0.50, 0.50)`。
     - `windows-file-dialog-path`：向文件选择框路径/文件名输入文本，锚点 `(0.50, 0.88)`。
     - `windows-system-confirm`：点击系统确认按钮，锚点 `(0.56, 0.64)`。
   - `web-console` 的 `target_name()` 增加新目标中文名称，保证报告和测试实验室输出可读。

## 验证

日志目录：`tmp/logs`

- 红灯：`red-cu004-windows-core-20260508.log`
- 局部转绿：`green-cu004-windows-core-filter-20260508.log`
- 格式化：
  - `fmt-computer-use-core-cu004-windows-20260508.log`
  - `fmt-web-console-cu004-windows-20260508.log`
- 核心包：
  - `cargo test -p coolzhu-computer-use-core --offline`：9 passed
  - `cargo check -p coolzhu-computer-use-core --offline`：通过
- Web 回归：
  - `cargo test -p coolzhu-web-console --offline`：129 passed
  - `cargo check -p coolzhu-web-console --offline`：通过

## 结论

`REQ-CU-004` 已具备 Windows 应用 dry-run 场景矩阵，状态更新为 `测试中`。真实记事本、文件选择框和系统确认弹窗 E2E 仍需后续交互验证。
