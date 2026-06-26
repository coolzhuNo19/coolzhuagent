# compute use 问题库

## 2026-06-26：compute use 视觉确认容易被中断，后续改为人工确认优先

### 背景

用户已经确认：compute use 视觉确认容易被中断，后续前端视觉确认由用户人工完成。自动化侧只做可重复的功能验证、API 验证、日志验证和必要截图辅助。

### 当前状态

重启后状态检查显示：

- `coolzhu-web-console.exe` 正在监听 `127.0.0.1:8765`；
- UI-DETR 正在监听 `127.0.0.1:7860`；
- ShowUI 正在监听 `127.0.0.1:8000`；
- `coolzhu-tauri-shell.exe` 已从 package 运行。

日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-post-reboot-state-check.log`

### 约束

- compute use 可用于辅助点击、截图、dry-run，但不能作为唯一视觉验收。
- 对长任务模型传递视觉信息时，优先使用 agnes-text 多模态识别截图，再让任务模型引用该识别结果。
- 如果 UI-DETR/ShowUI 未跟随启动，先检查 7860/8000 监听与 web-console 子进程归属，再操作前端。
- 前端最终视觉效果仍由用户确认。

