# 2026-05-10 - 多工具调用适配现状

## 当前状态的约束

### 已存在但未打通
- `GlobalToolRegistry` (`modules/tooling/packages/tool-registry/src/lib.rs`) 已注册 21 个内置工具
- 每个工具有 `ToolSpec` (name, description, input_schema, required_permission)
- `execute_tool()` 函数已可执行所有工具 (bash→run_bash, Skill→run_skill, 等)
- Plugin 系统已可加载 MCP 插件并注册为额外工具

### 当前卡点
- `llm_tool_definitions()` (main.rs:7728) 只输出 1 个工具: `tools_semantic_dispatch`
- `run_model_tool_dispatch()` (main.rs:7900) 白名单只放行 `tools_semantic_dispatch`
- `ToolDispatchRequest` (main.rs:12147) 只有 intent/target 等 computer-use 字段，无法承载多工具参数
- TOOL-LOOP-STREAM 的结果回传只适配了 computer-use dry-run 格式

### 权限分级现状
- 每个 ToolSpec 已有 `required_permission` 字段:
  - `ReadOnly` → read_file, glob, grep, Skill, WebFetch, WebSearch, etc.
  - `WorkspaceWrite` → write_file, edit_file, TodoWrite, Config, etc.
  - `DangerFullAccess` → bash, PowerShell, REPL, Agent
- workspace 边界已通过 `workspace_id` 和 `allowed_workspace_roots` 定义

## 设计方案 (已确认)

### REQ-TOOL-007: LLM 多工具调用适配
1. `llm_tool_definitions()` → 读取 `GlobalToolRegistry.mvp_tool_specs()` 全部 21 个
2. `run_model_tool_dispatch()` → 移除白名单，直接调用 `GlobalToolRegistry.execute(name, args)`
3. TOOL-LOOP-STREAM → 非 computer-use 工具结果打包为 ToolResult 回传 LLM
4. `AgentSessionDto` 增加 `allowed_tools: Vec<String>` 过滤字段 (可选)

### REQ-TOOL-008: 工具权限分级审批  
- 4级权限 (Protected > DangerFullAccess > WorkspaceWrite > ReadOnly)
- Protected: coolzhu.toml + .coolzhu/** → 始终弹审批+二次确认
- workspace 内判断: 路径前缀匹配 `workspace_id`
- 前端复用 [Allow]/[Deny] 按钮，增加工具名+参数摘要显示

## 待办
- TDD 开发 REQ-TOOL-007 + REQ-TOOL-008
- 实现权限判断函数 `classify_tool_permission(tool_name, args, workspace_id) -> PermissionGate`
- 实现路径安全函数 `is_path_inside_workspace(path, workspace_id) -> bool` + `is_protected_path(path) -> bool`
