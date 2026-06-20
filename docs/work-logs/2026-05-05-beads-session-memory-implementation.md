# 2026-05-05 beads 会话与记忆层实现日志

## 范围

本次按新优先级先落地 beads 会话与记忆层，随后才进入工具卡片和桌宠需求。

## 实现内容

| 需求 | 实现 |
| --- | --- |
| 三合一卡片溢出 | 会话名称、Provider、模型、Key 引用输入/下拉框补 `min-width: 0`、`max-width: 100%` 和文本省略，避免右侧越界 |
| beads CRUD | 新增 `PATCH/DELETE /api/sessions/{session_id}/beads/{bead_id}` |
| beads 查询 | `GET /api/sessions/{session_id}/beads/query` 支持 `q`、`layer`、`kind`、`prompt_only`、`limit` |
| beads 摘要 | 新增 `GET /api/sessions/{session_id}/beads/summary`，返回 layer/kind/pinned/prompt 候选统计 |
| prompt 预览 | 新增 `GET /api/sessions/{session_id}/beads/prompt`，复用真实 prompt 注入选择与渲染逻辑 |
| 自动沉淀 | 流式和非流式聊天完成后都会沉淀 assistant/reasoning/tool-summary beads |
| 去重与容量 | 新增 `layer + kind + source + summary` 签名去重，显式 beads 上限为 256 条并按 pinned/layer/confidence/time 裁剪 |

## 验证

已执行并通过：

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
cargo build -p coolzhu-web-console
```

测试结果：

- `coolzhu-web-console` 单测从 74 增至 77 个，全部通过。
- 新增覆盖：
  - beads summary 统计 layer/kind/prompt candidate。
  - prompt context 跳过 L4。
  - 显式 beads 超过 256 条时裁剪并保留 pinned。

接口冒烟：

```powershell
GET /api/sessions/{id}/beads/summary
GET /api/sessions/{id}/beads/prompt?limit=4
GET /api/sessions/{id}/beads/query?prompt_only=true&limit=4
POST /api/sessions/{id}/beads
PATCH /api/sessions/{id}/beads/{bead_id}
DELETE /api/sessions/{id}/beads/{bead_id}
```

结果：

- summary/prompt/query 返回 200。
- 新增临时 bead 后，按 `q=codex-query-smoke&kind=decision&layer=L2&prompt_only=true` 查询命中 1 条。
- PATCH 可更新 pinned/confidence。
- DELETE 后临时 bead 不再出现在返回列表。

## 服务状态

已重新构建并重启 Web 控制台：

- 当前进程：`coolzhu-web-console.exe`
- 当前地址：`http://127.0.0.1:8765`

## 后续

1. 会话、消息、beads 下沉 SQLite/FTS，并补迁移脚本。
2. 为 beads 增加专用 UI 面板，支持人工 pin、删除、搜索和 prompt 预览。
3. 开始工具卡片后端 catalog/API 接入。
