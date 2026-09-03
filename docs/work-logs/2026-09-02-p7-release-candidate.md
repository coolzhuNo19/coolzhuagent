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
- （P7-B2 阶段历史状态）视觉复验现已通过；当时 0.2.9 Release MSI 构建、安装验收及后续 PR 流程仍未完成，本条不代表当前发布状态。

## 后续状态

- （P7-B2 阶段历史状态）候选版本 0.2.9 的 Release 打包、安装与 MSI 独立验收仍待后续任务执行；当时本记录不宣称已打包、已安装或已完成全路线。供应商 reasoning 目录同样未被表述为 9 家真实请求联调完成。
- 当前状态（截至 2026-09-03，P7-C.3 attempt 2 已完成）：0.2.9 Release MSI 已正常升级安装成功；`tmp/qa-p7-installed-2026-09-02/logs/msiexec-upgrade-0.2.8-to-0.2.9-attempt2-2026-09-03.log` 记录 ProductVersion=0.2.9、安装成功或错误状态=0、MainEngineThread returning 0。安装后的 10 个 binary SHA-256 已与 `tmp/package-reports/package-report-release-20260903-011838146.json` 中的候选值逐项匹配。普通消息/SSE 真实 UI 短轮使用隔离 `127.0.0.1:18766` fixture 已通过，相关请求记录为 `tmp/qa-p7-installed-2026-09-02/fixture/mock-llm-requests.jsonl`，真实截图为 `tmp/qa-p7-installed-2026-09-02/screenshots/installed-p7-local-message-sky-2026-09-03.png`。安装后的界面恢复场景因当前策略拒绝待用户；独立 Browser 小轮因工具不可用未执行。0.2.10 尚未构建或安装。

## P7-C WebView2 发布前自检修正

- 根验收发现标准 EdgeWebView `Application` 根目录下实际使用一层版本目录（例如 `Application\\151...\\msedgewebview2.exe`），旧自检只检查根目录 exe，且以 `exists()` 判断会把目录误报为运行库。
- 已在 `main.rs` 保留 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER` 明确覆盖入口，补充已知 `Application` 根目录的一层版本子目录候选（不做全盘或递归扫描），并将运行库命中条件收紧为真实文件 `is_file()`；加入版本目录存在/缺失与目录不应命中的最小源测试，测试未由本实现代理执行。
- 2026-09-02 独立测试日志 `tmp/qa-p7c1-webview2-test-2026-09-02/logs/cargo-test-web-console-p7c1.log` 已完成 925 passed / 0 failed / exit 0。
- 2026-09-03 C.1 独立运行态证据目录为 `tmp/qa-p7c1-webview2-test-2026-09-03/`：`api/diagnostics-health.json` 中 `desktop.webview2=ok`，命中 `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\152.0.4191.53\msedgewebview2.exe`；`screenshots/module-self-check-1280x720.png`（1280x720，506740 bytes，SHA-256 `02E3EA2B1AA0AC9AD4A9A2B054AAB86FAFAF55131C5498B5584B7B779C02D685`）由根直接 view 复验通过，36px 按钮、端口/构建信息可读且无自动 debug 泡。`logs/p7c1-webview2-evidence-2026-09-03.txt` 已记录 served HTML/JS/CSS 200 且源 hash 一致、owned PID 1280 已不存在、18765 已释放及 8765 只读内核无监听；cleanup 已由独立会话归档并通过。
- 本项修改后的 `cargo build -p coolzhu-web-console --offline` 已通过（exit 0，2026-09-02；保留既有 59 条编译 warning）；构建由实现会话验证，正式测试由独立测试会话完成。
- 原候选 commit `e4371e39955762bb76c661aeabf1bdf77274846e` 已创建；本项自检修正随后以增补 commit 进入打包，构建结果见 P7-C.2。

## P7-C.2 0.2.9 Release MSI 构建

- 增补 source commit 为 `56d29f978a970938ae83eb6ca8a7871457581bbd`（短 SHA：`56d29f9`）；按 `scripts/build-msi.ps1 -Version 0.2.9 -Configuration release` 使用指定 staging 构建成功，Release build target 为 `x86_64-pc-windows-msvc`。
- 0.2.9 MSI 位于 `dist/CoolzhuAgent-0.2.9.msi`，大小 196385227 bytes，SHA-256 为 `BF5718943DBA91537E05A4321B85DC54C5678C741E9BE20F200923CE6A4D41D7`；installer report 为 `dist/CoolzhuAgent-0.2.9-installer-report.json`，package safety report 为 `dist/CoolzhuAgent-0.2.9-package-safety.json`，报告显示 803 files、`safe=true`、`findings=[]`。
- 完整构建日志为 `tmp/p7-release-preflight-2026-09-03/build-msi-0.2.9-release.log`，package report 为 `tmp/package-reports/package-report-release-20260903-011838146.json`；staging 为 `tmp/p7-release-preflight-2026-09-02/staging/package-0.2.9-release`。staged CLI `--version` 已核验 `0.2.9`、source commit 同上、target 同上。
- staged CLI `--version` 报告的 build date 为 `2026-09-02`（UTC；installer report 仅含 `generated_at`，不含 build date 字段）；MSI 当前未签名，`signed=false`、`signing_status=unsigned`。本条仅记录构建阶段本实现会话未安装或启动应用；后续 C.3 attempt 2 的实际安装结果见“后续状态”。

## P7-C.4 Tauri 桌面壳可见性修正

- 普通无参或 `--show-console` 启动默认只显示控制台；明确 `--pet`、`--show-pet`、`--pet-action` 或 `--pet-event` 才显示桌宠，显式同时要求控制台与桌宠时保留两者。桌宠窗口创建后不再隐式 `show()`，避免启动可见性契约被覆盖。
- 原生托盘新增“隐藏桌宠”，仅隐藏桌宠窗口，不退出进程、不终止控制台、不改变控制台可见性；既有“显示桌宠”、拖动、动画和生命周期行为保留。
- `--pet-state` 现作为被动状态更新：仅向已有桌宠发送状态事件，不强制显示/唤起已隐藏桌宠，也不弹出控制台；与显式桌宠意图组合时仍按显式意图显示。该行为通过源契约测试覆盖。
- `pet-theme.json` 增加 `blink` 瞬时信号配置，复用现有 8 张 `idle-{index}.png`；不改现有 `asset_version`、`pet-mini.html` 的闭眼覆盖逻辑或任何 PNG，修复 audio 事件被 Rust 归一化为 idle 的实际链路缺口。
- 首次独立 Tauri 测试编译曾被历史 `generated-previews-20260617/stabilized-metrics.json` 缺失阻断。已确认该原件不在 tracked/可达或悬空 Git 历史、现有项目源及 tmp 交付目录；未运行会删除当前动画 PNG 的稳定化脚本。为让其余测试真实编译执行，仅将测试专用 `include_str!` 改为测试期读取，缺失时报告明确路径；保留 3 个原 metrics 测试及全部断言，不 skip、ignore 或提供默认数据，因此这 3 项仍会如实报告缺 fixture。
- 独立 Tauri 全套基线记录于 `tmp/qa-p7-installed-2026-09-02/logs/cargo-test-tauri-shell-c4-full-2026-09-03.log`：36 passed / 10 failed / 0 ignored。失败分类为 3 个 CRLF 源文本契约（`quit_app`、`report_throne_zone`、diagnostics count）、3 个过时 blink overlay 契约、1 个 audio→blink 数据映射缺口及 3 个缺失历史 metrics fixture；本轮仅分别做测试期换行规范化、按现有 8 帧 overlay/PNG 锚点更新契约及 theme 数据修复，未伪造 metrics 结果。
- 独立修复后 Tauri 全套记录于 `tmp/qa-p7-installed-2026-09-02/logs/cargo-test-tauri-shell-c4-final-2026-09-03.log`：43 passed / 3 failed / 0 ignored，exit 101；3 个失败均为缺失历史 `stabilized-metrics.json` fixture（`pet_martial_frames_keep_character_scale_consistent_with_idle`、`pet_success_frames_do_not_mix_closeup_character_scales`、`pet_wuxia_frames_keep_policy_stable_scale_and_anchors`）。C.4 启动/托盘/被动 state 行为、audio→blink 映射、8 帧 overlay 与实际 PNG 几何契约均通过；测试编译保留两个 test-only dead-code warning，未因此改测或生产代码。
- `cargo fmt --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml -- --check`：通过；`git diff --check`：通过（仅 LF→CRLF 提示）。`cargo build --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml --offline`：通过，22.74s；日志为 `tmp/p7-release-preflight-2026-09-03/p7c4-tauri-build-after-blink-fix.log`。当前 `main.rs` SHA-256 为 `1F424ABAFA3179C4BCD0A7516F699AE3A0B2250FD55819B3AEB9F7D2298D5650`，`pet-theme.json` SHA-256 为 `5F177647AD33E472A5EC6921AC33A14DDC50E53A61842A10168B68EF73A35DE3`；全套不宣称绿色，3 个历史 metrics fixture 缺失保持为明确失败。
