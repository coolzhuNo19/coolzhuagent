# 2026-06-19 UI Redesign V3 迁移记录

## 背景

根据新的武侠竹林风格效果图与截图批注，开始把 Web Console 迁移到新版窗口布局。当前批次重点处理前端结构与可用性，不重做“记忆知识”后端；记忆知识页先保留前端预留态，后端重构后再接真实数据。

## 修改范围

- `modules/gui-web/packages/web-console/index.html`
  - 删除所有窗口内重复标题栏：`window-panel-head`、`panel-title`、`window-side-title` 不再出现在页面结构中。
  - 删除“页面标题 / 折叠控制栏”与旧的 office/bridge 折叠场景容器。
  - 删除聊天页本地重复标题“通信舱 / Communication Bay”，空间留给消息列表。
  - 保留主导航 dock 作为唯一窗口切换入口。
  - 将被移除标题栏内的必要操作按钮迁到各窗口内容区：
    - 媒体刷新迁到媒体工具条。
    - 终端清屏迁到命令栏。
    - 任务刷新迁到默认权限卡片。
    - 视觉刷新迁到截图证据区域。
    - 日志 Health/Audit 入口迁到日志健康区。
  - 聊天工具审批按钮从隐藏标题栏迁为右上角悬浮胶囊，避免工具执行审批按钮失效。

- `modules/gui-web/packages/web-console/src/styles.css`
  - 重新收紧聊天、设置、项目、媒体、终端、任务授权、视觉实验、记忆知识等窗口的 grid 行布局。
  - 聊天窗口改为内容区直接占满，去除本地标题栏占位。
  - 增加 `.chat-window-state-hooks` 悬浮样式，用于显示工具执行审批按钮。
  - 调整媒体与终端工具条列布局，承接从旧标题栏迁出的按钮。

- `modules/gui-web/packages/web-console/src/app.js`
  - 禁用主 dock 标签双击折叠为空白窗口的行为；双击当前标签仍保持当前窗口。
  - 记忆知识窗口改为前端预留数据：
    - `MEMORY_WINDOW_PLACEHOLDER_BEADS`
    - `loadSessionBeads()` 不再调用后端 beads 列表接口。
    - `memoryWindowRefreshPreviews()` 不再调用 summary/prompt/context-preview 后端接口。
    - pin/edit/delete 暂时只修改本地预留数据，等待后端重新开发。

- `modules/gui-web/packages/web-console/src/main.rs`
  - 增加静态前端结构测试：确认新版布局删除重复窗口标题/折叠栏，同时保留主 dock。
  - 更新旧测试契约：聊天页不再要求显示“通信舱 / Communication Bay”；记忆知识页断言前端预留态而不是后端 beads API。
  - 修复 `ConfigSession::default()` 缺失 `relay_timeout_ms` 的编译阻断项。

## 风险管理

- 修改前备份：
  - `tmp/backups/20260619-183022-ui-redesign-v3-pre`
  - 备份日志：`tmp/logs/20260619-183022-ui-redesign-v3-backup.log`
- 打包第一次失败原因：
  - `package/bin/coolzhu-web-console.exe` 被旧运行进程占用。
  - 已确认相关进程仅来自当前项目 `package/bin`：
    - `coolzhu-web-console.exe`
    - `coolzhu-tauri-shell.exe`
  - 停止旧进程后重新打包成功。

## 验证记录

- TDD RED：
  - `tmp/logs/tdd-red-ui-redesign-v3-chrome.log`
  - 新增测试先失败，证明旧结构仍存在。
- TDD GREEN：
  - `tmp/logs/tdd-green-ui-redesign-v3-focused.log`
  - 新增结构测试通过。
- Web 前端静态测试组：
  - `tmp/logs/tdd-green-ui-redesign-v3-web-frontend-20260619-191958.log`
  - 结果：`102 passed; 0 failed`
- JS 语法检查：
  - `tmp/logs/node-check-ui-redesign-v3-20260619-192038.log`
  - 结果：`node --check completed with no output`
- 格式化：
  - `tmp/logs/cargo-fmt-ui-redesign-v3-20260619-192109.log`
  - 结果：`cargo fmt completed with no output`
- package all：
  - 首次失败日志：`tmp/logs/package-all-ui-redesign-v3-20260619-192252.log`
  - 释放旧进程日志：`tmp/logs/package-stop-old-ui-redesign-v3-20260619-192512.log`
  - 成功日志：`tmp/logs/package-all-ui-redesign-v3-rerun-20260619-192537.log`
  - 输出：`package/package-report.json`
- package 启动：
  - `tmp/logs/package-run-app-ui-redesign-v3-20260619-192806.log`
  - Web Console 健康检查：HTTP 200
  - Tauri 桌宠壳启动成功。
- Computer Use 前端点击验证：
  - `tmp/logs/computer-use-ui-redesign-v3-20260619-193333.log`
  - 验证点：
    - 聊天页无重复“通信舱 / Communication Bay”本地标题栏。
    - 无“页面标题 / 折叠控制栏”。
    - 设置页、记忆知识页可通过主 dock 正常切换。
    - 记忆知识页显示前端预留数据 `ui-redesign-v3/frontend_placeholder`。
    - 双击聊天标签不会再折叠到空白态。

## 后续建议

- 继续按设计稿把项目、浏览器、终端、任务授权、视觉实验等窗口逐个细化为新版布局。
- 记忆知识页建议先冻结前端 shell，后续单独设计数据模型与后端 API，再替换当前 placeholder。
- 老 CSS 中仍保留部分历史选择器用于兼容和过渡，后续完成全部窗口迁移后可单独清理。
