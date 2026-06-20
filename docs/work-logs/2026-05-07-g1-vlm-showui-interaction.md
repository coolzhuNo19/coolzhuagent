# G1 本地 VLM/ShowUI 交互验证闭环

时间：2026-05-07 23:40-23:59 +08:00

## 背景

用户反馈内存不足，希望先确认 Windows 虚拟内存状态，再尝试拉起 ShowUI。当前 G1 剩余交互项为 `REQ-VIS-001` 本地 VLM/OCR 接入，需要确认 Qwen2.5-VL-3B 和 ShowUI-2B 对真实屏幕的描述、OCR、grounding 能力。

## 执行内容

1. 检查系统内存、pagefile 与当前权限。
   - 当前 Codex 进程非管理员权限，不能直接修改 pagefile。
   - `C:\pagefile.sys` 已启用，初始 8192MB，最大 12288MB。
   - C 盘剩余空间充足，后续如需扩大 pagefile 需要管理员权限并通常需要重启。

2. 尝试在 Qwen 已运行时启动 ShowUI。
   - Qwen 端口：`http://127.0.0.1:8001/v1`
   - ShowUI 启动结果：`status=exited-before-ready`
   - 失败日志显示权重加载阶段出现 `Windows fatal exception: access violation`。
   - 判断为两个本地视觉模型同跑时资源风险较高，pagefile 不能完全替代 VRAM。

3. 停止 Qwen 后单独启动 ShowUI。
   - 临时停止 Qwen PID `10156`。
   - ShowUI 成功 ready，服务地址：`http://127.0.0.1:8000/v1`。
   - health 返回 `ok=true`、`served_model=showui-2b`、`loaded=true`。

4. 执行 G1 VLM 交互验证脚本。
   - Qwen：`describe-screen` 通过，`find-target` 无 grounding。
   - ShowUI：`find-target use_model=true` 可返回可解析 point 和截图证据。
   - ShowUI 对 `codex project row` 返回 point `x=222, y=336`；复杂目标存在偏移，且 `bbox/confidence` 仍为空。

## 变更文件

- `docs/requirements-management.md`
  - `REQ-VIS-001` 保持 `测试中`，记录 Qwen/ShowUI 真实 endpoint 验证结论。
  - `REQ-VIS-005` 补充 Qwen 与 ShowUI 不建议同跑，短期采用互斥 profile 切换。
  - 需求统计 `测试中` 更新为 24。
- `docs/interactive-test-plans/2026-05-07-g1-vlm-showui-retest.md`
  - 新增 Qwen、ShowUI 同跑失败、ShowUI 单独启动、ShowUI grounding 验证记录。

## 验证日志

- `tmp/logs/g1-showui-virtual-memory-20260507-2340`
- `tmp/logs/g1-vlm-interaction-20260507-2331`
- `tmp/logs/g1-vlm-interaction-20260507-2352-showui`
- `tmp/logs/g1-vlm-interaction-20260507-2355-showui-highlight`
- `tmp/logs/g1-vlm-interaction-20260507-2357-showui-codex-row`

## 结论

`REQ-VIS-001` 的 G1 真实 endpoint 交互验证可以判定为 PASS with gaps：Qwen 描述/OCR 可用，ShowUI 单独启动后 point grounding 可用。`bbox/confidence` 缺失和复杂目标命中率不稳不再阻塞 G1，转入 G2 的 `REQ-VIS-004`、`REQ-CU-002`、`REQ-TOOL-005` 继续修复和增强。

## 后续风险

- 8GB VRAM 环境下不应默认同时常驻 Qwen 和 ShowUI。
- 后续需要实现本地 VLM profile 互斥切换、资源占用检测和清晰启动失败提示。
- 打包阶段 `REQ-PACK-013` 需要继续处理模型资源内置、自启动和安装前硬件检测，不在当前 G1/G2 开发阶段落地。
