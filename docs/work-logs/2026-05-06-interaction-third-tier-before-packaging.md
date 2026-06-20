# 2026-05-06 推进顺序调整：先交互闭环与第三梯队，再打包

记录时间：2026-05-06 22:33:03 +08:00

## 背景

用户确认新的推进顺序：先闭环交互性测试项；待第三梯队需求全部落地并验证完成后，再推进打包方案相关需求。

本轮为需求排期和方案状态落档，不修改业务代码。

## 修改范围

- 更新 `docs/requirements-management.md`
  - 将待交互验证清单明确为当前优先闭环项。
  - 增加 G1 交互测试执行单链接。
  - 新增 G1/G2/G3 推进闸门：
    - G1：闭环 `REQ-WEB-UI-002`、`REQ-DESK-PET-001/002/004/005`、`REQ-VIS-001`。
    - G2：完成第三梯队 `REQ-CU-001~008`、`REQ-VIS-001~004`、`REQ-TOOL-005/006` 的 TDD 实现、自动化验证和必要交互验证。
    - G3：G1/G2 均完成后才解锁 `REQ-PACK-001~012` 打包方案实现。
  - 重排下一步计划：交互验证置于第 1 位，第三梯队全量闭环置于打包之前。
  - 增加变更记录，说明打包需求在 G1/G2 完成前冻结实现。
- 更新 `docs/packaging-and-device-migration.md`
  - 在文档顶部补充推进状态：方案已落档，但安装器、授权服务和资源镜像代码实现冻结到 G1/G2 完成之后。
- 新增 `docs/interactive-test-plans/2026-05-06-g1-interaction-closure.md`
  - 拆分 `REQ-WEB-UI-002`、`REQ-DESK-PET-001/002/004/005`、`REQ-VIS-001` 的交互测试步骤、通过标准、失败记录和证据路径要求。
  - 记录本地 VLM/OCR endpoint、Tauri WebView 调试触发、桌宠双击/气泡/动作帧验证方式。

## 当前阻塞关系

- 打包实现阻塞于 G1/G2。
- G1 中桌宠真实窗口、WebView 字体/滚动条、VLM/OCR 命中率必须人工确认。
- G2 中真实执行相关能力仍保持禁用，先完成 dry-run、审计证据、安全闸门和可复测靶场。

## 验证

- 已复核需求管理文档中的待交互验证清单、推进闸门和下一步计划。
- 已复核 G1 交互测试执行单已被需求管理文档引用。
- 本轮未运行代码测试，因为没有修改业务代码。

## 备份

- 修改前备份目录：`tmp/backups/interaction-third-tier-before-packaging-pre-20260506-223126`
- 修改后备份目录：`tmp/backups/interaction-third-tier-before-packaging-post-20260506-223331`
- 最终备份目录：`tmp/backups/interaction-third-tier-before-packaging-final-20260506-223858`
