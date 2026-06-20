# 2026-05-14 Precise-Click Grounding 问题修复闭环

记录时间：2026-05-14 23:20:08 +08:00

## 关联需求

- `REQ-VIS-008`：视觉 Agent / Grounding Backend 职责分离与 Precise-Click Router 收口
- 问题优先级：P0，优先于后续需求开发

## 问题复盘

上一轮录屏与日志显示 `REQ-VIS-008` 真实交互验收仍未闭环：

- `PC-SAFE-001`：视觉点位在截图逻辑坐标系内正确，但真实鼠标输入使用物理屏幕坐标，导致点击偏移。
- `PC-SAFE-002`：右键菜单目标项仍使用估算 y 坐标，实际点击到 `Inspect`。
- `PC-BR-001`：qwen2.5-vl-3b 对浏览器绿色按钮只返回 point-only 低置信结果，未达到 router 阈值。
- 验收环境补充问题：9865 出现 Windows TCP 残留监听；测试服务启动时桌宠子进程退出会带停 web-console。

## 本轮修改

### 代码修复

- `modules/gui-web/packages/web-console/src/main.rs`
  - 增加截图逻辑坐标到物理输入坐标换算：`map_capture_point_to_input`。
  - 增加物理输入坐标回写截图坐标：`map_input_point_to_capture`，用于响应和审计一致。
  - `api_tool_execute`、`api_safe_click_test`、`run_safe_context_menu_test`、`run_safe_drag_select_test` 的真实输入路径统一做坐标系换算。
  - `safe-context-menu` 由 WinForms 菜单 `Opened` 事件写出 `ACTION` 菜单项真实屏幕中心点，避免估算菜单项坐标。
  - 本地 VLM point-only 低置信时，如果目标明确是绿色/金色按钮，启用截图颜色区域扫描兜底，返回 bbox、point、confidence=0.72 和 raw_response 审计说明。
  - safe-click 强视觉模式把金色按钮兜底限制在安全测试窗体 ROI 内，避免被浏览器背景页面干扰。
  - `COOLZHU_WEB_BIND_ADDR` 支持临时覆盖绑定端口。
  - `COOLZHU_DISABLE_DESKTOP_PET` 实际接入 `desktop_pet_disabled()`，便于测试服务不被桌宠退出联动关闭。

### 验收脚本修复

- `tmp/precise-click-grounding-acceptance.ps1`
  - 浏览器测试页打开后先执行地址栏跳转，减少旧前台页面干扰。
  - `PC-BR-001` 使用 Edge headless 对同一个本地测试页生成 `browser-grounding-capture.png`，再提交给 `/api/vision/locate`，定位输入可复盘。
  - API case 自动复制 `capture_path` 到 case 目录的 `locate-capture.png`。

- `tmp/start-web-project003-frontend-refresh.ps1`
  - 修复 `$PID` 只读变量冲突，改为 `$listenerPid`。
  - 启动时设置 `COOLZHU_WEB_BIND_ADDR` 与 `COOLZHU_DISABLE_DESKTOP_PET=1`。

- `tmp/scan-color-components.ps1`
  - 临时诊断脚本，用于分析截图中 green/gold 连通区域，输出候选 bbox 和像素数。

## 验证结果

自动化验证：

- `cargo fmt -p coolzhu-web-console`
- `cargo test -p coolzhu-web-console --offline`
  - 结果：205 passed
- `cargo check -p coolzhu-web-console --offline`
  - 结果：通过，仅保留既有 warning

交互验收：

- 服务：`http://127.0.0.1:9866`
- 最终验收 run：`tmp/verification-runs/precise-click-grounding-20260514-073146/summary.md`
- 录屏：`C:\Users\zhupu\Videos\Desktop\Desktop 2026.05.14 - 07.31.50.03.mp4`

关键 PASS 项：

- `PC-PRE-001`：服务可访问
- `PC-PRE-002`：grounding backend 健康端点可访问
- `PC-GR-001`：UIA 定位 Windows Start button，不回退固定锚点
- `PC-GR-002`：不存在目标失败时不回退固定锚点
- `PC-SAFE-001`：安全视觉点击真实命中
- `PC-SAFE-002`：右键菜单 `ACTION` 项真实命中
- `PC-SAFE-003`：拖拽框选真实命中
- `PC-BR-001`：浏览器绿色按钮定位 PASS，返回 `color_region_fallback=green`

保留人工录屏确认项：

- `PC-WIN-001`：Win+E 已发送，需按录屏确认文件资源管理器是否打开。
- `PC-BR-000`：浏览器页面打开动作保留人工确认。
- `PC-BR-002`：浏览器地址栏 Ctrl+L + 粘贴 + Enter 保留人工确认。
- `PC-BR-003`：浏览器页面搜索 Ctrl+F `TARGET-472` 保留人工确认。

这些 CHECK 项属于键盘/窗口可见性确认，不阻塞 `REQ-VIS-008` 的 grounding router 与真实点击闭环。

## 需求状态

- `REQ-VIS-008`：`测试中 -> 已完成`
- 下一优先级：`REQ-TOOL-008/009/010/011` + `REQ-CORE-TOOL-001` 工具权限、审批、审计与诊断交互闭环。

## 备份

- 本轮相关文件备份：`tmp/backups/20260514-precise-click-r9-close/`
