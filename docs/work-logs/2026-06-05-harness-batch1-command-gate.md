# 2026-06-05 Harness 批次一：确定性命令门控 + 结构化进度注入

> 配套：`docs/harness-gap-analysis-2026-06-04.md`、`docs/harness-optimization-plan-2026-06-04.md`、plan `~/.claude/plans/cozy-shimmying-sparrow.md`。

## 关键发现（修正 gap 分析）
plan mode 函数级核查发现 **CUR-GOAL-LOOP-001 的双向回退闭环其实已实现**（`record_goal_phase_model_result`）：
- implementer→planner：`goal_phase_implementer_blocked_reason` + `GOAL_PHASE_REPLAN_MAX_RETRIES` + escalate。
- verifier→implementer：`goal_phase_missing_files` + `GOAL_PHASE_VERIFICATION_ATTENTION_MIN_BLOCKS` + 暂停升级。
- 完成推进：`complete_goal_phase`。

CLAUDE.md "plan→execute→verify 单向，缺失败回退" 的描述**已过时**。批次一真实缺口收窄为：① 确定性门控只支持 `FilesExist`，缺 `Command`（build/test 硬门）；② 无结构化进度注入。

## 实施（全部 `web-console/main.rs`）
### A 确定性命令门控
- `goal_phase_command_failures`（async）：`verification.type=="Command"` 时逐条跑 `commands`，非零退出/超时/启动失败→结构化失败证据。
- `run_goal_gate_command`：Windows PowerShell / 其他 sh，`decode_console_output` 兜底 GBK，超时控制，尾部 20 行证据。
- `run_goal_phase_command_gate`：**在不持 session_store 锁时执行**（关键架构决策：`record` 是持锁同步 fn，绝不能在里面跑 cargo build 数十秒阻塞全局）。
- `run_goal_phase_once`：record 前异步跑门控，failures 作参数传入。
- `record_goal_phase_model_result`：加 `command_failures` 参数 + **对称 FilesExist 的 command 回退分支**（失败→回 implementer、phase 保持 running；达阈值→暂停 + attention 事件）。
- `goal_command_gate_enabled`：`COOLZHU_GOAL_COMMAND_GATE=0/false` 可关。
### A3 能力告知（而非硬编码推断）
- planner/verifier 角色描述加 Command verification 说明，让 planner 按任务上下文自主配门。**未硬编码 cargo 推断**——避免在非 rust workspace 误判（default_goal_trigger_plan 是 HTML 默认计划，真实 coding plan 来自 planner LLM，`verification: Option<JsonValue>` 已支持任意 Command JSON）。
### B 结构化进度注入
- `goal_phase_progress_block`：从 `goal_events` 聚合重试次数/上轮失败原因/artifacts 就绪数。
- `goal_phase_run_prompt_with_progress`：phase prompt 注入 `Progress:` 段；`goal_phase_run_prompt` wrapper 加 `#[cfg(test)]`（仅测试用）。

## 视觉语音兼容（零影响，已验证）
- Command 门控 **opt-in**：vision/语音/通用 phase 维持 `FilesExist`/`UserConfirm` → `goal_phase_command_failures` 返回空。
- 不碰 `RealtimeSessionState` / `/api/realtime|audio|vision/realtime` 路由 / `call_agent_model_with_tool_loop` / `build_context_assembly`。
- 进度注入仅 goal phase prompt，不碰聊天多模态（避免挤压图像 token）。
- 回归实测：`/api/realtime/session/status` HTTP 200、`/api/goals` 200。

## 验证
- `cargo build -p coolzhu-web-console` link 通过（0 error，27 既有 dead_code warning）。
- `cargo test`：**405 passed**，含新单测 `goal_command_gate_detects_exit_code`（exit 0→Ok、exit 1→Err）+ 现有 goal 回退测试不回归。
- 视觉语音回归：realtime session status 200、goals API 200，新 exe 健康。

## 遗留
- **预存 flaky（非本批次引入）**：`project_diff_files_rejects_path_escape_before_read` 并行下偶发失败（多测试争用 `reload_workspace_scope` 全局 workspace scope，期望 403 得 400）。**单独跑通过**；本批次新增的 async 单测改变调度时序而偶发诱发暴露。建议后续用 `serial_test` 或测试级 workspace 隔离修，超批次一范围。
- 完整 coding goal run 端到端（配 provider model + 真实 coding 任务触发 build 失败→回退→修复→二次过）建议用户实测；机制已由单测（命令 exit code）+ 对称 FilesExist 回退（现有测试覆盖）+ 编译/启动验证保障。
- 批次二/三（聊天 tool loop 进度注入、双模监管 L1/L2、请求幂等、语义记忆检索、规则分层加载）按方案计划后续推进。

## 落点
- `modules/gui-web/packages/web-console/src/main.rs`：A1/A2/A3/B 全部后端改动 + 单测 + 3 处既有测试调用补 `command_failures` 参数。
