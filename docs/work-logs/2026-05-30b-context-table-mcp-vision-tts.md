# 2026-05-30（第三批）模型能力表 / 上下文 compact / MCP-CLI / 视觉 / TTS-STT

负责人：Claude Code。覆盖用户新提 4 项（任务 12–15）。诚实标注"已落地" vs "方案就绪待执行"。

## 环境说明（影响本批节奏）
本批工具环境间歇性**读取渲染降级**（Read/PowerShell/grep 输出被截断、行重复、插入"见上文"）。
对 1.36 MB `main.rs` 做外科式编辑前，凡读不可靠时一律暂停（仓库有 main-rs-corrupted 前科）。
仅在锚点经多源核验为唯一且 Edit 按真实字节匹配（错锚点会安全失败、不会损坏）时才动手。

## 任务12：上下文自动 compact + 模型能力表
### 已落地（编译通过 + HTTP 实测）
- **模型能力表 API** `GET /api/models/capabilities`（main.rs）：返回每个模型的
  `{provider, model, context_window, max_output_tokens, reasoning_options[], supports_reasoning}`。
  - 数据源复用 `api::model_token_limit`（context/输出上限）+ `api::provider_catalog`（模型清单）。
  - `model_reasoning_options`：glm-5/glm-4.6/glm-4.5/deepseek/claude/grok/qwen/o1/o3 → 全档
    `[minimal,low,medium,high,max]`；其余 → `[none,medium]`。
  - 实测（HTTP 200，结构化核对）：glm-4.6→200k/128k、deepseek-v4-pro→131072/8192、
    claude-opus-4-7→200k/64k、glm-5→200k/128k、qwen3.7-max→131072/32768，思考档位与 supports 标志一致。
- `cargo build -p coolzhu-web-console` 通过（exit 0，两次：初版 + glm-4.6 思考档修正）。

### 方案就绪待执行（见 docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md）
- **12-C 前端查表显示**：现状前端 **无既有 model/reasoning 配置 UI**（app.js `reasoning` 命中 0，
  index.html 无会话配置表单）——session 配置为运行时生成/后端默认。故需新增配置 UI 区，
  fetch 能力表后按所选 model 显示上下文容量并约束思考档下拉。属净新增，已在 impl plan 给出。
- **12-D 自动 compact 接入**：core-runtime `compact.rs`（should_compact/compact_session）已写好未接 web；
  方案：超 token 预算的旧史 → 滚动摘要 → 注入 system + 沉淀为高 kind 权重 bead（与任务9 价值老化联动）；
  token 预算由所选 model 的 context_window 动态推导（替代写死 3000/1200）。

## 任务13：MCP/CLI 落地（方案就绪，代码待执行）
- 现有积木齐全：`runtime::McpClientBootstrap/McpClientTransport/McpClientAuth`、`spawn_mcp_stdio_process` +
  JsonRpc 类型、`config.mcp().servers()`、`mcp_tool_name`。**缺**：web 运行时管理器 + `/api/mcp/*` 路由 + 前端面板。
- impl plan 给出：进程级 MCP 管理器（connect/tools_list/call/disconnect，仿 showui_service_process）、
  4 条路由、工具并入 registry/审计、前端 MCP 面板、CLI 命令模板（P2 共享 agent core）。
- 未动手原因：MCP 运行时是较大新功能，且本批读取间歇降级；方案锚点清晰，待环境稳定逐条应用。

## 任务14：ShowUI vs UI-DETR-1 + 实时交互（文档已产出）
- 文档：`docs/showui-vs-uidetr-realtime-vision-eval-2026-05-30.md`。
- 结论：UI-DETR-1（纯检测，低延迟、框稳、无语言）**不直接替代** ShowUI（VLM，自然语言 grounding），但**互补**。
  实时窗口/游戏交互推荐**双环架构**：UI-DETR-1+OCR 高频感知 / 推理大模型降频决策 / 流式 STT+TTS 语音。
  现有 `vision-service` backend 抽象可增量接入 UI-DETR-1 作 DetectionBackend，ShowUI 退为按需精确定位。

## 任务15：TTS/STT + IndexTTS（文档已产出）
- 文档：`docs/tts-stt-indextts-plan-2026-05-30.md`。
- 现状：STT=whisper.cpp（whisper-cli，单段），TTS=piper（固定音色，含分段流式骨架），有 AudioStatus/voice-monitor/健康检查。
  最大缺口=**自定义音色（克隆）**。
- 方案：引入 `TtsBackend{Piper|IndexTts}`，IndexTTS 以本地 HTTP 服务接入（仿本地 VLM）；
  新增 `/api/audio/voices`(GET/POST 上传参考 wav 克隆/DELETE)；前端语音面板分 STT/TTS/自定义音色三区。
  优先级 P0 音色下拉、P1 IndexTTS 适配、P2 克隆全链路、P3 流式实时化（配合任务14）。

## 变更清单
代码：
- `modules/gui-web/packages/web-console/src/main.rs`：新增 `ModelCapabilityDto` + `model_reasoning_options` +
  `api_model_capabilities` handler + `/api/models/capabilities` 路由。
文档：
- `docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md`（任务12-D/13 实施方案）
- `docs/showui-vs-uidetr-realtime-vision-eval-2026-05-30.md`（任务14）
- `docs/tts-stt-indextts-plan-2026-05-30.md`（任务15）
- 本 work-log。
验证：`cargo build` exit 0；`GET /api/models/capabilities` HTTP 200，7 模型条目结构正确。

## 经验增量
1. **读取间歇降级时不强改巨型文件**：先用多源（Read + PowerShell + grep -c）交叉核验锚点；Edit 按真实字节匹配，错锚点安全失败不损坏，但大范围替换仍应等读取稳定。
2. **截断显示≠数据错误**：模型能力表初看"options 全档却 supports=false"是截断拼接假象，结构化 ConvertFrom-Json 核对后实为正确。诊断 JSON 必须结构化看，勿信截断串。
3. **诚实标注完成度**：后端 API 真实可用即标已落地；前端/compact/MCP 净新增部分标"方案就绪待执行"，不混为完成。
