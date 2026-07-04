# ClawBot 扫码登录状态同步设计

日期：2026-07-04

## 背景

当前二维码刷新接口会创建或查询 iLink 登录二维码，但扫码后没有持续查询确认状态。前端只读取 web-console 已持久化的登录快照，因此即使用户已扫码，页面仍可能显示 `Awaiting scan` 和旧二维码；provider 也无法及时取得 bot token。

## 目标与范围

- 用户扫码后 2 秒内把 ClawBot 登录卡片更新为 `Online`。
- 在线后隐藏二维码，并立即停止登录轮询。
- 刷新页面后仍从持久化快照读取在线状态。
- 不重复生成二维码，不因状态查询递增 generation。
- 本轮不重构 sidecar 登录状态机，不处理多窗口协调。

## 方案

采用独立登录状态轮询接口：

1. web-console 新增 `POST /api/channels/clawbot/gateway/login/poll`。
2. handler 读取当前持久化登录快照：
   - 仅 `awaiting_scan` 或 `refresh_requested` 时使用当前 generation 调用 sidecar 的既有 `/login/refresh`。
   - `online`、`expired`、`error`、`logged_out` 直接返回当前快照，不访问 provider。
3. sidecar 继续把 provider 返回的登录报告写回 web-console；poll 不创建新 generation。
4. 前端在登录状态为 `awaiting_scan` 或 `refresh_requested` 时启动单实例定时器，每 2 秒调用 `/login/poll`。
5. 收到 `online`、`expired`、`error` 或 `logged_out` 后停止定时器并重新渲染。
6. `online` 状态沿用现有渲染逻辑：隐藏二维码、显示账号和在线样式。

## 状态与并发约束

- 前端同一时间最多存在一个登录轮询请求；请求未完成时不发起下一次。
- generation 只由用户主动“刷新二维码”递增，状态轮询保持原值。
- 后端以 generation 校验 sidecar 报告；过期报告不得覆盖更新代次。
- 切换离开 ClawBot 页可以保留轻量轮询，达到终态后必须停止；页面卸载时清理定时器。

## 错误处理

- 单次网络错误不清除现有二维码；前端记录错误并在下一个周期重试。
- 连续错误不并发、不加速；固定 2 秒节奏。
- provider 返回 `expired` 或 `error` 时停止轮询并展示现有错误文案。
- 已在线时 `/login/poll` 必须幂等，不能触发新二维码或重新登录。

## 测试与验收

自动测试：

- 后端仅在等待扫码状态需要 provider 轮询。
- `/login/poll` 路由已注册且不调用 `request_refresh`。
- 前端包含单实例轮询、2 秒间隔、终态停止和页面卸载清理。
- 原有二维码刷新、登录报告、登出测试保持通过。

真实验收：

1. 点击刷新二维码并扫码。
2. 不再点击任何按钮。
3. 2 秒内页面从 `Awaiting scan` 切换为 `Online`。
4. 二维码自动隐藏，账号与 provider 在线状态可见。
5. 刷新或重新进入 ClawBot 页后仍显示在线。
6. 登录后发送微信消息，inbox、模型会话和 outbox 闭环仍成功。
