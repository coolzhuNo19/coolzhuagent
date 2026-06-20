# ShowUI Grounding 与 Vision Agent 职责分离调整方案

文档版本：v1.0  
创建日期：2026-05-12  
触发来源：`docs/work-logs/2026-05-12-showui-vision-agent-confusion.md` 暴露的职责混淆  
关联需求：REQ-VIS-001（视觉理解）、REQ-VIS-006（Vision Tool Service）、REQ-WEB-OVERVIEW-001（总览卡片）、REQ-CU / REQ-TOOL（computer-use / grounding）  
状态：方案，待 Phase E 落地实施

本文件只产方案，代码由后续 Phase E1/E2/E3 分别实现。

---

## 0. 背景与结论

work-log `2026-05-12-showui-vision-agent-confusion.md` 定位到代码把两类**语义完全不同**的实体当一回事：

| 维度 | Grounding Backend（ShowUI 等） | Vision Understanding Agent（GLM-4.6V / GPT-4o 等） |
| --- | --- | --- |
| 用途 | 坐标识别（返回点/框） | 图片/视频/截图内容理解 |
| 生命周期 | 进程内后端工具，用户不可见 | 用户创建的会话，可多选可持久化 |
| 服务位置 | 本地固定端点 `localhost:8000/v1` | 云端 provider 或本地多模态端点 |
| 配置来源 | `[vision.router.local_vlm]` / `default_local_vision_*` | `PersistedSession`（SQLite）+ 会话 api_key |
| 对外 ID | 无；内部 backend_id | `session.id`（用户选择） |
| 调用入口 | `run_vision_grounding_model` / GroundingRouter | `run_vision_describe_screen_model` / vision_session_config |

**真正的问题不是 1 条 bug**，而是这两个概念在 DTO、下拉选择、路由逻辑里共用同一个 `AgentSessionDto` 与同一个"视觉 Agent"标签，架构上必须拆开，否则未来 Remote VLM backend 接入、多 grounding backend 轮换都会继续踩同一个坑。

**结论**：  
**不要只打补丁**。需要做一次**架构级职责分离 + DTO 拆分 + API 面向稳定**，否则每次新增/修复都会撞回这个耦合点。下面是可落地方案。

---

## 1. 目标架构

```
┌──────────────────────── Web API（对外稳定面）──────────────────────┐
│                                                                    │
│  视觉理解（Vision Understanding）                                   │
│   • GET  /api/agents                                              │
│   • POST /api/sessions   → model_type="vision"                    │
│   • GET  /api/config/vision-agent       # active_vision_session   │
│   • POST /api/config/vision-agent       # 切换                    │
│                                                                    │
│  视觉落点（Grounding / Vision Tool Service）                       │
│   • GET  /api/vision/locate/backends    # 只列 backend 健康状态    │
│   • POST /api/vision/locate                                       │
│   • POST /api/vision/locate/verify                                │
│   • POST /api/vision/find-target        # 旧 REQ-VIS-001 入口保留 │
│   • POST /api/vision/describe-screen    # 走 vision_session 配置  │
│                                                                    │
│  总览（Overview）                                                   │
│   • GET  /api/state → overview.active_vision_session（绝不回退 ShowUI）│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌───────────────────────────┐      ┌───────────────────────────────┐
│  UnderstandingAgent       │      │  GroundingBackend             │
│  （用户拥有，可选，可持久化）  │      │  （进程内资源，不可见）         │
│  来自 session_store       │      │  配置来自 coolzhu.toml         │
│  model_type ∈ {vision,    │      │  backend ∈ {uia, local_vlm,   │
│                multimodal}│      │             remote_vlm}       │
└───────────────────────────┘      └───────────────────────────────┘
```

用一句话说清边界：**用户能在总览里"选"的 agent 必须是 UnderstandingAgent；GroundingBackend 绝不出现在任何"选 agent"的下拉**。

---

## 2. 数据契约拆分

### 2.1 新 DTO：`UnderstandingAgentDto`

放 `modules/gui-web/packages/web-console/src/main.rs`（或后续抽到 `core-runtime`）：

```rust
/// REQ-VIS-001 Phase E：视觉"理解"Agent。由 session_store 中 model_type 为
/// vision / multimodal / video（后续扩展）的 PersistedSession 直接投影而来。
///
/// 与 `AgentSessionDto` 区别：
/// - 不含 `system=true` 保留项（没有内置系统版本）
/// - 不含 `selectable=false` 选项（出现即意味着可选）
/// - 明确携带 `capabilities`，供总览按场景过滤
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnderstandingAgentDto {
    pub session_id: String,
    pub display_name: String,
    pub provider: String,
    pub model: String,
    pub model_type: String,                       // vision | multimodal | video
    pub base_url: Option<String>,
    pub api_key_status: String,                   // present | missing
    pub capabilities: UnderstandingCapabilities,
    pub active: bool,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UnderstandingCapabilities {
    pub describe_screen: bool,
    pub analyze_image: bool,
    pub analyze_video: bool,
    pub multimodal_chat: bool,
}
```

### 2.2 新 DTO：`GroundingBackendHealth`

```rust
/// Grounding backend 只对"管理员诊断"可见；用户用不到它，总览不含。
#[derive(Debug, Clone, Serialize)]
pub struct GroundingBackendHealth {
    pub backend: String,              // uia | local-vlm | remote-vlm
    pub status: String,               // ready | disabled | unreachable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,      // "Windows 11 22631" / "showui-2b"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}
```

这个结构**已经**在 `GET /api/vision/locate/backends` 有约等形式（见 C-9 audit §E3）。Phase E 只是正式 codify。

### 2.3 `AgentSessionDto` 的收敛

`default_agent_sessions()` 里那个 `system-vision-agent` 条目（main.rs:13065-13084）**删掉**。理由：

1. 它不是用户可见的 session，却被 `default_agent_sessions` 一视同仁返回；
2. `build_overview_metrics` 能回退到它，让 "user 没配多模态 → 界面出现 ShowUI" 的 UX 漏洞常态化；
3. grounding 调用链已经**不依赖**这个 DTO —— `run_vision_grounding_model` 直接用 `default_local_vision_base_url()` / `default_local_vision_model()` / `authoritative_local_vision_api_key()`（见 main.rs:5361），和 `AgentSessionDto` 没关系。

删除后 `default_agent_sessions` 只含 `system-conversation-agent` / `system-tool-agent` 两个真·系统 agent，以及用户 session。

---

## 3. 端点调整

### 3.1 `GET /api/state` 的 overview 字段（REQ-WEB-OVERVIEW-001）

当前 `build_overview_metrics`（main.rs:13089）流程：

```rust
agents.iter().find(is_multimodal_agent)
      .or_else(|| agents.iter().find(id == "system-vision-agent"))  // ← 删
      .map(overview_vision_agent_from)
```

新流程：

```rust
fn build_overview_metrics() -> OverviewMetrics {
    let agents = default_agent_sessions();       // 不含 system-vision-agent
    let store = session_store().lock().ok();
    let active_vision_session_id =
        store.as_ref().and_then(|s| s.state.active_vision_session_id.clone());

    let vision_agent = store.as_ref().and_then(|s| {
        // 1) 优先用 active_vision_session_id
        if let Some(id) = &active_vision_session_id {
            if let Some(session) = s.state.sessions.iter().find(|x| &x.id == id) {
                return Some(overview_from_persisted(session, true));
            }
        }
        // 2) 回退：挑第一个 model_type 是 vision/multimodal 的会话
        s.state.sessions.iter()
            .find(|session| is_understanding_model_type(&session.model_type))
            .map(|session| overview_from_persisted(session, false))
    });
    // ⚠️ 绝不回退到 system-vision-agent
    OverviewMetrics { ..., vision_agent }
}

fn is_understanding_model_type(mt: &str) -> bool {
    matches!(mt, "vision" | "multimodal" | "video")
}
```

`is_multimodal_agent` 留着但**只服务于** chat dispatch 的路由判断（如"消息里有图片走多模态 agent"），与总览下拉无关。并从其关键词列表里**移除 `"showui"`**（main.rs:13139）。

### 3.2 新端点 `GET /api/agents/understanding`

暴露干净的 `UnderstandingAgentDto[]`，前端总览下拉直接消费：

```http
GET /api/agents/understanding

Response:
{
  "agents": [ UnderstandingAgentDto, ... ],
  "active_session_id": "ses-xxx" | null
}
```

`POST /api/config/vision-agent` 保留（已存在），body `{session_id}`，用于切换 active；切换后 SSE 广播 `overview-vision-agent-changed`，前端不用轮询。

### 3.3 新端点 `GET /api/vision/grounding/backends`

重命名现有 `GET /api/vision/locate/backends` 为语义更准确的 `GET /api/vision/grounding/backends`（保留 `/locate/backends` alias 做向后兼容，两者同 handler）。响应是 `Vec<GroundingBackendHealth>` —— **不再与 UnderstandingAgent 混淆**。

### 3.4 保留既有视觉理解入口

- `POST /api/vision/describe-screen` 继续走 `vision_session_config()`（用户选定的 understanding agent）。不变。
- `POST /api/vision/find-target` 继续走 `run_vision_grounding_model()`（本地 ShowUI 固定路径）。不变。
- 前端如果要"让 LLM 描述当前屏幕"，走 describe-screen；"点击某个按钮"走 locate / find-target 或新 `runtime-execute`。**两个入口在文档上明确区分**。

---

## 4. 前端调整

### 4.1 `renderVisionAgentSelect(activeVisionAgent)` （app.js:515）

```js
function renderVisionAgentSelect(activeVisionAgent) {
  const select = document.querySelector('[data-role="overview-vision-agent"]');
  if (!select) return;
  select.replaceChildren();

  // 默认选项
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "未配置";
  select.append(noneOpt);

  // ❌ 删除 system-vision-agent 选项

  // 只列用户保存的 vision / multimodal session
  // 数据从新端点 /api/agents/understanding 拉，或沿用 sessionRegistry
  const sessions = understandingAgents || [];
  sessions.forEach((agent) => {
    const opt = document.createElement("option");
    opt.value = agent.session_id;
    opt.textContent = `${agent.display_name} (${agent.model})`;
    select.append(opt);
  });

  select.value = activeVisionAgent?.session_id ?? "";
}
```

即便用户没配多模态会话，下拉也只显示"未配置"；**永远不显示 ShowUI**。

### 4.2 新增"Grounding 诊断" tab（仅管理员视角）

位置：工具卡片 / 诊断面板内。拉 `/api/vision/grounding/backends` 展示 backend 健康状态（ready / disabled / unreachable）。这是把 ShowUI 暴露给用户的**唯一合法位置**—— 且语义是"工具诊断"不是"可选 agent"。

### 4.3 用户引导

总览"未配置"时给一条 tip：

> 视觉 Agent 用于图片/截图理解。点击"会话管理"新建会话，选择 GLM-4.6V-Flash / GPT-4o / Qwen-VL-Max 等多模态模型。

不要暗示用户"ShowUI 可以当视觉 Agent"。

---

## 5. Grounding Backend 管理侧的清理

顺便把 grounding 侧也 codify：

1. `default_local_vision_base_url()` / `default_local_vision_model()` / `authoritative_local_vision_api_key()` 三函数集中到 `grounding_backend.rs`（新模块，在 web-console 或 vision-service），对外只暴露 `fn local_grounding_config() -> LocalGroundingConfig`。
2. Phase E 后的 `GroundingRouter`（precise-click-grounding-plan §E1）从该模块读配置，不再散落 env var 直接访问。
3. `ConfigVisionRouter` 终于挂入 `ConfigVision`（修 C-9 audit 提到的 silent config bug）。

---

## 6. 分阶段落地

| Phase | 范围 | 风险 | TDD 建议 |
| --- | --- | --- | --- |
| **E1**（低风险）| 删 `system-vision-agent`；`is_multimodal_agent` 移除 `"showui"`；`build_overview_metrics` 改查 `session_store` | 单文件、测试覆盖总览指标 | 3 条：总览不含 ShowUI / 无多模态会话时 `vision_agent=null` / 有多模态会话按 active_vision_session_id 挑选 |
| **E2**（中风险）| 新 DTO `UnderstandingAgentDto` + `UnderstandingCapabilities`；新端点 `GET /api/agents/understanding`；前端 `renderVisionAgentSelect` 切到新数据源；删 `system-vision-agent` 下拉选项 | 前端数据面变化 | 3 条：serde 双向；端点按 model_type 筛选；active 切换广播 |
| **E3**（中风险）| `GET /api/vision/grounding/backends` + 保留 `/locate/backends` alias；诊断面板 UI；`GroundingBackendHealth` DTO | 可选增强 | 2 条：端点返回不含 session_id；alias 行为一致 |
| **E4**（独立）| grounding 配置集中到 `grounding_backend.rs`；`ConfigVisionRouter` 挂入 `ConfigVision` | 架构清理，和 precise-click grounding plan 合并推进 | 与 Grounding Phase B/C 并轨 |

**E1 ~ E2** 一起做就能解决 work-log 里全部 5 个问题点；E3/E4 属于长期清理。

---

## 7. 回滚与兼容

| 兼容点 | 策略 |
| --- | --- |
| 既有 `/api/state.overview.vision_agent` 响应结构 | 字段保持；只是不再可能等于 "system-vision-agent" |
| 既有 `POST /api/config/vision-agent` | 不变 |
| `/api/vision/find-target` | 不变，继续走本地 ShowUI |
| `/api/vision/describe-screen` | 不变，继续走 vision_session_config |
| `/api/vision/locate/backends` | 保留为 `/api/vision/grounding/backends` 的 alias |
| `AgentSessionDto` 结构 | 字段不变；`default_agent_sessions()` 长度 3→2 |
| 前端 localStorage `active_vision_agent_id` | 删除 `"system-vision-agent"` 值（迁移到 ""），一次性 migration 就在首次加载触发 |

回滚：任何一步出问题都可 `git revert` 单 commit；**配置层无需回退**，因为本方案没改 `coolzhu.toml` schema（E4 单独开 commit 再改 `[vision.router]` 嵌入）。

---

## 8. TDD 矩阵（E1/E2 重点）

| 测试 | 断言 |
| --- | --- |
| `overview_metrics_omits_system_vision_agent_when_no_user_session` | 空 session_store → `overview.vision_agent == null` |
| `overview_metrics_picks_active_vision_session_from_store` | `active_vision_session_id="ses-a"` → 对应 session 出现在 overview |
| `overview_metrics_falls_back_to_first_vision_session_when_no_active` | 不再 fallback 到 `system-vision-agent`；而是选第一个 `model_type=vision` 会话 |
| `is_multimodal_agent_does_not_match_showui_model` | `model="showui-2b"` → false |
| `default_agent_sessions_does_not_include_system_vision_agent` | 列表长度 = 2；不存在 id=`system-vision-agent` |
| `understanding_agents_endpoint_lists_user_vision_sessions_only` | 用户保存 2 个 vision + 3 个 text → 返回 2 条，全是 UnderstandingAgentDto |
| `understanding_agents_endpoint_returns_empty_on_no_vision_sessions` | 无多模态 session → `{agents:[], active_session_id:null}` |
| `grounding_backends_endpoint_contains_no_session_id` | 响应 JSON 不含 `session_id` 字段（断言字符串） |
| `grounding_backends_alias_locate_backwards_compat` | GET `/api/vision/locate/backends` 与 `/api/vision/grounding/backends` 返回相同内容 |

---

## 9. 关联文档与需求

| 文档 | 关系 |
| --- | --- |
| `docs/work-logs/2026-05-12-showui-vision-agent-confusion.md` | 本方案的问题来源 |
| `docs/precise-click-grounding-plan-2026-05-10.md` | Phase E4 合并推进；`ConfigVisionRouter` 挂 `ConfigVision` 的遗留 |
| `docs/work-logs/2026-05-11-precise-click-grounding-audit.md` | 指出 `api_tool_execute` 仍走硬编码锚点、`ConfigVisionRouter` silent 失效等关联遗留 |
| `docs/requirements-management.md` | 需补一条 REQ-VIS-008（grounding vs understanding 职责分离）状态：待开发 P1 |
| `docs/interface-contracts.md` | 新 DTO `UnderstandingAgentDto` / `GroundingBackendHealth` 进稳定接口清单 |

---

## 10. 给下一任 agent 的提醒

1. **E1 是纯重构**：只改 3 个函数 + 删 1 条硬编码。用 `config_test_guard()`（Phase C-5 已建立）串行化新总览测试，避免 session_store 污染。
2. **不要在 E1 就动前端**：先让后端 `vision_agent` 逻辑正确，再做 E2 前端切换；E1 的验收是"现有前端 render 旧数据源也不会错误地回退到 ShowUI"。
3. **`capabilities` 字段是 forward-looking**：E2 落地时可以先全部 `false`，保持结构；具体 capability 由 model_catalog 表（`llm-adapter` 未来功能）反查。
4. **`is_multimodal_agent` 的命运**：它应该只活在 chat dispatch "消息里有图片自动路由到多模态 agent" 这一个业务场景。Phase E 之后要再审视它是否可以直接用 `session.model_type` 判断。
5. **诊断面板不等于用户下拉**：坚持这个边界 —— 只要"选 agent"的 UI 就走 UnderstandingAgentDto；"看 backend 是否健康"的 UI 才走 GroundingBackendHealth。

---

结论：这是一次值得做的**架构调整**，不是局部打补丁。E1+E2 一次落地就能彻底消除 work-log 列出的 5 个问题点；E3/E4 作为清理项择机合并到 Grounding Plan 落地。整体工作量 ≤ 3 天，风险极低，对外 API 面完全向后兼容。
