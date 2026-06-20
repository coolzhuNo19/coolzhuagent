# Phase C-10 落地：llm_tool_definitions 扩张

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1 T2 / `docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md` §2.2  
前置：Phase A / B / C-1 ~ C-8 + C-9 分析

关联需求：
- 推进：`REQ-TOOL-007`（25% → 45%，LLM 看到 11 个工具而非 1 个）
- 不动：`run_model_tool_dispatch` 内部白名单（C-11 做）、Tool Loop 回灌格式（C-12 做）

## 1. 本轮范围（Phase C-10）

按 C-9 §2.2 落地 **LLM 工具暴露扩张**，保持运行时执行路径不变：

- **新增** `ConfigModel.llm_tool_exposure: Option<String>`（默认 `"whitelist"`）
- **新增** `llm_tool_exposure_mode()`：解析配置，未知值安全降级
- **新增** `default_llm_tool_allowlist()`：从 `mvp_tool_specs` 自动筛出 ReadOnly 档，与 `ReadOnlyRegistryExecutor::from_registry()` 过滤条件同源
- **新增** `compose_description_with_permission(spec)`：description 追加 `(Permission: read-only)` 等标注
- **新增** `semantic_dispatch_tool_definition()`：抽出元工具定义（保留原 schema）
- **重构** `llm_tool_definitions()`：按 mode 分三档暴露

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` `ConfigModel` | 新字段 `llm_tool_exposure: Option<String>`，`Default` 置 None |
| 同上 紧邻 `llm_tool_definitions` 上方 | 新 `llm_tool_exposure_mode` / `default_llm_tool_allowlist` / `compose_description_with_permission` / `semantic_dispatch_tool_definition` |
| 同上 `llm_tool_definitions` | 按 mode 三档返回：`dispatch-only`（1 个）/ `whitelist`（11 个）/ `all`（21 个） |
| tests | 新 4 个 TDD |

### 关键设计点

**三档暴露**：
- `dispatch-only`：**完全**回退到 Phase C-10 前的行为，用于灰度验证或紧急回滚
- `whitelist`（默认）：`tools_semantic_dispatch` + 10 个 ReadOnly 工具。11 = `mvp ReadOnly` 数（read_file, glob_search, grep_search, WebFetch, WebSearch, Skill, ToolSearch, Sleep, SendUserMessage, StructuredOutput）+ 1 元工具
- `all`：`mvp` 全量 20 个 + 1 元工具 = 21 个

**为什么 description 追加权限标注？**  
让模型自我约束。当前 `run_model_tool_dispatch` 对非 `semantic_dispatch` 工具仍返回 `BAD_REQUEST`——description 提示可以减少"模型反复试 write_file 失败"的情况。C-11 接入 runtime 后，这个标注依然有用（让模型预期哪些工具需要审批）。

**为什么默认是 `whitelist` 而不是 `all`？**  
安全默认。ReadOnly 工具即使在 C-11 之前被模型调用，`run_model_tool_dispatch` 仍会返回 `BAD_REQUEST`（除 semantic_dispatch 外），模型会自然回退用 semantic_dispatch 或直接文本回答。`all` 模式下暴露的 `bash` / `write_file` 被模型调用 → 同样 BAD_REQUEST，没有风险；但 LLM 花上下文预算去列这些工具描述不划算——默认从 whitelist 开始。

**为什么过滤条件用 `required_permission == ReadOnly`？**  
与 `ReadOnlyRegistryExecutor::from_registry()` 过滤规则完全一致。保证"暴露给 LLM 的，一定是 Phase C-11 切过去以后能真正执行的工具"，不会出现"暴露了但运行到 unknown tool"的体验落差。

**为什么不引入 `ConfigToolRegistry.allowlist`？**  
C-10 的 whitelist 是**编译期常量**（从 `mvp_tool_specs` 反查）；未来用户想自定义白名单属于 C-12+ 的扩展，届时可加 `[model] llm_tool_allowlist = [...]`，与 mode 正交。

## 3. Tests

| 套件 | Phase C-8 | Phase C-10 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 173 | 4 | **177 passed** | 绿（`--test-threads=1`） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-10 新增用例：

1. `llm_tool_definitions_returns_none_when_disabled` — `enable_llm_tools=false` 时返回 None，确保不回归
2. `llm_tool_definitions_default_whitelist_exposes_readonly_set` — 默认 whitelist：含 semantic_dispatch + read_file / glob_search / grep_search / WebFetch / WebSearch；**不含** bash / write_file / edit_file / Config；read_file description 含 `(Permission: read-only)`
3. `llm_tool_definitions_all_mode_exposes_full_registry_plus_dispatch` — mode=`"all"` → 数量 = `mvp_tool_specs().len() + 1`；bash description 含 `(Permission: danger-full-access)`
4. `llm_tool_definitions_dispatch_only_mode_exposes_single_tool` — mode=`"dispatch-only"` → 仅 `tools_semantic_dispatch`

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c10-llm-tool-definitions-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-8 | `Copy-Item tmp\backups\phase-c6-audit-jsonl-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs`（main.rs 从 C-6 起未变至 C-8） |
| 回 Phase C-7 | `tmp\backups\phase-c7-approval-ui-20260511-post\main.rs` |
| 回 Phase C-6 | `tmp\backups\phase-c6-audit-jsonl-20260511-post\main.rs` |
| 回 Phase C-5 | `tmp\backups\phase-c5-protected-config-20260511-post\main.rs` |
| 回 Phase C-4 | `tmp\backups\phase-c4-tool-events-20260511-post\main.rs` |
| 回 Phase C-3 | `tmp\backups\phase-c3-runtime-execute-20260511-post\main.rs` |
| 回 Phase C-2 | `tmp\backups\phase-c2-approval-api-20260511-post\main.rs` |
| 回 Phase C-1 | `tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs` |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

单文件改动。**运行时紧急回滚**：改 `coolzhu.toml [model] llm_tool_exposure = "dispatch-only"` 一行即可让 LLM 只看到元工具，等价于 Phase C-9 前行为；不需要重新编译。

## 5. 接口清单

### coolzhu.toml

```toml
[model]
enable_real_llm = true
enable_llm_tools = true
# Phase C-10：可选三档：dispatch-only / whitelist / all
# 未设置时默认 "whitelist"（ReadOnly 集合，与 executor 对齐）
llm_tool_exposure = "whitelist"
```

### LLM provider 视角

LLM 在启用 `enable_llm_tools = true` 后看到 `ToolDefinition` 数组：

| mode | 数量 | 包含 |
| --- | --- | --- |
| `dispatch-only` | 1 | `tools_semantic_dispatch` |
| `whitelist`（默认） | **11** | semantic_dispatch + 10 个 ReadOnly |
| `all` | **21** | semantic_dispatch + 20 个 mvp 工具 |

description 追加 `(Permission: read-only / workspace-write / danger-full-access / prompt / allow)` 便于 LLM 自我约束。

### 运行时路径

**暂未变**：`run_model_tool_dispatch` 继续硬白名单（`tools_semantic_dispatch` only）。暴露的其它工具 → LLM 调 → `BAD_REQUEST` → LLM round 2 看到错误自己修正。这是 C-10 设计的过渡状态。

C-11 切 runtime 后：白名单内 ReadOnly → `runtime-executed`，白名单外 → 继续 `BAD_REQUEST` 或走 runtime 的 `Failed`（取决于 C-11 选项）。

## 6. 未落地（Phase C-11 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-007 | `run_model_tool_dispatch` 分流：元工具保留 legacy，registry 工具走 `invoke_through_runtime` → `runtime_tool_execute`，返回映射为 `ToolDispatchResponse` |
| REQ-TOOL-008 | LLM tool_use 触发的审批与 Phase C-7 前端面板打通（自动复用） |
| REQ-TOOL-009 | LLM tool_use 自动落 `tool-audit.jsonl`（复用 `append_tool_audit_record`） |

## 7. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- llm_tool_definitions_

# 全量回归
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

## 8. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| LLM 试调非白名单工具消耗上下文 | 低 | description 里权限标注让模型少试；BAD_REQUEST 的短消息占用极小 |
| 用户误配 `"all"` 让 LLM 调 `bash` / `write_file` | 低 | 运行时还是 BAD_REQUEST；C-11 切 runtime 后会走审批闸门，不会裸跑 |
| `mvp_tool_specs()` 未来扩充工具但漏标 permission | 中 | tool-registry 编译期要求 `ToolSpec.required_permission` 必填；新增工具必须显式声明档位 |
| 并发测试跑时 `workspace_config` 互相影响 | 已缓解 | 沿用 C-5 的 `config_test_guard()` 串行化锁 |

## 9. 下一步（Phase C-11）

按 C-9 §2.3 落地 `run_model_tool_dispatch` 的 `invoke_through_runtime` 路径 + `tool_outcome_to_dispatch_response` 映射：

1. 元工具 `tools_semantic_dispatch` 继续走 `run_tool_dispatch`（legacy 路径）
2. 其它 registry 工具构造 `ToolInvoke{caller: Llm}` → `runtime_tool_execute` → outcome 映射 `ToolDispatchResponse`
3. DryRunOnly 自动 `enqueue_pending_approval`（前端面板自动弹出）+ `append_tool_audit_record`（审计自动落）
4. 5 条 TDD：元工具路径不回归、ReadOnly 成功、Danger 走 pending、Protected 走 RequireConfirm、session grant 后第二次自动放行

预期 web-console 172 → 182 passed。

## 10. 给下一任 agent 的提醒

- **不要直接把 whitelist 改成静态字符串数组**。它必须从 `mvp_tool_specs()` 按 `PermissionMode::ReadOnly` 过滤，这样未来新增 ReadOnly 工具自动进入 whitelist，新增写/危险工具自动被排除。
- **description 的权限标注不要国际化**。LLM 预训练对英文术语更敏感，`(Permission: read-only)` 比 `（权限：只读）` 更可靠。
- **Phase C-11 开始前跑一次**：`cargo test -p coolzhu-web-console --offline --bins -- llm_tool_definitions_` 确认 4 条 TDD 全绿，再动 run_model_tool_dispatch。
- **`diag!("[TOOL-REG] exposed {} tools (mode={})")`** 已埋；运行时日志可以直接核对当前模式。
