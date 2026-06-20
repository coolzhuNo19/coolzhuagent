# 2026-06-19 聊天 UI、桌宠闭眼帧重新编译与运行验证

## 目标

- 将聊天室操作按钮迁移到左侧会话菜单，释放主会话区顶部空间。
- 将顶部总览区域高度压缩约一半，并保持左 26%、中 48%、右 26% 的布局比例。
- 使用完整人物闭眼候选帧替换不协调的局部闭眼帧，禁止非等比拉伸。
- 基于 `package all` 解耦编译架构重新构建、打包并启动桌宠和 Web Console。
- 通过 Computer Use 执行真实前端点击验证。

## 风险控制与备份

- UI、桌宠资源修改前备份：
  - `tmp/backups/20260619-145447-chat-ui-blink-pre`
  - 备份清单包含 470 个文件。
- 活动配置修改前备份：
  - `tmp/backups/20260619-151833-active-config-pre`
- `package all` 自动备份被替换的旧二进制：
  - `package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260619-151432659.exe`
  - `package/backup/coolzhu-tauri-shell.exe/coolzhu-tauri-shell.20260619-151456089.exe`

## 主要修改

### Web Console

- `modules/gui-web/packages/web-console/index.html`
  - 新增聊天室左侧操作栏。
  - 迁移新建、重命名、删除、任务链、转交、加载更早、删除所选等会话操作。
  - 迁移聊天室选择、频道/模型选择、当前接收者和转交面板。
  - 主会话区标题栏不再重复占用操作按钮空间。
- `modules/gui-web/packages/web-console/src/styles.css`
  - 顶部区域比例调整为 `13.25%`。
  - 顶部三栏比例调整为 `26% / 48% / 26%`。
  - 工作区顶部占比调整为 `14.45%`。
  - 增加聊天室左侧操作栏、模型卡片和紧凑布局样式。
- `modules/gui-web/packages/web-console/src/app.js`
  - 会话与模型控件适配新的左侧容器。
  - 普通会话默认头像改为武侠桌宠头像。
- `modules/gui-web/packages/web-console/src/main.rs`
  - 增加左侧操作栏结构回归测试。
- 新增正式资源：
  - `modules/gui-web/packages/web-console/assets/ui-redesign/bamboo-leaf-banner-v1.png`
  - `modules/gui-web/packages/web-console/assets/avatars/wuxia-swordsman.png`

### 桌宠闭眼帧

- 使用完整人物 ImageGen 候选帧进行统一等比归一化：
  - 源人物边界：`X15 Y12 W227 H234`
  - 目标人物边界：`X12 Y7 W232 H239`
  - 等比缩放：`1.0214`
  - 基线：`245`
- 替换：
  - `blink.png`
  - `blink-0.png` 至 `blink-5.png`
- 所有正式帧均为 `256x256`，未进行横纵向独立拉伸。
- `pet-theme.json` 资源版本更新为 `20260619-1500`。

## TDD 与静态验证

- 红灯：
  - `tmp/logs/tdd-red-chat-left-sidebar.log`
  - 新增测试因缺少 `chat-left-rail` 结构按预期失败。
- 绿灯：
  - `tmp/logs/tdd-green-chat-left-sidebar.log`
- Web 前端测试：
  - `tmp/logs/test-coolzhu-web-console-frontend-green.log`
  - 结果：101 passed，0 failed。
- Tauri 桌宠测试：
  - `tmp/logs/test-coolzhu-tauri-shell-full.log`
  - 结果：40 passed，0 failed。
- 闭眼帧尺寸测试：
  - `tmp/logs/test-pet-blink-scale-imagegen-green-r2.log`
  - 结果：通过。
- JavaScript 语法检查：
  - `tmp/logs/node-check-web-console-app.log`
  - 结果：通过。
- Rust 检查：
  - `tmp/logs/check-coolzhu-web-console.log`
  - `tmp/logs/check-coolzhu-tauri-shell-low-memory.log`
  - 结果：通过。
  - Tauri 使用 `CARGO_BUILD_JOBS=1` 避免并行编译造成内存压力。

## 编译打包

- 执行 `package all`，日志：
  - `tmp/logs/package-all-chat-ui-blink-20260619.log`
- 打包报告：
  - `package/package-report.json`
- 新二进制：
  - `package/bin/coolzhu-web-console.exe`
  - SHA-256：`F6DF9A377D1E7146486137865C8316C5348610B7D27C2E3CEA8D710B32E51B12`
  - `package/bin/coolzhu-tauri-shell.exe`
  - SHA-256：`67A102174BDDF470C7A755DA6EAA476EFB864D7FD856C7E448202B63CBC19945`

## 启动与运行状态

- Web Console：
  - PID：`10236`
  - 地址：`http://127.0.0.1:8766`
- 桌宠 / Tauri Shell：
  - PID：`6300`
- 最终检查：
  - `tmp/logs/20260619-runtime-final-check.log`
  - 两个进程均为 responding。
  - `127.0.0.1:8766` 正常监听。
  - `/api/diagnostics/health` 返回 HTTP 200。

### 端口说明

Windows 当前保留了一个无法由现存进程回收的 `127.0.0.1:8765` 幽灵监听，记录的归属 PID 已不存在。为保证本次可运行验证，已在备份后将活动配置 `C:\Users\zhupu\coolzhuagent\coolzhu.toml` 的 Web 监听临时切换为 `127.0.0.1:8766`。系统注销或重启清除幽灵监听后，可按需恢复 8765。

## Computer Use 前端验证

- 激活窗口：`COOLZHU AGENT 控制台`。
- 实际点击“设置”，三列设置页面成功加载：
  - 会话/模型
  - 工具/审批
  - TTS/STT
- 实际点击“聊天室”切回主页面。
- 最终页面确认：
  - 顶部竹林 Logo 区已压缩。
  - 会话操作和模型卡片位于左侧菜单栏。
  - 主聊天区域不再保留原操作按钮堆。
  - 桌宠窗口正常显示。
- 截图证据：
  - `tmp/logs/20260619-web-console-chat-final.jpg`
  - `tmp/logs/20260619-desktop-pet-final.jpg`

## 当前状态

桌宠和 Web Console 保持运行，供人工继续检查视觉效果和眨眼动画。
