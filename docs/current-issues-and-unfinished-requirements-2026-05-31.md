# 2026-05-31 需求管理与未闭环事项（滚动收敛）

> 本文收敛 2026-05-29 ~ 05-31 交互式开发会话的全部任务/方案，统一编号、状态、优先级与证据落点。
> 承接 `docs/current-issues-and-unfinished-requirements-2026-05-21.md`。
> 状态图例：✅已落地(编译/测试/实测) · 📄方案(文档就绪待实施) · 🔧进行中 · ⛔受阻

## 一、已落地（代码 + 编译 + 测试/实测）

| ID | 模块 | 事项 | 证据 |
| --- | --- | --- | --- |
| R-ENC-01 | web-console / tool-registry | 子进程输出 GB18030 回退解码 `decode_console_output`，修复 git diff / 终端中文乱码 | cargo build 通过；终端 PowerShell HTTP 200 中文无乱码 |
| R-CU-01 | compute-use | UIA 定位 + 剪贴板注入 端到端打通（与 Claude Code 交互） | 实测消息进入对话区 |
| R-CU-02 | compute-use | 全局输入闸门 `compute_use_input_gate`（tokio Mutex 排队，防多会话冲突） | cargo build 通过 |
| R-CU-03 | skills | `compute-use-control` skill（任意 APP+控件+树状菜单的通用 UIA 脚本生成） | SKILL.md 已建，catalog 动态计数 |
| R-GOAL-01 | Goal | 反馈/回退：implementer 受阻→planner 重规划(retry≤3+升级)；verifier 不过→implementer 重改 | cargo build + 前端订阅新事件 |
| R-MEM-01 | 记忆 | 价值评分老化：kind 权重+星图关联度+置信度+新鲜度；pinned 永不淘汰，低价值问答先老化 | 366 测试通过(含 prune/pin) |
| R-MEM-02 | 前端 | 记忆星图：中心=会话/环=Layer/色=Kind/大小+亮度=关联度(价值)/暗淡=易老化 | 内联编译通过 |
| R-TASK-01 | 前端 | 任务链弹窗：总进度条+阶段状态灯(脉冲)+中文状态标签+事件中文化 | 366 测试通过 |
| R-TASK-02 | 前端 | 任务卡片：简要任务名+进度条 | 366 测试通过 |
| R-TASK-03 | 前端 | 任务卡片 **todo 清单**（多任务名+状态徽章[运行中/排队中/完成/失败重试]+实时耗时，对照截图） | cargo build + 366 测试通过；HTTP 实测待服务器恢复 |
| R-CTX-01 | web-console | 模型能力表 API `GET /api/models/capabilities`（context_window/max_output/思考档/supports） | HTTP 200，27 条目，双解析器校验 |
| R-CTX-02 | web-console | 自动 compact：超 token 预算旧史→`summarize_dropped_history` 滚动摘要注入 system_prompt（不再丢弃） | cargo build + 366 测试通过；HTTP 实测待服务器恢复 |
| R-TERM-01 | 终端 | PowerShell `/api/tools/runtime-execute` 打通 | HTTP 200 实测 |

## 二、评估/梳理文档（已产出）

| ID | 事项 | 文档 |
| --- | --- | --- |
| R-CTX-DOC | 上下文管理 vs 业界对比 | docs/context-management-analysis-2026-05-30.md |
| R-MCP-DOC | MCP/CLI 接入梳理 + 终端 | docs/mcp-cli-terminal-analysis-2026-05-30.md |
| R-VIS-DOC | ShowUI vs UI-DETR-1 + 实时双环架构 | docs/showui-vs-uidetr-realtime-vision-eval-2026-05-30.md |
| R-TTS-DOC | TTS/STT 现状 + IndexTTS 音色克隆方案 | docs/tts-stt-indextts-plan-2026-05-30.md |
| R-PET-DOC | clawd-on-desk 桌宠移植分析 | docs/clawd-on-desk-port-analysis-2026-05-31.md |
| R-PLAN-DOC | 子agent/todo/桌宠/手机远控 方案 | docs/plans/2026-05-30-subagent-todolist-pet-remote-plans.md |
| R-IMPL-DOC | compact+MCP/CLI 实施步骤 | docs/context-compact-and-mcp-cli-impl-plan-2026-05-30.md |

## 二.5、代码隐患审查结论（2026-05-31，详见 docs/code-audit-context-tools-goal-2026-05-31.md）

| ID | 模块 | 隐患 | 等级 | 状态 |
| --- | --- | --- | --- | --- |
| R-BUG-VIS01 | 语义路由 | `semantic_action_from_intent` visual_action 关键词含空串 `""`，`contains("")` 恒真→几乎所有意图误判为视觉动作（test5 分析目录却截图的直接根因） | 🔴高 | ✅已修 `""`→`"看"`，build+374测试通过 |
| R-BUG-CTX01 | 工具结果 | tool loop 单条工具结果无上限累积，撑爆上下文（test5 89k/128k→无回复） | 🔴高 | ✅已修 `truncate_tool_result_for_context`(≤8000字符) |
| R-AUDIT-A1 | 模型限额 | deepseek-v4-* 容量登记错误（表内显式登记为 64000，实际 1M）→ 历史窗口被严重低估 | 🔴高 | ✅已修 deepseek-v4-flash/pro=1_000_000（用户确认官网值），build exit0 + 运行时实测 ctx=1000000；deepseek-chat/reasoner 暂留 64000 待 test5 核对 |
| R-MODELTAB-01 | 模型限额 | MODEL_TOKEN_LIMITS 容量未全按官网核对（~24 模型）；且思考档等参数散在 web 字符串匹配未并入表 | 🟡中 | P1：委派 test5 联网核对全表容量；下轮把 reasoning_options/supports_reasoning 并入 model 表，各处查表（用户要求统一从 model 管理表取参数） |
| R-AUDIT-A2 | 健壮性 | clippy restriction：arithmetic_side_effects 186 / indexing_slicing 108（多误报，少数用户输入驱动点需甄别） | 🟡低 | P2 人工过非测试命中点改 saturating/get |
| R-AUDIT-A3 | 上下文 | tool loop 累积 token 守卫（超 context×0.7 停循环强制总结）二道防线 | 🟢 | P2 加固 |
| — | 已排除 | 动态预算失效(H1)/tool loop 绕过预算(H3)/goal记忆污染/权限拦截/unwrap panic | — | 实测+clippy 证实无（详见审计文档） |

## 三、方案就绪待实施（📄）

| ID | 模块 | 事项 | 优先级 | 落点/方案 |
| --- | --- | --- | --- | --- |
| R-PET-FILEDROP | 桌宠 | 文件拖到桌宠→放进 workspace 附件目录 + 加进消息附件 | P1 | ✅已落地+GUI实测通过：原生 WM_DROPFILES 方案失败(WebView2 渲染窗口属独立子进程，主进程跨进程无法子类化拦截，光标禁止图标)→改前端 HTML5 拖放：build_pet_window 加 disable_drag_drop_handler 把拖放交网页层，pet-mini.html 监听 drop 读文件内容(base64)→Tauri command pet_drop_uploaded→reqwest POST /api/pet/drop-upload→存 attachment_store_dir(原文件名,重名加序号)+入队→前端轮询 /api/pet/pending-attachments 加 composer。**复制语义**(HTML5 安全模型不暴露磁盘路径，无法删原件，与最初"移动"设想偏离)。附带修复 serve_static_path 加 no-cache 头(根除 WebView2 缓存旧 app.js 致附件不显示，preview 已证渲染本身正确)。403测试+preview渲染+用户GUI拖放 全通 |
| R-PET-CLEANUP | 桌宠 | 清理硬编码：console 窗口尺寸/位置字面量提常量；pet-mini.html 与 pet-theme.json 帧资源双维护→单一数据源；web 端口与 8765 联动 | P3 | 同上文档 |
| R-RICHTEXT-MEDIA | 聊天室 | 正文图片/视频链接内联渲染 | P1 | ✅已落地：appendRichMedia 加 richImageNode/richVideoNode(仅 http/https/blob/file 安全协议，图片失败回退链接，视频 preload=metadata 不自动播)；CSS max-height 240px；403测试+渲染逻辑验证 ALL_PASS。音频/图片/视频链接现都能在聊天室正文内联 |
| R-RT-SEGMENT-STT | 实时语音 | **分段音频→增量转写**：segment 端点现"只计字节不转写"，前端录真实blob但只报字节数；改前端传音频+后端whisper分段转写+VAD切句 | P0 | 详见 docs/realtime-vision-voice-completion-analysis-2026-06-04.md；打通后实时语音从伪turn-based变真流式 |
| R-RT-TTS-STREAM | 实时语音 | TTS 分片流式回复(复用 TtsStreamResult)+ barge-in 停播 | P1 | 同上文档 |
| R-MCP-IMPL | MCP | mcp_client 接入 web：`/api/mcp/*` 路由+前端面板+工具并入 registry | P1 | core-runtime 已有 mcp_client/spawn_mcp_stdio_process |
| R-SUBAGENT | 会话 | 临时子 agent 并行：JoinSet+Semaphore，EphemeralAgent 状态机，结果汇聚回主会话 | P1 | 不污染会话列表；max_parallel 可配 |
| R-TTS-IMPL | 音频 | IndexTTS 本地 HTTP 服务接入 + 自定义音色克隆 + 前端三区 | P1 | TtsBackend 抽象(Piper/IndexTTS) |
| R-VIS-SWITCH | 视觉 | **ShowUI/UI-DETR-1 显存互斥切换**（本地显存不足以同时开两模型）：按场景切换——grounding 按需 ShowUI / 实时感知 UI-DETR-1，单模型常驻 | P1 | ✅ 已补 DetectionBackend HTTP 连接器、start/stop 实时轮询、元素表 SSE、base_url 未配置等待态；真实权重需用户本机/远端提供兼容 `/detect` 服务 |
| R-CTX-COMPACT2 | 上下文 | compact 进阶：摘要沉淀为高 kind 权重 bead；token 预算由 model context_window 动态推导 | P2 | 与 R-MEM-01 价值老化联动 |
| R-CTX-OUTPUT | 上下文 | **接入 max_output 输出预留 + history 比例 55→70%**：history/memory 预算作用于"扣除输出预留后的可用上下文"，输出预留=max(max_output_tokens, ctx×output_reserve_percent默认15%)，避免大输出被历史挤占 | P1 | ✅已落地：context_build_options_for_agent + 新增 output_reserve_percent 配置；398测试通过；实测 deepseek-v4-pro budget 550K→595K(扣150K预留后850K×70%) |
| R-REMOTE | 远程 | 手机远程消息输入：0.0.0.0 绑定+token 鉴权+二维码配对+移动端 /m 视图 | P2 | 复用现有 REST/SSE |
| R-CLI-IMPL | CLI | CLI 与 web 共享 agent core（消除双入口能力漂移） | P2 | — |
| R-PET-IMPL | 桌宠 | clawd 行为状态机移植为 pet_behavior + 自研像素帧动画 | P2 | 已分析完成度~80%(13态/帧动画/拖拽/悬浮窗已就绪)；详见 docs/desktop-pet-clawd-integration-and-new-features-2026-05-31.md |
| R-PET-FLY | 桌宠 | **拖拽动作帧改超人飞行**：dragging 态已存在，替换 frame_pattern→superman-fly-*.png + pet.html frameSets 同步 | P1 | 改 pet-theme.json + 渲染器 + 美术帧，不动 Rust；详见桌宠方案文档 |
| R-PET-PERFORM | 桌宠 | **空闲5分钟随机表演**(MJ舞蹈/拳击/武术)：无桌宠交互且无 web-console 操作满5分钟→随机播表演态(priority低不打断真实状态) | P1 | MVP 纯前端计时器+3表演态+美术；"无操作"靠 /api/pet/events 事件流近似(或补UI心跳事件)；详见桌宠方案文档 |
| R-MODELTAB-VERIFY | 模型表 | 按联网核实值更正 MODEL_TOKEN_LIMITS：deepseek-v4/chat/reasoner=1M、qwen=1M、grok=1M、claude=1M、glm=200K + 同步 fallback 分支与 max_output | P1 | ✅已落地：providers/mod.rs 表+5个fallback；llm-adapter 65测试+web-console 398测试通过；实测 capabilities API 全返回新容量。数据见 docs/model-capability-table-verified-2026-05-31.md |
| R-UIA-PORT | UIA | **把验证过的UIA方法落到coolzhu**：uia-resolver 扩展 resolve_window_control(任意窗口+控件)，现仅 StartButton；CEF窗口回退视觉grounding | P2 | 详见 docs/uia-method-port-and-download-skill-2026-05-31.md |
| R-DL-SKILL | skill | 下载操作固化为 thunder-download skill：thunder://协议拉迅雷+UIA/视觉确认+点立即下载；"下载X资源"意图默认走它 | P1 | ✅已落地：.coolzhu/skills/thunder-download/(SKILL.md+download.ps1)；catalog 识别7/7；端到端实测拉起迅雷弹新建任务面板。含未装迅雷/磁力链/视觉回退 |

## 四、受阻/待外部条件（⛔）

| ID | 事项 | 阻塞原因 | 解除条件 |
| --- | --- | --- | --- |
| B-SERVER | web-console 本机服务本轮无法稳定启动 | 纯启动环境问题（代码已编译+366 测试通过）；多种启动方式均 HTTP 000 | 重启机器/排查端口 8765 占用与 exe 锁后重试 |
| B-TEST5 | 委派 test5 分析 clawd 源码 | 依赖 web-console 服务(`/api/chat/send`)，B-SERVER 受阻 | 服务恢复后重发委派(提示词已备 tmp/delegate-test5-clawd.json) |
| B-WEBSEARCH | ✅已解除 | 根因=User级 env `ANTHROPIC_SMALL_FAST_MODEL=claude-3-5-haiku-20241022` 被中转端点拒绝 | 改为 `claude-haiku-4-5-20251001`(tmp/fix-websearch-env.ps1)+重启app，WebSearch 已实测恢复 |
| B-SERVER | ✅已解除 | 旧 cargo-run 实例(PID未被PowerShell名杀)占8765跑旧二进制 | 用 `taskkill //F //IM`/按PID杀+netstat确认端口释放后重建，服务器正常 |

## 五、本轮交互式开发新增经验
1. **服务器 exe 启动**：`(exe &)` 子 shell 与直接 `run_in_background` 跑 exe 会瞬退（父 shell 退出连带）；前台跑能运行但阻塞。`cargo run` run_in_background 是历史验证可行方式，但本轮亦出现 HTTP 000（环境降级）。改后端务必先停旧进程再 build。
2. **工具输出渲染降级**：Read/awk/PowerShell 输出间歇出现重复行、`...[degraded]`、串台。对策：以 `cargo build` 退出码 + `grep -c` + curl HTTP 码 + 双解析器为唯一判据，不信被截断的可视输出；小文件结构损坏直接 Write 重写。
3. **Edit 锚点必先 Read/grep 确认**：多次因假设实现形态(包装函数/字段名 context_window vs context_tokens、usize vs u32)导致 E0425/E0308；改前必核实真实字节。
4. **过早标记完成是反复出现的错误**：必须编译+测试+实测三证齐全才算完成；远程委派(test5)与服务器验证不可假定成功。
