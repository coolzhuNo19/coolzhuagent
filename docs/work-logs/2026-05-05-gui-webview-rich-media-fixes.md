# 2026-05-05 GUI WebView 与富媒体交互修复日志

## 范围

本次按新工作流先补需求和方案，再实施以下修复：

- Tauri WebView 与浏览器页面的基础字号和卡片内部显示一致性。
- 配置/会话/Agent 三合一卡片字段收敛，去掉调试感的超时字段。
- 工程目录卡片内容溢出时在卡片内滚动。
- 内视觉卡片显示最新截图缩略图。
- 对话回复区域富文本/图片/视频可点击，避免与消息选中转发冲突。

## 需求记录

已新增：

- `docs/change-and-requirement-workflow.md`
- `docs/gui-web/2026-05-05-ui-webview-rich-media-plan.md`

已更新：

- `docs/requirements-management.md`
- `docs/README.md`

## 实现内容

| 需求 | 实现 | 文件 |
| --- | --- | --- |
| `REQ-WEB-UI-002` | 固定根字号和文本缩放，三合一卡片内部字号统一，卡片内容可滚动 | `modules/gui-web/packages/web-console/src/styles.css` |
| `REQ-WEB-UI-003` | 三合一卡片去掉 `超时`，改为显示 `Key` 状态 | `modules/gui-web/packages/web-console/index.html`、`src/app.js` |
| `REQ-WEB-UI-004` | 工程目录卡片改为 flex column，工程树占剩余空间并启用滚动条 | `src/styles.css` |
| `REQ-WEB-VIS-003` | `CaptureMetadata` 增加 `preview_url`，新增 `/api/capture/latest/image`，前端将其渲染为缩略图背景 | `src/main.rs`、`src/app.js`、`src/styles.css` |
| `REQ-WEB-MEDIA-004` | 消息点击选中避开链接、图片、视频、附件控件；正文支持轻量 Markdown 链接、图片、视频、粗体、行内代码和换行 | `src/app.js`、`src/styles.css` |

## 验证

已执行并通过：

```powershell
cargo fmt
node --check modules\gui-web\packages\web-console\src\app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
```

测试结果：

- `coolzhu-web-console` 单测从 73 个增加到 74 个，全部通过。
- 新增 `latest_capture_metadata_exposes_preview_route`，验证最新截图元数据暴露固定缩略图路由。

接口验证：

```powershell
Invoke-WebRequest http://127.0.0.1:8765/api/state -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8765/api/capture/latest -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8765/api/capture/latest/image -UseBasicParsing
```

结果：

- `/api/state` 返回 `200`。
- `/api/capture/latest` 返回 `preview_url: "/api/capture/latest/image"`。
- `/api/capture/latest/image` 返回 `200`，`Content-Type: image/png`。

## 服务状态

已停止旧 `coolzhu-web-console` 进程并重启新版本：

- 当前 Web 服务：`target\debug\coolzhu-web-console.exe`
- 当前地址：`http://127.0.0.1:8765`
- 当前桌宠壳：`coolzhu-tauri-shell.exe` 仍在运行。

## 已知限制

| 限制 | 后续处理 |
| --- | --- |
| 本轮无法使用 Codex in-app browser 做截图比对，因 IAB 后端未发现可用浏览器 | 后续可补 Playwright/人工截图验收 |
| 富文本为轻量白名单解析，不执行 HTML | 后续富文本编辑器落地时再引入成熟 Markdown 渲染器 |
| 视频外链能否播放取决于源站 CORS/编码 | 保留外链入口作为降级 |
| WebView 字号一致性已通过 CSS 固定，但仍需人工看实际 Tauri 窗口截图 | 需求状态标记为测试中 |

## 追加修复记录

更新时间：2026-05-05

| 问题 | 处理 |
| --- | --- |
| 三合一卡片仍显示 `[L1]chat`、`[L2]decision` beads 文本 | 从主卡片移除 memory beads 列表和前端渲染入口；beads 后续进入专门记忆管理视图 |
| 工程目录路径被遮挡 | 工程目录卡片不再显示分支和变更，仅保留路径和目录树 |
| 新增滚动条样式不一致 | 工程目录路径、工程树、三合一卡片滚动条统一使用对话回复同款金色样式 |
| 内视觉缩略图显示空间不足 | 内视觉卡片改为 flex column，采集按钮固定底部，按钮上方全部作为截图缩略图区域 |

追加验证：

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
Invoke-WebRequest http://127.0.0.1:8765/api/state -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8765/api/capture/latest/image -UseBasicParsing
```

结果：

- `coolzhu-web-console` 74 个测试全部通过。
- `/api/state` 返回 `200`。
- `/api/capture/latest/image` 返回 `200`，`Content-Type: image/png`。
- 已重启 `coolzhu-web-console.exe`，桌宠 WebView 下次显示会加载新页面资源。

## 追加修复记录二

更新时间：2026-05-05

| 问题 | 处理 |
| --- | --- |
| 普通链接、图片链接、视频链接出现两次显示 | 正文只保留链接和基础富文本样式，图片/视频预览统一交给附件区渲染 |
| 图片预览失败导致排版混乱 | 附件图片增加预览失败降级，失败时移除坏图并保留“打开图片”链接 |
| 视频/图片排版撑乱消息 | 附件区改为受限网格，媒体预览放入 `attachment-media-frame` |
| 测试实验室卡片内容显示不完整 | `lab-card` 增加卡片内滚动，滚动条使用同款金色样式 |

追加验证：

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
Invoke-WebRequest http://127.0.0.1:8765/api/state -UseBasicParsing
```

结果：

- `coolzhu-web-console` 74 个测试全部通过。
- `/api/state` 返回 `200`。
- 已重启 `coolzhu-web-console.exe`。

## 追加修复记录三

更新时间：2026-05-05

| 问题 | 处理 |
| --- | --- |
| 普通链接、图片链接、视频链接仍存在双份显示预期不清 | 普通链接只保留正文链接；图片/视频链接从正文去重，只在附件区预览和提供打开入口 |
| 无扩展名图片 URL 识别失败 | 图片检测兼容 `/image/png`、`format=png`、`type=png` 等地址 |
| 工程目录树在部分 WebView 滚动条颜色未命中 | `project-tree` 补齐标准 `scrollbar-color` |
| 测试实验室滚动条与内部内容稳定性 | `lab-card` 加 `scrollbar-gutter: stable`，`task-list/profile-list` 补齐标准金色滚动条 |

验证：

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
```

结果：

- 前端脚本语法检查通过。
- 富媒体展示仍需用户在浏览器/WebView 中做手动交互复测。
