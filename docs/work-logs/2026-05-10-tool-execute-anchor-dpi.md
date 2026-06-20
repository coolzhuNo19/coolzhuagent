# 2026-05-10 - Tool Execute + Anchor/DPI 系统

## 变更 1: 工具授权执行按钮
- **app.js** 新增 `showToolExecButtons()`/`hideToolExecButtons()` 函数
- SSE 收到 `tool-summary`/`tool-call`/`computer-use` 消息时自动显示按钮
- `lastUserIntent` 记录用户最后输入，[允许] 点击时发送到 `/api/tools/execute`
- 新增 `dispatchSummary()` 格式化执行结果
- "发送给" 文本去重（去掉重复前缀）

## 变更 2: POST /api/tools/execute 端点
- **main.rs** 新增 `api_tool_execute()` 函数
- 路由：`.route("/api/tools/execute", post(api_tool_execute))`
- 功能：接收 `ToolDispatchRequest`，强制 `execute=true`

## 变更 3: ShowUI 视觉识别 → 真实点击
- `api_tool_execute` 调用 `run_vision_find_target`（ShowUI grounding）
- 从 grounding 结果提取 `point` 坐标
- 调用 `execute_mouse_action` 执行真实鼠标点击（SetCursorPos + SendInput）
- 诊断日志：`[TOOL-CHAIN]` / `[VISION-MODEL]` / `[ANCHOR]`

## 变更 4: 分辨率/DPI读取 + 锚点回退
- **main.rs** 新增：
  - `get_physical_screen_size()` — PowerShell System.Windows.Forms 获取屏幕物理分辨率
  - `get_system_dpi_scale()` — 物理/逻辑分辨率比值
  - `read_screen_info()` — 返回 (width, height, dpi_scale) + diag 日志
  - `target_anchor_for_taskbar()` — 计算任务栏区域锚点 (x=0.45*w, y=0.96*h)
- 坐标校验：目标含"开始/任务栏/taskbar/start" 且 ShowUI y < height/4 → 回退到锚点

## 变更 5: 路径 + 发送对象修复
- `display_path()` 剥除 `\\?\` 前缀
- 发送目标只显示 `agent.name`（不显示模型名）

## 测试结果
- 138 单元测试通过
- execute 端点可正常调用，ShowUI grounding 工作
- 第1次：ShowUI 返回 (1672,29) 顶部 → 未触发回退（不含关键词?）
- 第2次：ShowUI 返回 (1518,825) 下半区域 → y=825 > 427 未回退 → 点击执行
- ShowUI 模型对"开始按钮"定位不准，需进一步调优

## 备份
- `tmp/backups/tool-exec-auth-20260510-165550/`
- `tmp/backups/dpi-anchor-20260510-171840/`
