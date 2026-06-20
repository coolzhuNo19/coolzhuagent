# G1 交互性测试结果记录

记录时间：2026-05-07 06:06 +08:00

## 证据目录

- 用户截图原始目录：`C:\Users\zhupu\Pictures\Screenshots`
- 本轮归档目录：`tmp/logs/g1-interaction-20260507-054320/screenshots/user-20260507`
- 自动化前置日志：`tmp/logs/g1-interaction-20260507-054320`

## 结果汇总

| 用例 | 关联需求 | 结果 | 结论 |
| --- | --- | --- | --- |
| TC-G1-001 | `REQ-WEB-UI-002` | PASS | 浏览器 Web GUI 与 Tauri WebView 控制台主要区域显示正常 |
| TC-G1-002 | `REQ-DESK-PET-001` | PASS | Web 服务启动后桌宠窗口出现 |
| TC-G1-003 | `REQ-DESK-PET-002` | PASS | 桌宠双击显示/聚焦/隐藏 Web 控制台基本正常 |
| TC-G1-004 | `REQ-DESK-PET-004` | FAIL | `set_pet_action` 返回 state/message，但真实桌宠未显示气泡对话框 |
| TC-G1-005 | `REQ-DESK-PET-005` | FAIL | 动作帧中心/底部锚点基本稳定，但 warning 状态与 blink 状态动作观感一致 |
| TC-G1-006 | `REQ-VIS-001` | PASS with gap | 本地 `qwen2.5-vl-3b` 链路、项目 describe/find-target API 可用；confidence 为空，记录为协议缺口 |

## 缺陷记录

### TC-G1-004 气泡不显示

复现动作：

```javascript
await window.__TAURI__.core.invoke("set_pet_action", { state: "warning", message: "测试 warning 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "idle", message: "测试 idle 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "thinking", message: "测试 thinking 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "sleeping", message: "测试 sleeping 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "success", message: "测试 success 气泡" })
```

观察结果：

- Tauri invoke 返回 `state`、`message`、`console_url`。
- 桌宠动作状态可切换，但窗口中没有显示气泡对话框。
- `REQ-DESK-PET-004` 状态回到 `开发中`。

### TC-G1-005 warning 动作观感错误

复现动作：

```javascript
await window.__TAURI__.core.invoke("set_pet_action", { state: "warning", message: "测试 warning 气泡" })
await window.__TAURI__.core.invoke("set_pet_action", { state: "blink", message: "测试 blink 气泡" })
```

观察结果：

- warning 与 blink 状态动作观感一致。
- 中心位置和底部锚点未见明显跳动，原锚点修复有效。
- `REQ-DESK-PET-005` 状态回到 `开发中`，修复重点调整为状态动作区分。

## 需求状态更新

- `REQ-WEB-UI-002`：`待交互验证` -> `已完成`
- `REQ-DESK-PET-001`：`待交互验证` -> `已完成`
- `REQ-DESK-PET-002`：`待交互验证` -> `已完成`
- `REQ-DESK-PET-004`：`待交互验证` -> `开发中` -> 修复后 `待交互验证`
- `REQ-DESK-PET-005`：`待交互验证` -> `开发中` -> 修复后 `待交互验证`
- `REQ-VIS-001`：继续保留待协议补强记录，confidence 缺口并入 `REQ-VIS-004/REQ-CU-002`

## 修复记录

修复时间：2026-05-07 06:08 +08:00

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 新增 `bubbleText` 文本气泡层，状态 payload 只带 `message` 时也可显示气泡对话框。
  - 状态 payload 缺少 `bubble` 时按 `idle/blink/thinking/warning/success` 回退默认气泡资源。
  - 前端优先使用 payload `frames`，避免真实窗口状态动作被旧本地映射吞掉。
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - 新增 pet-mini HTML 回归测试，覆盖 message 气泡和 payload frames 消费。
  - 新增 `--pet-state/--pet-message` 单实例触发解析，便于后续由脚本触发桌宠状态复测。
- `tmp/g1_trigger_pet_state.ps1`
  - 新增 G1 桌宠状态触发脚本，后续可由 Codex 触发状态，用户只需截图确认。

验证结果：

- 红灯：`cargo test --offline pet_mini` 曾失败，确认缺少 `bubbleText` 与 `normalizeFrameList`。
- 绿灯：`cargo test --offline pet_mini` 通过，3 passed。
- 全量：`cargo test --offline` 通过，12 passed。
- JS 语法：`node --check` 通过。
- 重启：`tmp/g1_restart_tauri_after_pet_fix.ps1` 通过，`tauri_ready=true`。
- 触发：`tmp/g1_trigger_pet_state.ps1 -State success -Message "success bubble"` 通过，`exit_code=0`。

待复测：

- 执行 TC-G1-004，确认 `idle/thinking/sleeping/success/warning` message 气泡可见并自动消退。
- 重新执行 TC-G1-005，确认 warning 与 blink 动作观感已区分，且中心和底部锚点仍稳定。

## 复测反馈

2026-05-07 06:20 用户补充截图 `C:\Users\zhupu\Pictures\Screenshots\屏幕截图 2026-05-07 062057.png`，反馈桌宠动作帧再次出现左右平移，没有锚定中心点。

- `REQ-DESK-PET-005` 已从 `待交互验证` 回到 `开发中`。
- 后续修复需要用主体视觉锚点而不是单纯 alpha 外接框中心来约束动作帧。

## 锚点回归修复

修复时间：2026-05-07 06:31 +08:00

- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - `PetStatus` 增加 `frame_offsets`。
  - `pet_action_frame_offsets` 为每个动作帧提供渲染尺度下的水平补偿。
  - 新增 `pet_action_frame_offsets_stabilize_visual_centroid` 测试，验证 `thinking/warning/success` 补偿后的视觉重心漂移不超过 1px。
- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 新增 `activeFrameOffsets` 与 `applyFrame`。
  - 每次换帧时同步设置 `petImage.style.transform = translateX(...)`，抵消帧内视觉重心漂移。

验证结果：

- 红灯：`cargo test --offline pet_action_frame_offsets_stabilize_visual_centroid` 曾因缺少 `pet_action_frame_offsets` 失败。
- 绿灯：`cargo test --offline pet_action_frame_offsets_stabilize_visual_centroid` 通过。
- 全量：`cargo test --offline` 通过，13 passed。
- JS 语法：`node --check` 通过。
- 重启：`tmp/g1_restart_tauri_after_pet_fix.ps1` 通过，`tauri_ready=true`。
- 触发：`tmp/g1_trigger_pet_state.ps1 -State success` 与 `-State warning` 均通过。

待复测：

- 重新观察 `success/warning/thinking` 动作循环，确认主体视觉中心不再左右平移。
