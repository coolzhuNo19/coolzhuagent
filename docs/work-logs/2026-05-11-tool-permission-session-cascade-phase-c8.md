# Phase C-8 落地：审计前端 Tab（REQ-TOOL-009 UI）

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.5  
前置：Phase C-6（审计 jsonl 落盘）、Phase C-7（前端审批订阅）

关联需求：
- 完善：`REQ-TOOL-009`（测试中，现在有前端可视化）
- 不动：后端 API、`run_model_tool_dispatch`、LLM Tool Loop

## 1. 本轮范围（Phase C-8）

纯前端改动，把 Phase C-6 的 `/api/tools/audit` 接到工具卡片下方：

- **新增** `index.html` 工具卡片内 `.tool-audit` 块：标题 + 状态 pill + "刷新" 按钮 + 内容容器
- **新增** `app.js` `refreshToolAudit()`：拉 `/api/tools/audit?limit=50`，表格化渲染（时间/工具/调用方/状态/决策/耗时）
- **新增** `app.js` 行点击展开明细（call_id / workspace / session / input_summary / reason / paths / summary_text）
- **新增** `app.js` `respondToApproval` 成功回调后自动 `refreshToolAudit()`，让用户立即看到"刚刚做了什么"
- **新增** `styles.css` `.tool-audit*` 样式（表格、状态色、展开明细）
- **零后端改动**

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/index.html` | 工具卡片内 `tool-catalog` 和 `task-list` 之间插入 `.tool-audit` 块（head + body + refresh 按钮） |
| `web-console/src/app.js` | 顶部 DOMContentLoaded 加挂 `tool-audit-refresh` 按钮 + 初始 `refreshToolAudit()`；新增 `refreshToolAudit` / `renderToolAudit` / `formatAuditTs` / `escapeHtml`；`respondToApproval` 成功后触发 `refreshToolAudit` |
| `web-console/src/styles.css` | 末尾 `.tool-audit*` 样式：max-height 220px 滚动；status 颜色映射（ok=绿 / dry-run-only=黄 / rejected/failed/timeout=红）；展开行浅灰 |

关键设计点：
- **插入位置**：嵌在现有 `tool-card` 内部，不新开卡片。视觉层级：工具目录（现有）→ 审计记录（新）→ 任务列表（现有）。
- **容量与 UX**：`max-height: 220px` 内部滚动，避免撑长 rail。`entries.slice().reverse()` 让新的在上（jsonl 本身是旧→新顺序）。
- **XSS 防御**：`escapeHtml()` 处理所有 `innerHTML` 注入的文本（`call_id` / `workspace_id` / `input_summary` / `reason` / `paths` / `summary_text`）。`input_summary` 虽已被后端脱敏，防御性转义仍然必要。
- **点击交互**：主行 click → toggle 明细行 `hidden`。不用 `<details>` 是为了明细行也能铺满 6 列。
- **即时反馈**：审批按钮成功后立即刷新审计表。用户不用再手动点刷新。

## 3. Tests

| 套件 | Phase C-7 | Phase C-8 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 173 | 0（纯前端） | **173 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

前端静态检查：
- `node --check modules/gui-web/packages/web-console/src/app.js` ✅

手工验证清单（交互式，待在真实浏览器中执行）：
1. 启动 `cargo run -p coolzhu-web-console`。
2. 打开 Web 控制台，工具卡片内应看到"工具调用记录"块，状态 pill 显示 `最近 N 条`（N 取决于此前 runtime-execute 调用次数）。
3. 点击"刷新"按钮 → 重新加载。
4. 在另一个终端 `curl -X POST /api/tools/runtime-execute -H "Content-Type: application/json" -d '{"tool_name":"read_file","input":{"path":"src/main.rs"}}'` → 审计表最顶部出现新行，状态 `ok`，决策 `allow-auto`。
5. 再 `curl` 一个写 `coolzhu.toml` 的请求 → 最顶新行状态 `dry-run-only`（黄色），决策 `require-confirm`。
6. 前端审批面板弹出 → 点 "拒绝" → 面板消失，审计表自动多一行"同 call_id 已 rejected"？⚠️ **实际上审计在 runtime-execute 时已经登记，拒绝不会多写一条**（后端设计），这符合预期。
7. 点击任一行 → 展开明细，可见 `workspace / session / input_summary / reason / paths / summary_text`。

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c8-audit-ui-20260511-post/`
- `app.js`
- `styles.css`
- `index.html`

（`main.rs` 未动，保持 Phase C-6 状态；需要时用 `tmp/backups/phase-c6-audit-jsonl-20260511-post/main.rs`。）

### 回滚步骤

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-7 | `Copy-Item tmp\backups\phase-c7-approval-ui-20260511-post\app.js modules\gui-web\packages\web-console\src\app.js；同理 styles.css / index.html` |
| 回 Phase C-6（无前端 UI） | `git restore modules/gui-web/packages/web-console/{index.html,src/app.js,src/styles.css}` |
| 逐级回退到 Phase A | 按备份链从 C-8 → C-7 → ... → A 依次 Copy |

Phase C-8 完全可以用 `git restore` 三个前端文件一次性回滚，不影响后端状态。

## 5. 接口

无新 HTTP；复用 `/api/tools/audit`。

## 6. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 审计文件几 MB 时一次拉 50 条 | 低 | 后端 `api_tools_audit` 已做尾部截取，不会传整个文件 |
| `escapeHtml` 漏转义导致 XSS | 低 | 明细行 innerHTML 所有变量都过 escape；审计内容来自本地后端，攻击面很小 |
| 初始 `refreshToolAudit()` 早于 workspace 切换完成 → 读旧路径 | 低 | 初次加载在 DOMContentLoaded 执行，与 `refreshAll()` 并行；workspace 切换后建议手动点刷新，后续 Phase C-? 可加 workspace-changed 事件自动刷 |
| 没有筛选 / 分页 | 中（UX） | Phase D 可加 "按 tool_name / status 过滤" + "加载更多" |

## 7. 下一步（Phase C-9）

继续推进 `REQ-TOOL-007` 的最后一步：`run_model_tool_dispatch` 切到 `runtime_tool_execute`。这是 LLM Tool Loop 触发的工具调用也走统一权限 + 审计链的关键动作。C-9 单独先出分析方案（列所有调用点、行为差异、兼容策略），C-10 才正式改代码。

## 8. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
node --check modules/gui-web/packages/web-console/src/app.js
```

手工：见 §3 清单 7 步。
