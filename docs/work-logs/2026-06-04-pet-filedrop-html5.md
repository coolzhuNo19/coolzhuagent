# 2026-06-04 桌宠文件拖放（R-PET-FILEDROP）HTML5 方案落地

## 目标
完成 R-PET-FILEDROP：把文件拖到桌宠图标 → 文件进当前 workspace 的附件目录 + 自动加进聊天室 composer 附件区。

## 结论
✅ **完整打通，经用户真实 GUI 拖放实测 + preview 渲染实测双重确认。**
采用 **HTML5 拖放**方案（原生 WM_DROPFILES 因 WebView2 架构不可行，已废弃）。语义为**复制**——保留原文件（HTML5 安全模型不向网页暴露磁盘路径，无法删原件），与最初确认的"移动删原件"设想偏离，已与用户确认"先维持复制"。

## 历程与关键技术结论

### 1. 原生 WM_DROPFILES 方案（失败，已废弃）
桌宠窗口为"点击不抢焦点"设了 `WS_EX_NOACTIVATE` + `focusable(false)`，尝试用 Win32 shell 的 `DragAcceptFiles` + 子类化窗口过程拦截 `WM_DROPFILES`：
- 顶层窗口 `DragAcceptFiles` → 拖放悬停仍显示禁止图标，`WM_DROPFILES` 不触发。
- 诊断日志（EnumChildWindows 枚举窗口结构）揭示根因：桌宠客户区被 **WebView2 渲染窗口**（`Chrome_RenderWidgetHostHWND` / `Intermediate D3D Window`）覆盖，拖放命中的是这些窗口，而它们属于 **WebView2 独立子进程**（`SetWindowLongPtrW` 返回 `orig=0`，跨进程子类化失败）。
- 即便对所有子窗口 `RevokeDragDrop` + `DragAcceptFiles`，`WM_DROPFILES` 仍被投递到 WebView2 子进程的消息队列，主进程的 wndproc 收不到。
- **硬结论：Windows 不允许跨进程子类化窗口过程（WNDPROC 是本进程地址），WebView2 架构下原生 WM_DROPFILES 这条路彻底走不通。**

### 2. HTML5 拖放方案（成功）
WebView2 原生支持 HTML5 拖放，让网页层直接收 drop 事件：
- **tauri-shell**：`build_pet_window` 加 `.disable_drag_drop_handler()`（把拖放交给网页 HTML5）；新增 command `pet_drop_uploaded(files: Vec<PetUploadFile>)`，用 reqwest POST 转发到 web-console（rust 侧无浏览器跨域问题）。
- **pet-mini.html**：监听 `dragenter/dragover`（`preventDefault` + `dropEffect=copy`，去掉禁止图标）+ `drop`（`FileReader.readAsDataURL` 读 base64 → `invoke("pet_drop_uploaded", {files})`），并播 carrying/success 动画反馈。
- **web-console**：新增 `POST /api/pet/drop-upload`（JSON `{files:[{name,mime_type,content_base64}]}`）→ base64 decode → 写 `attachment_store_dir` → 按 MIME 推断 kind（image/video 支持富媒体内联）→ 入队 `pet_dropped_attachments_queue`。
- **闭环**：前端 `pollPetDroppedAttachments`（3 秒轮询 `/api/pet/pending-attachments`）取出附件 → push `pendingFileAttachments` → `renderComposerAttachments` 渲染 chip + addMessage("桌宠")。

### 3. 关键 bug：附件不显示（WebView2 缓存）
HTML5 方案后用户反馈"桌宠收下文件但主控制台没附件"。逐层排查：
- 后端自测：drop-upload 写盘+入队+出队全正确。
- 前端代码：`pollPetDroppedAttachments` / `renderComposerAttachments` 逻辑正确（`formatFileSize(undefined)` 容错返回空，不抛错）。
- **preview 实测**（启动隔离浏览器加载 8765，注入 drop-upload + 触发轮询）：`chipCount=1`、`chipText="preview-test.png×"` —— **渲染本身完全正确**。
- **根因**：`serve_static_path` 用 `tokio::fs::read` 读盘但**无 Cache-Control 头**，WebView2 对无缓存头响应做启发式缓存，主控制台用了缓存的旧 app.js。
- **修复**：`serve_static_path` 加 `Cache-Control: no-cache, no-store, must-revalidate`。重启后用户实测附件成功显示。

### 4. 文件名修复
用户反馈复制后文件名被改成 `att-{id}-{hash}-原名`。`api_pet_drop_upload` 改为存盘用 `sanitize_attachment_file_name(原名)`，仅重名时加序号（`原名-1.txt`），保持可读。

### 5. 死代码清理
删除失败的原生方案全部产物（`PET_DROP_*` static、`pet_drop_procs/log/collect_child`、`install_pet_file_drop_target`、`pet_drop_wndproc`，约 180 行），Cargo.toml 移除已无用的 `Win32_System_Ole` / `Win32_UI_Shell` feature。tauri-shell 编译 0 warning。

## 涉及文件
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`：disable_drag_drop_handler、pet_drop_uploaded command + PetUploadFile、删原生块。
- `modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml`：移除 Ole/Shell feature。
- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`：drop 监听 + base64 上传。
- `modules/gui-web/packages/web-console/src/main.rs`：`/api/pet/drop-upload` 端点 + DTO、`serve_static_path` no-cache 头、拖放文件名用原名。

## 验证
- web-console：`cargo test -p coolzhu-web-console` **403 passed; 0 failed**。
- tauri-shell：`cargo build` Finished，0 warning。
- pet-mini.html：node AsyncFunction 语法校验 JS_SYNTAX_OK。
- 后端端到端：curl drop-upload → 写盘(原文件名)+ 可访问 + 入队/出队/清空全通。
- preview 渲染：composer chip 正确渲染。
- 用户真实 GUI：拖放→桌宠"收下文件"动画→主控制台 composer 附件成功显示。

## 遗留 / 限制
- **复制语义**：HTML5 拿不到磁盘路径，无法删原件（原文件保留）。如坚持"移动删原件"，在 WebView2 桌宠上技术不可行。
- DragDrop 后端监听 + `handle_pet_file_drop` + `/api/pet/drop-files`（路径方式）保留作后备（disable 下不活跃，未来若桌宠能拿路径可复用）。
