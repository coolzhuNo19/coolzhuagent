# 2026-05-10 - DPI/Anchor 分析与 ShowUI 定位修复

## 关键发现

### 1. ShowUI 识别分辨率确认
- 截图分辨率：**1707×960**（逻辑像素）
- 物理分辨率：2560×1440，DPI 缩放 150%（2560/1.5=1707, 1440/1.5=960）
- `SetCursorPos` 使用逻辑坐标 → 与 ShowUI 坐标系一致 → 无需额外缩放

### 2. 锚点回退误触发 Bug（已修复）
- **原因**：`target.contains("任务栏")` 无条件触发回退，即使 ShowUI 返回了正确坐标 (853,921)
- **修复**：条件改为 `is_bottom_target && point.y < bottom_threshold`，先检查关键词再检查 y 值
- 实际点击：ShowUI 返回 (853,921) → 被回退到锚点 (768,921) → 点击偏移

### 3. 中文编码传输损坏（待修复）
- **现象**：HTTP 请求体中的中文"Windows开始按钮"在 Rust 端变为 `Windows????` (非 UTF-8)
- **影响**：`target.contains("开始")` 永远返回 false → 底部目标检测失效 → ShowUI 返回顶部坐标时无法回退
- **原因**：PowerShell 5.1 的 `Invoke-RestMethod -Body` 对中文使用系统默认编码（GBK），不是 UTF-8
- **修复方向**：使用 `[System.Text.Encoding]::UTF8.GetBytes($body)` 或前端 JS 发送（前端已是 UTF-8）

### 4. ShowUI 模型能力限制
- 模型 `showui-2b` 是轻量级 VLM，对复杂英文提示理解有限
- 多次测试确认：始终在右下区域 (1200-1600, 850-900) 附近，无法精确定位左下角开始按钮
- "start button" → (1552,882)
- "bottom left corner" → (1297,882)
- ShowUI 的 `confidence=0.35` 一致，说明模型对自身结果不确定

### 5. Dry-Run 使用硬编码坐标
- `taskbar-shortcut-left-click` 场景锚点 `{ x: 0.14, y: 0.965 }` → 计算坐标 (239, 926)
- 但日志显示 point=(200,180)，说明场景匹配到缓存坐标
- Dry-run 路径不使用 ShowUI，只有 [Allow] 按钮触发 execute 路径才用

## 已修复
- 锚点回退条件逻辑（AND 替代 OR）
- `display_path()` 剥除 `\\?\` 前缀
- `read_screen_info()` 读取分辨率+DPI

## 待修复
- 中文 HTTP 传输编码
- ShowUI 模型定位精度（可能需要更大的 VLM 或不同的 grounding 策略）
- anchor fallback 默认位置 (768,921) 需根据 Windows 版本调整（Win10 左下 vs Win11 中下）

## 测试数据
| 目标描述 | ShowUI 坐标 | 回退？ | 最终点击 |
|---------|------------|--------|---------|
| Windows开始按钮 | (1672,38) | 否（中文损坏）| (1672,38) 顶部 |
| start button | (1552,882) | 否（y=882≥240）| (1552,882) 右下 |
| bottom left corner... | (1297,882) | 否（y=882≥240）| (1297,882) 右下 |
| 任务栏的Windows... | (853,921) | **是（误触发）| (768,921) 中下 |
