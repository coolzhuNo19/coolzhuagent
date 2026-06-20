# 2026-05-07 G1 桌宠气泡与 warning 动作修复

记录时间：2026-05-07 06:10 +08:00

## 背景

用户回传 G1 交互验证截图并确认：TC-G1-001 至 TC-G1-005 大部分功能正常，但 TC-G1-004 未显示桌宠气泡对话框，且 warning 状态与 blink 状态动作观感一致。

截图证据已归档到：

- `tmp/logs/g1-interaction-20260507-054320/screenshots/user-20260507`

## 需求状态处理

- `REQ-WEB-UI-002`：人工验证通过，更新为 `已完成`。
- `REQ-DESK-PET-001`：人工验证通过，更新为 `已完成`。
- `REQ-DESK-PET-002`：人工验证通过，更新为 `已完成`。
- `REQ-DESK-PET-004`：人工验证失败后回到 `开发中`，修复完成后更新为 `待交互验证`。
- `REQ-DESK-PET-005`：人工验证发现 warning 动作问题后回到 `开发中`，修复完成后更新为 `待交互验证`。

## 修复内容

- `modules/gui-desktop/packages/tauri-shell/ui/pet-mini.html`
  - 新增 `bubbleText` 文本气泡层，兼容状态 payload 只返回 `message` 的情况。
  - 状态 payload 缺少 `bubble` 时，按 `idle/blink/thinking/warning/success` 回退默认气泡图片。
  - 前端优先使用状态 payload 的 `frames`，确保后端状态动作帧能覆盖本地映射。
  - blink 自动切换时同步更新 `activeFrames`，避免动作帧继续使用旧状态。
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
  - 新增 pet-mini HTML 回归测试，覆盖 message 气泡和 payload frames。
  - 新增 `--pet-state/--pet-message` 单实例状态触发解析，便于脚本触发真实桌宠状态。
- `tmp/g1_trigger_pet_state.ps1`
  - 新增 G1 桌宠状态触发脚本，后续可由 Codex 执行状态切换，用户只需截图确认。

## TDD 记录

红灯：

- 命令：`cargo test --offline pet_mini`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/cargo-test-red.log`
- 结果：新增测试失败，缺少 `bubbleText` 与 `normalizeFrameList`。

绿灯：

- 命令：`cargo test --offline pet_mini`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/cargo-test-green-pet-mini.log`
- 结果：3 passed。

回归：

- 命令：`cargo fmt`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/cargo-fmt.log`
- 结果：PASS。
- 命令：`cargo test --offline`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/cargo-test-full-after-cli-trigger.log`
- 结果：12 passed。
- 命令：`tmp/check_pet_mini_html_js.ps1`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/js-check/node-check.log`
- 结果：PASS。

## 待人工复测

- TC-G1-004：重新启动 Tauri shell 后执行 `set_pet_action`，确认各状态 message 气泡可见并自动消退。
- TC-G1-005：确认 warning 与 blink 动作观感已区分，且中心和底部锚点仍稳定。

## 复测回归与原因排查

复测时间：2026-05-07 06:20 +08:00

用户回传截图 `C:\Users\zhupu\Pictures\Screenshots\屏幕截图 2026-05-07 062057.png`，确认动作帧再次出现左右平移。截图已归档到：

- `tmp/logs/g1-interaction-20260507-054320/screenshots/user-20260507-anchor-regression`

排查结论：

- 直接触发原因不是窗口位置变化，`coolzhu-tauri-shell` 仍是固定 150x150 窗口，`petImage` 仍固定在 `left: 10px; top: 6px; width: 128px; height: 128px`。
- 上一轮修改让 `pet-mini` 优先消费后端 `payload.frames`，同时新增的脚本状态触发会让 `success/warning` 状态持续循环，导致动作序列中的视觉重心漂移被稳定暴露。
- 现有 Rust 单测 `pet_action_frames_share_canvas_and_visual_anchor` 只验证 256x256 画布、alpha 外接框中心和底部基线。该测试无法识别主体视觉重心漂移。
- 临时测量脚本 `tmp/measure_pet_action_anchors.ps1` 输出显示：alpha 外接框中心每个动作序列仅约 1px 波动，但 alpha 重心波动明显。

测量证据：

- 日志目录：`tmp/logs/pet-anchor-analysis-20260507-062358`
- `success`：alpha 重心范围 9.615px，渲染到 128px 后约 4.8px。
- `warning`：alpha 重心范围 7.709px，渲染到 128px 后约 3.9px。
- `thinking`：alpha 重心范围 4.505px，渲染到 128px 后约 2.3px。

根因判断：

- 上一轮代码引入的关键变化是“状态触发后持续播放完整动作帧序列”，而不是只展示静态首帧。
- 资产层的动作帧只做了画布和 alpha 外接框归一，没有按主体视觉中心或可感知重心归一。
- 因此 `REQ-DESK-PET-005` 回到 `开发中`，下一步应补“主体视觉重心/锚点漂移”测试，再选择资源归一或渲染补偿方案。

## 复测前置

- 已执行 `tmp/g1_restart_tauri_after_pet_fix.ps1`
- 日志：`tmp/logs/g1-interaction-20260507-054320/tauri-restart-after-pet-fix.log`
- 结果：`tauri_ready=true`，最新 `coolzhu-tauri-shell` 进程 PID 为 `28992`。
- 已执行 `tmp/g1_trigger_pet_state.ps1 -State success -Message "success bubble"`
- 日志：`tmp/logs/g1-pet-fix-20260507-060830/trigger-success-run.log`
- 结果：`exit_code=0`。

## 备份

- 修改前备份目录：`tmp/backups/g1-pet-interaction-result-pre-20260507-060608`
- 修改后备份目录：`tmp/backups/g1-pet-interaction-result-post-20260507-061426`
