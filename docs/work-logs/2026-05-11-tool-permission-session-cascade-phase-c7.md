# Phase C-7 落地：前端审批订阅 UI

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.4 / §7 步骤 D  
前置：Phase A / B / C-1 / C-2 / C-3 / C-4 / C-5 / C-6（均 2026-05-10 → 05-11）

关联需求：
- 推进：`REQ-TOOL-008`（开发中 → 测试中，前端可演示审批面板）
- 不动：`run_model_tool_dispatch`、LLM Tool Loop、后端端点

## 1. 本轮范围（Phase C-7）

纯前端 + CSS 改动，把 Phase C-4 已有的 SSE 事件通道接到真实 UI：

- **新增** `index.html` 末尾 `aside.tool-approval-panel`：默认 `hidden`，填充 `工具 / 调用方 / 入参摘要 / 原因 / 影响路径` 5 个字段 + 3 个按钮（拒绝 / 授权本次 / 授权本会话）
- **新增** `app.js` `startToolApprovalStream()`：订阅 `/api/tools/events` SSE；`permission-required` → 渲染面板；`approved/rejected` → 隐藏；`lagged` → 拉 `/api/tools/pending` 补齐；`onerror` → 1.5s 重连
- **新增** `app.js` `respondToApproval(kind, scope)`：POST `/api/tools/approve|reject`，body 含 `call_id / scope / confirmed_twice`
- **新增** `styles.css` `.tool-approval-panel` 及子选择器（右下角悬浮卡、红/蓝/绿三色按钮、badge）
- **零后端改动**

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/index.html` | 末尾注入 `<aside class="tool-approval-panel" hidden ...>`，5 行 `<dl><dt>/<dd>` + 3 个按钮 |
| `web-console/src/app.js` | 顶部挂 `startToolApprovalStream()` 到 DOMContentLoaded；新增 `toolApproval` state + `connectToolEventSource` + `renderApprovalPanel` + `hideApprovalPanel` + `refreshPendingApprovals` + `respondToApproval` + `safeJsonParse` + `setBindText` |
| `web-console/src/styles.css` | 末尾 `.tool-approval-panel` 及子选择器（约 90 行） |

关键设计点：
- **面板位置**：固定右下角 `bottom: 96px`，避开既有 `data-role="tool-exec-actions"` 旧按钮，保留旧 computer-use 闸门不受影响。
- **SSE 错误处理**：`onerror` 触发后 1.5s 重连，避免网络抖动导致面板丢事件；单飞 timer 防止堆积。
- **`lagged` 补齐策略**：SSE 容量满时服务端发 `lagged` 事件，前端立即 `/api/tools/pending` 拉最新队列的第一条，保证不丢审批请求。
- **按钮回包**：`approve` 默认 `scope: "once"` / `confirmed_twice: false`；`session` 按钮让用户选"本会话授权"；`reject` 固定 `reason: "user-rejected"`。后续 Phase D 可以加自定义 reason 输入框。
- **`setBindText`**：复用已有的 `bindings` Map（`data-bind` 收集的节点），保持与其它卡片相同的更新范式。

## 3. Tests

| 套件 | Phase C-6 | Phase C-7 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 173 | 0（纯前端改动） | **173 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

前端静态检查：
- `node --check modules/gui-web/packages/web-console/src/app.js` ✅
- `cargo check -p coolzhu-web-console --offline` 无新 warning（index.html / styles.css 是运行时资产，不参与编译）

手工验证清单（交互式，待在真实浏览器/Tauri Shell 中执行）：
1. 启动 `cargo run -p coolzhu-web-console`。
2. 打开 Web 控制台，F12 → Network，应看到 `/api/tools/events` 持续挂起（EventSource）。
3. 新开一个 curl 触发 `POST /api/tools/runtime-execute { "tool_name": "write_file", "input": { "path": "C:\\Users\\<u>\\coolzhuagent\\coolzhu.toml", "content": "x" } }`。
4. 前端面板应弹出，显示 `tool=write_file`、`decision=require-confirm`、`protected_match=coolzhu-config`、`affected_paths=[...coolzhu.toml]`。
5. 点 "拒绝" → 面板消失；curl 响应体里 `outcome.status=dry-run-only, pending_call_id=<id>`；`GET /api/tools/pending` 应不含此 id。
6. 再触发一次，点 "授权本次" → 面板消失；后续再触发同一 call 会再次进 pending（因为 once 不建立 session grant）。
7. 再触发一次，点 "授权本会话" → 面板消失；之后对同 `(workspace_id, session_id, bash)` 触发 `RequireApproval`，`session_grant_view_for` 返回 `session_authorized=true` → Phase D-? 的 run loop 可以自动放行。

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c7-approval-ui-20260511-post/`
- `main.rs`（保持 C-6 状态，未改）
- `app.js`
- `styles.css`
- `index.html`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-6（纯后端态） | `Copy-Item tmp\backups\phase-c6-audit-jsonl-20260511-post\main.rs ...\main.rs`；前端直接 `git restore` app.js / index.html / styles.css |
| 回 Phase C-5 | 依链逐级退 |
| ... | ... |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` |

Phase C-7 的前端改动全部可以用 `git restore modules/gui-web/packages/web-console/{index.html,src/app.js,src/styles.css}` 一次性还原，不影响后端任何状态。

## 5. 接口清单

**无新 HTTP 端点；复用 Phase C-2/C-4 的：**

| Method | Path | Phase | 前端用法 |
| --- | --- | --- | --- |
| GET | `/api/tools/events` | C-4 | `new EventSource(...)` 订阅 |
| GET | `/api/tools/pending` | C-2 | `lagged` 事件后补齐 |
| POST | `/api/tools/approve` | C-2 | 按钮 → `scope: once/session` |
| POST | `/api/tools/reject` | C-2 | 按钮 → `reason: user-rejected` |

## 6. 未落地（Phase C-8 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-007 完成 | `run_model_tool_dispatch` 切到 `runtime_tool_execute`，LLM tool_use 触发时真正用到这个审批面板 |
| REQ-TOOL-009 增强 | 前端"工具调用记录"tab → 轮询 `/api/tools/audit?limit=50` 渲染表格 |
| REQ-TOOL-011 超时 | bash / PowerShell 的 `tokio::time::timeout` + `Semaphore` |
| Pending queue UI | 多条待审批时面板支持"下一条"翻页；当前只展示第一条 |

## 7. 验证命令

```powershell
# 后端编译 + 测试
cargo check -p coolzhu-web-console --offline
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline

# 前端静态检查
node --check modules/gui-web/packages/web-console/src/app.js

# 手工交互验证：见 §3 清单（7 步）
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| SSE 连接断开 1.5s 内有多条事件丢失 | 低 | `lagged` 事件时主动拉 `/api/tools/pending` 补齐；容量 128 足够覆盖短暂断线 |
| 多标签页同时订阅 → 所有页都弹面板 | 中 | 设计如此（broadcast 多订阅者）；Phase D 可加 `scope: tab-local` / `once-global` 区分，或用 `BroadcastChannel` 跨标签去重 |
| 用户不小心点 "授权本会话" 后遗留 30min | 中 | 审计面板（Phase C-8）让用户随时看到授权记录；后续可加 `DELETE /api/tools/grants/:key` 手工清除 |
| 面板遮挡重要 UI | 低 | 右下角固定定位，内容少时高度 < 260px；移动端 `max-width: calc(100vw - 48px)` 保证不溢出 |

## 9. 下一步建议（Phase C-8）

1. **`/api/tools/audit` 前端渲染**：新增"工具调用记录" tab，复用 `.tool-approval-panel` 同类视觉；展示最近 50 条。
2. **`run_model_tool_dispatch` 切换**：LLM tool_use 复用 `runtime_tool_execute` + 审批事件；这是 REQ-TOOL-007 的最后一步。
3. **Pending 多条支持**：当 `/api/tools/events` 在面板未关闭时再次收到 `permission-required`，前端入栈并在关闭当前条后自动展示下一条。

每步独立 commit，保持回滚成本 ≤ 1 次 revert。
