# 桌宠代码 Review + 文件拖拽到桌宠功能方案（2026-06-04）

> 用户任务1：检查桌宠代码完成度、review 硬编码等设计问题；新增"文件拖到桌宠→移到 workspace + 加进消息附件"功能。
> 本文为代码排查 + 方案规划，**不直接改代码**。

## 一、桌宠代码完成度（截至 2026-06-04 实测）

桌宠核心已相当完整（详见 `docs/desktop-pet-clawd-integration-and-new-features-2026-05-31.md` 的 06-03 落地记录）：
- 后端事件→状态机（`pet_status_for_backend_event`）、`/api/pet/*` 路由、SSE 事件流 ✅
- tauri-shell 独立悬浮窗（transparent/always_on_top/无边框/skip_taskbar/76px 固定）✅
- 13+ 动画态主题清单（含超人飞行 dragging、3 种表演态、sleeping）✅
- 拖拽（`start_pet_dragging`→native drag + 释放回 idle 看守）✅
- 空闲自治（5min 随机表演、10min 睡眠、活动唤醒）✅
- Rust 测试覆盖主题清单/帧裁切/idle 逻辑 ✅

**结论：桌宠功能完成度高，本次只需补"文件拖放"这一缺口 + 清理少量硬编码。**

## 二、Review：硬编码与代码设计问题

### 🟢 设计较好的地方
- 关键标识已常量化：`CONSOLE_LABEL`/`PET_LABEL`/`PET_WINDOW_SIZE=76.0`/`DEFAULT_GUI_WEB_URL`/`PET_THEME_JSON`(include_str!)。
- 帧动画用 `pet-theme.json` 数据驱动（frame_pattern/count/interval/priority），非写死。
- 事件→态映射集中在 `pet_status_for_backend_event` 一处。

### 🟡 硬编码/可改进点（建议清理，非阻塞）
| 位置 | 现状 | 建议 |
| --- | --- | --- |
| `build_console_window` | `.inner_size(1440.0, 900.0)`、`.min_inner_size(1180.0, 760.0)`、`.position(48.0,48.0)` 裸字面量 | 提为常量 `CONSOLE_DEFAULT_W/H`、`CONSOLE_MIN_W/H`、`CONSOLE_POS` |
| `build_pet_window` | `.position(120.0, 120.0)` 裸字面量 | 提为常量 `PET_DEFAULT_POS`；理想是按屏幕右下角动态算（现固定左上偏移） |
| `DEFAULT_GUI_WEB_URL` | 写死 `http://127.0.0.1:8765` | 已可被参数覆盖（`unwrap_or_else`），但端口 8765 与 web-console 的 `COOLZHU_WEB_BIND_ADDR` 未联动——若用户改 web 端口，桌宠仍连 8765。建议从同一配置源读。 |
| **前端帧资源双维护** | `pet-mini.html` 的 `frameSets/stateSprites` 与 `pet-theme.json` **并行各存一份** | 已知风险（文档已记）：改帧两处都要改。建议让 pet-mini.html 启动时 fetch/读同一份 theme JSON，单一数据源。 |
| 表演态魔数 | 5min/10min/30s 计时散在 pet-mini.html | 提为命名常量，便于调参 |

### 🔴 真正的功能缺口
- **无文件拖放处理**：全仓 `drop` 只出现在 CSS `drop-shadow`，tauri 后端 + pet-mini.html 均无 `DragDrop`/`FileDrop` 事件处理。这是任务1要新增的。

## 三、新功能：文件拖到桌宠 → 移到 workspace + 加进消息附件

### 目标链路
```
用户把文件拖到桌宠图标
  → tauri pet window 捕获 DragDrop(paths)
  → 把文件移动到当前 workspace 目录
  → 通知 web-console 把该文件(workspace 路径)加进 composer 附件
  → 桌宠播一个"接住/搬运"动作 + 气泡提示
```

### 关键技术点与落点（Tauri 2.x）
1. **捕获文件拖放**（tauri-shell main.rs）：
   - Tauri 2 的文件拖放事件是 `WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position })`。
   - 落点：`build_pet_window` 已有的 `pet_window.on_window_event(move |event| match event {...})`，
     在现有 match 里加 `WindowEvent::DragDrop(...)` 分支。
   - ⚠️ **风险**：pet window 当前 `.focusable(false)` + `.skip_taskbar(true)`，需验证无焦点窗口能否收到 DragDrop
     （部分平台无焦点窗口不接受拖放）。若收不到，备选：拖放时临时 `set_focusable(true)`，或用一个透明命中层。
   - ⚠️ Tauri 2 默认 `dragDropEnabled` 可能需在 `tauri.conf.json` 的 window 配置里确保未禁用。

2. **获取 workspace 目录 + 移动文件**：
   - 桌宠进程**不直接知道** workspace（那是 web-console 的 `active_workspace_path()`）。两种方案：
     - **A（推荐）**：桌宠收到文件后，HTTP POST 到 web-console 新增的 `/api/pet/drop-files`（带本地文件绝对路径列表），
       **由 web-console 后端**完成"移动到 workspace + 登记附件"（它本就持有 workspace 路径与附件存储逻辑）。
       桌宠只做"捕获 + 转发 + 播动画"，职责清晰，不重复 workspace 逻辑。
     - B：桌宠先 `GET /api/workspace` 拿路径自己移动——但移动文件 + 附件登记的逻辑会和后端重复，不推荐。
   - 移动语义：默认**移动**（move，按用户要求）。同盘 `std::fs::rename`，跨盘 copy+delete。
     目标名冲突时加序号（`name (1).ext`）。需提示用户"已移动"而非"复制"。

3. **加进消息附件**：
   - 新增后端 `POST /api/pet/drop-files { paths: [本地绝对路径] }`：
     - 校验路径存在、大小、类型；移动到 `active_workspace_path()`（或 `attachment_store_dir()`，见下方决策）；
     - 返回附件 DTO（kind/name/url=workspace 相对路径或 `/api/attachments/files/...`）。
   - 前端：把返回的附件 push 进 `pendingFileAttachments`（composer 暂存区），并渲染到 `[data-role="composer-attachments"]`，
     用户下次发消息时随附件一起发。
   - ⚠️ **目录决策**：用户要求"移到 workspace 目录"。但现有附件机制用的是 `attachment_store_dir()`（独立附件库）。
     需明确：是移到 **workspace 根目录**（用户语义，文件在工程里可见）还是 **附件库**（现有机制）？
     建议：移到 workspace 下一个约定子目录（如 `workspace/.coolzhu/dropped/` 或 `workspace/attachments/`），
     既满足"在 workspace 里"又不污染工程根。**此点需用户确认**。

4. **桌宠反馈动画**：
   - 收到文件 → `emit_pet_status("carrying", "已接收 N 个文件，放进工作区")`（carrying 态已存在，正合"搬运"语义），
     或新增 `catch` 态。气泡提示文件名。

### 改动面与优先级
- 后端（web-console main.rs）：新增 `/api/pet/drop-files` 路由 + handler（移动文件 + 登记附件 + 返回 DTO）。
- 桌宠（tauri-shell main.rs）：`on_window_event` 加 `DragDrop` 分支 → 收集 paths → HTTP POST 到 web-console → 播 carrying 动画。
- 前端（app.js）：暴露一个"接收外部拖入附件"的入口（或桌宠 POST 后 web-console 经 SSE 通知前端刷新 composer 附件）。
- 测试：`/api/pet/drop-files` 单测（移动 + 冲突重命名 + 附件 DTO）；tauri DragDrop 手动验证。

### 待用户确认
1. **目标目录**：workspace 根 / `workspace/.coolzhu/dropped/` / 现有附件库？（建议 `workspace/.coolzhu/dropped/`）
2. **移动 vs 复制**：用户说"移动"，确认原文件删除可接受（不可逆）。
3. **无焦点窗口拖放**：若 pet window 收不到 DragDrop，是否接受拖放瞬间短暂获取焦点？

## 四、本次 Review 结论
- 桌宠功能完成度高，**唯一功能缺口 = 文件拖放**（任务1新需求）。
- 硬编码问题**不严重**（关键已常量化），建议顺手清理窗口尺寸/位置字面量 + 解决"前端帧资源双维护"单一数据源问题。
- 文件拖放推荐**方案A**（桌宠捕获转发，web-console 后端落地），职责清晰、不重复 workspace 逻辑。
- 三个待确认点需用户拍板后再动代码。
