# 2026-06-20 UI 批注迁移、package 发布与运行验证

## 背景

本轮接续 UI 新风格迁移任务，重点处理用户批注中的三类问题：

1. web-console 无法稳定打开/可能被桌宠退出联动关闭。
2. UI 仍残留旧金属金色结构框线、重复文本信息栏、独立多媒体/诊断日志入口。
3. 需要按 package 解耦编译架构重新编译打包并拉起桌宠与 web-console，用 Computer Use 做前端点击验证。

执行过程中遵循约束：

- 临时脚本放在 `tmp/`。
- 脚本输出通过 `tmp/run-command-with-timeout.ps1` 或脚本自身写入 `tmp/logs/`。
- 测试/构建/启动均设置超时。
- UI 行为变更使用最小 TDD 契约测试验证。
- 启动/进程清理由 package/bin 路径限定，避免误杀其它进程。

## 备份与风险控制

- 备份目录：`C:\Users\zhupu\Desktop\codex\tmp\backups\20260620-005515-ui-feedback-startup-pre`
- package 备份机制本轮生效：
  - `package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260620-023915071.exe`
  - `package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260620-072130299.exe`
- package-all 保留最近 10 次同名二进制备份，并裁剪更旧版本。

## 主要修改

### web-console 启动联动

- 修正 `pet_exit_closes_console` 默认行为：
  - `modules/gui-web/packages/web-console/src/main.rs`
  - 默认从“桌宠退出关闭 web-console”改为 false，避免桌宠进程短暂退出导致 web-console 联动关闭。
- 用户配置同步：
  - `C:\Users\zhupu\coolzhuagent\coolzhu.toml`
  - `[pet] pet_exit_closes_console = false`

### UI 结构与窗口合并

- `modules/gui-web/packages/web-console/index.html`
  - 移除顶层“多媒体”“诊断日志” dock 入口。
  - 移除独立多媒体窗口和独立诊断日志窗口。
  - 将模块自检区域并入任务授权窗口右侧自检区域。
  - 聊天左侧栏对齐新设计：会话操作、频道/模型、会话列表、快速筛选、当前接收者。
  - 移除聊天主区重复“通信舱 / Communication Bay”说明栏。
  - 移除“页面标题 / 折叠控制栏”冗余条。

- `modules/gui-web/packages/web-console/src/app.js`
  - 删除独立 media/logs 窗口状态和渲染逻辑。
  - 诊断自检逻辑改为绑定任务授权窗口内的 `module-selfcheck`。
  - Composer 附件预览补齐类型 icon 显示。
  - 视频预览统一设置 `playsInline`。

- `modules/gui-web/packages/web-console/src/styles.css`
  - 删除旧独立 media/logs 窗口样式块。
  - 增加竹林玻璃最终覆盖：
    - `ui-feedback-bamboo-glass-final`
    - `ui-feedback-bamboo-glass-controls`
    - `ui-feedback-bamboo-glass-visible-frame-overrides`
    - `ui-feedback-bamboo-glass-settings-heading-overrides`
  - 高可见区域（app-shell、dock、tab、window-panel、聊天/设置/任务/项目/浏览器/终端/记忆/视觉布局）统一压到竹绿玻璃边框。
  - 设置页分区标题左侧金色竖线改为竹绿强调，避免旧金属风残留。

### 临时工具脚本

新增/修正以下 `tmp/` 脚本：

- `tmp/audit-ui-feedback-residuals.ps1`
- `tmp/audit-gold-structural-selectors.ps1`
- `tmp/inspect-package-scripts.ps1`
- `tmp/stop-package-processes.ps1`
- `tmp/check-package-runtime.ps1`
- `tmp/launch-package-app-detached.ps1`
- 若干只读 inspect 脚本，用于定位 CSS/test 片段。

## TDD 与验证记录

### 新增红绿测试

1. 高可见结构金边覆盖：
   - RED：`red-visible-frame-bamboo-overrides.log`
   - GREEN：`green-visible-frame-bamboo-overrides.log`
   - 测试：`web_frontend_visible_frames_have_final_bamboo_glass_overrides`

2. 设置页标题金色竖线移除：
   - RED：`red-settings-heading-bamboo-accent.log`
   - GREEN：`green-settings-heading-bamboo-accent.log`
   - 测试：`web_frontend_settings_headings_use_bamboo_accent_not_gold_bars`

### 完整契约测试

- `tmp/logs/check-ui-feedback-web-frontend-tests-heading-final.log`
- 结果：`110 passed; 0 failed`

### 格式与语法

- `tmp/logs/fmt-web-console-after-heading-fix.log`
- `tmp/logs/check-web-console-app-js-syntax-after-heading-fix.log`
- 结果：均通过。

### package 编译打包

- `tmp/logs/package-all-ui-feedback-heading-final.log`
- 结果：
  - `coolzhu-web-console.exe` 重新 build 并发布到 `package/bin/`。
  - 其它模块二进制按 package all 编译链路检查，未变化则保持 unchanged。
  - resources 同步到 package 目录。
  - `package/package-report.json` 生成。

### 运行态验证

- `tmp/logs/check-package-runtime-after-visible-run.log`
- 结果：
  - web-console health HTTP 200。
  - `coolzhu-web-console.exe` 来自 `C:\Users\zhupu\Desktop\codex\package\bin`。
  - `coolzhu-tauri-shell.exe` 来自 `C:\Users\zhupu\Desktop\codex\package\bin`。
  - 8765 端口由 package web-console 监听。

## Computer Use 前端验收

使用 Computer Use 插件连接 Windows UI，目标窗口：

- App：`process:C:\Users\zhupu\Desktop\codex\package\bin\coolzhu-tauri-shell.exe`
- Window：`COOLZHU AGENT 控制台`

已完成模拟点击验证：

- 设置窗口可打开，设置分区标题左侧线已变为竹绿。
- 任务授权窗口可打开，模块自检已并入任务授权窗口右侧区域。
- 记忆知识窗口可打开。
- 浏览器窗口可打开。
- 终端窗口可打开。
- 视觉实验窗口可打开。
- 聊天室窗口可打开。
- 顶层 dock 未显示“多媒体”“诊断日志”独立入口。
- 聊天主区未显示重复“通信舱 / Communication Bay”说明栏。

### 桌宠双击显示/隐藏验证状态

本项未能通过 Computer Use 完成最终双击验证。

原因：桌宠捕获面存在，并显示为第二个截图区域（152×152），但 Computer Use 对该坐标点击时报错：

`point (...) is over msedgewebview2.exe "Chrome Legacy Window", not target window coolzhu-tauri-shell.exe "COOLZHU AGENT 控制台"`

刷新 `list_apps()` / `list_windows()` 后，插件只暴露 Tauri 顶层窗口，不暴露 WebView2 子窗口作为可控目标。根据 Computer Use 技能要求，不能绕过到 PowerShell SendKeys 或自写 UI 自动化，因此此项记录为插件目标窗口限制；主窗口点击验证已完成。

## 当前运行状态

- package 版 web-console 与 tauri-shell 已启动。
- web-console health：200。
- 最新可见启动日志：
  - `tmp/logs/package-run-app-20260620-072922.log`
  - `tmp/logs/launch-package-app-20260620-072921.stdout.log`

## 后续建议

1. 若必须自动化桌宠双击，需要让桌宠透明窗口暴露为独立可控窗口，或在 Tauri 层提供测试专用的只读/本地 toggle endpoint，再由 Computer Use 点击可访问按钮验证实际效果。
2. 继续 UI 迁移时，建议优先把残余黄色文字强调统一整理为设计 token，而不是再散落使用 `--gold`。
3. `tmp/run-command-with-timeout.ps1` 对 GUI 子进程启动会出现 wrapper 超时但 app 已启动的问题，建议后续专门改造成“启动后按 health 判断成功并退出”的 package 启动验证脚本。
