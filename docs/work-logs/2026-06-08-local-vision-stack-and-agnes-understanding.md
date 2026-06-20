# 2026-06-08 本地视觉栈选型 + agnes 理解层 + 误触发修复

## 设备约束（实测）
- GPU：RTX 3070 Ti Laptop **8GB**（baseline 占 ~0.9GB）；RAM 16GB（free ~7GB）；另有 Intel Iris Xe 集显。

## 模型调研结论
- **Gemma 4 31B QAT**：需 24GB 显存，本机跑不动；视觉强但 OCR 不如 Qwen，检测不如专用模型。
- **Gemma 4 12B QAT**：Q4 ~6.6GB，8GB 勉强单跑、无法与检测/grounding 共存；~21–40 tok/s。
- 结论：8GB 设备无法本地同时跑 检测 + grounding + 理解 三层 GPU。

## 本地资源盘点（已下载）
- UI-DETR：`models/uidetr/UI-DETR-1/model.pth`（510MB，racineai/UI-DETR-1，RF-DETR-Medium）；服务 `modules/vision/resources/uidetr/uidetr_service.py` :7860。
- ShowUI-2B / Qwen2.5-VL-3B：`~/.claw/local-vlm/models/`，launcher `start-local-vlm.ps1 -Profile {showui|qwen}`（:8000/:8001）。
- 运行环境：UI-DETR 用 `C:\Python314`（rfdetr，**torch CPU**）；ShowUI/Qwen 用 `~/.claw/local-vlm/.venv`（**torch cu126 GPU**）。

## 拉起脚本 + 共存实测
- 脚本 `tmp/start-vision-stack.ps1`（启动/-Stop/-StatusOnly）。
- 实测：UI-DETR(CPU 显存≈0) + ShowUI-2B(GPU FP16 ~5GB) 共存 → **GPU used ~5.9GB / free ~2.0GB ✓**（8GB 放得下，未占满）。

## 理解层方案对比（实测）
- **CPU**（Qwen2.5-VL-3B bf16，`tmp/bench-qwen-vl-cpu.py`）：**0.21 tok/s**（93s/20token，一次理解 4–8 分钟）——RAM 不足换页，**不可行**。
- **云端 agnes 多模态**：✅ **agnes-2.0-flash 即多模态**（实测看图："这张图片是谷歌公司的标志"）；coolzhu 端到端发截图 → **16.7s 准确理解屏幕**，零本地 GPU/RAM 占用。
- **最终架构**：UI-DETR(CPU 检测) + ShowUI(GPU grounding) + **agnes-2.0-flash(云端理解)**。

## 误触发修复（理解请求误点桌面）
- 现象：发"描述屏幕"给 agnes 理解会话，除正常回复外还触发 `computer.visual_action` 真实点击桌面（desktop-icon-left-click）。
- 根因：`semantic_action_from_intent` 对含"看/screen/截图/desktop"的**纯理解**请求返回 `visual_action`
  → `calls_tool = ... || semantic_action.is_some()` 变 true → 执行点 `run_tool_intent_message` 执行 computer-use 点击。
- 修复（理解 / 动作分流）：
  - 新增 `vision_request_has_action_intent`（点击/拖拽/打开/输入/操作… 中英）。
  - `semantic_action_from_intent` 的 `visual_action` 分支加动作意图条件——纯"看/描述屏幕"返回 None。
  - 执行点（非流式 + 流式）加 gate：`calls_vision` 仅在含动作意图时才执行 computer-use。
  - `should_route_to_vision_agent` 保持原义（视觉意图识别正确，测试不破坏）。
- 验证：`semantic_router_detects_vision_and_tool_intents` / `overview_metrics_*` 通过；端到端发"描述屏幕"→
  `kinds: multimedia, assistant-reply`、**computer-use 触发数=0**、agnes 正确理解界面。`cargo build` OK。

## 当前运行
- coolzhu app :8765 ✓ | UI-DETR :7860 ✓ | ShowUI :8000 ✓（GPU ~5.9GB）| agnes 会话 session-1780812777035 设为 multimodal。

## 实施：视觉语音未完成部分（P0 + P1 落地，同日晚）

### P0 视觉理解模型「会话可配 + 总览可选」（不固化模型）
- index.html：总览卡新增「视觉理解」行 + `overview-vision-agent` 下拉。
- app.js：`renderVisionAgentSelect` 同时渲染设置窗口与总览两个选择器（候选 = vision/multimodal/video 会话）；
  两处 change 共用 handler → `POST /api/config/vision-agent`；
  `renderModelTypeSelect`：text 类型新增「视觉理解(multimodal)」选项（multimodal/vision 类型补全自身），
  任意文本/多模态会话（agnes/glm/…）均可标为视觉理解，进入总览候选。
- styles.css：`.overview-vision-select` 样式（UTF-8 无 BOM 追加）。
- 后端零改动（`/api/config/vision-agent` + `/api/agents/understanding` + sqlite 持久均已有）。
- 验证：候选 3 个（glm-4.6v-flash / agnes-2.0-flash / agnes-video-v2.0）；POST 选中 agnes 成功返回。

### P1 实时视觉理解联动 API
- 新增 `POST /api/vision/realtime/understand`（main.rs，路由挂 /api/vision/realtime/*）：
  截当前桌面（路径复用 `closed_loop_capture_path`，与 computer-use 闭环同源）→ data URI；
  拼 UI-DETR 实时元素表摘要（label/kind/相对 bbox，上限可配）；
  调 `active_vision_session_id` 选中的多模态会话 `call_agent_model`（模型由总览选择器决定，不固化）；
  SSE 广播 `vision_understanding` 事件；返回 {status, summary, element_count, session_id, model, elapsed_ms}。
- 排障：首版用 `active_workspace_path()` 拼截图路径 → "os error 2"；对照 closed-loop（同进程截图成功）
  定位为 workspace 路径构造差异，改用 `closed_loop_capture_path` 后通过。
- 端到端验证：选中 agnes → POST understand → 21.1s 返回，agnes 准确描述当前屏幕（COOLZHU 控制台日志、
  监听音频状态），并正确指出"UI-DETR 元素表为空（检测循环未运行）"——截图 + 元素表双输入融合生效。

### 状态
- `cargo build -p coolzhu-web-console --offline` OK；app :8765 运行中。
- P2（全双工 4 gates：provider 原生流式 ASR / 远端 AEC / 实时模型适配器 / 流式 chunked TTS）按方案文档排期，
  依赖 provider 流式能力，未在本轮实施。
## P2 实施：全双工流式 readiness gates（同日深夜）

### 摸底结论（4 gates 框架完成度远超预期）
- 配置驱动（coolzhu.toml [audio.realtime] stt_transport/aec_mode/provider_adapter/tts_transport/streaming_tts_url）
  + 运行时证据置位（partial provider / model_stream_delta / tts_stream_chunk）双层判定框架**已存在**。
- `streaming_tts_output`：后端 `/api/audio/tts/stream`（chunked 代理 upstream + 逐 chunk emit tts_stream_chunk）
  + 前端 `enqueueRealtimeTtsChunk` 边收边播 **均已完整**——配置 streaming_tts_url 指向流式 TTS 服务即用。
- `provider_native_partial_asr`：partial 上报 provider 含 provider_native/native_streaming/realtime_asr 即 ready
  ——链路已通，依赖外部流式 ASR provider 接入。
- `realtime_model_adapter`：model_stream_delta 健康置位已有，配置 provider_adapter=realtime_provider_adapter 即判。
- `far_end_reference_aec`：**唯一真缺口**——ready 字段无置位链路、前端无远端参考实现。

### 本轮实现（far_end_reference_aec 全链路）
- 后端（main.rs）：
  - `RealtimeSessionState` 增 `far_end_reference_aec_ready` + `last_aec_reference_event_ms`（Default/start 重置同步）。
  - 新端点 `POST /api/audio/realtime/aec-reference`（reference_active/correlation/source）：
    会话运行中收到 reference_active=true → 置 ready + 时间戳 + 会话 aec_mode 升为 far_end_reference
    （运行时证据优先于静态配置，与 partial 按 provider 推 transport 同模式）；emit `aec_reference` 事件。
  - `realtime_streaming_capabilities_for_session`：填充 far_end ready（session.running + 证据 + aec_mode 匹配）
    + readiness_source 记录 `aec_reference_at_ms`。
- 前端（app.js）：
  - `attachAecFarEndReference(audio)`：TTS 播放（playTtsAudioUrl）时把音频元素接 WebAudio
    MediaElementSource→Analyser→destination 参考 tap；250ms 周期估计参考能量（0-1），
    1s 节流上报 `/api/audio/realtime/aec-reference`；播放结束上报 reference_active=false。
  - MediaElementSource 重复创建 / 自动播放策略拒绝时静默降级（不影响 TTS 播放，gate 如实 not ready）。

### 验证
- API 端到端：start session(aec_mode=far_end_reference) → gate `ready=False` →
  POST aec-reference{reference_active:true, correlation:0.42} → gate `ready=True reason=ready`；
  all gates: far_end_reference_aec=True（其余三项如实 False，待外部 provider/配置）。
- `cargo test -p coolzhu-web-console --offline realtime`：**46 passed / 0 failed**（零破坏）。
- `cargo build` OK。

### P2 收口状态
| Gate | 链路 | 剩余依赖 |
|---|---|---|
| far_end_reference_aec | ✅ 本轮全链路落地+验证 | 真实播放场景自动上报（前端已挂） |
| streaming_tts_output | ✅ 前后端完整 | 配置 streaming_tts_url 指向流式 TTS 服务 |
| provider_native_partial_asr | ✅ 证据链已通 | 外部 provider 原生流式 ASR 接入 |
| realtime_model_adapter | ✅ 证据链已通 | 配置 provider_adapter=realtime_provider_adapter + 流式 delta 观测 |
四 gates 全 ready 时 `full_streaming_ready=true` → 自动推荐 FULL_STREAMING 模式（既有逻辑，46 测试覆盖）。
## 桌宠交互 + 表演降速 + 办公室窗口交互（次日）

### 桌宠（tauri-shell ui/pet-mini.html）
- **表演帧降速一倍**：perform_dance/boxing/martial 帧间隔 115/115/125 → 230/230/250ms；
  minDuration 2200/2200/2400 → 4400/4400/4800、autoReturn 5200/5200/5600 → 10400/10400/11200（保持完整轮数）。
- **右键交互菜单**（新增，pet-mini 此前无 contextmenu）：💃跳舞 / 🥊拳击 / 🥋武术（applyStatus priority=9 点播，
  高优先级覆盖当前状态）、😴睡觉/☀唤醒切换（按当前 state 动态文案）、🖥控制台（复用 handlePetDoubleClick）；
  像素风浮层适配 150px 小窗，点外部/选择后关闭；菜单项为 button 元素天然绕过拖动 mousedown。
- 编译：tauri-shell 为独立 cargo 项目（src-tauri 内 `cargo build --offline`）；ui/ 资源编译期打包，
  改 HTML 必须重编。BUILD OK，桌宠已以新版重启。

### 办公室窗口（web-console agent-office-scene）
- 机器人点击直达窗口：planner→设置 / toolsmith→任务授权 / memory→记忆 / chat→聊天室
  （`OFFICE_ROBOT_WINDOW` 映射 + 模拟 window-tab click，规避 setActiveWindow 闭包作用域）。
- 活动条点击轮换多条活动（`(i/n)` 序号 + officeActivityIndex）；状态栏点击手动刷新场景；
  事件委托一次性绑定（dataset.interactionsBound 防重复）。
- styles.css：机器人 cursor/hover 金光（保留原底影叠加 drop-shadow）、活动条/状态栏 cursor + hover。
- 验证（preview eval）：bound=1；4 robots 齐；**点 chat 机器人 → 聊天室窗口 is-active=true**；
  活动轮换 `(1/3) Planner → (2/3) Tool runtime`。截图确认。
- launch.json 改为 preview 直接管理真实 exe（`autoPort:false`），解决端口接管冲突。