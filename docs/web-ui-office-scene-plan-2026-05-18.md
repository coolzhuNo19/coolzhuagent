# Web UI 折叠态办公室场景落地计划 - 2026-05-18

## 背景

新 Web UI 下半区采用多窗口复用布局。所有窗口折叠时，下部分展开区域需要显示一个“Agent 办公室状态场景”，作为 agent、工具、记忆和聊天室状态的视觉总览。

参考来源：[Star Office UI](https://agentskill.work/en/skills/ringhyacinth/Star-Office-UI) 的像素办公室状态看板思路，用作交互概念参考，不复用其运行时和美术资产。

首次 imagegen 直接生成含 robot 的办公室图时，出现坐姿 robot 眼睛位置错误。后续方案调整为：

- 背景图只生成办公室环境，不包含 robot、人物、动物或脸部。
- robot worker 使用 imagegen 生成动作帧 sprite sheet，前端 CSS/DOM 只负责定位、状态切帧和标签展示，便于稳定显示眼睛、状态、位置、动画和后续交互。
- 参考 Star Office UI 的“办公室状态可视化”思路，但不引入其运行时、美术资源或依赖。

## REQ-WEB-OFFICE-001

目标：所有窗口折叠后，下部分展开区域显示马里奥风格 FC 像素办公室，叠加可控 robot worker 状态层。

验收点：

- 使用 `assets/ui-redesign/office-status-bg.png` 作为办公室背景。
- 使用 `assets/ui-redesign/office-robot-sprites.png` 作为 robot 动作帧图；源绿幕图保留在 `.codex/generated_images` 与 `tmp/imagegen` 处理目录，避免进入前端打包资产。
- `/api/office/scene` 返回聚合状态：active agents、chat rooms、memory beads、pending approvals、recent tools。
- 前端根据接口渲染 robot worker：planner、tool、memory、chat。
- robot 状态类可覆盖 `idle`、`active`、`waiting`、`warning`、`archiving`、`chatting`。
- 接口失败时保留静态 fallback，不影响其它窗口展开。

## API 草案

`GET /api/office/scene`

响应字段：

- `generated_at`: 秒级时间戳。
- `status`: 聚合状态，默认 `ready`。
- `background_url`: 前端背景资产地址。
- `counters`: active agents、chat rooms、memory beads、pending approvals、recent tools。
- `robots`: 每个 worker 的 `id`、`label`、`role`、`state`、`lane`、`x`、`y`、`detail`。
- `activity`: 可显示在底部状态条的近期活动。
- `notes`: 后端状态说明。

## 记忆管理后续优先级

前端设计稳定后，优先闭环 `REQ-WEB-WIN-005`：

- P0：记忆窗口接真实 query/summary/prompt/context-preview，筛选条件与当前 session/workspace 一致。
- P0：详情面板显示 source、origin_message_id、origin_table、token_count、pinned、updated_at。
- P1：pin/delete/update 操作统一确认与结果刷新。
- P1：Goal plan/phase/summary 沉淀结果归入记忆窗口筛选。

## 工具治理后续优先级

记忆窗口后推进 `REQ-TOOL-012` 与 `REQ-WEB-WIN-004`：

- P0：整理 Core、Vision、Computer Use、Plugin、Skill 工具场景目录。
- P0：把工具能力映射成“场景 -> 推荐工具 -> 权限 -> 验证方式 -> 风险”的矩阵。
- P1：任务/授权窗口展示 pending approvals、session grant TTL、tool audit filter 和 protected path 摘要。
- P1：Goal skill registry 与工具场景目录对齐，避免 skill 声明和真实 runtime 能力漂移。

## 风险

- 视觉资产风险：生成图中角色不可控，已通过“背景无角色 + 前端 robot 层”规避。
- 状态漂移风险：办公室场景必须只做状态摘要，真实数据仍以各独立窗口为准。
- 性能风险：接口只聚合小规模计数和最近工具审计，不读取大文件内容。
