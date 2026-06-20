# COOLZHU AGENT 文档入口

本目录维护迁移后集成仓的说明、规范、接口契约和测试说明。模块自己的对外接口说明放在各自 `modules/<module>/INTERFACE.md`，便于 Gerrit 审查模块接口风险。

## 目录

- [仓库结构](repository-structure.md)
- [接口契约](interface-contracts.md)
- [开发规范](development-standard.md)
- [测试规范](testing-standard.md)
- [迁移说明](migration-notes.md)
- [变更记录与需求管理工作流](change-and-requirement-workflow.md)
- [聊天、记忆、视觉路线图](agent-roadmap-chat-memory-vision.md)
- [beads 会话与记忆层落地方案](gui-web/2026-05-05-beads-session-memory-implementation-plan.md)
- [当前目录功能完成度](module-completion-status.md)
- [需求管理表](requirements-management.md)
- [打包、安装与跨设备迁移方案](packaging-and-device-migration.md)
- [精准点击 Grounding 根治方案（UIA + 本地 VLM + 远端 VLM 路由）](precise-click-grounding-plan-2026-05-10.md)
- [工具调用适配与风险控制调整方案（REQ-TOOL-007/008/009/010/011）](tool-calling-permission-plan-2026-05-10.md)
- [会话 / 聊天室 / 记忆 / 工作区一体化管理方案](session-memory-workspace-integration-plan-2026-05-10.md)
- [高难度未开发需求落地实施方案（桌宠/唤醒词/监控/安装/授权）](hard-requirements-implementation-plan-2026-05-10.md)
- [聊天室多 Agent 协作方案（REQ-WEB-CHAT-007，roster/@寻址/任务流转）](multi-agent-chatroom-collaboration-plan-2026-05-11.md)
- [脚本化需求功能交互验证方案](interactive-verification-automation-plan-2026-05-11.md)
- [ShowUI Grounding 与 Vision Agent 职责分离方案（REQ-VIS-008）](showui-vision-agent-separation-plan-2026-05-12.md)
- [Web UI D2 下半区窗口独立实现方案](web-ui-window-d2-implementation-plan-2026-05-17.md)
- [Web UI D2 窗口内布局与 Goal 工具方案](web-ui-window-d2-inner-layout-goal-plan-2026-05-17.md)
- [Web UI 折叠态办公室场景落地计划](web-ui-office-scene-plan-2026-05-18.md)

## 当前模块

- `modules/core-runtime`
- `modules/llm-adapter`
- `modules/tooling`
- `modules/vision`
- `modules/computer-use`
- `modules/gui-web`
- `modules/gui-desktop`
- `modules/cli`
- `modules/diagnostics`

## 最小验证命令

```powershell
cargo metadata --no-deps --format-version 1
cargo test -p coolzhu-computer-use-core --offline
cargo test -p coolzhu-web-console --offline
cargo test -p coolzhu-agent-server --offline
cargo check -p coolzhu-vision-service --offline
cargo test --test module_linkage_smoke --offline
```
