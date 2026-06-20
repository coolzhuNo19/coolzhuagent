# 浏览器 Computer Use dry-run 场景补齐

时间：2026-05-08 08:17-08:25 +08:00

## 关联需求

- `REQ-CU-003`：浏览器内操作场景
- `REQ-CU-006`：鼠标动作原语补齐
- `REQ-CU-005`：执行审计与权限

## 背景

`REQ-CU-003` 要求覆盖地址栏、页面搜索、按钮确认、表单输入。现有 `computer-use-core` 已有地址栏输入和页面搜索点击，但缺少浏览器页面确认按钮和表单输入两类目标。本轮按 dry-run 安全策略补齐底层回归场景，不启动真实浏览器、不执行真实键鼠。

## 实施内容

1. TDD 红灯
   - 在 `computer-use-core` 新增 `browser_matrix_covers_confirm_and_form_input`。
   - 先断言 `UiTargetKind::BrowserConfirmButton` 与 `UiTargetKind::BrowserFormInput` 存在，并对应默认场景：
     - `browser-confirm-button`
     - `browser-form-input`
   - 红灯结果：枚举目标不存在，编译失败，符合预期。

2. 实现
   - `UiTargetKind` 新增：
     - `BrowserConfirmButton`
     - `BrowserFormInput`
   - `default_regression_scenarios()` 新增：
     - `browser-confirm-button`：左键点击浏览器页面确认按钮，锚点 `(0.64, 0.62)`。
     - `browser-form-input`：向浏览器页面表单输入文本，锚点 `(0.50, 0.46)`。
   - `web-console` 的 `target_name()` 增加新目标中文名称：
     - 浏览器确认按钮
     - 浏览器表单输入框

## 验证

日志目录：`tmp/logs`

- 红灯：`red-cu003-browser-core-20260508.log`
- 局部转绿：`green-cu003-browser-core-filter-20260508.log`
- 格式化：
  - `fmt-computer-use-core-cu003-browser-20260508.log`
  - `fmt-web-console-cu003-browser-20260508.log`
- 核心包：
  - `cargo test -p coolzhu-computer-use-core --offline`：8 passed
  - `cargo check -p coolzhu-computer-use-core --offline`：通过
- Web 回归：
  - `cargo test -p coolzhu-web-console --offline`：129 passed
  - `cargo check -p coolzhu-web-console --offline`：通过

## 结论

`REQ-CU-003` 已具备浏览器内操作 dry-run 场景矩阵，状态更新为 `测试中`。真实浏览器 E2E、视觉 grounding 命中率和人工交互确认仍后置。
