# 2026-05-05 REQ-MEM runtime 依赖落地方案

## 范围

本轮先推进 Web-GUI 第一梯队依赖的 `REQ-MEM` 能力，重点覆盖：

- `REQ-MEM-002`：beads 持久化服务稳定化。
- `REQ-MEM-004`：检索增强 prompt 支持按 query/layer/kind 选择高价值 beads。
- `REQ-MEM-005`：记忆治理规则下沉，减少 Web 层重复实现。

## 当前状态

- Web console 已具备 session 级 beads CRUD、query、summary、prompt preview API。
- SQLite 已保存 `memory_beads`，并具备会话级容量限制和老化策略。
- core-runtime 目前只有分层映射、prompt 排序和 query 匹配的纯函数，缺少签名去重、摘要统计、prompt 上下文渲染、统一查询选取和容量裁剪规则。

## 技术方案

1. 在 core-runtime `memory.rs` 中补齐可复用规则：
   - `memory_bead_signature`：统一去重签名。
   - `MemoryBeadsSummary` + `summarize_memory_beads`：统一 summary 统计。
   - `MemoryBeadQueryOptions` + `query_memory_beads`：统一 layer/kind/q/prompt_only/limit 查询。
   - `render_prompt_memory_context`：统一 prompt preview 文本。
   - `prune_memory_beads_to`：统一容量老化排序。
2. Web console 改为复用 runtime 规则：
   - beads query 不再本地手写排序和筛选。
   - prompt preview 支持 `q/layer/kind/prompt_only/limit`。
   - summary、signature、prompt context、capacity prune 复用 runtime。
3. 补自动化测试：
   - core-runtime 单测覆盖签名、查询、摘要、prompt context、容量裁剪。
   - web-console 单测覆盖 prompt query 过滤和 L4 跳过。

## 风险与边界

- 本轮不迁移 SQLite schema，不改已有数据文件格式。
- 本轮不新增真实跨 session 记忆合并，只为后续回复引用/转发提供稳定 query/prompt 能力。
- `REQ-WEB-CHAT-003` 的引用/转发 UI 和跨 agent 写入会在本轮之后接入。

## 验收标准

- `cargo test -p coolzhu-core-runtime memory`
- `cargo test -p coolzhu-web-console memory`
- `cargo check -p coolzhu-web-console --offline -q`
- 文档需求状态更新到 `docs/requirements-management.md`。
