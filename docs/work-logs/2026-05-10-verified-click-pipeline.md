# 2026-05-10 - Verified Click Pipeline (多次采样 + LLM 确认)

## 新增功能

### 1. grounding_median_point(target) - ShowUI 3次采样取中位数
- 调用 `run_vision_find_target` 3次
- 收集所有成功的 x, y 坐标
- 返回中位数 `(xs[n/2], ys[n/2])`
- 少于2次成功 → 返回 None
- 日志：`[MEDIAN] sample N: (X, Y)` / `[MEDIAN] result=(X,Y)`

### 2. move_cursor_to(x, y) - 纯移动鼠标（不点击）
- PowerShell `SetCursorPos` via p/invoke
- 不触发点击

### 3. verify_cursor_on_target(x, y, target) - LLM 验证鼠标位置
- 将鼠标移到 (x, y)
- 等待 300ms 让光标渲染
- 截图 `verify-cursor.png`
- Base64 编码截图
- 发送给云端多模态 LLM（智谱 glm-4.6v-flash）：
  "Look at this screenshot. Is the mouse cursor positioned on the 'target'? Answer ONLY 'yes' or 'no'."
- 解析回答：yes/是/ok/正确 → PASS，否则 → FAIL
- 日志：`[VERIFY] moving cursor to (X,Y)` / `[VERIFY] LLM answer: '...'` / `[VERIFY] result=PASS/FAIL`

### 4. api_tool_execute 重构
- 旧路径：ShowUI 1次 → 锚点回退 → 直接点击
- 新路径：ShowUI 3次取中位数 → 锚点校验 → LLM 验证 → 确认后点击

### 5. 验证模型选择
- 强制使用智谱 glm-4.6v-flash（支持多模态）
- 从环境变量 `ZAI_API_KEY` 获取 API Key（由 vision service 自动设置）

## 问题与修复
- **第一次测试**：验证模型用了活跃会话的 DeepSeek（不支持 image_url）→ 修复：强制用智谱多模态
- **第二次测试**：活跃会话 DeepSeek v4-pro 拒绝 image_url → 400 错误
- **ShowUI 采样**：3次结果 (597,153), (614,173), (614,173) 全部在中上部 → 触发锚点回退

## 待优化
- ShowUI 模型 `showui-2b` 准确度不足，3次采样仍无法找到开始按钮
- 中位数结果在 (597,173) 附近 → y=173 < 240 → 回退锚点 (768,921)
- 可考虑换更大 VLM 或增加采样次数

## 备份
- `tmp/backups/dpi-anchor-20260510-171840/`
- `tmp/backups/tool-exec-auth-20260510-165550/`
