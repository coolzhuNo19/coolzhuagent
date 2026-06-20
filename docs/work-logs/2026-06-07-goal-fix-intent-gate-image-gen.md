# 2026-06-07 Goal 打通 / 意图门控 / 图片生成闭环

本轮三项需求全部闭环，app 已重启运行（http://127.0.0.1:8765/ ，HTTP 200）。

## 1. Goal 端到端打通修复（CUR-GOAL-LOOP 相关）

历经多根因，本轮定位并修掉**最后一个**外层超时单位 bug：

- `tool_timeout_ms_for`（`web-console/src/main.rs` ~4119）：外层 `tokio::time::timeout` 把
  schema 的 `timeout`（**秒**）当成毫秒用，导致 `timeout:10` 实际只给 10ms → 工具必超时。
  修复：`timeout_ms` 原样用毫秒；`timeout` 字段 `*1000` 转毫秒；最后 `clamp(1, 600_000)`。
- 配合更早修过的：custom provider budget 饿死、goal 工具 None 会话、内层
  `execute_powershell`/`run_bash`（tool-registry）×1000 秒/毫秒、prompt 污染过滤。
- 验证：`tool_call OK: PowerShell, route=runtime-executed, status=ok`，round2 产出最终回复。

## 2. agnes 文本模型无意图却触发工具调用 —— 根因与修复

### 审计结论
- `enable_real_llm` / `enable_llm_tools` / `dev_open_permissions` / `llm_tool_exposure` 全部只读
  `coolzhu.toml`，**前端无设置入口**（app.js 仅读 `dev_open_permissions` 一行做展示）。
- `dev_open_permissions=true` 会**全局**强制 `llm_tool_exposure_mode()="all"`（全部 21 个工具）+
  FullAccess，对所有会话生效、绕过按会话/前端控制。**非硬编码（配置驱动）**，但确实绕过前端。

### 根因
弱模型 agnes-2.0-flash（小 flash）+ `tool_choice=auto` + 暴露 21 个工具 →
对纯介绍/问答类问题（本无任何工具意图）也强行调用 ToolSearch→WebSearch。

### 修复（三层，最后一层为根治）
1. system-prompt 增加「纯信息/解释/对话类问题直接作答，禁止仅为介绍产品/模型而调用 ToolSearch」。
2. `llm_tool_definitions` 暴露列表**排除 ToolSearch**。
3. **意图门控（根治）**：`agent_message_request_build_with_system`
   - 新增 `messages_have_tool_intent` / `text_has_tool_action_intent`。
   - round1 且最后一条用户文本**不含动作类关键词** → `tools=None`、`tool_choice=None`
     （请求里**零工具**，模型物理上无可调用）。
   - round2+（已出现 ToolUse/ToolResult 工具往返）**始终保留工具**，不打断 goal / 多轮工具链。
   - 关键词刻意取宽（创建/生成/部署/搜索/运行… + 中英 + 工具名），避免误伤真实任务。
- 验证：`intent_gate_tests` 5 个单测全过。那句 agnes 原话 → 无意图 → 零工具；
  goal「创建网站」、图片生成、powershell、搜索、读文件 → 有意图保留工具；round2 始终保留。

## 3. 新增图片生成模型，会话链路打通（验收：agnes-image-2.1-flash）

- `resolve_model_type`：模型名含 image/dall-e/flux/imagen → `"image"`。
- 新增 `agent_media_gen_kind`（model_type 或 resolve_model_type 命中 image/video）、
  `generate_image_attachments_for_agent`（POST `v1/images/generations`，Bearer=会话 key，
  解析 `data[].url|b64_json` → `ChatAttachmentDto{kind:"image",mime:"image/png"}`）、
  `image_generation_chat_message`（kind=`assistant-image`，失败回退 `assistant-fallback`）。
- `api_chat_send` / `api_chat_send_stream` 主循环：命中 image 类 → 走图片生成消息并 `continue`。
- 前端：`renderModelTypeSelect` 增加「图片生成/视频生成」选项；`renderAttachments` 的
  `canPreviewUrl` 增加 `data:` 协议。
- 验证：agnes-image-2.1-flash 会话发提示词 → `MSG kind=assistant-image atts=1`，
  `ATT image mime=image/png url=https://platform-outputs.agnes-ai.space/images/text-to-image/...`
  —— 真实图片 URL 入聊天消息，聊天室可渲染 `<img>`。**图片闭环达成。**

## 待办
- **视频生成（agnes-video-v2.0，异步）**：按「先图片闭环再视频」顺延。需异步提交 job + 轮询、
  视频端点、视频展示（`renderAttachments` 已支持 video 附件）。下一步实现。
