# 2026-05-14 Precise-Click Grounding 录屏审查

时间：2026-05-14 02:15:00 +08:00

## 背景

用户提供正式验收录屏：

- `C:\Users\zhupu\Videos\Desktop\Desktop 2026.05.14 - 01.53.04.02.mp4`

本次审查目标是对照 `tmp/verification-runs/precise-click-grounding-20260514-015301` 的日志和录屏，确认真实点击验收是否存在未命中目标。

## 审查产物

- 原始验收日志：`tmp/logs/precise-click-grounding-acceptance-20260514-015301.log`
- 验收摘要：`tmp/verification-runs/precise-click-grounding-20260514-015301/summary.md`
- response 汇总：`tmp/logs/precise-click-review-response-files-20260514.log`
- 录屏抽帧脚本：`tmp/extract_precise_click_video_frames.py`
- 录屏抽帧目录：`tmp/video-review/precise-click-20260514-015304/`
- 抽帧日志：`tmp/logs/video-frame-extract-20260514-015304.log`

录屏时长约 100.55 秒，已按 5 秒间隔抽出 21 帧，并生成 `contact_sheet.bmp` 供人工复核。

## 结论

本轮 Precise-Click Grounding 真实交互验收未闭环，`REQ-VIS-008` 保持 `测试中`。

明确结果：

- `PC-GR-001`：PASS。UIA 可定位 Windows Start button。
- `PC-GR-002`：PASS。不可能目标返回 unavailable，没有回退固定锚点。
- `PC-SAFE-001`：存在未命中记录。日志状态为“真实点击未命中”，`executed=true`，`marker.hit=false`，目标编号为 `566`。
- `PC-SAFE-002`：不是点击未命中，而是执行前失败。日志为 `context-menu-execute-failed`，`executed=false`，原因是 `safe-context-menu` 窗口未进入 ready 状态；录屏抽帧也未看到右键菜单测试窗口正常出现。
- `PC-SAFE-003`：PASS。拖拽框选命中，`drag-select-hit`，`marker.hit=true`。
- `PC-BR-001`：未执行真实点击。日志为 `low-confidence`，local-vlm 返回点位但置信度仅约 0.35，router 按策略拒绝执行，没有硬编码兜底。
- `PC-BR-002/003`：键盘路径可在录屏看到浏览器页面打开、搜索 `TARGET-472` 并高亮，但不是 grounding 点击命中证明。

## 关键证据

`PC-SAFE-001` 的目标截图显示黄金按钮 `CONFIRM 566`，vision point 为 `(597,489)`，视觉上位于按钮区域内；但执行后截图中测试窗口消失，marker 未置位，日志判定为真实点击未命中。

该现象更像是执行/回传/标记判定链路问题，而不是单纯视觉定位偏离：

- 视觉点位看起来在按钮内部。
- `executed=true` 表示动作链有发出输入。
- `marker.hit=false` 表示安全测试窗口没有收到预期命中确认。
- 需要继续排查真实输入坐标换算、窗口前台焦点、点击后 marker 写入时序、测试窗口关闭逻辑或 DPI/缩放映射。

`PC-SAFE-002` 的目标截图和录屏对应帧没有出现预期右键菜单测试窗口，因此本项应归类为 ready/窗口生命周期失败，不能算目标点未命中。

`PC-BR-001` 在录屏中浏览器测试页正常打开，绿色按钮 `TARGET-472 GREEN CONFIRM` 可见，但日志明确为低置信度拒绝执行；这符合“无高置信证据不点击”的安全策略，需要后续优化 local-vlm grounding 或配置远端 fallback。

## 后续修复建议

1. 优先修 `PC-SAFE-001`：增加点击前后 overlay/marker 细粒度日志，记录实际 SendInput 坐标、DPI scale、窗口句柄、前台窗口、click_down/up 时间和 marker 写入时间。
2. 修 `PC-SAFE-002`：把 safe-context-menu 测试窗口 ready 判定改为显式窗口句柄 + marker bootstrap，避免窗口未创建时直接进入右键流程。
3. 优化 `PC-BR-001`：保留低置信拒绝策略，补充 local-vlm 多候选投票/DOM 辅助证据，或在远端视觉模型可用时走 RemoteVLM fallback。
4. 修复后重跑同一脚本，只有 `PC-SAFE-001~003` 与 `PC-BR-001` 都能给出可审计 PASS，才将 `REQ-VIS-008` 推进到 `已完成`。

## 备份

- `tmp/backups/precise-click-review-20260514-0215`
