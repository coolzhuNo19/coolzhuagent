# 2026-06-20 UI Round3：任务授权窗口设计图对齐

## 背景

用户反馈“授权任务窗口没有按照设计图效果对齐”，要求任务授权窗口按设计图实施布局重构和组件 icon 风格替换。重点包括：

- 左侧保留待审批、Goal 角色分配和定时任务区域。
- 中间改为授权配置主面板，包含 workspace、外目录授权、Full access 三种模式。
- 右侧改为模块自检，不再使用诊断日志窗口的大段文本，也不让 self-update plan / suggestions 挤占首屏。
- 模块自检行需要显示真实模块健康状态，组件 icon 与竹林武侠玻璃质感保持一致。

## 修改范围

- `modules/gui-web/packages/web-console/index.html`
  - 任务授权窗口标记为 `data-round3-layout="authorization-design-grid-v2"`。
  - 保留 legacy 标记用于旧契约兼容。
- `modules/gui-web/packages/web-console/src/app.js`
  - 模块自检从真实 health checks 映射到 Web Console、Desktop Pet、Local Model、Vision、TTS/STT、MCP、Plugin、Packaging、Logs 九行。
  - 新增 `moduleSelfcheckRowIcon`、`refreshAuthorizationSelectedRoom` 等渲染/同步辅助逻辑。
- `modules/gui-web/packages/web-console/src/styles.css`
  - 新增 `ui-feedback-round3-authorization-v2-approved-layout` 样式块。
  - 三栏比例调整为待审批/授权配置/模块自检。
  - 统一授权模式卡片、Goal 角色卡片、模块自检行、按钮、状态灯、滚动条的竹林武侠玻璃风格。
  - 隐藏旧的模块建议与 self-update plan 首屏内容，避免挤占模块自检列表。
  - 修复模块自检行六元素布局，避免“重试”按钮换行或重叠。
- `modules/gui-web/packages/web-console/src/main.rs`
  - 增加/更新任务授权窗口 v2 布局契约测试。
- `assets/icons-wuxia/alert-triangle.svg`
- `assets/icons-wuxia/package-crate.svg`

## 风险管理

- 源码备份目录：`tmp/backups/20260620-authorization-v2/`
  - `index.html`
  - `app.js`
  - `styles.css`
  - `main.rs`
- 本轮只聚焦任务授权窗口，不继续扩大到记忆知识、浏览器、终端等窗口。
- package 构建自动备份旧二进制，最近一次备份：
  - `package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260620-151500817.exe`

## TDD 与验证记录

### RED / GREEN

- 初始 v2 布局契约：
  - `tmp/logs/ui-round3-authorization-v2-green.log`
- 模块自检列表首屏可见：
  - RED：`tmp/logs/ui-round3-authorization-selfcheck-list-red.log`
  - GREEN：`tmp/logs/ui-round3-authorization-selfcheck-list-green.log`
- 模块自检行六列防换行：
  - RED：`tmp/logs/ui-round3-authorization-selfcheck-row-columns-red.log`
  - GREEN：`tmp/logs/ui-round3-authorization-selfcheck-row-columns-green.log`

### 回归

- Round3 前端契约：
  - `tmp/logs/ui-round3-contracts-final.log`
  - 结果：5 项通过。
- JS 语法检查：
  - `tmp/logs/ui-round3-node-check-final-2.log`
  - 结果：通过。

### package 与运行

- package all：
  - `tmp/logs/ui-round3-authorization-package-all-final-2.log`
  - package 报告：`package/package-report.json`
- 运行健康检查：
  - `tmp/logs/ui-round3-final-runtime-check-web.log`
  - 结果：`/api/health` 返回 HTTP 200，`package/bin/coolzhu-web-console.exe` 监听 `8765`。
- Tauri 启动：
  - `tmp/logs/ui-round3-final-launch-tauri-console.log`

### Computer Use 前端验证

使用 Computer Use 在 packaged Tauri 窗口中真实点击“任务授权”：

- 已进入 `COOLZHU AGENT 控制台`。
- 点击顶部“任务授权”后显示三栏布局：
  - 左侧：默认权限、待审批、Goal 角色分配。
  - 中间：授权配置、workspace / 外目录授权 / Full access、路径配置、生效范围、风险提示和授权/撤销按钮。
  - 右侧：模块自检列表。
- 模块自检行显示 icon、模块名、状态、时间、详情、重试，未出现换行、遮挡或按钮重叠。

## 备注

- GUI 启动包装命令作为后台进程拉起时仍可能因句柄继承表现为超时；本轮通过后续 health check、端口监听和 package 进程路径确认运行状态，未作为功能失败处理。
- 后续如果继续做其它窗口，应沿用这轮策略：先用小契约锁定布局，再 package 启动，用 Computer Use 点击验证真实前端。
