# 2026-05-17 Web UI D2 下半区窗口独立实现方案

## 背景

用户要求后续下半区每个窗口按独立功能设计实现，并采用多 agent 协同开发。当前上半区布局已经确认可用，D2 需要从“布局骨架”进入“窗口真实功能接入”阶段。

## 多 Agent 调研

本轮启动 4 个只读 explorer，分别调研：

- 工程目录 / IDE 窗口
- 设置 / 任务授权 / 诊断日志窗口
- 聊天室 / 会话协同 / 记忆知识窗口
- 浏览器 / 多媒体播放器 / 终端 / 视觉实验窗口

调研结论：

- 工程目录窗口当前只有一层 `project_entries` 和占位 UI，需新增 UI 专用只读 API：tree/file/meta/diff。
- 设置、工具审批、音频、会话配置已有后端能力，但设置窗口缺聚合分区，任务/授权窗口应承接全局审批浮层。
- 聊天、会话、handoff、beads 后端主链已经较成熟，D2 重点是聊天窗口、任务链和记忆窗口的布局与可用性。
- 多媒体可复用附件索引；视觉实验可复用现有 vision/computer-use API；浏览器和终端风险较高，首版必须保守。

## 文档变更

- 新增方案文档：`docs/web-ui-window-d2-implementation-plan-2026-05-17.md`。
- 更新需求管理表：
  - 新增 `REQ-WEB-WIN-001~010`。
  - 更新 `REQ-WEB-UI-010` 下一阶段说明。
  - 更新下一步计划为 D2 第一批、第二批、风险窗口三段。
  - 更新需求统计：总数 99，待开发 15，P0 21，P1 66，P2 12。

## 新增窗口子需求

- `REQ-WEB-WIN-001` 工程目录 / IDE 独立窗口，P0。
- `REQ-WEB-WIN-002` 设置独立窗口，P0。
- `REQ-WEB-WIN-003` 聊天室独立窗口，P0。
- `REQ-WEB-WIN-004` 任务 / 授权独立窗口，P0。
- `REQ-WEB-WIN-005` 记忆 / 知识独立窗口，P1。
- `REQ-WEB-WIN-006` 多媒体播放器独立窗口，P1。
- `REQ-WEB-WIN-007` 视觉实验独立窗口，P1。
- `REQ-WEB-WIN-008` 诊断日志独立窗口，P1。
- `REQ-WEB-WIN-009` 浏览器独立窗口 MVP，P2。
- `REQ-WEB-WIN-010` 终端命令面板窗口，P2。

## 多 Agent 开发切分

第一批可并行：

- Backend-Project：`REQ-WEB-WIN-001` 后端只读 API。
- Frontend-ChatMemory：`REQ-WEB-WIN-003/005` 聊天室与记忆窗口。
- Frontend-SettingsTasks：`REQ-WEB-WIN-002/004/008` 设置、任务授权、日志诊断窗口。
- Frontend-MediaVision：`REQ-WEB-WIN-006/007` 多媒体与视觉实验窗口。

第二批：

- Frontend-Project：工程目录 IDE 前端，依赖 Backend-Project。
- Browser-MVP：浏览器 MVP，先做 URL/search/外部打开兜底。
- Terminal-MVP：命令面板，复用 `/api/tools/runtime-execute`，不做 PTY。

## 风险记录

- 终端窗口不得绕过工具权限、审批、审计。
- 浏览器窗口不承诺登录态复用、跨域读取或真实网页自动点击。
- 工程目录首版只读，写文件/编辑草稿必须另走工具权限。
- 诊断日志需 tail/分页，避免大文件卡 UI。

## 验证

本轮为方案和需求文档更新，不修改运行代码。验证方式：

- 文档新增和需求编号通过 `rg "REQ-WEB-WIN"` 检查。
- 后续进入代码开发时，每个窗口必须按 TDD：先补后端/前端契约测试，再实现，再截图或交互验证。

## 备份

- 变更前备份：`tmp/backups/web-ui-d2-window-plan-20260517-1005-pre`。
