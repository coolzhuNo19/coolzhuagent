# Phase C-9 分析：`run_model_tool_dispatch` 切换到 `runtime_tool_execute`

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §4.1（T2 / T3 / T4）  
前置：Phase A / B / C-1 ~ C-8 已落地，`runtime_tool_execute` / 审批 API / SSE / 审计 / 前端面板均可用

本文件**只输出分析与迁移方案**，不改代码。代码由后续 Phase C-10 / C-11 / C-12 落地。

## 0. 为什么要切换

| 当前（Phase C-8 止） | 目标 |
| --- | --- |
| LLM 只看到 1 个工具 (`tools_semantic_dispatch`) | 看到 registry 全量工具 |
| `run_model_tool_dispatch` 硬白名单 + 直接调 `run_tool_dispatch` | 走 `runtime_tool_execute` 统一闸门 |
| 工具结果以纯文本拼入 round 2 prompt | 发 `InputContentBlock::ToolResult` 标准块 |
| LLM 触发的工具 **不** 走审批 / 审计 / session grant | 与 `/api/tools/runtime-execute` 同样走完整链 |
| 多工具调用按顺序 | 支持并发（`futures::join_all`），整批超时 |

Phase C-8 已经把 Web UI 入口、审批 UI、审计 jsonl、配置化 Protected 规则全部打通；**就差 LLM 入口切过来，REQ-TOOL-007 就能从 25% → 95%**。

## 1. 现状盘点（精确到行）

### 1.1 LLM 侧调用链

**两条路径**，都最终落到 `run_model_tool_dispatch`：

1. **非流式 Tool Loop**：`main.rs:7115-7143`
   ```text
   stream_agent_model (async)
     → response.content
       → model_tool_requests_from_blocks(&response.content)  // :7119
         → for (name, input) in tool_requests:
             result = run_model_tool_dispatch(name, input).await       // :7124 ⭐
           result_text = dispatch_plan_chat_summary(dispatch)
         current_prompt = "工具执行结果:\n{tool_results}"               // :7134 ⭐ 纯文本拼接
         continue  // round += 1，回到 stream_agent_model
   ```

2. **流式 Tool Loop**：`main.rs:3948-4003`
   ```text
   for (_, (name, arguments)) in &model_tool_calls:
     run_model_tool_dispatch(name, &input).await                       // :3954 ⭐
     dispatch_plan_chat_summary(&dispatch)                             // :3955
     tool_results_text.push_str("[{name}]: {summary}\n\n")
   stream_agent_model(agent, &second_prompt, second_images).await      // :3966 round 2 文本
   ```

3. **额外一处**：`main.rs:8814-8842 run_model_tool_use_message`  
   生成给聊天室展示的 `tool-summary` 消息，也调 `run_model_tool_dispatch`。

### 1.2 `run_model_tool_dispatch` 当前实现（`:8844-8881`）

```rust
async fn run_model_tool_dispatch(name, input) -> ApiResult<ToolDispatchResponse> {
    if normalized != "tools.semantic_dispatch" && normalized != "tools_semantic_dispatch" {
        return Err(BAD_REQUEST, format!("未开放模型工具：{name}"));  // ❌ 硬白名单
    }
    let intent = input["intent"] || input["query"] || input["target"] || input.to_string();
    run_tool_dispatch(ToolDispatchRequest {
        intent, execute: Some(false), confirm_after: true, ...
    }).await
}
```

**问题**：

1. 只放行一个工具；其它全拒绝
2. 返回 `ToolDispatchResponse`（结构化 computer-use 结果），不是 `ToolOutcome`
3. 不经 `runtime_tool_execute`，不走审批 / 审计 / session grant
4. `execute: Some(false)` 强制 dry-run，即使 LLM 想写 read-only 的 `read_file` 也跑不成

### 1.3 `llm_tool_definitions()` 当前实现（`:8672-8696`）

```rust
Some(vec![ToolDefinition {
    name: "tools_semantic_dispatch",
    input_schema: { intent, execute, confirm_after, roi_radius, text, target, menu_item }
}])
```

只暴露一个工具定义，模型没法调 `read_file`、`bash`、`write_file`。

### 1.4 llm-adapter 的 ToolResult 支持

`modules/llm-adapter/packages/llm-adapter/src/types.rs`：

```rust
InputContentBlock::ToolResult {
    tool_use_id: String,
    content: Vec<ToolResultContentBlock>,   // Text | Json
    is_error: bool,
}
```

**已经原生支持**；Tool Loop 把它塞进 `messages: Vec<InputMessage>` 的下一轮即可。当前走文本拼接只是**历史路径**。

### 1.5 `ToolDispatchResponse` vs `ToolOutcome`

| 字段 | ToolDispatchResponse（旧） | ToolOutcome（新） |
| --- | --- | --- |
| 核心 | `route / status / dispatch_plan / closed_loop` | `status / output / summary_text / permission_gate / evidence` |
| 工具名 | `dispatch_plan.tool_id` | `tool_name` |
| 结构化结果 | JSON tree（action_plan / safety_gate / closed_loop 等） | 任意 JSON `output` + `summary_text` |
| 失败表达 | `Err(ApiError)` | `status = Failed/Rejected/Timeout` |

**关键 insight**：`tools_semantic_dispatch` 本质上是一个"元工具"——它接 intent 然后产出 computer-use 的 dry-run plan。这个工具**不应该消失**，它应该继续以"一个 registry 条目"的身份被暴露给 LLM；跟 `read_file`、`bash` 等并列。

## 2. 切换设计

### 2.1 分三步走

| 步骤 | 内容 | 风险 |
| --- | --- | --- |
| **C-10** `llm_tool_definitions` 从 registry 生成 | 暴露面从 1 → 20+，但 `run_model_tool_dispatch` **暂不切**——继续硬白名单 | 低：LLM 可能调非 whitelist 工具 → 落到旧 `BAD_REQUEST`，行为与旧版"用户讲 read_file 模型不会用"一致 |
| **C-11** `run_model_tool_dispatch` 内部切 `runtime_tool_execute` | 真正的权限闸门 + 审批 + 审计；对外签名与返回类型保持 | 中：改动核心路径，需要全量回归 |
| **C-12** Tool Loop 用 `InputContentBlock::ToolResult` 代替文本拼接 | 结构化回灌；并发 `join_all` | 中：多 provider 兼容性验证（部分 provider 可能不支持 ToolResult） |

### 2.2 C-10: `llm_tool_definitions` 扩张

**目标签名不变**：`fn llm_tool_definitions() -> Option<Vec<ToolDefinition>>`

**新实现**（伪代码）：

```rust
fn llm_tool_definitions() -> Option<Vec<ToolDefinition>> {
    if !llm_tools_enabled() { return None; }

    // 可选：通过 [model] llm_tool_exposure = "all" | "whitelist" | "dispatch-only" 控制
    let mode = workspace_config().model.llm_tool_exposure.clone().unwrap_or("all".into());

    let mut defs = Vec::new();

    // 1) 始终保留 tools_semantic_dispatch（元工具）
    defs.push(ToolDefinition {
        name: "tools_semantic_dispatch".into(),
        description: Some("Route intent to computer-use/vision dry-run plans...".into()),
        input_schema: /* 原 schema */,
    });

    if mode == "dispatch-only" { return Some(defs); }

    // 2) 从 registry 展开所有 mvp tool
    let registry = GlobalToolRegistry::from_plugin_tools(vec![]).unwrap_or_default();
    let allowed: BTreeSet<&'static str> = default_llm_tool_allowlist();
    for spec in tools::mvp_tool_specs() {
        if mode == "whitelist" && !allowed.contains(spec.name) { continue; }
        defs.push(ToolDefinition {
            name: spec.name.to_string(),
            description: Some(compose_description_with_permission(&spec)),
            input_schema: spec.input_schema.clone(),
        });
    }

    Some(defs)
}

fn default_llm_tool_allowlist() -> BTreeSet<&'static str> {
    // C-10 默认只开 ReadOnly：与 Phase C-3 的 ReadOnlyRegistryExecutor 对齐
    ["read_file", "glob_search", "grep_search", "WebFetch", "WebSearch",
     "Skill", "ToolSearch", "Sleep", "SendUserMessage", "StructuredOutput"]
        .into_iter().collect()
}
```

**关键决策**：

- **默认 mode = `"whitelist"`（只开 ReadOnly）**，避免 LLM 在 C-11 尚未接入前就调 `write_file` 失败。
- **`whitelist` 用静态表**：和 `ReadOnlyRegistryExecutor::from_registry()` 的筛选条件一致，保证"暴露给 LLM 的，一定是 runtime 能执行的"。
- **description 追加权限提示**：让 LLM 自我约束，例如 `read_file (Permission: read-only)` vs `bash (Permission: danger-full-access; requires user approval)`。

**测试补充**：

| TDD | 断言 |
| --- | --- |
| `llm_tool_definitions_default_mode_is_whitelist` | 默认返回 `semantic_dispatch + ReadOnly 集合` |
| `llm_tool_definitions_all_mode_exposes_all_specs` | 手动切 `all` → 返回所有 `mvp_tool_specs` 长度 + 1 |
| `llm_tool_definitions_respects_disabled_flag` | `enable_llm_tools=false` → 返回 None |

### 2.3 C-11: `run_model_tool_dispatch` 内部切 runtime

**目标：保持外部返回 `ApiResult<ToolDispatchResponse>`**，这样 Tool Loop / `run_model_tool_use_message` 都不用动。内部根据工具名分流：

```rust
async fn run_model_tool_dispatch(name: &str, input: &JsonValue)
    -> ApiResult<ToolDispatchResponse>
{
    let normalized = name.replace('-', "_");

    // 路径 A：元工具继续走老路径（semantic_dispatch → computer-use plan）
    if normalized == "tools.semantic_dispatch" || normalized == "tools_semantic_dispatch" {
        return legacy_semantic_dispatch(input).await;
    }

    // 路径 B：registry 工具走 runtime
    let outcome = invoke_through_runtime(name, input).await?;
    Ok(tool_outcome_to_dispatch_response(name, outcome))
}

async fn invoke_through_runtime(name: &str, input: &JsonValue) -> ApiResult<ToolOutcome> {
    let call_id = format!("llm-{}", unix_timestamp_millis());
    let workspace_root = active_workspace_path();
    let workspace_id = workspace_identity(&workspace_root);
    // session_id：从 current LLM turn 的 agent 拿；Tool Loop 内层需要把 agent 传进来
    let session_id = current_llm_session_id();   // 见下

    let invoke = ToolInvoke {
        call_id: call_id.clone(),
        tool_name: name.to_string(),
        input: input.clone(),
        caller: ToolCaller::Llm,                 // ⭐ LLM 来源
        workspace_id: workspace_id.clone(),
        session_id: session_id.clone(),
        user_authorized: false,
        user_confirmed_twice: false,
    };
    let grant = session_grant_view_for(&workspace_id, session_id.as_deref(), name);
    let required = required_permission_for_tool(name);
    let targets = extract_path_targets(name, input);
    let rules = effective_protected_rules();

    let exec = ReadOnlyRegistryExecutor::from_registry();
    let executors: [&dyn ToolInvocationExecutor; 1] = [&exec];
    let ctx = RuntimeToolContext {
        workspace_root: &workspace_root,
        required_permission: required,
        path_targets: targets,
        protected_rules: &rules,
        session_grant: grant,
        executors: &executors,
    };
    let outcome = runtime_tool_execute(invoke.clone(), &ctx);

    // Pending + 审计，跟 /api/tools/runtime-execute handler 保持一致
    if matches!(outcome.status, ToolOutcomeStatus::DryRunOnly)
        && outcome.permission_gate.decision.requires_ui()
    {
        enqueue_pending_approval(&call_id, &invoke, &outcome.permission_gate);
    }
    append_tool_audit_record(&invoke, &outcome);
    Ok(outcome)
}
```

**`tool_outcome_to_dispatch_response`** —— 映射层：

```rust
fn tool_outcome_to_dispatch_response(name: &str, outcome: ToolOutcome) -> ToolDispatchResponse {
    ToolDispatchResponse {
        route: match outcome.status {
            ToolOutcomeStatus::Ok => "runtime-executed",
            ToolOutcomeStatus::DryRunOnly => "runtime-dry-run",
            ToolOutcomeStatus::Rejected => "runtime-rejected",
            ToolOutcomeStatus::Failed => "runtime-failed",
            ToolOutcomeStatus::Timeout => "runtime-timeout",
        }.to_string(),
        status: outcome.status.as_str().to_string(),
        scenario: None,
        closed_loop: None,
        dispatch_plan: Some(ToolDispatchPlan {
            tool_id: name.to_string(),
            action: outcome.status.as_str().to_string(),
            target: outcome.summary_text.clone(),
            dry_run_input: outcome.output.clone(),
            llm_tool_call: ToolCallPreview { name: name.to_string(), arguments: ..., mode: "runtime".into() },
            execute_allowed: matches!(outcome.status, ToolOutcomeStatus::Ok),
            safety_gate: outcome.permission_gate.decision.as_str().to_string(),
            action_plan: None,
            requires_visual_grounding: false,
        }),
        notes: vec![outcome.summary_text],
    }
}
```

这样 `dispatch_plan_chat_summary` / `run_model_tool_use_message` 不用改，上层继续把它拼成 tool-summary 消息。

**关键决策**：

- **路径 A（semantic_dispatch）完全保留**，零回归风险；前端/测试继续 pass。
- **路径 B** 只覆盖 registry 中 ReadOnly 工具；写/危险工具此刻命中 `executors[0].handles == false` → 返回 `Failed("unknown tool")` → 映射 `route=runtime-failed`；模型看到这个结果后会尝试其它工具或退回到 semantic_dispatch。
- **`current_llm_session_id()`**：需要新增助手函数。Tool Loop 内从 `agent.id` 拿；流式路径的 `model_tool_calls` 已知 agent；非流式 `agent_chat_response` 循环的 agent 也可用。
- **审批链 vs LLM tool**：`DryRunOnly` 分支先记录 pending + 审计；但**模型侧**返回 `execute_allowed=false + summary="awaiting user approval"`，模型下一轮会说"需要你确认"。用户在前端点授权 → `session_grant_view_for` 下次命中 → LLM 再次调该工具时直接 `AllowApproved`。闭环成立。

### 2.4 C-12: Tool Loop 用 ToolResult 回灌

**目标**：把 `current_prompt = "工具执行结果：{...}"` 文本拼接改成：

```rust
// round 1 response 已有 OutputContentBlock::ToolUse
// round 2 request 要把结果以 ToolResult 塞回
let mut messages = /* round 1 assistant turn */;
let mut tool_result_blocks = Vec::<InputContentBlock>::new();
for (tool_use_id, (name, args)) in &model_tool_calls {
    let outcome = run_model_tool_dispatch(name, &input).await?;
    tool_result_blocks.push(InputContentBlock::ToolResult {
        tool_use_id: tool_use_id.clone(),
        content: vec![ToolResultContentBlock::Json {
            value: json!({
                "status": outcome.status.as_str(),
                "summary": outcome.summary_text,
                "output": outcome.output,
                "permission": outcome.permission_gate,
            }),
        }],
        is_error: matches!(outcome.status, ToolOutcomeStatus::Rejected
                         | ToolOutcomeStatus::Failed
                         | ToolOutcomeStatus::Timeout),
    });
}
messages.push(InputMessage::user_with_blocks(tool_result_blocks));
```

**并发**：若 `model_tool_calls.len() > 1`，用 `futures::future::join_all` 并发执行。`runtime_tool_execute` 本身是同步函数；包进 `tokio::task::spawn_blocking` 或直接 `async move` 即可。

**兼容性降级**：

- **provider 支持 ToolResult block**：正常走。
- **provider 不支持**（例如某些 DeepSeek 版本）：`llm-adapter` 内部在发送前把 ToolResult 平展为 `user: "Tool result: {json}"` 文本。**这个降级放在 llm-adapter 而不是 Tool Loop**，runtime 侧始终发 ToolResult。

**Phase C-12 独立 TDD**：

| TDD | 断言 |
| --- | --- |
| `tool_loop_round2_emits_tool_result_block` | 模拟 round 1 返回 1 个 ToolUse → round 2 的 messages 最后一个是 user + ToolResult block |
| `tool_loop_round2_is_error_on_rejected` | outcome=Rejected → `is_error=true` |
| `tool_loop_round2_parallel_two_calls` | 模拟 2 个 ToolUse → round 2 2 个 ToolResult，顺序稳定 |
| `tool_loop_round2_fallback_plaintext_when_provider_unsupported` | 如果引入 feature flag，可测降级路径 |

## 3. 兼容性矩阵

| 入口 | 当前行为 | C-10 后 | C-11 后 | C-12 后 |
| --- | --- | --- | --- | --- |
| `/api/tools/dispatch` | `run_tool_dispatch(body)` | 不变 | 不变 | 不变 |
| `/api/tools/execute` | computer-use execute=true | 不变 | 不变 | 不变 |
| `/api/tools/runtime-execute` | `runtime_tool_execute` + ReadOnly | 不变 | 不变 | 不变 |
| LLM tool_use（非流式） | run_model_tool_dispatch 硬白名单 | 模型**看到**更多工具；白名单外 → BAD_REQUEST 老行为 | 白名单内工具走 runtime；审批/审计生效 | 同 C-11 + 结构化 ToolResult |
| LLM tool_use（流式） | 同上 | 同上 | 同上 | 同上 |
| `run_model_tool_use_message`（聊天室消息） | 调 run_model_tool_dispatch | 不变（路径 A 回到 semantic_dispatch） | runtime 路径返回也能序列化 | 不变 |

## 4. 对外接口稳定性

**不破坏任何已发布接口**：

- `ToolDispatchResponse` 结构不变（只是部分字段走新路径时会出现 `route=runtime-executed/runtime-dry-run/...` 等新值，属于新增枚举值，旧 client 只需显示字符串即可）。
- `/api/tools/runtime-execute` 端点新增但不替换。
- `ToolDefinition` schema 不变；只是 LLM 侧看到更多工具。

**内部接口新增**（都在 web-console 内，不出 crate）：

- `invoke_through_runtime(name, input) -> ApiResult<ToolOutcome>`
- `tool_outcome_to_dispatch_response(name, outcome) -> ToolDispatchResponse`
- `current_llm_session_id() -> Option<String>`（或者把 `session_id` 从 Tool Loop 显式传下来）

## 5. 风险与回滚

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| LLM 看到 20+ 工具后一次调多个，超出上下文预算 | 中 | `max_tokens_for_model` 已有限制；description 加权限提示让模型自我约束 |
| LLM 误调 `write_file`，runtime 返回 Failed（因 executor 不 handle） | 低 | 模型会根据 `summary_text` 自我纠正；但用户体验上看是"工具不可用"。缓解：Phase C-13 接入 `WorkspaceWriteExecutor`，让写类工具走审批而不是直接 Failed |
| provider 不支持 ToolResult block | 中 | 降级放 llm-adapter；引入 `supports_tool_result()` 查询；否则退回文本拼接 |
| ReadOnly 工具的 `read_file` 被 LLM 高频调用读取全仓库 | 中 | 继续沿用 `extract_path_targets` + workspace 边界：workspace 外直接 RequireApproval；配合 Phase C-5 的 Protected 规则（`.env` 等）保护敏感文件 |
| 现有 `semantic_dispatch` 触发链（computer-use dry-run）被误导到 runtime 路径 | 低 | 路径 A 早退：`normalized == "tools_semantic_dispatch"` 短路返回 |
| 并发 join_all 暴露共享 runtime state 的并发 bug | 中 | runtime_tool_execute 目前是纯函数 + 只读 registry + 独立 SessionGrant 锁；但 `pending_approvals` / audit file append 是共享状态，需验证 |

**回滚**：每个子阶段（C-10/C-11/C-12）独立 commit + 独立备份；任何一步失败都可 `git revert` 或从 `tmp/backups/phase-c{X}-*-post/main.rs` 恢复。

## 6. 推荐执行顺序

```
C-10 (low risk) llm_tool_definitions 扩张
  → 独立 commit + 备份 + 3 TDD
  → web-console 176 target (173 + 3)

C-11 (medium risk) run_model_tool_dispatch 分流
  → 独立 commit + 备份 + 5 TDD
    - path A 保留（semantic_dispatch）
    - path B 新：模拟 LLM 调 read_file → ToolDispatchResponse.route = "runtime-executed"
    - path B 新：调 bash → "runtime-failed: unknown tool"
    - path B 新：调 write_file + path 在 workspace 外 → "runtime-dry-run" + pending 登记
    - path B 新：上一个审批通过后再调 → "runtime-executed"
  → web-console 181 target

C-12 (medium risk) Tool Loop 结构化回灌
  → 独立 commit + 备份 + 4 TDD
  → llm-adapter 的 ToolResult 降级路径如果需要，独立 crate commit
```

每个子阶段 commit message：

```
feat(tool-calling): phase-c10 llm_tool_definitions 从 registry 生成
feat(tool-calling): phase-c11 run_model_tool_dispatch 走 runtime_tool_execute
feat(tool-calling): phase-c12 Tool Loop 用 ToolResult block 回灌
```

## 7. 完成后需求状态（预期）

| REQ | Phase C-8 止 | Phase C-10 止 | Phase C-11 止 | Phase C-12 止 |
| --- | --- | --- | --- | --- |
| REQ-TOOL-007 | 25% | 45% | 85% | **100%** |
| REQ-TOOL-008 | 90% | 90% | **100%**（LLM tool_use 也走审批面板） | 100% |
| REQ-TOOL-009 | 100% | 100%（LLM tool 也落审计） | 100% | 100% |
| REQ-TOOL-010 | 100% | 100% | 100% | 100% |
| REQ-TOOL-011 | 0% | 0% | 0% | 0%（Phase D 再做） |
| REQ-CORE-TOOL-001 | 30% | 40% | 60% | 70%（CLI/MCP 余下） |

**整体 tool-calling 完成度**：60% → 65% → 80% → **92%**

## 8. 不做什么

本轮明确**不做**：

- REQ-TOOL-011 超时 / 并发信号量：需要改 `tools::execute_tool`（注入 timeout），涉及 tool-registry crate，放 Phase D
- CLI / MCP 入口切换：REQ-CORE-TOOL-001 剩余部分，与本轮 Web GUI 切换独立
- `WorkspaceWriteExecutor` / `DangerExecutor`：先验证 ReadOnly 链路闭环，再扩写类，Phase C-13+
- 多 provider 兼容性矩阵测试：等 C-12 落地后单独交互验收
- 前端 tool-use 悬浮提示（"模型正在调用 X 工具"）：UI 增强放 Phase D

## 9. 交付物清单

本分析文档本身是交付物。Phase C-10 开工前需要：

- [x] 读完方案文档 §4.1 T2/T3/T4
- [x] 确认 llm-adapter 支持 `InputContentBlock::ToolResult`
- [x] 确认 `runtime_tool_execute` / `ReadOnlyRegistryExecutor` / `required_permission_for_tool` / `extract_path_targets` / `effective_protected_rules` / `session_grant_view_for` / `enqueue_pending_approval` / `append_tool_audit_record` 全部可用
- [x] 确认现有 `run_model_tool_dispatch` / Tool Loop 两条路径 + `run_model_tool_use_message` 调用点清单
- [ ] Phase C-10 启动：按 §2.2 改 `llm_tool_definitions`，补 3 TDD

## 10. 给后续 agent 的提醒

1. **路径 A 的保留是硬要求**：`tools_semantic_dispatch` 已经是 GUI + 测试 + 前端多处依赖的 API，不要删；作为一个 registry 条目和其它工具并列即可。
2. **`ReadOnlyRegistryExecutor::from_registry()` 已是权威 executor 过滤器**：C-10 的 `default_llm_tool_allowlist()` 必须和它的过滤条件（`PermissionMode::ReadOnly`）对齐。未来扩充写类 executor 时，两处同步更新，避免"暴露了但执行不了"的不一致。
3. **`session_id` 的传递**：LLM Tool Loop 里 `agent.id` 就是 session_id；沿着调用栈一路带下来，不要回头查全局 `active_session_id`，否则并发请求会相互污染。
4. **`append_tool_audit_record` 和 `enqueue_pending_approval` 的顺序**：先 enqueue 再 append，跟 `/api/tools/runtime-execute` 保持一致；审计先落 pending 状态，前端收到 SSE 时 audit 里也能查到。
5. **`diag!` 前缀**：`[TOOL-LOOP]` / `[TOOL-LOOP-STREAM]` / `[TOOL-EXEC]` / `[TOOL-GATE]` / `[TOOL-AUDIT]` 均已约定，新代码沿用。

---

下一步：Phase C-10 按 §2.2 落地，独立 commit。
