# 变更记录与需求管理工作流

更新日期：2026-05-05

## 执行规则

后续每次落地修改按以下顺序执行：

1. 新需求提出后，先写入 `docs/requirements-management.md`。
2. 实施前补充落地方案文档到 `docs/` 或对应子目录。
3. 代码或资源修改完成后执行验证。
4. 验证通过后，把实现内容、验证命令和结果写入 `docs/work-logs/`。
5. 回写 `docs/requirements-management.md`，更新需求状态、验收结果和下一步。
6. 若方案已规划但未完成，实现状态必须标为 `开发中`、`测试中` 或 `待开发`，不允许只停留在口头计划。

## 文档位置

| 类型 | 建议位置 | 命名 |
| --- | --- | --- |
| 需求管理 | `docs/requirements-management.md` | 单表维护 |
| 实施方案 | `docs/gui-web/`、`docs/memory/`、`docs/packaging-and-device-migration.md` | `YYYY-MM-DD-主题-plan.md` |
| 实现日志 | `docs/work-logs/` | `YYYY-MM-DD-主题.md` |
| 模块完成度 | `docs/module-completion-status.md` | 按阶段更新 |

## 状态回写标准

| 场景 | 需求状态 |
| --- | --- |
| 仅写了方案，没有改代码 | `待开发` 或 `开发中` |
| 已改代码，未完整验证 | `测试中` |
| 已改代码并通过对应验证 | `已完成` |
| 受硬件、外部服务或权限限制 | `暂停` |

## 本批新增需求

| REQ-ID | 需求 | 状态 |
| --- | --- | --- |
| REQ-WEB-UI-002 | Tauri WebView 与浏览器 Web 页面字体/卡片显示一致 | 开发中 |
| REQ-WEB-UI-003 | 配置/会话/Agent 三合一卡片去除调试字段并保持布局紧凑 | 开发中 |
| REQ-WEB-UI-004 | 工程目录卡片内容溢出时使用卡片内滚动条 | 开发中 |
| REQ-WEB-VIS-003 | 内视觉卡片显示最新截图缩略图，不直接显示文件路径 | 开发中 |
| REQ-WEB-MEDIA-004 | 对话回复支持富文本/媒体点击，同时保留消息选中转发能力 | 开发中 |
