# 2026-05-09 LLM & Vision 链路全线打通

## 背景
用户反馈：
1. 三合一卡片模型类型只读显示"文本推理"，无法选择视觉类型
2. 总览卡片视觉Agent下拉未从已保存会话加载
3. 消息发送卡片布局需优化（附件挤压按钮、框选监控位置）
4. 真实LLM链路不通，消息无回复
5. 图片附件发送视觉模型链路未打通
6. REASONING_EFFORT_MATRIX 丢失导致思考程度失效
7. 保存会话后发送对象下拉不更新
8. 启动时已保存会话配置不回显

## 修改内容

### 后端 (main.rs)

#### 环境变量全部迁移到 coolzhu.toml
- `real_llm_enabled()`: config-first → env fallback
- `llm_tools_enabled()`: 同上
- `desktop_pet_disabled()`: `[pet] enabled` 
- `default_reasoning_model()`: `[model] reasoning`
- `authoritative_local_vision_*()`: `[vision] local_model/local_base_url/local_api_key`
- `ConfigModel` 新增 `enable_real_llm: bool`, `enable_llm_tools: bool`
- `ConfigVision` 新增 `api_key`, `local_model`, `local_base_url`, `local_api_key`
- `ConfigPet` 新增 `exe_path`
- `effective_agent_base_url_impl()` 新增 provider→default_base_url 映射表

#### model_type 全链路
- `ConfigModel` / `PersistedSession` / SQLite schema / `SessionSummaryDto` / `UpsertSessionRequest` 新增 `model_type: String`
- DB 迁移 `ensure_session_column("model_type", "TEXT NOT NULL DEFAULT 'text'")`
- `resolve_model_type(&str)`: vl/vision/showui→vision, video→video, whisper/audio→audio, embed→embedding, else→text
- `create_session`/`update_session` 处理 model_type
- 14个测试 struct 补齐 `model_type` 字段

#### 视觉Agent持久化
- `PersistedSessionState` 新增 `active_vision_session_id: Option<String>`
- SQLite metadata 读写 `active_vision_session_id`
- `GET/POST /api/config/vision-agent` 端点
- `vision_session_config()`: 从 active_session 读 provider/model/base_url/api_key
- `session_by_id()`: 辅助查找

#### Grounding vs 视觉理解分离
- `run_vision_grounding_model`: 纯本地 ShowUI（env vars/default local URL），不读视觉会话
- `run_vision_describe_screen_model`: 走 `vision_session_config()` → 远程 provider
- `run_visual_action_dry_run`: `use_model` 保持默认 false（仅 dry-run）

#### LLM 链路打通
- `real_llm_enabled()`: `coolzhu.toml [model] enable_real_llm=true`
- 流式/非流式路径均加 `diag!` 诊断日志
- `local_agent_response()` 移除误导性"未启用"文本

#### 图片→LLM 传输链路
- `encode_attachment_images()`: 读取 `.coolzhu/attachments/` 图片 → base64 → data URI
- `agent_message_request_with_images()`: 图文混合请求
- `call_agent_model`/`stream_agent_model` 新增 `image_urls` 参数
- `PreparedChatDispatch` 新增 `image_urls: Vec<String>`
- `agent_chat_response` 传递 image_urls

#### 桌宠退出联动
- `launch_desktop_pet()` 返回 `Option<std::process::Child>`
- main 中 `spawn_blocking` 等待 pet 进程退出 → `std::process::exit(0)`

#### 诊断系统
- `diag!` 宏 → `C:\Users\zhupu\coolzhuagent\err.log`
- 覆盖: CONFIG/REAL_LLM/LLM-CHAIN/LLM-CHAIN-STREAM/API-KEY/PROVIDER/VISION-CFG/VISION-MODEL/VISION-API/VISION-UI/IMAGE-ENCODE

### 前端 (app.js + index.html)

#### MODEL_TYPE_MAP 分类
- 专用视觉: `glm-4.6v-flash` → `"vision"`
- 多模态 (16个): `gpt-4o-mini`, `claude-sonnet-4-6`, `grok-3`, `glm-4.7`, `qwen-plus` 等 → `"multimodal"`
- 纯文本: 其余 → `"text"`
- 新增 `MODEL_TYPE_LABELS`

#### REASONING_EFFORT_MATRIX 恢复
- 28 模型×5 级完整矩阵 (low/medium/high/xhigh/max)
- `deepseek-v4-pro` 支持 max

#### 模型类型 select
- `<b>` → `<select data-role="session-model-type">`
- `renderModelTypeSelect()`: 根据 MODEL_TYPE_MAP 动态生成选项
- text-only → ["文本推理"]; vision-only → ["视觉"]; multimodal → ["文本推理", "视觉"]

#### 总览视觉Agent下拉
- 数据源从 `/api/agents` → `/api/sessions` (已保存会话)
- `renderOverviewVisionDropdown(sessions)`: 筛选 model_type∈{vision,multimodal}
- `notifyVisionAgentChanged`: POST `/api/config/vision-agent` 持久化
- `setOverviewVisionAgent`: 避免 setText 破坏 select

#### 会话表单修复
- `setSessionForm`: provider先设→model后设→显式updateModelOptions
- `sessionPayloadFromForm`: dataset.saved 标记避免覆盖已保存 key
- API Key 输入: "已配置" placeholder, input事件清除标记

#### 消息发送卡片重构
- 框选监控从 composer → 内视觉卡片 `.vision-btn-row` 与采集桌面并排
- 附件 `position: absolute` 浮动在 composer 左上方，不挤压按钮
- 附件按键 5%→8%（对齐发送按键），发送对象 14%→11%
- "发送给：" 通过 `::before` 伪元素添加
- 消息输入框 `overflow-y: auto` + 金色滚动条
- grid: `11% 8% minmax(0, 1fr) 8% 8% 8%`

### 关联文件
- `modules/gui-web/packages/web-console/src/main.rs`: 所有后端变更
- `modules/gui-web/packages/web-console/src/app.js`: MODEL_TYPE_MAP, 表单, 视觉下拉, 布局
- `modules/gui-web/packages/web-console/index.html`: select, vision btn row, composer
- `modules/gui-web/packages/web-console/src/styles.css`: grid, ::before, vision-btn-row, scrollbar
- `modules/gui-web/packages/web-console/Cargo.toml`: 新增 base64 依赖
- `modules/llm-adapter/packages/llm-adapter/src/providers/mod.rs`: 已确认 base_url 正确
- `modules/llm-adapter/packages/llm-adapter/src/providers/openai_compat.rs`: 已确认 reasoning_effort 参数传递
- `docs/requirements-management.md`: 需求状态更新
- `docs/model-provider-config-table.md`: 视觉模型清单

### 未完成项
- ShowUI 本地模型生命周期（需随服务启动/关闭）
- 视觉描述/OCR reserved 接口
- 自定义 endpoint/base_url 三合一卡片字段
- 多模态模型手动切换（当前自动判定）

## 测试结果
- `cargo test -p coolzhu-web-console --offline`: 134 passed, 0 failed
- `node --check app.js`: 语法通过
