# 2026-06-19 UI Redesign V3 Batch 2 修改记录

## 目标

本批继续按已确认的武侠竹林、深色金属与玻璃质感设计迁移 Web Console，并把用户特别指出的三项核心界面纳入同一交付计划：

1. 顶部总览卡片。
2. 顶部当前任务卡片。
3. 聊天室窗口。

同时统一工程目录、浏览器、终端、任务授权和视觉实验窗口的信息密度。记忆知识窗口维持前端预留，后端重构暂缓。

设计与执行文档：

- `docs/superpowers/specs/2026-06-19-ui-redesign-v3-batch2-design.md`
- `docs/superpowers/plans/2026-06-19-ui-redesign-v3-batch2.md`

## 风险管理与回滚

修改前已备份本批涉及源码：

- 备份目录：`tmp/backups/20260619-194754-ui-redesign-v3-batch2-pre`
- 备份日志：`tmp/logs/20260619-194754-ui-redesign-v3-batch2-backup.log`
- 备份 manifest：备份目录内包含文件 SHA-256。

回滚方式：停止当前 packaged Web Console/Tauri Shell 后，将备份目录中对应文件恢复到原路径，再重新执行 `package all`。

## 实施内容

### 1. 总览卡、Logo 与任务卡

- 顶部区域收紧为应用高度约 12%。
- 三列严格恢复为 26% / 48% / 26%，去除最终优先级规则中的额外 gap 与水平 padding。
- 总览卡保留头像、健康状态、Agent 数、聊天室数、Goal roles 和当前视觉 Agent。
- 任务卡保留当前任务、进度、Running/Completed/Queued/Failed 和 Success Rate。
- 不在紧凑任务卡展开 todo、诊断或调试明细。

### 2. 聊天室

- 左侧栏改为：聊天室选择、频道/模型、当前接收者、紧凑会话操作。
- 左栏宽度使用有上下限的约 18% 布局，不再侵占消息区。
- 删除重复的 `Communication Bay`、`通讯发射台` 及页内说明条。
- 消息流获得主要高度。
- composer 收紧到约 10%，实际限制为 62~76px，并保留附件、发送和语音入口。
- 房间、频道、handoff、附件、发送和 STT 原有 hook 保持不变。

### 3. 工程目录

- 搜索、Diff、刷新和差异参数统一移入左侧命令栏。
- 删除冗余 `project-preview` 按钮及监听器；选择文件后继续自动预览。
- 右侧只保留紧凑元信息行和全高内容/Diff 预览。

### 4. 浏览器

- 保留紧凑的后退、刷新、地址、打开和独立窗口操作行。
- 代理设置移入默认折叠的高级配置。
- iframe/主画布占据剩余空间。
- 删除重复说明和装饰性占位文本。

### 5. 终端

- 输出区改为主区域。
- 命令、timeout、运行和清理控件固定到底部 composer。
- 正常结果使用简洁文本，原始执行响应放入折叠详情。
- `/api/tools/runtime-execute`、审批与审计安全边界未改动。

### 6. 任务授权

- 重排为三列：
  - 待审批与折叠定时任务。
  - 默认 workspace、外部目录授权与 full access。
  - 模块自检。
- 将真实 diagnostics health/check/suggestions 数据迁入模块自检，不新增静态假状态。
- full access 文案改为高风险、会话级、到期或重启失效并可手动撤销；后端 TTL 行为不变。
- 日志窗口继续保留审计和 tail，不重复展示健康卡。

### 7. 视觉实验

- 按约 18% / 60% / 22% 重排命令、证据与结果。
- 中央截图证据成为主区域。
- 右侧仅显示 backend、point、bbox、confidence、profile、mode 和计划摘要。
- profiles、capabilities、backend 列表与 raw realtime 数据收进折叠高级详情。

### 8. 代码与测试契约

- `index.html`：重排上述窗口 DOM，保留有效 `data-*` hook。
- `src/styles.css`：集中覆盖最终 V3 Batch 2 布局优先级。
- `src/app.js`：
  - 删除冗余 Project Preview 监听器。
  - 将 diagnostics 渲染泛化到 `[data-role="module-selfcheck"]`。
  - 终端正常输出与原始响应分层。
  - full access 状态显示剩余时间。
- `src/main.rs`：
  - 新增 `web_frontend_v3_batch2_matches_approved_compact_workbench_layout`。
  - 更新仅锁定旧标题、旧百分比和旧 full-access 文案的测试。

## TDD 与自动验证

本批采用最小行为契约，不扩张为过度测试设计。

- RED：新增布局契约首次运行因缺少 `chat-compact-actions` 失败，证明测试能够识别旧结构。
- GREEN：
  - 日志：`tmp/logs/20260619-ui-redesign-v3-batch2-tests.log`
  - 结果：`103 passed; 0 failed; 408 filtered out`
- 静态 UI 检查：
  - 日志：`tmp/logs/20260619-ui-redesign-v3-batch2-static-check.log`
  - 结果：`Static UI checks passed.`

说明：focused contract 脚本复用了同一个日志文件，最终 GREEN 覆盖了早期 RED 文本；RED 失败已在实施时现场确认，不将其描述为独立保留的日志产物。

## 编译、打包与启动

- package all：
  - 脚本：`tmp/run-package-all-batch2.ps1`
  - 日志：`tmp/logs/20260619-ui-redesign-v3-batch2-package-all.log`
  - 结果：所有模块完成离线编译/检查，package report 生成；最终复跑检测到二进制未变化。
- packaged app：
  - 脚本：`tmp/run-package-app-batch2.ps1`
  - 日志：`tmp/logs/20260619-ui-redesign-v3-batch2-run.log`
  - package self-check：通过。
  - Web Console health：HTTP 200。
  - 已启动：
    - `package/bin/coolzhu-web-console.exe`
    - `package/bin/coolzhu-tauri-shell.exe`

第一次 package wrapper 在包已完成后因日志正则判断错误返回异常；该问题属于验证脚本，不是 Rust 编译失败。修正正则后重新执行，exit code 为 0。

## Computer Use 前端验收

验收日志：`tmp/logs/20260619-ui-redesign-v3-batch2-computer-use.log`

目标为 packaged `COOLZHU AGENT 控制台`，使用真实 Windows 前端输入完成：

- 聊天室：确认总览/Logo/任务卡紧凑显示；左栏、消息流和底部 composer 符合新结构；重复标题已删除。
- 任务授权：确认三列布局；真实自检显示 `WARN / ok 10 / warn 1 / error 0`。
- 工程目录：确认左侧命令栏与目录树、右侧全高预览。
- 浏览器：确认代理配置折叠，主画布获得剩余空间。
- 终端：确认输出优先、底部 composer 和折叠执行详情。
- 视觉实验：确认左命令、中证据、右摘要与折叠高级详情。

一次直接指针切换工程目录时被 WebView2 窗口所有权保护拒绝；未绕过保护，改用 Computer Use 的真实键盘 `Tab` / `Shift+Tab` / `Return` 导航完成后续验收。最终已返回聊天室，方便用户直接确认。

## 已知限制

- 记忆知识后端未在本批重构，仅保留前端预留。
- 按 Computer Use 安全规范，没有在终端窗口通过 UI 执行命令；本批只验收终端布局，命令后端由自动测试覆盖。
- 诊断日志窗口本批不做视觉重构，只保留审计与日志 tail 职责。
- 桌宠是独立桌面层，可能覆盖顶部卡片局部区域；不属于本批 Web Console 布局范围。
- Rust 构建仍存在既有 dead-code warning，本批没有新增编译错误。

## 修改文件

- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/styles.css`
- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/main.rs`
- `docs/superpowers/specs/2026-06-19-ui-redesign-v3-batch2-design.md`
- `docs/superpowers/plans/2026-06-19-ui-redesign-v3-batch2.md`
- `docs/requirements-management.md`
- `docs/work-logs/2026-06-19-ui-redesign-v3-batch2.md`
