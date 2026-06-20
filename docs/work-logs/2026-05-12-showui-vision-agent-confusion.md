# 2026-05-12 - ShowUI Grounding 与 Vision Agent 职责混淆分析

## 问题发现
总览卡片视觉 Agent 下拉框显示异常，追溯发现 ShowUI (grounding 模型) 和云端视觉理解模型 (vision agent) 在代码中被混用。

## 正确架构定义

| 角色 | ShowUI (grounding) | 视觉 Agent (理解) |
|------|--------------------|--------------------|
| **用途** | 坐标识别（找按钮位置） | 图片/视频内容理解 |
| **模型** | showui-2b (2B参数) | glm-4.6v-flash、gpt-4o 等云端多模态 |
| **服务地址** | localhost:8000/v1 (固定) | 云端 API (用户配置) |
| **用户可见** | ❌ 不可见，纯后端工具 | ✅ 总览卡片下拉可选 |
| **配置持久化** | 不存储 (固定默认值) | 作为会话保存到 SQLite |
| **API调用方式** | `run_vision_grounding_model()` | `vision_session_config()` |
| **关联需求** | REQ-CU/REQ-TOOL (computer-use) | REQ-VIS (视觉理解) |

## 不符合点详细分析

### 问题 1: `system-vision-agent` 语义混淆
**位置**: `main.rs:13065-13084`

```rust
AgentSessionDto {
    id: "system-vision-agent",
    name: "system-vision-agent",
    display_name: "系统视觉 Agent",      // ← 暗示是"视觉理解Agent"
    model: showui-2b,                    // ← 但用的是grounding模型
    model_type: "vision",                // ← 标记为vision类型
    provider: "本地视觉",
    base_url: http://127.0.0.1:8000/v1, // ← ShowUI端口
    selectable: false,
    system: true,
}
```

这个实体将 grounding 后端（ShowUI）包装成了"视觉Agent"。`display_name="系统视觉 Agent"` 和 `model_type="vision"` 让下游代码将其当作视觉理解模型处理。实际上它只是一个坐标识别工具。

**影响**: 这个实体被 `build_overview_metrics()` 作为 visual agent 候选，导致总览面板可能显示 ShowUI 作为视觉 Agent。

### 问题 2: 回退逻辑暴露 ShowUI
**位置**: `main.rs:13095-13103`

```rust
let vision_agent = agents
    .iter()
    .find(|agent| agent.selectable && agent.enabled && is_multimodal_agent(agent))
    .or_else(|| {
        agents
            .iter()
            .find(|agent| agent.id == "system-vision-agent" && agent.enabled)
    })
    .map(overview_vision_agent_from);
```

当用户未配置多模态会话时，自动回退到 `system-vision-agent`（ShowUI）。这导致：
- 新用户首次打开时看到"系统视觉 Agent · showui-2b"
- 用户误以为 showui-2b 是图片理解模型
- showui-2b 实际只能做坐标定位，无法描述屏幕内容

**影响**: 用户体验混乱，且 grounding 工具暴露给用户。

### 问题 3: `is_multimodal_agent()` 包含 "showui"
**位置**: `main.rs:13139`

```rust
["vision", "vl", "glm-4.1v", "glm-4v", "qwen2.5-vl",
 "showui",     // ← 不应该在这里！
 "multimodal", "image", "视觉", "多模态"]
```

showui 是 grounding 模型，不是多模态理解模型。如果用户在会话名/model/provider 字段中包含 "showui" 字符串，会被误判为视觉理解 Agent。

### 问题 4: 前端渲染了系统视觉 Agent
**位置**: `app.js:526` (我新加的代码)

```js
// system vision agent (ShowUI)
const sysOpt = document.createElement("option");
sysOpt.value = "system-vision-agent";
sysOpt.textContent = "系统视觉 Agent (ShowUI)";  // ← 不应渲染
```

这是我在修复下拉框时引入的错误——我假设 `system-vision-agent` 是一个合法的视觉 Agent 选项。根据架构，ShowUI 应该完全不可见。

### 问题 5: 概览不查询用户保存的会话
**位置**: `main.rs:13090`

```rust
fn build_overview_metrics() -> OverviewMetrics {
    let agents = default_agent_sessions();  // ← 只用硬编码列表
```

`default_agent_sessions()` 返回硬编码的 Agent 列表，不包含用户在 SQLite 中保存的视觉会话（如 glm-4.6v-flash 配置）。因此用户保存的多模态会话永远不会出现在总览下拉框中。

**正确做法**: 视觉 Agent 下拉应从 `session_store().state.sessions` 中筛选 `model_type == "vision" || "multimodal"` 的 `selectable && enabled` 会话。

## 修复方向

1. **拆分 `system-vision-agent`**: 
   - 保留 grounding 用途（内部使用，不暴露）
   - 视觉 Agent 下拉不再包含它
2. **`build_overview_metrics()`**: 
   - 改为从 `session_store().state.sessions` 查询用户保存的视觉会话
   - 移除对 `system-vision-agent` 的回退
3. **`is_multimodal_agent()`**: 移除 `"showui"` 关键词
4. **前端 `renderVisionAgentSelect()`**: 移除 ShowUI 选项，只显示用户保存的视觉会话
5. **`overviewVisionAgentLabel`**: 保留，用于显示选中项

## 相关文件
- `main.rs:13065-13147` (system-vision-agent, build_overview_metrics, is_multimodal_agent)
- `app.js:515-543` (renderVisionAgentSelect)
- `app.js:507-512` (overviewVisionAgentLabel)
- `index.html:24-29` (overview 视觉 Agent 元素)
