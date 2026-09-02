# P7-A Release Candidate 实施记录

日期：2026-09-02（Asia/Shanghai）
范围：仅处理发布候选前的状态栏收敛、兼容说明与文档登记；仅做 Haiku 标识兼容修复，不新增强度档位。

## 本轮变更

- 全局底栏收敛为“工作区 / 连接 / 会话”三项；端口与构建号从底栏移入现有“模块自检”诊断健康卡的运行环境元信息，保留既有 `system-port`、`system-build` 更新入口与诊断数据。
- 连接状态沿用既有 `/api/system/info` 刷新节奏：初始/请求中显示“连接中”，成功显示“已连接”，失败显示“未连接”；文字、`aria-label` 与中性/绿色/朱红状态样式同步，未新增轮询或后端接口。
- 补充 Web 静态源契约，约束三项底栏、诊断区端口/构建字段及连接状态实现；更新 P6-E.4h 最终两遍 921/0 与视觉验收记录。
- 新增[供应商模型与 reasoning 兼容性说明](../user-guide/provider-reasoning-compatibility.md)，按 `reasoning_capability_catalog()` 整理 9 个 provider、39 条目录、5 条旧会话 deprecated 与当前新选 34 条，说明 requested/effective、auto 与安全省略边界。
- 在 2026-08-24 总体方案顶部补充当前实现优先、981px 断点及快捷工具归右栏的短注。
- 将内置 Claude Haiku 4.5 目录与 Claw payload 统一到官方 model id `claude-haiku-4-5-20251001`；旧 `claude-haiku-4-5-20251213` 仅作为显式历史 alias，能力接口下发 alias，前端通用索引保留旧会话的 model/reasoning requested 值，出站仍发送官方 ID。

## 实现期检查

- `cargo build -p coolzhu-llm-adapter --offline`：通过（2026-09-02）。
- `cargo build -p coolzhu-web-console --offline`：通过（2026-09-02；保留既有 warnings）。
- `node --check modules/gui-web/packages/web-console/src/app.js`：通过（2026-09-02）。
- `git diff --check`：通过（仅报告既有/工作区 LF→CRLF 提示，无 whitespace error）。
- 实现代理未运行正式 `cargo test`、未读取真实密钥；独立测试任务随后执行 P7-B 初轮验收，结果见下节。

## P7-B 初轮验收与后续修复

- Web：921 passed / 0 failed。
- llm-adapter：107 passed / 0 failed，1 ignored（需要真实 vendor 密钥，未因此伪报失败）。
- CLI：1 passed / 0 failed；module linkage：4 passed / 0 failed；Node 语法检查通过。
- 旧 Haiku model id 会话在设置页打开后，`requested=none` 能保持并保存为 `none`，通过旧会话兼容验收；出站 model id 仍由后端 alias 映射到官方 ID。
- 根视觉检查发现两项真实问题：`refreshState()` 成功分支会把稳定性矩阵诊断写成自动聊天气泡；实际嵌套层级下长 Agent 名称按钮 `scrollHeight=44`、`clientHeight=23` 且 overflow 可见，出现两行文字溢出（证据中的 y=46–58 区域）。
- 随后完成最小修复：移除成功连接调试气泡但保留失败提示；将 Agent 按钮、文字与 chevron 的 flex/ellipsis/nowrap/固定尺寸规则合并到当前实际 25px 规则，并补静态源契约。最终使用 workspace/tmp 隔离 target 的 `cargo build -p coolzhu-web-console --offline` 与 Node 检查均通过。
- P7-B 诊断真图进一步发现右栏模块自检头部按钮因继承 column/flex basis 被拉高到约 110px，健康卡状态/计数与端口/构建元信息被同一行挤压而不可读；已仅在 `chat-tool-host-content` 内补 row、常规 36px 按钮与健康卡独立元信息行，长构建值允许换行，未改全局底栏规则，并补少量静态契约。
- 上述诊断布局修复后的离线 web build 与 Node 检查已通过；P7-B2 独立最终复验 Web 922/0，并由根逐张查看最终四张 UI 证据图后确认通过。
- P7-B2 证据边界为 `tmp/qa-p7b2-candidate-test-2026-09-02/` 下的测试日志、browser 几何/交互记录及根审四张最终截图；其中 `runtime/`、`.coolzhu/`、`edge-profile/` 等运行时会话与浏览器配置仅作测试环境，不属于候选提交或视觉结论素材。
- P7-B2 视觉复验现已通过；0.2.9 Release MSI 构建、安装验收及后续 PR 流程仍未完成，因此当前不宣称已完成发布全路线。

## 后续状态

候选版本 0.2.9 的 Release 打包、安装与 MSI 独立验收仍待后续任务执行；本记录不宣称已打包、已安装或已完成全路线。供应商 reasoning 目录同样未被表述为 9 家真实请求联调完成。

## P7-C WebView2 发布前自检修正

- 根验收发现标准 EdgeWebView `Application` 根目录下实际使用一层版本目录（例如 `Application\\151...\\msedgewebview2.exe`），旧自检只检查根目录 exe，且以 `exists()` 判断会把目录误报为运行库。
- 已在 `main.rs` 保留 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 明确覆盖入口，补充已知 `Application` 根目录的一层版本子目录候选（不做全盘或递归扫描），并将运行库命中条件收紧为真实文件 `is_file()`；加入版本目录存在/缺失与目录不应命中的最小源测试，测试未由本实现代理执行。
- 2026-09-02 独立测试日志 `tmp/qa-p7c1-webview2-test-2026-09-02/logs/cargo-test-web-console-p7c1.log` 已完成 925 passed / 0 failed / exit 0。
- 2026-09-03 C.1 独立运行态证据目录为 `tmp/qa-p7c1-webview2-test-2026-09-03/`：`api/diagnostics-health.json` 中 `desktop.webview2=ok`，命中 `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\152.0.4191.53\msedgewebview2.exe`；`screenshots/module-self-check-1280x720.png` 由根直接 view 复验通过，36px 按钮、端口/构建信息可读且无自动 debug 泡。测试会话 cleanup 证据仍待独立会话归档，本文不提前宣称完成。
- 本项修改后的 `cargo build -p coolzhu-web-console --offline` 已通过（exit 0，2026-09-02；保留既有 59 条编译 warning）；构建由实现会话验证，正式测试由独立测试会话完成。
- 原候选 commit `e4371e39955762bb76c661aeabf1bdf77274846e` 已创建；因本项自检修正发生在其后，0.2.9 Release MSI 构建暂缓，待 web 离线构建与独立测试复核后再以增补 commit 进入打包，当前不宣称已构建或已安装。
