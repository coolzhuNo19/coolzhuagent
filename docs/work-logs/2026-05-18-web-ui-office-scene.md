# 2026-05-18 Web UI 折叠态办公室场景落地

## 时间

- 开始：2026-05-17 22:51
- 本轮闭环：2026-05-18 01:24

## 关联需求

- `REQ-WEB-OFFICE-001`：折叠态 3D 像素 robot 办公室
- `REQ-WEB-UI-010`：Web GUI 16:9 多窗口重构
- 后续优先级承接：`REQ-WEB-WIN-005` 记忆 / 知识窗口、`REQ-TOOL-012` 工具 / 插件 / SKILL 场景目录与适配矩阵

## 需求与方案更新

- 新增 `docs/web-ui-office-scene-plan-2026-05-18.md`。
- `REQ-WEB-OFFICE-001` 从 `REQ-WEB-UI-010` 拆出，避免把折叠态办公室视觉和整体多窗口骨架混在一个验收项里。
- 首次 imagegen 生成含 robot 的办公室图出现“坐着的 robot 眼睛跑到脑袋背面”的不可控问题，因此方案调整为：背景图只保留办公室环境，robot worker 由前端 CSS/DOM 可控层渲染。
- 记忆管理和工具治理优先级重排为：办公室折叠态视觉闭环 -> 记忆窗口真实治理闭环 -> 工具场景目录与授权/审计窗口 -> Goal runtime G1。

## 修改内容

- 新增资产：
  - `modules/gui-web/packages/web-console/assets/ui-redesign/office-status-bg.png`
  - `modules/gui-web/packages/web-console/assets/ui-redesign/office-robot-sprites.png`
- 前端：
  - `index.html` 将旧 `.office-worker` 手写占位场景替换为 `data-role="office-scene"`、`office-robots`、HUD 和 activity strip。
  - `styles.css` 接入 imagegen 生成的办公室背景图，并将 robot 从 CSS 拼装形象切换为 `office-robot-sprites.png` 动作帧。
  - `app.js` 新增 `loadOfficeScene`、`renderOfficeScene`、`renderOfficeRobot`，在 `refreshAll` 和所有窗口折叠时同步 `/api/office/scene`，并按状态类切换 sprite 帧。
- 后端：
  - `main.rs` 新增 `GET /api/office/scene`。
  - 新增 `OfficeSceneResponse`、`OfficeSceneCounters`、`OfficeRobotDto`、`OfficeActivityDto`。
  - 聚合 active agents、chat rooms、memory beads、pending approvals、recent tools。
  - 抽取 `read_tool_audit_entries` 供工具审计 API 和办公室场景复用。
- 测试：
  - 新增 `office_tool_state_prioritizes_pending_and_errors`。
  - 新增 `web_frontend_office_scene_uses_generated_background_and_api` 静态契约。

## 验证结果

- `cargo fmt --package coolzhu-web-console`：通过
- `node --check modules\gui-web\packages\web-console\src\app.js`：通过
- `tmp\check-web-ui-d2-inner-contract.ps1`：通过
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`：通过
- `cargo build -p coolzhu-web-console --offline`：通过
- 本地 UI 已启动：`http://127.0.0.1:8765`
- Edge CDP 截图验证：`tmp/web-ui-office-scene-1920x1080.png`
  - `activeWindow = null`
  - `folded = true`
  - `display = block`
  - 背景图命中 `assets/ui-redesign/office-status-bg.png`
  - 渲染 imagegen sprite robot：Planner、Tool、Memory、Chat

## 2026-05-18 02:00 二次视觉修订

用户反馈 CSS 拼装 robot 形象与办公室背景违和。本轮追加修订：

- 使用 imagegen 生成 6 帧横向动作帧图，源图位于 `C:\Users\zhupu\.codex\generated_images\019df8d8-f3ac-72e2-b28b-9d1f67e31f09\ig_09709e98f8a4a40c016a0a002803a88191bbec1d32f41bf87c.png`。
- 使用 skill 内置 `remove_chroma_key.py` 通过 bundled Python + Pillow 去除 #00ff00 绿幕，输出透明 PNG。
- 透明动作帧图：`modules/gui-web/packages/web-console/assets/ui-redesign/office-robot-sprites.png`。
- 帧映射：idle=第1帧，active=第2帧，waiting=第3帧，warning=第4帧，archiving=第5帧，chatting=第6帧。
- 前端删除 `.robot-head/.robot-eye/.robot-torso` 拼装样式，改为 `.robot-sprite` 背景帧。
- 验证重新通过：`cargo fmt`、`node --check`、D2 静态契约、`coolzhu-web-console` 245 passed、`cargo build`。
- 重新截图：`tmp/web-ui-office-scene-1920x1080.png`。

## 2026-05-18 02:25 脚底锚点修复

用户反馈 robot 仍像漂浮在空中、脚没着地。排查结果：

- `office-robot-sprites.png` 单帧尺寸为 362x724。
- 可见角色 alpha bbox 主要集中在 y=185..537，底部约 25.8% 是透明留白。
- 旧 CSS 以整帧盒子为定位和阴影基准，导致阴影落在透明留白底部，和真实脚底分离。

修复：

- 新增 `tmp/inspect-office-robot-sprite.py` 测量每帧 alpha bbox。
- `.office-robot` 改用可见角色区域比例 `362 / 396`。
- `.robot-sprite` 放大为原帧高度的 182.8%，上移 35.6%，裁掉多余透明上下留白。
- `.office-robot` 改为 `translate(-50%, -100%)`，用可见脚底锚定 `/api/office/scene` 的 y 坐标。
- 取消上下 bob 位移动画，改为不影响脚底位置的亮度 pulse；warning 只做水平 shake。

验证：

- `tmp/run-office-scene-validation.ps1` 通过。
- Edge CDP 重新截图：`tmp/web-ui-office-scene-1920x1080.png`。

## 备份

- 修改前备份：`tmp/backups/web-office-scene-20260517-225129-pre`
- 修改后备份：`tmp/backups/web-office-scene-20260518-021605-post`

## 待人工确认

- 请确认折叠态办公室背景、HUD 和 4 个 robot 的视觉比例是否符合当前 UI 风格。
- 若确认通过，下一步进入 `REQ-WEB-WIN-005` 记忆 / 知识窗口真实治理闭环；随后推进 `REQ-TOOL-012` 工具场景目录与适配矩阵。
