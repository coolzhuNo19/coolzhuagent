# 2026-06-21 GUI Web 修改恢复、记忆 API 与实时语音闸口修复

## 修改目的

1. 检查此前修改是否被其他 agent 的 reset/commit 覆盖。
2. 恢复记忆知识窗口的真实后端 API 接线，移除前端占位数据。
3. 修复 realtime full-stream 探针默认提前停止、探针结果误通过真实模型流闸口的问题。
4. 保留上一轮尚未提交的工程目录紧凑布局修改。
5. 重新完成模块测试、package all、启动和真实前端验证，并建立 Git 提交留痕。

## Git 审计结果

- workspace 根目录是独立 Git 仓库，但根 `.gitignore` 忽略 `/modules/`。
- `modules/gui-web`、`modules/gui-desktop` 等模块各自拥有独立 `.git`，因此模块代码必须在模块仓库内提交，根仓库只记录 docs/config/scripts。
- `modules/gui-web` 当前分支：`review/gui-web-21`。
- reflog 中存在其他 agent 的 reset/commit 操作；对照源代码发现以下行为曾被覆盖：
  - 记忆窗口重新出现 `MEMORY_WINDOW_PLACEHOLDER_BEADS`。
  - realtime 探针恢复为 `stop_after_first_delta: true`。
  - 后端请求默认值恢复为 `unwrap_or(true)`。
- 下列修改仍保留：
  - 工程目录 `expandedProjectPaths` 展开状态逻辑。
  - 浏览器窗口 WebView2/native 路由。
  - 工程目录紧凑命令栏与隐藏冗余 Diff 抽屉的未提交改动。
- 未修改、未提交 `modules/gui-desktop` 中其他 agent/用户已有的大量桌宠代码和图片资源。

## 风险备份

- 备份目录：
  - `tmp/backups/20260621-115219-gui-web-review-fixes-pre`
- 清单：
  - `tmp/backups/20260621-115219-gui-web-review-fixes-pre/manifest.json`
- 备份日志：
  - `tmp/logs/20260621-backup-gui-web-review-fixes.log`

恢复方式：

1. Git 优先回滚：
   - `git -C modules/gui-web revert 89133f3`
   - `git -C modules/gui-web revert c7ae785`
2. 或从上述备份目录按 `manifest.json` 恢复对应文件。

## 修改内容

### 1. 记忆知识窗口

涉及文件：

- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/main.rs`

修改：

- 删除前端 `MEMORY_WINDOW_PLACEHOLDER_BEADS`。
- 记忆窗口按当前 session 请求 `/api/sessions/{session_id}/beads`。
- Prompt Preview、Context Preview、Summary 分别请求现有后端端点。
- Pin/Edit/Delete 使用真实 PATCH/DELETE API。
- 筛选后为空时渲染空星图，不再回退到假数据。
- `/beads`、query、summary 只返回显式 `session.memory_beads`。
- prompt/context 保留 `explicit_or_default_memory_beads`，继续允许上下文构造使用兼容派生数据，但不把派生数据伪装成用户可编辑记忆。

### 2. Realtime full-stream 与模型流闸口

涉及文件：

- `modules/gui-web/packages/web-console/src/app.js`
- `modules/gui-web/packages/web-console/src/main.rs`

修改：

- 前端 realtime 探针发送：
  - `stop_after_first_delta: false`
  - `record_runtime_evidence: false`
- 后端相同字段默认值改为 `false`。
- `record_realtime_model_adapter_stream_health` 拒绝 `source=model_stream_probe` 的泛化探针证据，避免探针自证通过真实模型流 readiness gate。
- 正常 assistant text stream event 仍可满足模型适配器流闸口。

### 3. 工程目录 UI checkpoint

涉及文件：

- `modules/gui-web/packages/web-console/index.html`
- `modules/gui-web/packages/web-console/src/styles.css`

修改：

- 隐藏冗余 `project-diff-drawer`。
- 工程命令栏改为六行自动高度，目录树固定在第七行并占满剩余空间。
- 该修改原本已存在但未提交，本轮单独提交，避免被后续 agent 覆盖。

## TDD 证据

### 记忆显式 API

- RED：`modules/gui-web/tmp/logs/20260621-memory-explicit-api-red-fixed.log`
- GREEN：`modules/gui-web/tmp/logs/20260621-memory-explicit-api-green.log`

### 记忆前端 API 接线

- RED：`modules/gui-web/tmp/logs/20260621-memory-frontend-api-red-fixed.log`
- GREEN：`modules/gui-web/tmp/logs/20260621-memory-frontend-api-green-2.log`

### Realtime 默认参数

- RED：`modules/gui-web/tmp/logs/20260621-realtime-probe-defaults-red-fixed.log`
- GREEN：`modules/gui-web/tmp/logs/20260621-realtime-probe-defaults-green.log`

### Realtime readiness gate

- RED：`modules/gui-web/tmp/logs/20260621-realtime-probe-gate-red-fixed.log`
- GREEN：`modules/gui-web/tmp/logs/20260621-realtime-probe-gate-green.log`

## 编译和自动化验证

- `cargo fmt -p coolzhu-web-console`
  - `tmp/logs/20260621-gui-web-fmt.log`
  - `tmp/logs/20260621-gui-web-fmt-after-test-fix.log`
- JavaScript 语法检查：
  - `tmp/logs/20260621-gui-web-node-check.log`
- 工程目录展开状态回归：
  - `tmp/logs/20260621-project-tree-regression.log`
- 浏览器/realtime 定向回归：
  - `tmp/logs/20260621-gui-web-targeted-regression.log`
- `cargo check -p coolzhu-web-console --offline`：
  - `tmp/logs/20260621-gui-web-cargo-check.log`
- 全量测试：
  - 首轮发现并修正一条仍断言占位记忆的旧测试：`tmp/logs/20260621-gui-web-full-test.log`
  - 最终结果 `530 passed; 0 failed`：`tmp/logs/20260621-gui-web-full-test-green.log`
- `.\package.ps1 all -Configuration debug`：
  - `tmp/logs/20260621-package-all-after-recovery.log`
  - package report：`package/package-report.json`
  - web-console SHA-256：`EE04B73864E15DADB2365C51010E7632C6175506F60957B46B67D88B366BFC99`
  - 旧二进制备份：`package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260621-123321645.exe`

## 启动与真实前端验证

- 启动命令：
  - `.\package\run.ps1 -Component app -HealthTimeoutSeconds 30`
- 启动包装器因长驻子进程继承句柄在 120 秒达到超时，但进程和服务均已正常启动：
  - Web Console：PID 16376，监听 `127.0.0.1:8765`
  - Tauri Shell：PID 15960
  - 启动日志：`tmp/logs/20260621-package-run-app-after-recovery.log`
  - 运行态审计：`tmp/logs/20260621-audit-package-runtime.log`
- `/api/diagnostics/health` 返回内容，汇总为 `ok=10 / warn=1 / error=0`；warn 为 WebView2 常见路径探测未命中，但当前 Tauri WebView2 窗口实际已运行。
- Computer Use 实际前端验证：
  - 成功激活 `COOLZHU AGENT 控制台`。
  - 成功点击“记忆知识”主导航。
  - 页面显示当前会话真实 Beads（14 条），不是固定占位数组。
  - 点击另一条 Bead 后，选中标题、来源 `chat-room:auto-extract`、Prompt Preview 和 Context Preview 均同步更新，证明前端输入经真实 API 链路生效。
  - 双击桌宠测试被 Computer Use 的 WebView2 覆盖层安全校验阻止：坐标被识别为 `msedgewebview2.exe / Chrome Legacy Window`，没有绕过安全层或改用非授权的前台输入方案。
  - 工程目录“打开文件后保持展开”已有自动化回归通过；本次 Computer Use 再次切换工程页时同样被 WebView2 覆盖层校验阻止，因此不把该项标记为完整前端验收。

## Git 提交

模块仓库 `modules/gui-web`：

- `89133f3 fix(memory,realtime): restore API wiring and protect readiness gates`
- `c7ae785 fix(project): preserve compact command rail layout`

根仓库：

- 本 work-log 单独提交，不包含现有的其它计划文档和 work-log 改动。

## 已知事项

- `package/run.ps1` 启动长驻子进程后，外层超时包装器可能因输出句柄继承不退出；不影响本次进程和端口启动，但后续应把“启动完成”与“长驻进程生命周期”解耦。
- diagnostics 对 WebView2 的常见安装路径探测与实际运行结果不一致，后续可根据正在运行的 `msedgewebview2.exe` 或注册表补强自检。
- 实时语音本轮完成 full-stream 参数和 readiness gate 修复；未在本轮向真实音频设备播放/采集语音，因此不能把真实麦克风全链路标记为完成。
- `modules/gui-desktop` 仍有大量未提交的历史代码和图片资产，本轮没有擅自归并提交。
