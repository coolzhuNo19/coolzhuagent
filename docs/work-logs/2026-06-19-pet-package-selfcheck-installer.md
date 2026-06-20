# 2026-06-19 桌宠 blink 修复、package 打包运行、自检日志与安装包准备

## 目标

1. 修复桌宠眨眼后出现一帧缩小的问题。
2. 基于 package 解耦编译架构完成一次编译打包并启动运行。
3. 继续补齐模块日志与开机自检方案。
4. 为后续打包安装文件方案做好实施准备。

## 修改范围

本轮主要修改：

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/blink.png`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/blink-0.png` ~ `blink-5.png`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-theme.json`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
- `scripts/package-all.ps1`
- `package/run.ps1`
- `docs/development-standard.md`
- `docs/plans/package-module-logging-selfcheck-2026-06-19.md`
- `docs/plans/installer-from-package-architecture-2026-06-19.md`

注意：`modules/gui-desktop` 当前工作区存在大量既有未提交/未跟踪资源改动，本轮未尝试回滚或整理这些历史变更，只在上述范围内继续推进。

## 眨眼帧问题

### 根因

自动 blink 运行时没有发现 CSS 单轴缩放或运行时拉伸。实际问题来自 blink PNG 角色主体体量偏小：

- 修复前 idle 主体宽度中位数约 `227px`。
- 修复前 blink 主体宽度中位数约 `215px`。
- blink 宽度约为 idle 的 `94.7%`，面积约为 `95.2%`。

另一个打包风险是 `package/modules/.../tauri-shell/ui/pet-mini.html` 曾保留旧副本，而新资源被错误复制到 `ui/ui/` 嵌套目录。

### 修复

- `scheduleIdleBlink()` 改为统一走 `setState("blink")`，回 idle 时使用 `if (state === "blink")` 保护，避免直接手改 `state/activeFrames/frameIndex`。
- 重新生成 blink 正式帧，使用 idle 帧作为角色体量与画布基准，只重绘眼睛闭合/过渡区域；没有使用 CSS scale、单轴拉伸或改角色比例。
- 更新 `pet-theme.json` 的 `asset_version`。
- 扩展 Rust 回归测试，增加 blink 与 idle 的主体宽度、主体面积对比，防止之后只看高度导致“看似过测但视觉缩小”。

### 备份与恢复

正式 blink 资源修改前已备份到：

```text
tmp/backups/20260619-094824-pet-blink-assets-pre
```

恢复方式：停止 package 进程后，将该目录内的 `blink*.png` 覆盖回：

```text
modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/
```

再执行：

```powershell
.\package.ps1 all -Configuration debug
```

## package 解耦打包与资源复制

### 修复

`scripts/package-all.ps1` 的资源复制改为复制目录内容而不是把源目录嵌套到目标目录，并在删除目标目录前校验目标路径必须位于 package 根目录下。

验证结果：

- package 内 `pet-mini.html` 与源文件 SHA-256 一致。
- `package/modules/gui-desktop/packages/tauri-shell/ui/ui` 已不存在。
- `gui-desktop.tauri-shell` 二进制重新编译并发布。
- 旧二进制备份到：

```text
package/backup/coolzhu-tauri-shell.exe/coolzhu-tauri-shell.20260619-095753951.exe
```

## 模块日志与启动自检

### 已落地

`package/run.ps1` 现在会：

- 创建 `tmp/logs/`。
- 设置 `COOLZHU_LOG_DIR=tmp/logs`，作为历史 diagnostics 输出目录 one-shot 兼容入口。
- 将长驻模块 stdout/stderr 分别重定向：
  - `coolzhu-web-console.stdout.log`
  - `coolzhu-web-console.stderr.log`
  - `coolzhu-tauri-shell.stdout.log`
  - `coolzhu-tauri-shell.stderr.log`
- 等待 web-console `/api/diagnostics/health`。
- 生成启动自检报告：
  - `tmp/logs/package-selfcheck-last.json`
  - `tmp/logs/package-selfcheck-<timestamp>.json`

当前自检报告结果：

```text
overall=ok
ok=12
warn=0
error=0
```

web-console health 结果：

```text
HTTP 200
summary.status=warn
ok=10
warn=1
error=0
```

`docs/development-standard.md` 已新增“模块日志与启动自检规范”。

### 后续方案

新增方案文档：

- `docs/plans/package-module-logging-selfcheck-2026-06-19.md`

该文档定义了 report schema、模块 probe 扩展点、err 日志最低字段，以及 gui-web/gui-desktop/computer-use/vision/llm-adapter/cli/core-runtime 后续补齐路线。

## 安装包准备

新增方案文档：

- `docs/plans/installer-from-package-architecture-2026-06-19.md`

推荐先做骨架安装包，把当前 `package/bin` 与 `package/modules` 作为安装器 staging 输入；大模型、llama.cpp runtime、视觉权重不内置默认安装包，首启向导提供下载/手动放置/校验。

## 验证记录

### 桌宠/眨眼回归

日志：

```text
tmp/logs/20260619-tauri-shell-pet-regression-final.log
```

结果：

```text
cargo fmt --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml
cargo check --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml --offline
cargo test ... pet_mini_idle_blink_uses_unified_state_transition
cargo test ... pet_blink_active_frames_match_idle_character_scale
cargo test ... pet_wuxia_frames_keep_policy_stable_scale_and_anchors
cargo test ... pet_action_frames_share_canvas_and_visual_anchor
TAURI_PET_REGRESSION_PASS
```

修复后指标：

```text
idle width median = 227
blink width median = 228
width_ratio = 1.0044
area_ratio = 1.0007
```

### package 脚本契约

日志：

```text
tmp/logs/20260619-package-script-contracts-with-selfcheck.log
```

结果：

```text
package run contract PASS
package resource copy contract PASS
package self-check contract PASS
```

### package all

日志：

```text
tmp/logs/20260619-package-all-debug-after-fixes.log
```

结果：

```text
package report: package/package-report.json
publish gui-desktop.tauri-shell
```

### 启动运行

package 当前已启动：

```text
coolzhu-web-console.exe pid=2024
coolzhu-tauri-shell.exe pid=14432
```

健康检查：

```text
tmp/logs/20260619-final-runtime-status.log
health_status=200
selfcheck ok=12 warn=0 error=0
```

computer-use 验证：

- 已枚举到 package 启动的 `coolzhu-tauri-shell.exe`。
- 可见窗口标题为 `COOLZHU AGENT 控制台`。
- 截图快照成功，`screenshotCount=2`。
- 当前 computer-use 只暴露控制台 Tauri 窗口；透明桌宠 mini 窗口未作为独立可点窗口暴露，因此桌宠 blink 本身以资源指标、Rust 回归测试、contact sheet 和 package 启动健康作为验收证据。

## 遗留事项

- 将 `COOLZHU_LOG_DIR` 从 package 启动器 one-shot 兼容迁移为 `coolzhu.toml` typed 配置。
- 为 gui-web、computer-use、vision、llm-adapter、core-runtime 接入更细的模块 probe。
- 为安装器新增 staging/安装/卸载自动化验证。
- 后续如需直接验证透明桌宠双击，可考虑为 pet mini 暴露可枚举的测试窗口句柄或在 Tauri 内增加只读状态 API，避免使用不稳定坐标猜测。
