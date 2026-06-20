# 2026-05-02 桌宠与 Gerrit 修复工作日志

## 范围

本次工作聚焦两条主线：

- 桌宠 Tauri Shell 可用性修复：透明窗口、拖动、失焦、关闭和动画资源。
- 本地 Gerrit 服务恢复：服务启动、账号 SSH 修复、项目创建和可用代码提交。

## 桌宠问题与处理

| 问题 | 现象 | 根因判断 | 处理方案 | 验证结果 |
| --- | --- | --- | --- | --- |
| 窗口边框残留 | 桌宠顶部出现 Windows 标题栏、小灰色 C、浅蓝色条 | Tauri/WebView2 在透明窗口和系统拖动状态下触发宿主窗口残影 | 新增 `pet-mini.html`，隐藏辅助小窗口，强制剥离 Win32 chrome | 启动后无边框 |
| 左侧帧裁切 | 少量动画帧左边被切掉 | 旧 sprite 切片存在边界风险 | 改用 GIF 派生的透明帧 `pet-gif-frames` | 每帧左侧透明留白约 42 到 49 像素 |
| 拖动后标题栏出现 | 长按拖动后出现蓝色标题栏 | `start_dragging()` 触发系统原生拖拽，透明区域留下 DWM 残影 | 改为 Win32 `WM_NCLBUTTONDOWN / HTCAPTION` 拖动，并在移动事件后清理 chrome | 拖动后 `Caption=false`、`Border=false` |
| 点击窗口外标题栏出现 | 桌宠失焦后标题栏重新出现 | 窗口激活/失焦切换导致 WebView2 透明区域残影 | 设置 `focusable(false)`，固定 `WS_EX_NOACTIVATE` 与 `WS_EX_TOOLWINDOW`，增加低 alpha 刷新层 | 点击外部后无标题栏，拖动仍可用 |
| 关闭行为不一致 | 点击桌宠 X 后边框残留或进程未按预期退出 | 关闭按钮和窗口关闭事件路径不统一 | `quit_app` 统一调用 `app.exit(0)`，窗口 close request 也退出进程 | 点击 X 退出应用 |

## 关键代码变更

- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
- `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-gif-frames/`

## 验证命令

```powershell
cd C:\Users\zhupu\Desktop\codex\modules\gui-desktop\packages\tauri-shell\src-tauri
cargo build --offline
Start-Process -FilePath .\target\debug\coolzhu-tauri-shell.exe -WindowStyle Hidden
```

窗口样式验证结论：

- 主桌宠窗口尺寸：`150x150`
- `Caption=false`
- `Border=false`
- `ToolWindow=true`
- `NoActivate=true`

## Gerrit 恢复过程

| 步骤 | 处理内容 | 结果 |
| --- | --- | --- |
| 启动服务 | 使用 `gerrit.war daemon -d gerrit-site --console-log` 启动 | HTTP `8080` 返回 Gerrit `3.8.1` |
| 修复 host key | Gerrit 重建后 SSH host key 变化，清理 `[localhost]:29418` 旧记录 | SSH host 校验恢复 |
| 修复账号 | 直接修复 `All-Users.git` NoteDb，为 `1000000` 绑定 `admin`，为 `1000001` 绑定 `chatgpt` | `admin` 和 `chatgpt` 均可 SSH 登录 |
| 修复 external-id 编码 | PowerShell UTF-8 BOM 导致 Gerrit 报 `Invalid external ID config` | 改为 ASCII 无 BOM 后恢复 |
| 创建项目 | `admin` 创建 `coolzhu-project/gui-desktop` 和 `coolzhu-project/docs` | 项目在 Gerrit project list 中可见 |
| 提交桌宠代码 | 将 `gui-desktop` 当前可用代码推入 Gerrit `main` | `coolzhu-project/gui-desktop` 已有可用代码 |

## Gerrit 验证命令

```powershell
ssh -p 29418 admin@localhost gerrit version
ssh -p 29418 chatgpt@localhost gerrit version
Invoke-WebRequest http://localhost:8080/config/server/version -UseBasicParsing
```

## 后续建议

- 将 Gerrit 启动、账号修复、项目创建整理为可重复脚本，避免重建服务后手工恢复。
- `gui-desktop` 后续变更使用 `chatgpt` 用户走 `refs/for/main`，首导入以外不再直接推 `refs/heads/main`。
- 桌宠形象后续替换时，应保持透明 PNG/GIF 帧统一画布尺寸，并在提交前运行透明边界扫描。
