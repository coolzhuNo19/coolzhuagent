# 2026-05-18 记忆 / 知识窗口后端能力接入

## 时间

- 开始：2026-05-18 07:41
- 闭环：2026-05-18 08:05

## 关联需求

- `REQ-WEB-WIN-005`：记忆 / 知识独立窗口
- `REQ-MEM-002`：beads 持久化服务
- `REQ-MEM-004`：检索增强 prompt
- `REQ-MEM-005`：记忆治理
- `REQ-WEB-CTX-001`：LLM 历史上下文装配

## 修改内容

- 前端 `memory` 窗口接入真实后端 API：
  - `GET /api/sessions/{session_id}/beads/summary`
  - `GET /api/sessions/{session_id}/beads/prompt`
  - `GET /api/sessions/{session_id}/context-preview`
  - `PATCH /api/sessions/{session_id}/beads/{bead_id}`
  - `DELETE /api/sessions/{session_id}/beads/{bead_id}`
- 记忆窗口新增 summary 指标刷新：
  - Total
  - Pinned
  - Prompt candidates
  - Context tokens
- 来源追踪区新增 Prompt Preview 与 Context Preview，随 keyword / kind / layer 筛选和选中 bead 刷新。
- 详情区补齐治理动作：
  - Pin / Unpin
  - Edit summary
  - Delete
- 修复新窗口内 bead 列表被旧 `.memory-bead-item button { width: 24px }` 样式压扁的问题：
  - 新窗口中的 bead select 恢复自适应宽度。
  - 列表行增加稳定高度与滚动区域，避免 47 条记忆挤压重叠。
- 新增静态契约测试：
  - `web_frontend_memory_window_connects_summary_prompt_context_and_governance`

## 验证结果

- `tmp/run-office-scene-validation.ps1`：通过
  - `cargo fmt --package coolzhu-web-console`
  - `node --check modules\gui-web\packages\web-console\src\app.js`
  - `tmp\check-web-ui-d2-inner-contract.ps1`
  - `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`
  - `cargo build -p coolzhu-web-console --offline`
- UI 启动：`tmp/start-office-scene-ui.ps1`，PID `29608`
- Edge CDP 截图：`tmp/web-ui-memory-window-1920x1080.png`
- 截图采集指标：
  - active window = `memory`
  - total beads = `47`
  - prompt preview has content = `true`
  - context preview has content = `true`
  - governance button count = `2`

## 备份

- 修改前备份：`tmp/backups/web-memory-window-20260518-074127-pre`
- 修改后备份：`tmp/backups/web-memory-window-20260518-080632-post`

## 待人工确认

- 记忆窗口三栏布局的阅读密度是否合适。
- Prompt Preview / Context Preview 右侧区域是否需要进一步缩短，只保留关键 token / bead 数与可展开详情。
