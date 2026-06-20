# 2026-05-10 - Phase2: 逐步合入变更至工具调用测试前状态

## 背景
- 因 app.js SSE 重写导致链路中断，回退到稳定版：
  - `main.rs` ← `showui-cu-20260510-110503`（有 LLM + ShowUI 集成）
  - `app.js` ← `overview-workspace-20260508-2050`（5月8日稳定版）
- 目标：逐步合入今天的变更到工具调用真实测试之前的状态

## 已合入变更

### app.js
1. **MODEL_TYPE_MAP** — 基于模型名自动分类（text/vision/multimodal/audio/video/embedding）
2. **REASONING_EFFORT_MATRIX** — 28个模型×5级推理程度映射
3. **updateModelOptions() 升级** — 联动调用 `renderModelTypeSelect()` + `updateReasoningEffortOptions()`
4. **renderModelTypeSelect()** — 多模态模型同时显示"文本推理"/"视觉"选项
5. **updateReasoningEffortOptions()** — 根据当前模型动态渲染推理程度选项
6. **sessionPayloadFromForm()** — 增加 `model_type`、`reasoning_effort` 字段，API Key 按 `dataset.saved` 控制发送
7. **setSessionForm()** — API Key 字段显示"已配置"/"sk-..."占位符，`dataset.saved` 标记
8. **事件监听器** — `session-model` change → `renderModelTypeSelect()` + `updateReasoningEffortOptions()`；`session-api-secret` input → `dataset.saved="0"`

### main.rs
1. **`call_agent_model_with_tool_loop()`** — 非流式双轮工具调用循环（REQ-LLM-003）
   - Round 0：发送提示 → 获取工具调用 → 执行工具 → 收集结果
   - Round 1：将工具结果发送回模型 → 获取最终回复
2. **`agent_chat_response()` 双支路由** — `llm_tools_enabled()` 时调用 `call_agent_model_with_tool_loop`，否则调用原 `call_agent_model`
3. **SSE TOOL-LOOP-STREAM 第二轮反馈** — 流式句柄中：
   - Round 1 流式完成后，检测到工具调用
   - 执行 `run_model_tool_dispatch` + `dispatch_plan_chat_summary`
   - 将工具结果发送回模型进行 Round 2 流式回复
   - Round 2 错误时降级到 dry-run dispatch 展示

### HTML
- `session-model-type` select（模型类型下拉）
- `session-reasoning-effort` select（推理程度下拉）  
- 已存在，无需额外修改

## 未合入
- Composer 布局调整（attachments 浮动、box-monitor 移至 vision card）— 功能非关键，暂缓
- 工具执行端点 API — 属于"真实工具调用测试"阶段，本次不包含

## 备份
- `tmp/backups/phase2-merge-20260510-153334/` — 合入前的主文件快照

## 验证
- JS 语法检查通过
- 编译通过
- 服务器正常启动，API 返回 workspace、vision_agent、models 数据
