# 2026-05-06 Web-GUI 卡片 API 审计端点

记录时间：2026-05-06 00:15:46 +08:00

## 关联需求

- `REQ-WEB-API-001`：卡片未接后端 API 补齐。

## 目标

建立 Web-GUI 主卡片的结构化 API 接入缺口清单，后续可按该清单逐卡片补 loading/error/empty 状态。

## TDD 过程

红灯：

- 新增 `web_card_api_audit_tracks_primary_card_gaps` 单测，要求存在卡片 API 审计构建器。
- 初次运行日志：`tmp/web_card_api_tdd_red.log`，失败点为 `build_web_card_api_audit` 尚不存在。

绿灯：

- 新增只读接口 `GET /api/web/cards`。
- 返回 10 张主卡片的 endpoint 清单、loading/error/empty 覆盖位、`ready/gap` 状态和缺口说明。
- 工具卡片已标记为 `ready`；外视觉、会话状态、语音监听等仍保留明确 gap，便于后续开发。

## 修改文件

- `modules/gui-web/packages/web-console/src/main.rs`
- `modules/gui-web/INTERFACE.md`
- `modules/gui-web/packages/web-console/README.md`
- `docs/requirements-management.md`

## 验证

- `cargo fmt -p coolzhu-web-console`
- `cargo check -p coolzhu-web-console --offline`
- `cargo test -p coolzhu-web-console --offline`

结果：

- `cargo check` 通过，日志：`tmp/web_card_api_check.log`。
- `cargo test` 通过，110 项测试全部成功，日志：`tmp/web_card_api_test.log`。

## 后续

- 按 `/api/web/cards` 输出优先补：`session-agent` 错误态、`voice-monitor` loading 态、`external-vision` loading/error 态。
- 补前端消费该审计接口时，不应让审计消息刷屏聊天室；建议进入诊断/总览小状态区。

## 备份

- 本次备份路径：`tmp/backups/web-card-api-audit-20260506-001615`。
