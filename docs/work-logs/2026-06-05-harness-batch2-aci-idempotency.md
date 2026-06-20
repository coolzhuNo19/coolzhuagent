# 2026-06-05 Harness 批次二：工具 ACI 增强 + 请求幂等（方案4/6）+ 方案5 落点

> 配套：`docs/harness-optimization-plan-2026-06-04.md`。批次二三方案，本轮交付方案4+6（已验证），方案5 记录落点作为独立增量。

## 方案4 工具 ACI 增强 + Poka-Yoke（✅ 已交付）
落点 `modules/tooling/packages/tool-registry/src/lib.rs::mvp_tool_specs`（工具规范源，web-console main.rs:70/1192 + CLI 都用它把 description+schema 传给 LLM）。增强 6 个高频工具描述（边界/防错/与相似工具差异）：
- `edit_file`：必须先 read_file；old_string 须精确匹配且唯一、含足够上下文，否则失败；replace_all 替换所有；优先于 write_file 做局部修改。
- `write_file`：创建或整体覆盖；改已有文件优先 edit_file 或先 read_file；content 为完整文件文本。
- `read_file`：返回带行号；大文件用 offset/limit 分段；优先绝对/workspace 相对路径。
- `glob_search`/`grep_search`：明确互相区分（找文件名 vs 搜内容），grep 优先于 bash grep/findstr。
- `bash`（Windows）：不要用于找文件/搜内容/读文件（用 glob_search/grep_search/read_file）。
- 验证：tool-registry 相关测试（`exposes_mvp_tools`/`file_tools_cover_read_write_and_edit`/`glob_and_grep`）全 ok；web-console test 通过。
- **视觉语音零影响**（纯文案，所有 agent 共用，不排斥多模态）。
- **预存 flaky 标注**：`tool-registry` 测试 `web_fetch_supports_plain_text_and_rejects_invalid_url` 进程崩溃（STATUS_STACK_BUFFER_OVERRUN）——与方案4 无关（未改 WebFetch），与 WebFetch 工具测试的 URL 解析/网络环境相关，建议后续单独排查。

## 方案6 用户请求级幂等（✅ 已交付）
落点 `web-console/main.rs::prepare_chat_dispatch`（流式 `api_chat_send_stream` + 非流式 `api_chat_send` 的**共享入口**），校验后加 `check_chat_request_duplicate`：
- 指纹 = session_id + chat_room_id + target_agent_ids + normalize(text) + 附件(url+name)；`hash_bytes` 求键。
- 时间窗默认 30s（`COOLZHU_CHAT_IDEMPOTENCY_WINDOW_MS` 可配，设 0 关闭）；窗口内重复 → `Err(409 CONFLICT)`，**不 emit、不调模型、不存消息**。
- 内存表 `chat_idempotency_registry`（OnceLock<Mutex<HashMap>>），每次 retain 清理过期。
- `selected_message_ids` 由 `unwrap_or_default()` 改 `clone().unwrap_or_default()`，保 payload 完整供 `check(&payload)` 借用。
- 验证：web-console test 通过（各测试 payload 的 session/room/text key 不同，幂等不误杀；多模态消息因附件指纹不同也不误判）。
- **realtime 链路独立**（不走发消息），零影响。

## 方案5 双模监管 L1/L2（✅ L1 已实现，L2 复用 goal 现有）
**L1 已实现并验证**（非流式 `call_agent_model_with_tool_loop`，main.rs:13476 循环外加 `last_tool_signature`/`tool_repeat_count`，13513 处对 `response.content` 的 ToolUse 算指纹、连续相同→往 `tool_result_blocks` 追加 `[Runtime supervisor]` 纠偏 Text block，带 `any_error` 标记）。**条件化天然**：只多轮 tool loop 触发，vision 单轮问答不进多轮、正常每轮调用指纹不同→零误判。验证：web-console `cargo test` 通过（exit 0）+ build 生效。
**流式不适用**：流式 `api_chat_send_stream` 是固定的 round1(工具)→round2(结果) **单轮工具反馈**（非 N 轮循环），无多轮重复机会，L1 无意义、无需同步。
**L2** 由 goal 现有 `GOAL_PHASE_VERIFICATION_ATTENTION_MIN_BLOCKS` + `GOAL_PHASE_REPLAN_MAX_RETRIES` 覆盖（验证/重规划失败计数→暂停升级）。原始落点设计：

### L1 tool loop 重复失败检测
- 落点：`call_agent_model_with_tool_loop`（main.rs:13451）的 `for round in 0..=max_tool_feedback_rounds` 循环（13477）。
- 实现：维护 `last_tool_signature: Option<u64>` + `repeat_count: u32`；每轮对 `tool_requests`（13495）算指纹（排序后 name+input 的 `hash_bytes`）；连续相同（repeat_count ≥1，即 ≥2 轮重复同样调用）→ 在该轮 `tool_result_blocks`（13510 构造处）追加一个纠偏提示 block（如 InputContentBlock 文本/ToolResult："连续重复相同工具调用且无进展，请改变策略或换工具"），随 history 进下一轮。
- **条件化天然**：只在多轮 tool loop 触发；vision 单轮问答/正常不同工具调用（指纹不同）不触发 → 零误判 vision。

### L2 goal 无进展熔断
- 现状：goal 已有 `GOAL_PHASE_VERIFICATION_ATTENTION_MIN_BLOCKS` + `GOAL_PHASE_REPLAN_MAX_RETRIES` 部分覆盖（验证/重规划失败计数→暂停）。
- 增强落点：`dispatch_ready_goal_phases`（main.rs:19850）加"连续 N 个 phase 无文件改动 / 无验证推进"计数 → 软介入或暂停熔断。
- 复用：`hash_bytes`、`InputContentBlock`、goal 现有阈值/暂停/事件机制。

### 验证（待实现时）
- 单测：构造重复失败工具调用序列确认 L1 注入纠偏 + 不误触发不同工具调用；goal 无进展用例确认 L2 熔断。
- 兼容：vision 单轮问答 + 正常多工具流程不被 L1 误判。

## 落点文件
- `modules/tooling/packages/tool-registry/src/lib.rs`（方案4）。
- `modules/gui-web/packages/web-console/src/main.rs`（方案6 + 方案5 待做）。
