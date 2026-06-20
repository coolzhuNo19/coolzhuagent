# 任务12（上下文自动 compact + 模型能力表）与任务13（MCP/CLI 落地）实施方案

> 状态：方案就绪，代码待执行。本轮工具环境出现**文件读取渲染降级**（Read/PowerShell 输出被截断、
> 行重复、插入"见上文"等），无法可靠读取 1.36 MB `main.rs` 来锚定外科式编辑。仓库有
> `main-rs-corrupted` 损坏前科，故暂不在读不可靠时强改巨型文件。下列方案锚点明确、改动最小，
> 待读取恢复即可逐条应用。

---

## 任务12：上下文自动 compact + 模型能力表

### A. 数据源（已确认存在，无需新写）
- `api::model_token_limit(model) -> ModelTokenLimit { context_window, max_output_tokens }`
  （llm-adapter/providers/mod.rs:127；context_window 例：glm-4.6/glm-5=200k，deepseek/grok/qwen=131072，claude=200k，默认 128k）。
- `api::context_tokens_for_model(model)`、`api::max_tokens_for_model(model)`、`api::provider_catalog()`。
- 思考程度合法值（`normalize_reasoning_effort`，main.rs:23406）：`minimal | low | medium | high | max | none`。
- 压缩（core-runtime/compact.rs，**已写好未接 web**）：`should_compact(session, cfg)`、`compact_session(session, cfg)`、
  `CompactionConfig { preserve_recent_messages:4, max_estimated_tokens:10_000 }`、`estimate_session_tokens`。

### B. 模型能力表（新增 API，附加式、低风险）
新增 DTO + handler（建议放在 `normalize_reasoning_effort` 之后，避免穿插既有逻辑）：
```rust
#[derive(Serialize)]
struct ModelCapabilityDto {
    provider: String,
    model: String,
    context_window: u32,
    max_output_tokens: u32,
    reasoning_options: Vec<String>,   // 该模型可选思考程度
    supports_reasoning: bool,
}

fn model_reasoning_options(model: &str) -> (Vec<String>, bool) {
    let m = model.to_ascii_lowercase();
    // 具备显式思考档位的模型给全档；纯指令模型给 none/medium
    let thinking = m.contains("glm-5") || m.contains("deepseek") || m.contains("claude")
        || m.contains("grok") || m.contains("qwen") || m.contains("o1") || m.contains("o3");
    if thinking {
        (["minimal","low","medium","high","max"].iter().map(|s| s.to_string()).collect(), true)
    } else {
        (["none","medium"].iter().map(|s| s.to_string()).collect(), false)
    }
}

async fn api_model_capabilities() -> Json<Vec<ModelCapabilityDto>> {
    let mut out = Vec::new();
    for meta in api::provider_catalog() {
        for m in meta.models.iter() {
            let name = m.to_string();
            let limit = api::model_token_limit(&name);
            let (reasoning_options, supports_reasoning) = model_reasoning_options(&name);
            out.push(ModelCapabilityDto {
                provider: meta.label.to_string(),
                model: name,
                context_window: limit.context_window,
                max_output_tokens: limit.max_output_tokens,
                reasoning_options,
                supports_reasoning,
            });
        }
    }
    Json(out)
}
```
路由（锚点 `.route("/api/audio/status", get(api_audio_status))` 之后追加一行）：
```rust
.route("/api/models/capabilities", get(api_model_capabilities))
```

### C. 前端查表显示（app.js + index.html）
- 会话配置表单选择 model 时，`fetch('/api/models/capabilities')`（启动时拉一次缓存）→ 按 model 查表：
  - 显示「上下文容量：200k tokens / 最大输出：128k」。
  - 思考程度下拉的选项 = 该 model 的 `reasoning_options`；`supports_reasoning=false` 时禁用并显示"该模型无显式思考档"。
- 现有 `reasoning_effort` 持久化链路（session CRUD，73 处）不变，仅前端约束可选项。

### D. 自动 compact 接入 web 聊天链路（结合记忆摘要）
当前 `build_context_assembly_with_roster` 是「按 token 预算从最新往回收历史 + 价值记忆」，超预算**直接丢弃**旧史。改造：
1. 在组装历史前，若 `估算历史 tokens >= 触发阈值`（取 `context_window * 0.7` 与 `CompactionConfig.max_estimated_tokens` 的较小值），
   对**超出 preserve_recent 的旧史**调用 compaction 生成滚动摘要。
2. 摘要复用 `compact.rs` 的 `summarize_messages`/`compact_session` 思路；web 侧消息结构是 `PersistedChatMessage`，
   需一个适配：把旧史转 `runtime::Session` → `compact_session` → 取 `formatted_summary`。
   - 若不想转换，落地更轻的做法：把超预算旧史用现有 `compactGoalText`/摘要器压成一条 `[历史摘要]` system 注入，
     并**沉淀为一条高 kind 权重的 bead**（L3，kind="decision"/"result"），与任务9 的价值老化联动——
     重要历史以摘要 bead 留存而非丢弃。
3. token 预算真正驱动：`history_token_budget`/`memory_token_budget` 由所选 model 的 `context_window` 动态推导
   （如 history=context*0.4，memory=context*0.15），替代当前写死的 3000/1200。

### E. 验证
- `cargo build -p coolzhu-web-console`；`curl /api/models/capabilities` 返回各模型 context/efforts；
- 构造超长历史的会话，断言响应里出现 `[历史摘要]` 且未超预算；记忆窗口出现摘要 bead。

---

## 任务13：MCP/CLI 落地

### A. 现有积木（已存在）
- `runtime::McpClientBootstrap::from_scoped_config`、`McpClientTransport::from_config`、`McpClientAuth::from_oauth`。
- `runtime::spawn_mcp_stdio_process` + `JsonRpcRequest/Response/Error/Id`（stdio JSON-RPC）。
- 配置：`config.mcp().servers()` → `ScopedMcpServerConfig`（stdio/remote/ws/sdk/proxy）。
- 工具命名：`mcp_tool_name(server, tool)`、`mcp_tool_prefix`、`normalize_name_for_mcp`。

### B. 后端：MCP 客户端运行时 + 路由（新增，附加式）
1. 进程级 MCP 管理器（`OnceLock<Mutex<McpRuntime>>`，仿 `showui_service_process`）：
   - `connect(server_name)`：`McpClientBootstrap::from_scoped_config` → `spawn_mcp_stdio_process` →
     发 `initialize` → `tools/list`，缓存 `{server -> [tool defs]}` 与子进程句柄。
   - `call(server, tool, args)`：发 `tools/call` JSON-RPC，返回结果。
   - `disconnect(server)`：kill 子进程。
2. 路由（新增）：
   - `GET /api/mcp/servers`：列出 `config.mcp().servers()` + 连接状态（已连/未连/错误）+ transport。
   - `POST /api/mcp/servers/{name}/connect` / `.../disconnect`。
   - `GET /api/mcp/servers/{name}/tools`：该 server 暴露的工具清单。
   - `POST /api/mcp/servers/{name}/tools/{tool}/call`：调用（走现有权限闸门 + 审计链路）。
3. **工具融合**：把 MCP 工具以 `mcp_tool_name(server,tool)` 注入现有 tool registry/dispatch，
   让模型能像调内置工具一样调 MCP 工具（复用 `runtime_tool_execute` 审计）。

### C. 前端：MCP 面板（终端窗口或设置内新增 tab）
- 列出 server（名称/transport/状态灯）+「连接/断开」按钮。
- 展开显示该 server 的工具清单（名称/描述）+「试调用」表单。
- 状态来源 `/api/mcp/servers`，红/绿/灰状态灯，与既有风格一致。

### D. CLI 接入（P2）
- 短期：前端「CLI 面板」用命令模板复用 `/api/tools/runtime-execute` 执行 `coolzhu-cli ...`，输出回终端窗口。
- 长期：CLI 与 web 共享同一 agent core（统一会话/记忆/工具后端），消除双入口能力漂移。

### E. 验证
- `cargo build`；配置一个 stdio MCP server（如 filesystem），`/api/mcp/servers/{n}/connect` →
  `/tools` 返回工具；`/tools/{t}/call` 真实调用成功；前端面板状态灯绿。

---

## 应用顺序建议（读取恢复后）
1. 任务12-B/C（模型能力表 API + 前端查表）：最附加、最低风险，先做。
2. 任务12-D（自动 compact + 预算动态化）：中等改动，注意 `build_context_assembly_with_roster` 锚点。
3. 任务13-B（MCP 运行时 + 路由）：较大，但全是新增函数/路由，不改既有逻辑。
4. 任务13-C/D（前端面板 / CLI）：UI 增量。

每步遵循：改前 Read 确认锚点 → 小步 Edit → `cargo build` 验证 → 关键链路 `cargo test` → HTTP 实测。
