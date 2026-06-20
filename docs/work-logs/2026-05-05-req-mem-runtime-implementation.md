# 2026-05-05 REQ-MEM runtime 依赖实现日志

## 完成内容

- 在 core-runtime `memory.rs` 下沉 beads 共享规则：
  - `memory_bead_signature`
  - `summarize_memory_beads`
  - `MemoryBeadQueryOptions`
  - `query_memory_beads`
  - `render_prompt_memory_context`
  - `prune_memory_beads_to`
- Web console 复用 runtime 记忆规则：
  - beads query 改为调用 `runtime::query_memory_beads`。
  - prompt preview 支持 `q/layer/kind/prompt_only/limit` 查询参数。
  - summary、去重签名、prompt context、容量裁剪改为 runtime 统一实现。
- 补 Web 单测覆盖聊天室引用/转发前置能力：按 query/kind 获取 prompt 候选，并默认跳过 L4 raw/archive。

## 影响范围

- `modules/core-runtime/packages/core-runtime/src/memory.rs`
- `modules/core-runtime/packages/core-runtime/src/lib.rs`
- `modules/gui-web/packages/web-console/src/main.rs`
- `docs/requirements-management.md`

## 验证

- `cargo test -p coolzhu-core-runtime memory --offline`
- `cargo test -p coolzhu-web-console memory --offline`
- `cargo check -p coolzhu-web-console --offline -q`

## 后续

- 基于本轮 query/prompt preview 能力，继续实现 `REQ-WEB-CHAT-003` 的回复引用与跨 agent 转发。
- 记忆治理 UI 专用面板仍未落地，`REQ-MEM-005` 保持 `测试中`。
- SQLite 并发写入、分页、备份恢复仍属于 `REQ-WEB-SESSION-002` 后续增强。
