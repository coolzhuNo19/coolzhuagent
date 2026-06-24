# COOLZHU AGENT 需求管理表

项目名称：COOLZHU AGENT  
版本：v0.2  
更新日期：2026-05-22  
维护范围：`C:\Users\zhupu\Desktop\codex`

## 管理规则

### 优先级

| 优先级 | 定义 | 响应策略 |
| --- | --- | --- |
| P0 | 阻塞核心聊天、会话、模型调用或 GUI 主入口 | 立即处理 |
| P1 | 影响核心体验、长期架构或跨模块联调 | 1 周内推进 |
| P2 | 增强能力、体验完善、索引和多媒体能力 | 2 到 3 周排期 |
| P3 | 优化、自动化、长期扩展 | 迭代安排 |

### 模块梯队

| 梯队 | 模块范围 | 排序原则 |
| --- | --- | --- |
| 第一梯队 | Web-GUI 卡片功能接入，以及直接支撑卡片的 LLM、Tooling、Diagnostics、Audio 状态 API | 先保证前端每张卡片都有后端能力、loading/error/empty 状态和可验证闭环 |
| 第二梯队 | Core Runtime 与分层 beads 记忆系统 | 支撑会话、聊天室、记忆沉淀、检索增强和工具编排的长期主干 |
| 第三梯队 | Computer Use 与内视觉 | 先 dry-run、安全审计和视觉 grounding，再进入真实鼠标执行 |
| 第四梯队 | GUI Desktop、桌宠、TTS/STT | 不阻塞 Web-GUI 主线；桌宠保持当前够用状态，音频仅保留 TTS/STT |
| 第五梯队 | 打包迁移、CLI、运维稳定性 | 打包、加密和完整性校验冻结；CLI/稳定性按需评估 |

依赖提升规则：如果第一梯队需求依赖后续梯队能力，依赖项按第一梯队节奏执行。例如回复引用/转发依赖 beads 查询与 prompt preview，`REQ-MEM-002/004/005` 在执行顺序上前置到第一梯队联调。

### 状态

| 状态 | 定义 |
| --- | --- |
| 已完成 | 已实现并通过基础验证 |
| 测试中 | 代码已完成，仍需自动化、矩阵或跨模块验证 |
| 待交互验证 | 代码或方案已就绪，剩余只能通过真实窗口、真实硬件或人工交互确认 |
| 开发中 | 已开始实现，仍有功能缺口 |
| 待开发 | 需求已确认，尚未实现 |
| 暂停 | 受硬件或外部条件限制 |
| 冻结 | 需求保留但当前不实现，只维护方案和风险记录 |
| 取消 | 不再实施 |

## 梯队执行摘要

| 梯队 | 重点需求 | 当前状态 | 下一步 |
| --- | --- | --- | --- |
| 第一梯队 | Web-GUI 卡片、会话/聊天室数据边界、模型配置、上下文装配 | 主体已完成，剩余少量 P0/P1 补洞 | 先修正 workspace/session/context 与自定义模型配置缺口，避免后续多 Agent 和打包建立在漂移状态上 |
| 第一梯队依赖提升 | LLM provider 诊断、结构化 tool call、工具目录/dispatch、健康检查、beads 查询与 prompt preview | 工具调用主链、审批/审计/Protected 诊断、MCP runtime 和真实 LLM 多 tool_use 已闭环 | 转入会话/记忆/协同与自定义模型配置收口 |
| 第二梯队 | SQLite 会话/beads、自动记忆沉淀、记忆治理、统一 runtime 工具协议 | 记忆主体完成，runtime 统一入口已完成，剩会话/记忆数据边界 | 优先做 `WorkspaceScope`、事务化删除和历史上下文装配，避免会话/记忆错位 |
| 第三梯队 | Vision Tool Service、Grounding Router、Computer Use 动作链、视觉理解 Agent 分离 | `REQ-VIS-008` 已闭环，CU/Vision 主体完成，工具安全链路已闭环 | 切到会话/记忆/协同，打包迁移继续冻结 |
| 第四梯队 | 桌宠状态事件、气泡、WebView 交互、TTS/STT | 桌宠当前功能够用；TTS/STT 保留，语音监听/唤醒不保留 | 桌宠不新增需求，后续只做回归修复 |
| 第五梯队 | Windows 安装包、数据迁移、首次启动向导、CLI 对齐 | 打包/加密/完整性校验冻结；CLI 低优先级待评估 | 冻结期间不实现安装包、资源加密、完整性校验 |

### 0.1 新增需求评估 - 2026-05-08

| 优先级 | 需求 | 梯队 | 技术方案 | 风险评估 |
| --- | --- | --- | --- | --- |
| P0 | 总览卡片指标重构 | 第一梯队 | 后端 `/api/state` 输出已激活 Agent 数、视觉 Agent、聊天室数；前端移除 health debug 文案，只保留清爽业务指标 | 低风险，主要是 UI 字段与状态 API 契约变更 |
| P0 | workspace 默认目录与权限边界 | 第一/第二梯队依赖 | 默认 workspace 改为 `C:\Users\<用户名>\coolzhuagent`；会话、聊天室和工具权限使用 workspace_id 作为隔离键；文件工具只允许访问当前 workspace 内路径 | 中高风险，涉及数据归属、文件权限与旧路径兼容，需保守落地 |
| P1 | 内视觉能力收敛 | 第三梯队 | 只保留 grounding / computer-use 相关能力和云端视觉模型识图；双视觉模型常驻、外视觉、持续监控不进入主线 | 中风险，需避免 ShowUI grounding 与视觉理解 Agent 概念再次混淆 |
| P1 | 本地模型/自定义 endpoint/base_url/思考程度 | 第一梯队依赖提升 | 三合一卡片与 LLM adapter 支持 local/openai-compatible provider、自定义 endpoint/base_url、reasoning effort 低/中/高/超高 | 中风险，需避免明文 key 泄露，并保持现有阿里百炼/智谱配置兼容 |
| P0 | 解除环境依赖与硬编码路径 | 第一梯队 | 新增 `coolzhu.toml` 统一配置文件，所有路径/配置从文件读取，禁止新增 `COOLZHU_*`/`CLAW_*` 自定义环境变量业务协议 | 主链已完成 config-first；2026-05-21 规范升级：新增业务配置一律走配置文件，历史 env 只作为兼容债务逐步迁移，技术不可避免例外必须代码注释和 work-log 说明 |
| P1 | 视觉Agent会话选择与模型类型标记 | 第一梯队 | 配置表新增 model_type 列(text/vision/audio/video/embedding/multimodal)；三合一卡片显示模型类型；总览卡片下拉从已保存视觉会话选择视觉Agent；视觉API使用选中会话配置调用 | ✅ 已完成：model_type 全链路 (PersistedSession/SQLite/SessionSummaryDto)；视觉Agent下拉+持久化；vision_session_config；视觉理解与 grounding 分离 |

### 0.2 完成度复盘与优先级重排 - 2026-05-13

本轮复盘依据 `README.md`、本需求表变更记录、`docs/work-logs/2026-05-10~2026-05-12` 连续日志和已落方案文档。结论：项目主线已经从"卡片/API 补齐"进入"数据边界、工具安全、视觉概念拆分、多 Agent 协作"阶段；但需求表曾出现状态漂移和重复编号，必须先修表再推进。

| 领域 | 当前完成度判断 | 主要问题 | 调整后的推进策略 |
| --- | --- | --- | --- |
| Web GUI / 会话 / 多媒体 | 卡片、附件、富文本、SQLite 基础、workspace 入口、删除级联和 LLM 上下文装配已完成 | 多 Agent handoff 仍不完整 | `REQ-WEB-CHAT-007` 继续作为下一批 P1 协同任务 |
| LLM / 模型配置 | 真实 LLM、reasoning effort、model_type、图文输入已可用 | 三合一卡片仍缺自定义 base_url/endpoint UI，文档配置表与前端选项存在漂移 | `REQ-LLM-005` 回到开发中，优先补自定义 OpenAI-compatible/UI 表单与配置诊断 |
| Tooling / 权限 / 审计 | `REQ-TOOL-007/008/009/010/011` 与 `REQ-CORE-TOOL-001` 已闭环；审批 SSE、审计 jsonl、Protected 配置诊断、Web UI、CLI/MCP runtime 与真实 LLM 多 tool_use 均有验收记录 | 后续只保留真实场景回归，不再阻塞需求主线 | 转会话/记忆/协同 |
| Vision / Computer Use | CU-001~008、VIS-001~008 主体已完成，Grounding Router 已有 UIA/LocalVLM/API 接入 | 仅保留 grounding / computer-use 与云端识图；外视觉、双模型常驻、持续监控删除 | 后续只做真实场景回归和必要 bugfix |
| Desktop / Pet / Audio | 桌宠窗口、双击、气泡、动作帧已人工复测通过；桌宠状态后端事件/API 已接入；TTS/STT API 已完成 | 桌宠不新增需求；语音监控/唤醒不保留 | 保留 `REQ-DESK-PET-003` 交互验收，音频只保留 TTS/STT |
| Packaging / 安装迁移 | NSIS、硬件检测、加密资源镜像和完整性校验已有方案 | 当前需求冻结 | 冻结期间不实现，只保留历史方案记录 |

#### 0.2.1 状态修正

- `REQ-TOOL-007`：变更记录和 Phase C13 显示主体已完成，主表从 `待开发` 修正为 `已完成`；并发 `join_all` 与工具超时拆到 `REQ-TOOL-011`。
- `REQ-TOOL-008`：审批 API、SSE、前端面板已落地，主表从 `待开发` 修正为 `测试中`。
- 新增/补入主表：`REQ-TOOL-009/010/011`、`REQ-MEM-006`、`REQ-WEB-PROJECT-003`、`REQ-WEB-CTX-001`。
- `REQ-VIS-008` 重复编号修正：保留 `REQ-VIS-008` 给"Grounding Backend 与 Vision Understanding Agent 职责分离"，原"ShowUI 模型生命周期跟随服务"改为 `REQ-VIS-011`。
- `REQ-LLM-005`：后端已有 custom/openai-compatible 与 reasoning_effort 基础，但前端自定义 endpoint/base_url 表单仍缺，状态从 `已完成` 回调为 `开发中`。

#### 0.2.2 新优先级顺序

| 顺位 | 优先级 | 需求 | 排序理由 |
| ---: | --- | --- | --- |
| 1 | P0/P1 | `REQ-WEB-CHAT-007` | 会话、记忆、workspace 与上下文装配已闭环，下一步收口多 Agent handoff |
| 2 | P1 | `REQ-LLM-005` | 自定义 provider 应成为通用 OpenAI-compatible 厂商/中转/本地模型入口，仅 custom 时显示 base_url/endpoint |
| 3 | P1 | `REQ-DESK-PET-003` | 后端/API 已完成，待真实桌宠窗口交互验收 |
| 4 | G3 冻结 | `REQ-PACK-001~013` | 打包、资源加密、完整性校验全部冻结，不进入当前实现队列 |

### 0.3 D2 窗口内布局与 Goal 工具新增需求 - 2026-05-17

本轮依据用户提供的 `goal.txt`、`goal-driven-multi-agent-orchestration-plan-2026-05-13.md`、D2 多窗口方案和 3 个并行 explorer 只读审计结果，做出以下调整：

- 下半区窗口继续保持现有 10 个窗口，不新增独立 Goal 大窗口。
- Goal 首版归入 `REQ-WEB-WIN-004` 任务 / 授权窗口，聊天窗口只负责 `/goal` 输入触发和启动反馈。
- 设置窗口负责 Goal 角色模型、默认 prompt、skill 配置；记忆窗口负责 Goal plan/phase/summary 的沉淀结果查看；诊断日志窗口负责 Goal 审计和关键步骤诊断摘要，不承载调试拦截开关。
- `REQ-CORE-AGENT-001` 作为 Epic 概念保留在方案来源里，正式需求拆成 `REQ-GOAL-001~009`。
- 新增后续治理需求 `REQ-TOOL-012`，在 D2 窗口功能接入和 Goal G1 后推进工具/插件/SKILL/常用外部工具的场景目录和适配矩阵。

| 优先级 | 需求 | 梯队 | 技术方案 | 风险评估 |
| --- | --- | --- | --- | --- |
| P0 | 任务 / 授权窗口承接 Goal 占位 | 第一梯队 | `REQ-WEB-WIN-004` 增加 Goals 区，展示 goal 状态、phase 时间线、iteration、pause/resume/cancel 预留入口；首版只做布局和数据占位 | 低到中风险，主要是避免与现有 pending approval/handoff/audit UI 冲突 |
| P1 | Goal 后端契约与持久化 | 第二梯队依赖提升 | 新增 `goals`、`goal_phases`、`goal_events/logs` 数据结构，按 workspace/session 隔离 | 中风险，需避免后台任务污染普通聊天室和 session |
| P1 | Goal Loop 复用 handoff/tool/runtime/memory | 第二梯队 | 所有工具调用走 `runtime_tool_execute`，角色投递复用 `chat_handoff`，结果沉淀到 beads | 中高风险，必须限制迭代、token、后台并发和权限上下文 |
| P1 | 工具/插件/SKILL 场景目录 | 第一/第二梯队后续 | 汇总现有工具、插件、Skill 和常用外部工具，按能力、风险、输入输出、授权方式、验证方式建目录 | 中风险，需避免 catalog 与真实 runtime 能力漂移 |

### 0.4 折叠态办公室与记忆/工具优先级重排 - 2026-05-18

本轮依据用户对 D2 下区布局的确认、Star Office UI 像素办公室状态看板思路，以及首次 imagegen 生成 robot 眼睛方向错误的反馈，做出以下调整：

- 3D 像素办公室不直接把 robot 烘焙进背景图；背景图只保留办公室环境，robot/状态标牌由前端可控层渲染，避免生成资产中的眼睛、朝向和动作不可控。
- 新增 `REQ-WEB-OFFICE-001`，从 `REQ-WEB-UI-010` 中拆出，作为“所有窗口折叠后状态场景”的独立验收项。
- 参考 Star Office UI 的状态可视化思路：把 agent、工具、记忆、聊天室状态映射为办公室区域内的 robot worker，而不是引入其 Flask/Phaser 运行时或美术资源。
- 前端设计完成后，优先转入记忆管理和工具治理：记忆窗口补齐真实检索/详情/治理闭环，工具窗口补齐场景目录、权限矩阵、审计筛选和 Goal skill 对齐。
- 完整后端功能接入前端的优先级调整为：办公室折叠态视觉闭环 -> 记忆管理 -> 工具治理 -> Goal runtime G1 -> 其它窗口细节。

| 顺位 | 优先级 | 需求 | 排序理由 |
| ---: | --- | --- | --- |
| 1 | P0 | `REQ-WEB-OFFICE-001` | 下区折叠态是新布局核心反馈面，需要先锁定视觉资产、状态接口和 robot 可控渲染 |
| 2 | P1 | `REQ-WEB-WIN-005` / `REQ-MEM-002~006` | 记忆主体 API 已完成，下一步要把检索、详情、来源追踪、pin/delete 治理在新窗口闭环 |
| 3 | P1 | `REQ-TOOL-012` / `REQ-WEB-WIN-002/004` | 工具权限与审计底座已完成；当前已接入设置窗口工具详情、语义派发 dry-run 和场景/权限矩阵，后续与 Goal skill registry 对齐 |
| 4 | P1 | `REQ-GOAL-002/003/004/006/007/009` | `REQ-GOAL-001` G1 持久化和前端列表已进入测试中；下一步补 CompletionCondition DSL、Phase DAG，再进入角色/loop/event |

### 0.5 Goal 指挥官、完全访问、IndexTTS 与 OpenCLI 新增需求 - 2026-05-19

本轮按用户新增需求重新归类：Goal 角色配置是 Goal Loop 的前置依赖，必须先落在设置窗口和后端角色会话模型；指挥官承担阶段审视、子任务分发、角色状态和长任务风险管理，应独立成需求避免塞进普通 role template。完全访问权限为高风险能力，只允许在任务 / 授权窗口中显式开启，并必须有醒目风险提示、TTL 和审计。IndexTTS 与 OpenCLI 进入后置集成队列，不阻塞当前 Goal G2/G3 后端闭环。

| 优先级 | 新增/调整需求 | 归属 | 决策 | 风险 |
| --- | --- | --- | --- | --- |
| P0 | `REQ-GOAL-004` 调整 + `REQ-GOAL-010` 新增 | Goal Runtime / Agent 协同 | 先实现每会话角色配置、指挥官配置、心跳与超时判断，再启动自动 Goal Loop | 中高风险，需防止无限派发、假完成和后台任务失控 |
| P0 | `REQ-TOOL-013` 新增 | 工具权限 | 完全访问只做显式临时授权，不作为默认模式；开启前提示“允许操作用户电脑文件”的风险 | 高风险，必须审计、可撤销、可过期 |
| P1 | `REQ-TOOL-014` 新增 | 工具治理 | OpenCLI 先作为外部 CLI 能力适配项进入工具目录，后续确认具体项目和命令协议 | 中风险，需命令白名单、超时和输出脱敏 |
| P2 | `REQ-AUDIO-002` 新增 | TTS/STT | IndexTTS 作为本地 TTS provider 候选，优先做配置/探活/调用适配，不打包模型 | 依赖较重，模型资源和 Python 环境后续单独评估 |

### 0.6 当前未闭环问题独立跟踪 - 2026-05-21

本轮根据真实模型链路、工具真实回归和窗口后端接入复核，新增独立跟踪表：`docs/current-issues-and-unfinished-requirements-2026-05-21.md`。

决策：

- 当前开发优先读取该文档中的 `P0 -> P1 -> P2` 顺序推进。
- 已冻结/删除需求不重新进入本轮开发队列：安装包/加密完整性校验冻结，外视觉删除，双视觉模型常驻删除，桌宠不新增，语音监听不保留。
- 每轮修改继续保留真实模型链路和真实工具调用回归；工具回归脚本不允许把 fallback 或 CHECK 当 PASS。
- 后续所有开发围绕四大核心功能验收：会话配置与真实会话链路、工具真实调用、compute-use 工具化真实调用、多 agent 协同与 Goal 长程任务。其它需求可脚本化测试，但不得破坏这四条主线。
- 四大核心功能后续补 imagegen 操作流程指导图和 Remotion 视频化指导，目标是用户按指导流程能完成真实场景操作。
- 除 OS/工具链或第三方 SDK 暂无替代等不可避免场景外，禁止用环境变量承载业务配置；新增配置写入 `coolzhu.toml` 或模块配置文件。

### 0.7 MSVC linker 修复后四大核心链路回归 - 2026-05-22

本轮先修复 Windows Rust MSVC linker 阻断，再用配置文件方式启动最新 `coolzhu-web-console.exe`，不新增业务环境变量。四大核心链路的最新状态如下：

| 主线 | 最新状态 | 证据 |
| --- | --- | --- |
| 会话配置和真实会话链路 | PASS：`test3` DeepSeek 会话真实流式回复，未命中 fallback | `tmp/verification-runs/chat-stream-real-chain-20260522-004040/summary.md` |
| 工具真实调用 | PASS：workspace、文件写/读、授权 PowerShell、WebSearch、清理链路通过；真实 LLM 至少触发 `read_file` 和 `glob_search` 两个 tool_use | `tmp/verification-runs/runtime-tool-api-real-ops-20260522-003902/summary.md`、`tmp/verification-runs/tool011-real-llm-20260522-004203/summary.md` |
| compute-use 工具化真实调用 | PASS/CHECK：接口、权限和浏览器准备通过；真实键鼠视觉命中项仍需人工录屏确认 | `tmp/verification-runs/precise-click-grounding-20260522-004722/summary.md` |
| 多 agent 协同与 Goal 长程任务 | PASS：API 级最小协同回归通过，包含角色配置、心跳、两阶段 plan、commander review、dispatch-ready handoff、status 与取消清理；完整 test3/test1/test2 产物场景仍保留在 CUR-GOAL-REG-001 | `tmp/verification-runs/goal-api-real-smoke-20260522-063331/summary.md` |

## 1. 第一梯队 - Web-GUI 卡片功能接入

模块路径：`modules/gui-web/packages/web-console/`  
核心职责：主控制台、卡片 UI、聊天室、会话、记忆、视觉和工具 API 聚合。

### 1.1 GUI Web 卡片

| REQ-ID | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-WEB-UI-001 | V2 卡片布局填充 | UI | P0 | 已完成 | 左右卡片 x 轴和宽度一致，中央聊天区和底部输入区无重叠 | 以 `gui-web-v2` 为布局草图 |
| REQ-WEB-UI-002 | WebView/浏览器显示一致性 | UI | P1 | 已完成 | Tauri WebView 与浏览器页面三合一卡片字号接近，卡片内容不溢出 | 2026-05-07 G1 人工截图确认浏览器/WebView 控制台主要区域显示正常 |
| REQ-WEB-UI-003 | 三合一卡片字段收敛 | UI | P1 | 已完成 | 去掉调试感字段，保留会话、Provider、模型、Key/记忆状态 | 已移除 `超时` 和 beads 调试列表 |
| REQ-WEB-UI-004 | 工程目录卡片内滚动 | UI | P1 | 已完成 | 工程树内容较多时只在卡片内部滚动 | 已移除分支/变更，仅保留路径和目录树 |
| REQ-WEB-UI-010 | Web GUI 16:9 多窗口重构 | UI/架构 | P0 | 测试中 | 1920x1080 / 16:9 首屏重构为紧凑顶部总览区与主工作台：顶部约 12%，严格按 26% / 48% / 26% 分配总览卡、竹林 Logo 与任务卡；下区由唯一主导航切换各功能窗口，不保留重复页眉、说明条或静态假遥测 | 2026-06-19 V3 Batch 2 已按批准设计收紧顶部高度并恢复 26/48/26；Computer Use 在 packaged Tauri 中确认总览、Logo、任务卡与工作台无额外标题占位 |
| REQ-WEB-OFFICE-001 | 折叠态 3D 像素 robot 办公室 | UI/API | P0 | 测试中 | 所有窗口折叠后，下部分展开区域显示 imagegen 生成的马里奥风格 FC 像素办公室背景；robot 不烘焙进背景，由前端可控层按 `/api/office/scene` 状态渲染 agent/tool/memory/chat worker；robot 形象使用 imagegen 生成动作帧 sprite sheet，状态包含 idle/active/waiting/warning/archiving/chatting；无角色眼睛朝向、裁切或错位问题 | 2026-05-18 完成二次视觉修订：生成透明 `office-robot-sprites.png` 动作帧图并替换 CSS 拼装 robot；随后按 alpha bbox 裁剪角色视窗并以可见脚底为锚点，修复脚不着地；自动验证通过，Edge CDP 截图 `tmp/web-ui-office-scene-1920x1080.png` 通过 |
| REQ-WEB-WIN-001 | 工程目录 / IDE 独立窗口 | UI/API | P0 | 测试中 | 文件树可展开，文件预览支持文本分页/二进制保护，Diff View 支持 worktree/staged/head 只读查看，workspace 切换后清空选中文件状态 | 2026-06-19 V3 Batch 2：搜索、Diff、刷新和差异参数收敛到左侧命令栏；选择文件自动预览并删除重复 Preview 动作；右侧改为全高内容/Diff 区。Computer Use 已在 packaged Tauri 中验证布局 |
| REQ-WEB-WIN-002 | 设置独立窗口 | UI/API | P0 | 测试中 | 会话/模型/Custom provider/视觉 Agent/TTS-STT/工具目录分区清晰；工具与审批栏默认按设计图显示本地模型、CLI、MCP、Skill、compute-use、Semantic Dispatch 六行状态清单，旧详情仅在“管理/启用/计划配置”后按需展开；工具调用状态以红/绿/灰状态灯表达，聊天流不展示工具调用细节 | 前端窗口首版已接现有会话、工具、音频和视觉 Agent 配置；2026-05-18 工具区补齐 `/api/tools/{tool_id}` 详情、`/api/tools/dispatch` 语义派发 dry-run 和场景/权限矩阵；2026-06-20 工具与审批栏完成设计图对齐，保留真实目录与语义派发能力但默认折叠详细控制区，Computer Use 已验证管理面板展开/收起与计划配置切换 |
| REQ-WEB-WIN-003 | 聊天室独立窗口 | UI | P0 | 测试中 | 左侧会话栏紧凑有界，主消息流优先占据可视区，底部输入区固定且高度约 10%；引用/附件/手工转交入口不遮挡消息流；不得重复显示“Communication Bay”或“通讯发射台”等页内标题 | 2026-06-19 V3 Batch 2：左栏按聊天室、频道/模型、接收者、紧凑会话操作重排；composer 收紧为 62~76px；删除重复标题和说明条。Computer Use 已在 packaged Tauri 中验证真实聊天记录与输入区布局 |
| REQ-WEB-WIN-004 | 任务 / 授权 / Goals 独立窗口 | UI/API | P0 | 测试中 | 三列呈现待审批/定时任务、默认与外部目录/full access 权限配置、真实模块自检；full access 必须显示会话级时效与撤销口径；模块状态不得使用静态假数据 | 2026-06-19 V3 Batch 2：诊断 health/check/suggestions 已迁入模块自检列，日志窗口保留审计与 tail；Computer Use 实测自检为 `WARN / ok 10 / warn 1 / error 0`，full access 文案与后端 TTL 保持一致。2026-06-20 Round3：按批准设计图重构任务授权窗口，左侧待审批+Goal，中间授权配置，右侧模块自检；模块自检映射 Web Console/Desktop Pet/Local Model/Vision/TTS-STT/MCP/Plugin/Packaging/Logs 九行真实 health checks，隐藏旧 suggestions/self-update 首屏文本，Computer Use 已在 packaged Tauri 中点击验证。 |
| REQ-WEB-WIN-005 | 记忆 / 知识独立窗口 | UI/API | P1 | 测试中 | beads 支持检索、kind/layer/pinned/source 筛选、详情、来源追踪、pin/edit/delete 操作；窗口显示 summary、prompt preview、context preview，并保证当前 session/workspace 边界一致 | 2026-05-18 已接入真实 `/beads/summary`、`/beads/prompt`、`/context-preview`，详情区补齐 pin/edit/delete 治理动作；自动验证与 Edge CDP 截图 `tmp/web-ui-memory-window-1920x1080.png` 通过，待人工确认视觉与交互手感 |
| REQ-WEB-WIN-006 | 多媒体播放器独立窗口 | UI/API | P1 | 测试中 | 基于附件索引展示图片/音频/视频媒体库，支持预览播放和前端播放列表 | 前端首版完成：附件媒体库、类型过滤、Now Playing、播放列表；不做视频理解/关键帧 VLM 首版 |
| REQ-WEB-WIN-007 | 视觉实验独立窗口 | UI/API | P1 | 测试中 | capture、describe、locate、dry-run action、profile 证据链集中展示，真实输入默认关闭 | 2026-06-19 V3 Batch 2：按约 18/60/22 重排命令、截图证据与结果摘要；profiles/capabilities/backend/raw realtime 收进折叠高级详情。Computer Use 已验证证据优先布局，真实输入仍默认关闭 |
| REQ-WEB-WIN-008 | 诊断日志独立窗口 | UI/API | P1 | 测试中 | 显示 diagnostics health、修复建议、日志 tail、工具审计日志筛选；只记录关键步骤诊断，不提供调试拦截/禁用执行类开关；Web 绑定端口诊断必须与实际启动变量 `COOLZHU_WEB_BIND_ADDR` 一致 | 前端首版完成：health、修复建议、工具审计摘要、logs tail 占位；2026-05-20 调整：移除 `goal.runtime` 禁用派发口径，Goal 运行关键步骤改通过 `goal_events` caller/payload 和诊断日志定位；同日补 Web bind 诊断变量一致性；logs tail/SSE 后端后续补 |
| REQ-WEB-WIN-009 | 浏览器独立窗口 MVP | UI | P2 | 测试中 | URL/搜索输入、页面展示尝试、CSP/X-Frame 失败兜底、外部打开按钮 | 2026-06-19 V3 Batch 2：代理配置移入折叠高级设置，主 iframe 获得剩余全部高度，移除装饰性说明文本；Computer Use 已验证主浏览区布局 |
| REQ-WEB-WIN-010 | 终端命令面板窗口 | UI/安全 | P2 | 测试中 | 单条命令通过 `/api/tools/runtime-execute` 执行，危险命令必须审批并落审计，输出限流 | 2026-06-19 V3 Batch 2：输出区成为主区域，命令、timeout、运行与清理控件固定底部；原始执行响应移入折叠详情。Computer Use 仅验证布局，未通过 UI 执行命令 |
| REQ-WEB-OVERVIEW-001 | 总览卡片指标重构 | UI/API | P0 | 已完成 | 总览卡片在顶部 26% 列内紧凑显示健康状态、已激活 Agent 数、聊天室数、Goal roles 与当前视觉 Agent，不显示 health error/debug 明细 | 已改 `/api/state` 聚合 overview 指标并移除诊断明细；2026-06-19 V3 Batch 2 将卡片高度收至顶部约 12%，Computer Use 已确认指标仍可见 |
| REQ-WEB-TASKCARD-001 | 顶部任务卡片紧凑化 | UI/API | P0 | 测试中 | 任务卡占顶部右侧 26%，显示当前任务、进度、Running/Completed/Queued/Failed 与 Success Rate；不展开 todo 或诊断明细，不挤占主工作台 | 2026-06-19 V3 Batch 2 已按设计图完成紧凑化，Computer Use 在 packaged Tauri 中确认任务状态与进度仍可读 |
| REQ-WEB-VIS-003 | 内视觉截图缩略图 | 内视觉卡片 | P1 | 已完成 | 内视觉卡片显示最新截图缩略图，路径仅作为 tooltip | 按钮固定底部，缩略图占据上方剩余空间 |
| REQ-WEB-CHAT-001 | 真实模型流式聊天室 | 聊天室 | P0 | 已完成 | SSE 显示回复、推理、完成和错误事件，失败可回退普通发送 | 已验证 `agent-test002` |
| REQ-WEB-CHAT-002 | 多 Agent 聊天室历史 | 聊天室 | P0 | 已完成 | 切换 `agent-test001/002` 后对话回复和推理卡片保留历史 | 后续补引用转发 |
| REQ-WEB-CHAT-003 | 回复引用与转发 | 聊天室 | P1 | 已完成 | 可选择历史回复引用到新消息，并可转发给其他 agent 会话 | 已补结构化引用上下文、引用预览/清除、转发记忆 bead；Web 交互已手动确认 |
| REQ-WEB-CHAT-007 | 聊天室多 agent 角色感知与消息流转 | 聊天室 | P1 | 测试中 | (1) 聊天室内多 agent 互相感知（roster 广播）；(2) 新增/删除会话对象实时更新 roster；(3) LLM A 按约定指令或工具把任务转交给 peer B（handoff），支持 @name / fenced `handoff` block / `chat_handoff` 工具三层寻址；(4) 任务链防环：max_depth=4、per-turn 8 次、60s 去重、禁自环/回环；(5) 投递走 REQ-TOOL-007 运行时与 REQ-TOOL-008 审批闸门，审计落 `tool-audit.jsonl`；(6) 前端成员条 + 任务链抽屉 + 手工 "转交" 按钮 | Phase D1 已完成：`/api/chat/rooms/{room_id}/roster?me=` 返回同聊天室 peers；Phase D2 已完成：roster 注入 LLM system prompt，支持 fenced `handoff` 与 JSON handoff 解析、大小写/名称解析；Phase D3a 已完成：self-loop/depth/cycle/quota/dedup 防环闸门纯函数；Phase D3b 已完成：SQLite `chat_handoffs` schema v3、任务链查询 API、手工 handoff API、inbound handoff 消息和 save 后任务链保留；Phase D3c 已完成：非流式/流式 LLM 回复中的 fenced handoff 自动落任务链并生成目标 inbound 消息，链式转交沿用原始 user turn 和 depth；Phase D4 代码完成待交互确认：前端成员条、任务链抽屉、手工转交入口已接后端 API，布局效果后续统一设计；Phase D5 已完成：`chat_handoff` 暴露给 LLM tool registry，模型 tool_use 可直接创建 handoff 任务链、注入 inbound 消息，并落 `tool-audit.jsonl` 审计 |
| REQ-WEB-SESSION-001 | 会话 CRUD 与激活 | 会话管理 | P0 | 已完成 | 新建、更新、删除、激活会话后消息和 beads 不串会话 | JSON store 阶段 |
| REQ-WEB-SESSION-002 | 会话 SQLite 存储 | 会话管理 | P1 | 已完成 | 支持 SQLite 落盘、JSON 迁移/备份、容量上限和老化 | 已落地 schema 和容量策略，后续补分页、并发写入、备份恢复 |
| REQ-WEB-SESSION-007 | 会话内容删除联动记忆删除 | 会话管理 | P0 | 已完成 | (1) 删除会话时 CASCADE 删除所有关联聊天室消息和 memory beads；(2) 单条消息删除含确认弹窗；(3) 单条 bead 删除含确认弹窗 | 2026-05-15 完成：SQLite 往返持久化 `origin_message_id/origin_table/token_count` 与 `attachment_refs`；聊天室删除改为事务化 SQL `DELETE`，由 FK/trigger 回收消息和衍生 beads；附件 GC 只清理无引用文件；Web UI 新增聊天室重命名、聊天室删除 impact 确认、所选消息删除确认、bead 列表单条删除确认；web-console 全量 211 passed |
| REQ-WEB-CTX-001 | LLM 历史上下文装配 | 聊天室/上下文 | P1 | 已完成 | LLM 请求能装配 system、相关 beads、最近历史、当前 user turn，并提供 context preview 与 token 预算 | 2026-05-15 完成：新增 `ContextAssembly/ContextBuildOptions/ContextTokenBudget`，非流式、流式和 tool-loop LLM 请求均使用聊天室历史窗口 + 相关 beads + 当前 user turn；新增 `/api/sessions/{session_id}/context-preview`；`coolzhu-web-console` 全量通过 |
| REQ-WEB-MEDIA-001 | 多媒体消息展示 | 多媒体 | P1 | 已完成 | 图片、视频、音频、文档、链接可在消息中预览 | 当前以 URL/附件元数据为主 |
| REQ-WEB-MEDIA-002 | 附件索引 API | 多媒体 | P1 | 已完成 | 房间级和全局附件索引可按类型过滤 | 已有 `/api/attachments/index` |
| REQ-WEB-MEDIA-003 | 富文本输入与上传 | 多媒体 | P1 | 已完成 | 支持 Markdown、粘贴图片、文件上传、草稿恢复；大文件在配置上限内不得被框架默认 body limit 提前拒绝 | 2026-06-24 修复 Axum multipart 默认 2 MiB 限制：路由 body limit 跟随 `[attachment].max_upload_bytes`，3 MiB 实际上传成功，超 32 MiB 业务上限返回 413 |
| REQ-WEB-MEDIA-004 | 富媒体消息点击与选中解冲突 | 多媒体 | P1 | 已完成 | 链接、图片、视频可点击/播放；点击交互控件不触发消息选中 | 用户已确认富文本内容显示正常 |
| REQ-WEB-MEDIA-005 | 消息发送文件按钮 | 多媒体 | P1 | 已完成 | 消息发送卡片提供文件选择按钮，选中文件可作为附件随消息发送并进入附件索引；上传上限由 config 管理 | 2026-06-24 与 `REQ-WEB-MEDIA-003` 同源修复；实际 multipart 上传和附件索引链路通过，前端视觉由用户人工确认 |
| REQ-WEB-MEDIA-006 | 聊天室音频富文本播放 | 多媒体 | P1 | 已完成 | Markdown/URL/附件中的 mp3、wav、ogg、webm 音频可显示 `<audio controls>` 并不触发消息选中 | 已补 Markdown/裸 URL inline audio control、附件音频预览和点击排除，自动化验证通过 |
| REQ-WEB-PROJECT-001 | 工程目录路径切换 | 工程管理 | P1 | 已完成 | 工程目录卡片可设置 workspace，刷新目录树；工具执行、记忆、聊天室数据按 workspace 边界隔离 | 已补 `/api/workspace`、allowed roots、双击路径编辑、目录刷新和稳定 `workspace_id`；SQLite 数据跟随 workspace 路径切换 |
| REQ-WEB-PROJECT-002 | 默认 workspace 与当前聊天室环境隔离 | 工程管理/权限 | P0 | 已完成 | 默认 workspace 为 `C:\Users\<用户名>\coolzhuagent`；用户设置路径后当前聊天室内容、环境和 Agent 默认文件读写权限限制在该路径 | 已补默认目录创建、用户目录内 workspace 设置与 `core.read_file/glob_search/grep_search` 路径边界测试；SQLite 会话/聊天室/bead 数据均随 workspace 切换 |
| REQ-WEB-PROJECT-003 | WorkspaceScope reload 与会话存储随动 | 工程管理/数据边界 | P0 | 已完成 | 切换 workspace 时 session store、attachment root、audit path、config scope 原子切换；`/api/workspace/reload` 可验证新旧 workspace 数据不串 | 2026-05-14 用户复测 PASS：工程目录、会话配置、发送对象、聊天室聊天记录均已随 workspace 切换刷新；新增前端刷新契约 TDD，`coolzhu-web-console` 全量 199 passed |
| REQ-WEB-API-001 | 卡片未接后端 API 补齐 | API | P1 | 已完成 | 每张卡片有明确 endpoint、loading、error、empty 状态 | `/api/web/cards` 审计已覆盖主卡片且全部 ready；前端已补视觉、会话/Agent 加载错误态；外视觉和语音监听卡片后续从新布局删除 |

### 1.2 Web-GUI 直接支撑依赖

这些需求虽然分布在 LLM、Tooling、Diagnostics 和 Audio 模块，但会直接影响 Web-GUI 卡片是否能完整接后端，因此按第一梯队执行。

| REQ-ID | 模块 | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-LLM-001 | LLM Adapter | Alibaba Bailian 兼容适配 | Provider | P0 | 已完成 | `agent-test001/002` 能真实流式返回 | 不暴露明文 key |
| REQ-LLM-002 | LLM Adapter | Provider 诊断 | Provider | P1 | 已完成 | 返回 provider kind、base_url、model、key 状态和错误分类 | 支撑三合一卡片配置诊断 |
| REQ-LLM-003 | LLM Adapter | 结构化 tool call | Tool Calling | P1 | 已完成 | 模型 tool_use 转 dry-run dispatch + 二轮 tool result 回灌 LLM | 流式/非流式均支持 tool loop；`[TOOL-LOOP-STREAM]` 实测验证通过 |
| REQ-LLM-005 | LLM Adapter | Custom 自定义厂商 / OpenAI-compatible 模型配置 | Provider | P1 | 开发中 | Provider 列表新增 `Custom`，既可接本地模型，也可接不在配置总表内的厂商模型和中转平台；三合一卡片保持现有紧凑布局，`base_url` 和 `endpoint` 仅在 provider=Custom 时显示与保存；reasoning effort 低/中/高/超高/最大继续可用 | 2026-06-18 审计发现 Custom 空 key 会发送 `Bearer EMPTY`、历史非 Custom base_url 可能误走 OpenAI-compatible 等协议漂移，回到开发中按协议矩阵修复 |
| REQ-LLM-006 | LLM Adapter / GUI Web | 会话协议显式路由与兼容性收口 | Provider Protocol | P0 | 开发中 | OpenAI-compatible 文本会话使用标准 Chat Completions；Anthropic、图片、视频等例外使用显式专用协议；model_type、URL、鉴权和 tool result 跨持久化/DTO/客户端保持一致 | 2026-06-18 已完成静态审计，确认 Anthropic 重复 `/v1`、model_type 丢失、媒体 endpoint 重复版本路径等风险；设计见 `docs/superpowers/specs/2026-06-18-pet-local-model-session-protocol-agent-reach-design.md` |
| REQ-TOOL-001 | Tooling | 语义工具调度 | 工具 | P1 | 已完成 | `/api/tools/dispatch` 返回稳定 `dispatch_plan.llm_tool_call` | 5项 dispatch 自动化测试通过 |
| REQ-TOOL-002 | Tooling | dry-run/execute 策略统一 | 安全 | P1 | 已完成 | 所有危险工具默认 dry-run，execute 需显式授权 | action_plan_rejects_execute 测试通过 |
| REQ-TOOL-003 | Tooling | 工具卡片后端目录 API | 工具 | P1 | 已完成 | `GET /api/tools/catalog` 返回工具/插件/SKILL 分类目录 | 已接入前端分类展示 |
| REQ-TOOL-004 | Tooling | opencode 插件/SKILL 迁移评估 | 插件/SKILL | P1 | 已完成 | 扫描 opencode master-project，列出可迁移项和依赖风险 | catalog 已包含 Core/Vision/CU/Plugins/Skills 分类 |
| REQ-DIAG-001 | Diagnostics | 一键健康检查 | 诊断 | P1 | 已完成 | 输出 Web、Tauri、LLM、视觉、音频、工具、数据目录的健康状态 | 9项诊断自动化测试通过 |
| REQ-DIAG-002 | Diagnostics | 错误修复建议 | 诊断 | P1 | 已完成 | 常见 base_url、端口占用、WebView2 缺失可提示修复 | 端口恢复/LLM修复建议/WebView2检测全部测试通过 |
| REQ-AUDIO-001 | Audio | 本地 STT/TTS API | 音频 | P1 | 已完成 | `/api/audio/status`、`/api/audio/stt/*`、`/api/audio/tts/speak` 可返回结构化结果 | 62项音频测试通过；音频范围收敛为 TTS/STT，不再保留语音监控/唤醒需求 |
| REQ-AUDIO-002 | Audio | IndexTTS 本地 TTS Provider 集成 | 音频 | P2 | 待开发 | 设置窗口可选择 IndexTTS provider，后端支持探活、base_url/endpoint 或本地进程模式配置，`/api/audio/tts/speak` 可路由到 IndexTTS 并返回音频结果/错误分类 | 参考 GitHub `index-tts/index-tts`；首版只做配置与调用适配，不打包大模型资源 |

## 2. 第二梯队 - Core Runtime 与记忆系统

模块路径：`modules/core-runtime/packages/core-runtime/`  
核心职责：运行时、会话、权限、MCP、分层记忆。

| REQ-ID | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-MEM-001 | 分层 beads 规则 | 记忆系统 | P1 | 已完成 | L0-L4 可归一，prompt 选择跳过 L4，查询支持 layer 和关键词 | 单测通过 |
| REQ-MEM-002 | beads 持久化服务 | 记忆系统 | P1 | 已完成 | 会话级 beads 提供 CRUD、query、summary、prompt preview API | Web store API 已闭环；新增 CRUD/签名去重/摘要统计 TDD 测试 |
| REQ-MEM-003 | 自动记忆沉淀 | 记忆系统 | P1 | 已完成 | 聊天摘要、用户偏好、决策、工具结果自动生成 beads | 流式/非流式均沉淀，已补去重和容量上限；新增去重签名 TDD 测试 |
| REQ-MEM-004 | 检索增强 prompt | 记忆系统 | P1 | 已完成 | 构建 prompt 时按 session/query 选择高价值 beads | prompt preview 已支持 q/layer/kind/prompt_only/limit 查询；新增 L4 过滤+limit TDD 测试 |
| REQ-MEM-005 | 记忆治理 | 记忆系统 | P1 | 已完成 | 支持 pin、update、delete、query、summary | 治理排序、去重签名、summary 和容量裁剪已下沉 runtime；新增 pin 保留+容量裁剪 TDD 测试 |
| REQ-MEM-006 | bead origin 归因与 token 估算 | 记忆系统 | P1 | 已完成 | 自动沉淀 bead 记录 origin_message_id/origin_table/token_count，删除消息时可精准回收衍生记忆 | 2026-05-15 验证完成：`save_session_state_to_sqlite` 已持久化 origin/token，新 SQL trigger 在聊天室/会话消息删除时精准回收衍生 beads；覆盖 SQLite 往返与级联删除 TDD |
| REQ-CORE-TOOL-001 | 工具调用编排 | 工具 | P1 | 已完成 | LLM tool call、Web dispatch、CLI tool、MCP tool 走统一 runtime 协议 | Web/LLM 入口已走 `runtime_tool_execute`；CLI `CliToolExecutor` 已改为 `ToolInvoke(caller=Cli)`；MCP `McpServerManager::call_tool_through_runtime` 已补 `ToolInvoke(caller=Mcp)` 门禁包装。2026-05-15 复核：fake MCP stdio server 真实进程交互 2 passed（允许工具真实 `tools/call`、越界 WorkspaceWrite 在 `tools/call` 前 dry-run 拦截），`coolzhu-core-runtime` 串行全量 123 passed，状态更新为已完成 |

### 2.1 Goal-Driven 多角色 Agent 编排

来源：`C:\Users\zhupu\Desktop\goal.txt` 与 `C:\Users\zhupu\Desktop\goal-driven-multi-agent-orchestration-plan-2026-05-13.md`。`REQ-CORE-AGENT-001` 作为 Epic 概念保留，正式开发拆成以下可验收需求。

| REQ-ID | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-GOAL-001 | Goal 契约、状态与持久化 | Goal Runtime | P1 | 测试中 | 支持创建、查询、取消 goal；字段包含 workspace_id、chat_room_id、title、status、max_iterations、current_iteration、background、originating_user_msg_id；goal 数据按 workspace 隔离 | 2026-05-19 已完成 SQLite schema v4（goals/goal_phases/goal_events）、`GET/POST /api/goals`、`GET /api/goals/{id}`、`POST /api/goals/{id}/cancel` 和任务窗口只读接入；TDD/构建/CDP 截图通过 |
| REQ-GOAL-002 | CompletionCondition DSL 与验证器 | Goal Runtime | P1 | 测试中 | 支持 FilesExist、CommandSucceeds、FileContains、All、Any、LlmJudge、UserConfirm；CommandSucceeds 必须走 runtime 工具权限；超时、失败、审批中状态可区分 | 2026-05-19 已完成结构校验和安全预检 API `/api/goals/conditions/validate`；CommandSucceeds 标记需要 runtime tool，不执行真实命令；路径条件拒绝绝对路径和父级逃逸 |
| REQ-GOAL-003 | GoalPlan / GoalPhase 编排模型 | Goal Runtime | P1 | 测试中 | 支持 phase DAG、拓扑排序、phase 状态机、产物路径、每 phase 验证条件；非法依赖创建时拒绝或进入 Failed | 2026-05-19 已完成 `/api/goals/{goal_id}/plan`，支持 phase 持久化、DAG 循环拒绝和任务窗口 Seed plan 入口；状态机执行留给 `REQ-GOAL-006` |
| REQ-GOAL-004 | 角色模板、会话角色配置与 Goal Role Session | Agent 协同 | P1 | 测试中 | 提供 planner、implementer、reviewer、designer、tester、releaser、documenter、verifier 8 个角色模板；每个普通会话可配置角色、责任规则、provider/model/system_prompt；首次使用可自动创建 `goal-<role>` session | 2026-05-19 已完成 SQLite `goal_role_configs`、Goal role 配置 API、设置窗口角色/责任规则配置；新增 `/api/goals/roles/bootstrap`，可按当前会话 provider/model/key/base_url 克隆创建 `goal-<role>` session，并写入 pinned `goal-role-template` memory bead 作为 system prompt 注入来源；2026-05-20 已补 Goal phase `assigned_role` -> `goal-<role>` session 解析字段，任务窗口可显示 ready/missing 分发目标；真实自动执行/投递归 `REQ-GOAL-006` |
| REQ-GOAL-005 | Skill 注册与执行约束 | Agent 协同 | P2 | 待开发 | 提供 plan、implement、test、review、simplify、debug、document、design、security-audit、release、verify、decompose、estimate、benchmark 14 个 goal skill；每个 skill 声明 requires_tools/requires_permission | 与 `REQ-TOOL-012` 适配矩阵对齐 |
| REQ-GOAL-006 | Goal Loop 引擎 | Agent 协同 | P1 | 开发中 | `/goal` 可启动 plan -> execute -> verify 主循环；max_iterations 和 token 预算生效；phase 通过 handoff 分派；失败有明确 Failed/Pause 原因；功能完成后不得保留调试性执行拦截闸口 | 2026-05-20 已完成最小派发闭环：新增 `POST /api/goals/{goal_id}/dispatch-ready`，复用 commander review 判定，只把 `ready_to_dispatch` phase 投递为 chat handoff，成功后 phase 标记为 `running` 并写入带 `caller=goal-loop` 的 `goal-phase-dispatched` 事件；任务窗口新增 Dispatch 按钮；同日按用户要求回撤 `[goal].enabled=false` 派发熔断，只保留关键事件诊断。2026-05-22 API 级最小协同回归通过，证据 `tmp/verification-runs/goal-api-real-smoke-20260522-063331/summary.md`；仍待自动循环、预算、失败/Pause 状态机、verify 回收和 test3/test1/test2 真实产物场景 |
| REQ-GOAL-007 | 后台 Goal 与事件流 | Agent 协同 | P1 | 开发中 | 支持 background goal、pause/resume/cancel/status；SSE 推送 goal-created、planning、phase-started、phase-completed、failed、paused、completed、iteration | 2026-05-20 已完成 `GET /api/goals/{goal_id}/status`、`POST /pause`、`POST /resume`、`GET /events` SSE；pause/resume 写入 `goal-paused`/`goal-resumed`，GoalEvent 仍独立于 ToolEvent；任务窗口新增 Status/Pause/Resume 与 EventSource 自动刷新。仍待 Goal Loop 产生 phase-started、phase-completed、failed、completed、iteration 等运行期事件 |
| REQ-GOAL-008 | 自愈与 Plan 修正 | Agent 协同 | P2 | 待开发 | phase/goal 验证失败后可交 reviewer/tester 分析，再交 planner 插入修复 phase；连续失败或超限自动暂停并提示用户 | 防止 planner 降级完成条件导致假完成 |
| REQ-GOAL-009 | Goal 审计与关键步骤诊断 | 审计/诊断 | P1 | 开发中 | goal 内工具调用、handoff、phase 状态变更落审计，caller=goal-loop；关键步骤写诊断事件和日志；不得用调试开关禁用正式执行路径 | 2026-05-20 已明确移除 `[goal].enabled` 运行闸口、`/api/goals/runtime` 与 `goal-runtime-disabled` 事件口径；保留 `goal-phase-dispatched`/`goal-commander-review` 事件中的 `caller=goal-loop` 作为诊断锚点。仍待统一 Goal 审计视图和真实工具调用审计归档 |
| REQ-GOAL-010 | 指挥官配置、角色心跳与长任务风险管理 | Agent 协同 | P0 | 测试中 | 可配置 commander 会话/模型/责任规则；指挥官负责审视每个 phase 完成情况、分发子任务、管理角色在线心跳、识别角色任务会话卡住/超时，并对长时任务输出风险状态和暂停建议 | 2026-05-19 已完成 commander 标记唯一性、`POST /api/goals/roles/{session_id}/heartbeat`、online/stuck/risk_level 计算、`goal-role-risk` 事件去重写入 `goal_events`、任务 / 授权窗口 Role risks 摘要；2026-05-20 新增 `/api/goals/{goal_id}/commander/review`，可审视 phase 目标会话缺失、role offline/stuck、依赖未完成并写入 `goal-commander-review` 事件，任务窗口新增 Review 入口；2026-05-22 API 级回归验证 commander、planner、implementer 角色配置、心跳和 review/dispatch 联动通过；自动循环完成审视仍待 `REQ-GOAL-006` |

## 3. 第三梯队 - Computer Use 与内视觉

模块路径：`modules/computer-use/`、`modules/vision/`  
核心职责：屏幕理解、坐标定位、安全执行闭环。

| REQ-ID | 模块 | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-CU-001 | Computer Use | 全屏随机 safe-click 靶场 | 安全执行 | P1 | 已完成 | 靶场随机出现在屏幕安全区域，三位数字随机，点击命中后返回证据 | 几何回退实测命中+截图证据；强视觉由 REQ-CU-002 收口 |
| REQ-CU-002 | Computer Use | 强视觉识别点击 | 内视觉 | P1 | 已完成 | `use_visual_grounding=true` 时点击点必须来自截图识别结果 | ShowUI 实测：`visual-grounding` → [0.35,0.43] → 像素映射 → 点击命中 |
| REQ-CU-003 | Computer Use | 浏览器内操作场景 | 内视觉 | P1 | 已完成 | 覆盖地址栏、页面搜索、按钮确认、表单输入 | 15项自动化 dry-run 测试通过 |
| REQ-CU-004 | Computer Use | Windows 应用内操作场景 | 内视觉 | P1 | 已完成 | 覆盖记事本、文件选择框、系统确认弹窗等 | 15项自动化 dry-run 测试通过 |
| REQ-CU-005 | Computer Use | 执行审计与权限 | 安全 | P1 | 已完成 | 真实点击/输入必须有 execute 开关、截图证据、日志 | 审计记录/权限闸门/截图证据/日志路径全部实现并测试通过 |
| REQ-CU-006 | Computer Use | 鼠标动作原语补齐 | 安全执行 | P1 | 已完成 | 支持左键/右键/double-click、滚轮、文本输入、按键/快捷键、拖拽轨迹和 Esc 恢复 | 底层原语+dry-run 计划+自动化测试通过 |
| REQ-CU-007 | Computer Use | 右键菜单操作闭环 | 安全执行 | P1 | 已完成 | 可右键打开菜单，视觉识别菜单项，点击目标项，失败后恢复 | safe-context-menu dry-run 测试通过 |
| REQ-CU-008 | Computer Use | 左键拖拽区域框选闭环 | 安全执行 | P1 | 已完成 | 视觉识别 bbox 后生成拖拽起止点，能框选浏览器/Windows 应用内区域 | safe-drag-select dry-run + visual_action bbox→drag path 测试通过 |
| REQ-VIS-001 | Vision | 本地 VLM/OCR 接入 | 视觉 | P1 | 已完成 | 可返回目标框、置信度、相对坐标、来源截图 | ShowUI 实测：`grounding-model-parsed` + point(597,412) + 截图证据 |
| REQ-VIS-002 | Vision | 云端视觉模型识图 | 多媒体视觉 | P2 | 待开发 | 图片附件和必要的视频关键帧可通过用户选择的云端多模态模型识别，返回结构化描述 | 仅保留云端识图能力；不做外视觉、不做持续监控、不要求本地双模型常驻 |
| REQ-VIS-003 | Vision | 内视觉截图文字描述工具 | 工具视觉 | P1 | 已完成 | 最新截图可转换为文字描述，并作为工具返回结构化结果 | `/api/vision/describe-screen` 返回 metadata + 截图信息，测试通过 |
| REQ-VIS-004 | Vision | 视觉 point/bbox/confidence 协议 | 工具视觉 | P1 | 已完成 | 支持 `[x,y]`、JSON point、bbox、confidence 和多候选解析 | 自动化测试通过 |
| REQ-VIS-005 | Vision | 本地 VLM 启动检查资源集成 | 本地模型 | P1 | 已完成 | 项目资源内提供本地 VLM 启动/检查脚本 | start-local-vlm.ps1/check-local-vlm.ps1 已集成 |
| REQ-VIS-006 | Vision | 统一 Vision Tool Service 能力接口 | 工具视觉 | P1 | 已完成 | 暴露统一能力接口 | VisionToolService + capability API 已完成 |
| REQ-VIS-007 | Vision | 本地/远端视觉模型 profile 与容量评估 | 本地/远端模型 | P1 | 已完成 | 评估同跑可行性 | 结论：只保留互斥 profile 与云端兜底；双视觉模型常驻不保留 |
| REQ-VIS-008 | Vision | 视觉 Agent / Grounding Backend 职责分离与 Precise-Click Router 收口 | 视觉理解 / Grounding / Computer Use | P0 | 已完成 | (1) 删除 `system-vision-agent` 硬编码条目；(2) `is_multimodal_agent` 移除 `"showui"` 关键词；(3) `build_overview_metrics` 改查 session_store，不再回退到 ShowUI；(4) 新 DTO `UnderstandingAgentDto / GroundingBackendHealth`；(5) 新端点 `/api/agents/understanding` 与 `/api/vision/grounding/backends`（保留 `/locate/backends` alias）；(6) 前端 `renderVisionAgentSelect` 只列用户多模态会话，绝不显示 ShowUI；(7) `ConfigVisionRouter` 挂入 `ConfigVision` 并写入默认模板；(8) `api_tool_execute` 真实点击改走 locate router，放弃 taskbar 硬编码锚点；(9) router pipeline 行为有 TDD 覆盖；(10) 真实交互验收 PC-SAFE-001~003 与 PC-BR-001 PASS | 2026-05-14 已修复截图逻辑坐标到物理输入坐标换算、右键菜单目标项真实坐标解析、LocalVLM 低置信绿色按钮颜色区域兜底、测试服务绑定/桌宠禁用开关和浏览器渲染截图验收；最终 run `precise-click-grounding-20260514-073146` 通过关键项，详见 work-log |
| REQ-TOOL-005 | Tooling | 内视觉目标点击工具化 | Computer Use | P1 | 已完成 | 通过工具调用完成目标识别、dry-run 和显式 execute 点击 | computer.visual_action 组合 grounding + action plan 全链路测试通过 |
| REQ-TOOL-006 | Tooling | Computer Use 动作工具细分 | Computer Use | P1 | 已完成 | 工具目录暴露所有动作工具 | 工具目录+dispatch 链路+自动化测试全部通过 |
| REQ-TOOL-007 | Tooling | LLM 多工具调用适配 | Tool Calling | P0 | 已完成 | `llm_tool_definitions()` 暴露内置工具；`run_model_tool_dispatch` 通过 runtime 执行；流式/非流式 ToolResult 结构化回灌 | Phase C13 主体完成，`web-console 186 / core-runtime 121 / tool-registry 34 / linkage_smoke 4` 全绿；并发 `join_all` 与超时抽到 `REQ-TOOL-011` |
| REQ-TOOL-008 | Tooling | 工具权限分级审批 | 安全 | P0 | 已完成 | 键鼠/高危操作支持按时间授权，避免长任务频繁授权；workspace 外文件操作必须授权；workspace 内 `coolzhu.toml`、`.coolzhu/**`、关键 SQLite 数据库等 Protected 路径必须授权和二次确认；ReadOnly 自动执行 | 2026-05-15 自动验收通过：`tmp/tool-permission-acceptance.ps1` 覆盖 ReadOnly 自动放行、Protected pending、reject/approve；现有 SessionGrants 30 min TTL 可支撑按时间授权，后续布局中统一呈现授权剩余时间 |
| REQ-TOOL-009 | Tooling | 工具审批审计与 UI 摘要 | 审计/安全 | P0 | 已完成 | 所有 runtime/LLM 工具调用写入 `.coolzhu/tool-audit.jsonl`，前端显示工具、调用方、状态、决策、耗时和脱敏入参摘要 | 2026-05-15 自动验收通过：API 审计含 ok/dry-run-only 记录，secret probe 未出现在响应；Headless Edge UI 检查确认审计表显示 dry-run 行且不泄露 secret |
| REQ-TOOL-010 | Tooling | Protected 路径规则表 | 安全配置 | P1 | 已完成 | `[tool.protected_paths]` 支持替换默认、追加默认、额外规则，`coolzhu.toml`、`.coolzhu/**`、敏感目录默认受保护；`/api/diagnostics/health` 输出配置解析失败 | 2026-05-15 补齐 diagnostics：新增 `config.coolzhu_toml` 健康检查，解析失败返回 error + 修复建议；启动加载遇 malformed config 不再覆盖原文件；新增 2 条 TDD，`web-console` 207 passed |
| REQ-TOOL-011 | Tooling | Tool Loop 超时与并发控制 | 稳定性 | P1 | 已完成 | 每个工具独立超时、并发上限、异常分类；bash/PowerShell 默认超时可配置；多 tool_use 可限流并发 | 2026-05-15 真实 LLM 验收通过：`tmp/tool011-real-llm-multi-tool-check.ps1` 创建临时聊天室，真实模型同一轮触发 `read_file` + `glob_search` 两个 ReadOnly tool_use，审计新增两条工具记录，临时聊天室已清理；自动回归 `tool` filter 38 passed |
| REQ-TOOL-012 | Tooling | 工具 / 插件 / SKILL 场景目录与适配矩阵 | 工具治理 | P1 | 开发中 | 现有 Core/Vision/Computer Use/Plugin/Skill 工具和常用外部工具按能力、风险、输入输出、授权方式、验证方式分类；形成“场景 -> 推荐工具 -> 权限 -> 验证方式”目录，并与 Goal skill registry 对齐 | 2026-05-18 完成前端 MVP：设置窗口工具区接 `/api/tools/{tool_id}` 详情、`/api/tools/dispatch` dry-run，并生成 Workspace read / Semantic routing / Grounded UI action / Protected writes 四类场景矩阵；2026-05-20 增补工具状态灯入口，后续补常用外部工具、Goal skill registry 绑定和人工交互验收 |
| REQ-TOOL-013 | Tooling | 完全访问权限显式授权开关 | 安全 | P0 | 测试中 | 任务 / 授权窗口提供完全访问开启按钮；开启前必须显示风险提示“该权限完全允许操作用户电脑文件，有一定风险”；授权必须有 TTL、可撤销、落审计，默认关闭 | 2026-05-20 已完成 `/api/tools/full-access` GET/POST/DELETE；开启需 `risk_acknowledged=true` 与 `confirmed_twice=true`，默认 10min、最大 30min、按 workspace+session 隔离，撤销后立即失效；任务窗口新增 Full access 状态和开启/撤销按钮；grant/revoke 写入 `tool-audit.jsonl`，后续真实交互需用户确认 |
| REQ-TOOL-014 | Tooling | OpenCLI 工具集成 | 工具治理 | P1 | 待开发 | OpenCLI 作为外部 CLI 工具适配项进入工具目录，支持命令探活、版本识别、参数白名单、超时、stdout/stderr 脱敏和 runtime 权限门禁 | 先做 adapter/registry，不默认下载或执行未知命令；具体 OpenCLI 项目和命令协议需在实现前二次确认 |
| REQ-TOOL-015 | Tooling | 工具调用状态灯与聊天降噪 | 工具治理/UI | P1 | 测试中 | 工具调用细节不再写入聊天室回复流；工具窗口展示每个工具最近调用状态灯：灰色未调用、红色执行中、绿色执行完成；失败仅在工具窗口输出/审计区显示，聊天区只保留必要错误提示 | 2026-05-20 已接入设置窗口 semantic dispatch dry-run 和工具目录条目状态灯，移除 Tool governance 聊天消息；定向 TDD 与完整 `tmp/run-office-scene-validation.ps1` 通过；后续扩展到 LLM tool_use、runtime-execute 与审批事件 SSE |
| REQ-TOOL-016 | Tooling | Agent Reach 基础渠道安装与健康检查 | 外部工具 | P1 | 开发中 | Python 3.11 独立环境安装 Agent Reach；doctor 可运行；至少一个无需登录的公共渠道 smoke test 通过；不得自动导入 Cookie 或泄漏 token | 安装位置 `C:\Users\zhupu\.agent-reach-venv`；大文件或慢速下载时停止并提供 URL 与放置路径 |

## 3.1 新增需求方案脑暴

本节已按 2026-05-16 裁剪决策收敛：内视觉只保留 grounding / computer-use 相关功能与云端视觉模型识图；ShowUI 生命周期托管、双视觉模型常驻、持续监控、关键词触发和外视觉均不进入活跃需求池。

### REQ-TOOL-007: LLM 多工具调用适配
- 方案：`llm_tool_definitions()` 从 `GlobalToolRegistry.mvp_tool_specs()` 读取 21 个工具定义
- 动态构建 ToolDefinition（name/description/input_schema）注入 LLM MessageRequest
- `run_model_tool_dispatch()` 白名单移除，改为调用 `GlobalToolRegistry.execute(name, args)`
- TOOL-LOOP-STREAM 适配：非 computer-use 工具结果打包为 ToolResult 消息回传 LLM
- 风险评估：工具 schema JSON 构造需与 OpenAI tool_use 格式兼容；bash 执行需超时保护

### REQ-TOOL-008: 工具权限分级审批
- **4级权限模型**（高优先级覆盖低）：
  1. 🔒 Protected: coolzhu.toml + .coolzhu/** → 任何位置都弹审批+二次确认
  2. DangerFullAccess: bash/PS/REPL/Agent → workspace 内自动, 外审批+二次确认
  3. WorkspaceWrite: write_file/edit_file/TodoWrite/Config → workspace 内自动, 外审批
  4. ReadOnly: 其余工具 → 始终自动执行
- workspace 内/外判断：目标路径以 `workspace_id` 为前缀
- 前端：`[Allow]` 按钮增加工具名+参数摘要；高危工具加二次确认文本"确认执行此操作？"
- 风险评估：路径判断需防止 `..` 穿越；受保护文件列表需可配置

## 4. 第四梯队 - GUI Desktop、桌宠与 TTS/STT

模块路径：`modules/gui-desktop/`、`modules/gui-web/packages/web-console/`、后续可拆 `modules/audio/`。  
核心职责：桌宠、Tauri WebView 壳、桌面能力入口、本地听写和朗读。桌宠当前功能够用，不再新增需求；语音监控/唤醒词不保留。

| REQ-ID | 模块 | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-DESK-PET-001 | GUI Desktop | Web 服务启动拉起桌宠 | 桌宠 | P0 | 已完成 | 启动 `coolzhu-web-console` 后自动尝试启动 `coolzhu-tauri-shell.exe --pet` | 2026-05-07 G1 人工截图确认 Web 服务启动后桌宠窗口出现 |
| REQ-DESK-PET-002 | GUI Desktop | 桌宠双击切换 Web 控制台 | 桌宠 | P0 | 已完成 | 双击桌宠显示/隐藏加载 Web GUI URL 的控制台 WebView | 2026-05-07 用户复测通过：双击显示 WebView，再次双击可隐藏 WebView |
| REQ-DESK-PET-003 | GUI Desktop | 桌宠状态联动 | 桌宠 | P1 | 测试中 | 聊天发送、推理、工具执行成功/失败可驱动桌宠状态 | Web 后端新增 `/api/pet/state`、`/api/pet/event`、`/api/pet/events`；非流式/流式聊天、推理开始、工具执行 Ok/DryRun/Rejected/Failed/Timeout 均映射桌宠状态并触发 Tauri `--pet-state/--pet-message` 单实例命令；待真实桌宠窗口交互验收 |
| REQ-DESK-PET-004 | GUI Desktop | 桌宠气泡回复 | 桌宠 | P1 | 已完成 | idle/thinking/sleeping/success/warning 状态可显示短气泡 | 2026-05-07 用户复测通过：只显示一个有效气泡，无右侧空白气泡 |
| REQ-DESK-PET-005 | GUI Desktop | 桌宠动作帧画布与中心锚点一致 | 桌宠 | P0 | 开发中 | idle/blink/thinking/sleeping/warning/success 切换时画布尺寸一致，主体水平居中、底部锚点稳定，不出现跳动或裁切 | 2026-06-18 用户反馈 blink 仍缩小；审计确认活动六帧主体约小 5%、脸部约小 9%，现有测试缺少与 idle 的跨状态尺度断言 |
| REQ-WEB-LOCAL-MODEL-001 | GUI Web / Vision | 设置窗口本地模型服务切换 | 本地模型 | P0 | 测试中 | Gemma、UI-DETR/ShowUI、全部关闭按钮能进入后端；启动中、ready、degraded、失败均可见；错误不得静默；本地会话预算必须服从服务实际上下文 | 2026-06-24 已修复 45,682 tokens 超出 llama-server `n_ctx=8192`：本地预算强制服从 config，输出限制 2048，小上下文禁用工具，否定式搜索不再误注入工具；真实聊天室返回 `LOCAL_CHAIN_OK`，待用户人工确认前端视觉与切换交互 |
| REQ-DESK-GUI-001 | GUI Desktop | GUI 主线收敛 | 架构 | P1 | 待开发 | 明确保留 Web GUI + Tauri shell，或证明 desktop-console 已 API 同构 | 推荐不保留两套 GUI；将纳入 `REQ-WEB-UI-010` 布局重构评估 |
| REQ-DESK-INSTALL-001 | GUI Desktop | Tauri shell 随包安装 | 打包 | P1 | 冻结 | 安装后 Web 后端能找到 Tauri shell 路径并拉起桌宠 | 随打包迁移整体冻结 |

## 5. 第五梯队 - 打包迁移、CLI 与运维稳定性

模块路径：新增 `packaging` 工作流，关联根目录、`gui-web`、`gui-desktop`、`diagnostics`、`llm-adapter`、CLI。  
核心职责：安装、迁移、跨设备运行、命令行能力对齐和长期稳定性。

| REQ-ID | 模块 | 需求名称 | 功能分类 | 优先级 | 状态 | 验收标准 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-PACK-001 | Packaging | Windows 一体化安装包 | 安装 | P1 | 冻结 | 新机器双击安装后可启动 Web GUI、桌宠和真实模型诊断 | 技术选型保留 NSIS；当前不实现 |
| REQ-PACK-002 | Packaging | 可迁移数据目录 | 迁移 | P1 | 冻结 | 配置、会话、beads、附件、日志可导出导入 | 当前不实现；不导出明文 API key |
| REQ-PACK-003 | Packaging | 首次启动向导 | 安装 | P1 | 冻结 | 检查端口、WebView2、provider、模型、数据目录权限 | 当前不实现 |
| REQ-PACK-004 | Packaging | 离线资源打包 | 安装 | P2 | 冻结 | 静态资源、桌宠帧、TTS/STT 模型可随包或按需下载 | 当前不实现 |
| REQ-PACK-005 | Packaging | 升级和回滚 | 运维 | P2 | 冻结 | 升级前备份数据目录，失败可回滚上一版本 | 当前不实现 |
| REQ-PACK-006 | Packaging | 多设备安装验收矩阵 | 测试 | P2 | 冻结 | Windows 10/11、无 Rust 环境、不同用户名路径均可运行 | 当前不实现 |
| REQ-PACK-007 | Packaging | 安装前环境与硬件检测 | 安装诊断 | P1 | 冻结 | 安装前检测 OS/架构、WebView2、端口、磁盘/内存/CPU/GPU、网络/provider、数据目录权限并输出阻断/提醒/可选项 | 当前不实现；麦克风/摄像头不再作为主线能力阻断项 |
| REQ-PACK-008 | Packaging | 首次启动诊断向导 | 启动向导 | P1 | 冻结 | 首次启动引导端口切换、WebView2 安装、provider/base_url/key、模型资源和数据目录初始化 | 当前不实现 |
| REQ-PACK-009 | Packaging | 加密资源镜像与完整性校验 | 安全 | P1 | 冻结 | 静态资源/模型包可签名校验，核心资源可加密镜像加载，篡改后进入诊断/修复流程 | 当前不实现；后续只做加密/完整性，不承诺不可破解 |
| REQ-PACK-010 | Packaging | 离线安装授权文件与本地完整性校验 | 安装安全 | P2 | 冻结 | 不做联网注册、不绑定机器指纹；安装包仅支持离线授权/许可文件校验、本地资源完整性校验和加密资源加载失败提示 | 当前不实现；原在线激活/机器指纹方向废弃 |
| REQ-PACK-011 | Packaging | 安装态交互验收矩阵 | 测试 | P2 | 冻结 | 覆盖当前机器、干净 Windows 10/11、缺 WebView2、端口占用、无 GPU/有 GPU 等安装态测试 | 当前不实现 |
| REQ-PACK-012 | Packaging | 模型/资源可选下载包 | 安装资源 | P2 | 冻结 | TTS/STT/grounding 模型/桌宠高体积资源可按需下载、校验、缓存和重试，安装包体积可控 | 当前不实现；下载慢或包体大时提示用户手动下载地址和放置路径 |
| REQ-PACK-013 | Packaging | 内视觉模型资源随包内置与 Web UI 自启动 | 模型资源 | P1 | 冻结 | 安装包包含 grounding 必需模型资源、服务脚本和运行环境检测；Web UI 服务启动时自动拉起 grounding 后端或给出可修复阻断提示 | 当前不实现；双视觉模型常驻不保留 |
| REQ-CLI-001 | CLI | 聊天室能力对齐 | CLI | P2 | 待开发 | CLI 可读写同一会话库并发送真实模型消息 | 依赖 SQLite 数据目录稳定 |
| REQ-CLI-002 | CLI | 迁移诊断命令 | 运维 | P2 | 待开发 | 可检查安装、端口、provider、数据目录和桌宠 | 依赖 diagnostics 输出稳定 |
| REQ-LLM-004 | LLM Adapter | 重试、限流、成本统计 | 稳定性 | P2 | 待开发 | 超时/429/5xx 可分类，token 和费用可记录 | 后续运营必需 |

## 待交互验证清单

当前优先闭环以下交互性测试项。验收通过后将对应需求从 `待交互验证` 更新为 `已完成`；验收失败时按问题修复优先级回到 `开发中`，先修复再继续第三梯队。

执行单：`docs/interactive-test-plans/2026-05-06-g1-interaction-closure.md`

| 关联需求 | 模块 | 需要确认的交互场景 | 验收动作 |
| --- | --- | --- | --- |
| `REQ-VIS-001` | Vision | 本地 VLM/OCR 服务对真实屏幕目标的命中率 | 2026-05-07 已执行：Qwen 描述/OCR PASS，ShowUI point grounding PASS with gaps；bbox/confidence 和复杂目标命中率转 G2 继续增强 |

## 推进闸门

| 闸门 | 范围 | 完成条件 | 未完成时处理 |
| --- | --- | --- | --- |
| G1 交互性测试闭环 | `REQ-WEB-UI-002`、`REQ-DESK-PET-001/002/004/005`、`REQ-VIS-001` | 人工交互测试通过并更新状态；失败项形成修复记录和复测记录 | 问题修复优先于所有需求开发 |
| G2 第三梯队落地验证 | `REQ-CU-001~008`、`REQ-VIS-001~008`、`REQ-TOOL-005~011`、`REQ-WEB-SESSION-007`、`REQ-WEB-PROJECT-003` | 所有第三梯队需求完成 TDD 实现、自动化验证；涉及真实桌面、本地模型、审批 UI 的项补交互验证记录 | 继续推进数据边界、视觉拆分和工具安全，不进入打包实现 |
| G3 打包方案实现解锁 | `REQ-PACK-001~013` | 需求冻结解除后重新评估 | 当前冻结，不做 NSIS、资源加密或完整性校验实现 |

## 下一步计划

| 顺序 | 梯队 | 需求 | 目标 | 依赖 |
| --- | --- | --- | --- | --- |
| 1 | D2 当前并行开发 | `REQ-WEB-WIN-002/004/005/006/007/008` | 设置、任务/授权/Goals、记忆、多媒体、视觉实验、诊断日志窗口内部布局与现有 API 接入 | `REQ-WEB-WIN-001/003` 已进入测试中，上半区布局稳定 |
| 2 | D2 风险窗口 | `REQ-WEB-WIN-009/010` | 浏览器 MVP 与终端命令面板，只做安全受控版本 | 浏览器跨域策略、工具审批/审计窗口可用 |
| 3 | Goal G1/G2 后端 | `REQ-GOAL-004/010` | 角色配置、角色会话 bootstrap、心跳 API、风险事件入库和任务窗口风险展示已落地；下一步补 commander phase 审视和分发 | `REQ-GOAL-002/003` 已进入测试中，`REQ-WEB-WIN-004` 可展示 Goal 状态 |
| 4 | Goal G3 协同循环 | `REQ-GOAL-006/007/009` | Goal Loop、后台事件流、审计诊断 | `REQ-GOAL-006` 最小 ready phase handoff 派发已进入开发中；`REQ-GOAL-007` 已有手动 status/pause/resume 与 SSE 事件通道；`REQ-GOAL-009` 回撤调试禁用闸口后只保留关键步骤审计诊断；后续补自动循环、运行期事件、统一审计视图和失败/Pause 状态机 |
| 5 | 工具场景治理 | `REQ-GOAL-005` / `REQ-TOOL-012/014/015` | Goal skill registry 与工具/插件/SKILL/OpenCLI/常用外部工具适配矩阵，工具调用状态灯和聊天降噪 | D2 功能窗口和 Goal 角色模型稳定后推进 |
| 6 | 交互验收 | `REQ-WEB-CHAT-007` / `REQ-LLM-005` / `REQ-DESK-PET-003` | 对测试中需求做真实交互验证，确认后再转已完成 | Tauri shell、本地/中转模型、真实 Web UI |
| 7 | 后置音频集成 | `REQ-AUDIO-002` | IndexTTS provider 适配与设置窗口配置 | 不阻塞 Goal/Tool 主线；大模型资源不随当前阶段打包 |
| 8 | G3 第五梯队冻结 | `REQ-PACK-001~013` | 安装包、加密资源镜像、完整性校验全部冻结，只保留历史方案记录 | diagnostics、数据目录、Tauri shell 路径 |

## 需求统计

| 状态 | 数量 |
| --- | ---:|
| 已完成 | 66 |
| 测试中 | 18 |
| 待交互验证 | 0 |
| 开发中 | 3 |
| 待开发 | 13 |
| 冻结 | 14 |
| 暂停 | 0 |
| 合计 | 114 |

| 优先级 | 数量 |
| --- | ---:|
| P0 | 21 |
| P1 | 74 |
| P2 | 14 |
| P3 | 0 |

## 变更记录

| 日期 | 变更 | 内容 |
| --- | --- | --- |
| 2026-06-20 | 更新 | `REQ-WEB-WIN-004` 任务授权窗口按批准设计图完成三栏重构：待审批与 Goal 保留左栏，workspace/外目录授权/Full access 收敛到中栏，真实模块自检进入右栏；新增武侠玻璃风格模块 icon、状态灯、授权模式卡片和模块行布局契约，修复模块自检列表被旧 suggestions/self-update 文本挤占以及“重试”按钮换行问题；package all 完成，并使用 Computer Use 在 packaged Tauri 中点击验证。 |
| 2026-06-20 | 更新 | `REQ-WEB-WIN-002` 设置窗口工具与审批栏按批准设计图重构：默认呈现本地模型、CLI、MCP、Skill、compute-use、Semantic Dispatch 六行状态清单，详细目录、模型控制、语义派发和审计能力改为按需展开；新增武侠风格工具图标与布局契约测试，117 项前端契约通过，package all 完成，并使用 Computer Use 在 packaged Tauri 中真实点击验证管理面板与计划配置。 |
| 2026-05-22 | 更新 | MSVC linker 修复后完成四大核心链路回归：最新 Web Console 构建通过；真实会话链路、工具 HTTP 实操、真实 LLM 多 tool_use、Goal API 最小协同均 PASS；compute-use/grounding 接口和真实输入预置 PASS，键鼠视觉命中项保留 CHECK 等人工录屏确认。`REQ-GOAL-010` 更新为测试中，`REQ-GOAL-006` 记录 API 级最小协同回归证据。 |
| 2026-05-21 | 调整 | 后续开发以四大核心功能为优先级主线：会话配置和真实会话链路、工具真实调用、compute-use 工具化真实调用、多 agent 协同与 Goal 长程任务；其它需求允许脚本化测试，但不得破坏四大主线。四大功能后续补 imagegen 操作流程图和 Remotion 视频化指导。 |
| 2026-05-21 | 调整 | 开发规范升级为禁止新增业务环境变量：新增路径、模型、工具、开关配置必须写入 `coolzhu.toml` 或模块配置文件；历史 env 只作为兼容债务迁移，技术不可避免例外必须在代码注释和 work-log 中说明。 |
| 2026-05-21 | 更新 | WebSearch 配置文件化：`base_url`、`transport`、`force_powershell_fallback` 改读 `coolzhu.toml [web_search]`；Web Console 在 workspace reload/runtime tool execute 时设置 tooling config root；PowerShell fallback 改用命令参数传 URL，不再新增 env 协议。`cargo check` 与格式检查通过，targeted `cargo test` 被当前环境缺少 MSVC `link.exe` 阻断。 |
| 2026-05-22 | 修复 | 修复 Windows Rust MSVC linker 环境：安装 Visual Studio Build Tools 2022 后 `link.exe`/`cl.exe` 可用，`cargo test -p coolzhu-tool-registry web_search_reads_base_url_and_transport_from_coolzhu_toml -- --nocapture` 通过；同时修复 WebSearch PowerShell fallback 参数传递，把 URL 作为 script block 参数传入，避免被 PowerShell 当作命令执行。 |
| 2026-05-17 | 更新 | 使用 Goal 编排方式完成 D2 下区 10 个窗口前端首版：工程目录、设置、聊天室、浏览器、多媒体、终端、任务 / 授权 / Goals、记忆 / 知识、视觉实验、诊断日志均具备可确认界面；Browser 提供 URL/search/iframe/外部打开兜底，Terminal 只走 `/api/tools/runtime-execute`，Vision 真实输入默认关闭；`REQ-WEB-UI-010` 与 `REQ-WEB-WIN-002/004/005/006/007/008/009/010` 更新为 `测试中`；`node --check`、`tmp/check-web-ui-d2-inner-contract.ps1`、`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 均通过；预览服务已启动于 `http://127.0.0.1:8765/`，截图 `tmp/web-ui-all-windows-current-1920x1080.png` |
| 2026-05-17 | 修复 | `REQ-WEB-WIN-001` 工程目录窗口目录树视觉回归：移除 `/api/state` 刷新时旧 `project_entries` 对新 API 树的覆盖，旧 `renderProjectTree` 入口改为归一化后复用 `renderProjectApiTree`，并提高 `.ui-redesign .project-tree .project-tree-item` CSS 优先级，避免旧 `.project-tree li { display:flex }` 将层级节点横向打散；新增前端嵌入回归断言，截图 `tmp/web-ui-project-tree-fixed-1920x1080.png`；`node --check`、D2 契约脚本、`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 通过 |
| 2026-05-17 | 新增 | 根据 `goal.txt` 与 `goal-driven-multi-agent-orchestration-plan-2026-05-13.md` 新增 Goal 工具正式需求：保留 `REQ-CORE-AGENT-001` 作为 Epic 概念，拆分 `REQ-GOAL-001~009`；Goal 首版归入 `REQ-WEB-WIN-004` 任务 / 授权 / Goals 窗口，不新增独立窗口；新增 `REQ-TOOL-012` 工具 / 插件 / SKILL 场景目录与适配矩阵；新增方案文档 `docs/web-ui-window-d2-inner-layout-goal-plan-2026-05-17.md`，明确窗口内布局、功能归窗、icon 缺口和并行开发边界 |
| 2026-05-16 | 裁剪 | 按用户确认更新需求边界：安装包、资源加密和完整性校验需求统一冻结；外视觉从活跃需求文档删除；内视觉只保留 grounding/computer-use 与云端视觉模型识图，删除双视觉模型常驻、ShowUI 生命周期托管、持续监控和关键词触发；桌宠当前功能够用，不再新增需求；语音监控/唤醒不保留，仅保留 TTS/STT；工具权限策略收敛为键鼠按时间授权、workspace 外文件操作需授权、workspace 内 config 和关键数据库强制授权；新增 P0 `REQ-WEB-UI-010` Web GUI 16:9 多窗口重构，后端功能完成后优先进入布局设计 |
| 2026-05-17 | 更新 | `REQ-WEB-UI-010` D1 布局骨架完成：备份原 Web UI 目录到 `tmp/backups/web-ui-original-20260517-0008-pre/web-console`；重构 `index.html` 为上下两区，默认 24% / 76%；新增下区多窗口 dock、窗口双击折叠/展开、Chat 默认展开和全折叠 3D 场景占位；移除外视觉和语音监控前端入口，音频仅保留 TTS/STT；新增 `tmp/ui-redesign-contract-check.ps1` 与 `tmp/ui-redesign-visual-check.ps1`，1920x1080 截图输出 `tmp/ui-redesign-d1-1920x1080.png`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed；整体需求保持开发中，D1 等待视觉确认 |
| 2026-05-17 | 更新 | `REQ-WEB-UI-010` D1.1 顶部区域新设计图资产填充完成：从 imagegen 资产板裁切并纳入 `assets/ui-redesign/`，包括 `top-logo-banner-bg.png`、`top-agent-card-frame.png`、`top-task-card-frame.png`、`top-agent-icon.png`、`top-task-icon.png` 与资产板备份；顶部 Logo、Agent 总览卡片、任务卡片已改用新组件；补充契约检查确保 top assets 存在且被引用；截图 `tmp/ui-redesign-top-assets-1920x1080.png`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed |
| 2026-05-17 | 修正 | `REQ-WEB-UI-010` 顶部 Logo 视觉微调：移除 Logo 下方工程目录路径，Logo 文本改为绝对居中并放大至填充砖块墙主体；契约脚本新增 `brand-subline` 移除和大号居中 Logo 校验；截图 `tmp/ui-redesign-logo-refine-1920x1080.png`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed |
| 2026-05-17 | 修正 | `REQ-WEB-UI-010` Logo 与背景图合并重做：使用 imagegen 生成包含 `COOLZHU CODE` 的完整马里奥风格顶部 Logo 位图，裁切为 `assets/ui-redesign/top-logo-banner-complete.png`；移除 HTML/CSS 文本叠加层 `brand-plaque`，避免字体与背景画风不一致；契约脚本改为校验烘焙位图引用与文本层移除；运行态资源检查 200，截图 `tmp/ui-redesign-logo-baked-1920x1080.png`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed |
| 2026-05-17 | 修正 | `REQ-WEB-UI-010` D1.3 顶部总览职责收敛：左侧 Agent 总览卡移除视觉 Agent 下拉，只保留已激活 Agent 数与聊天室个数；视觉 Agent 选择迁入设置窗口的会话与模型配置区，复用原 `/api/config/vision-agent` 保存逻辑；契约脚本新增顶部纯指标和设置窗口选择器校验；截图 `tmp/ui-redesign-overview-settings-1920x1080.png`；`node --check src/app.js` 通过，`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed |
| 2026-05-17 | 新增 | 按用户要求将下半区每个窗口拆成独立功能设计与多 agent 协同开发项：新增 `REQ-WEB-WIN-001~010`，覆盖工程目录/IDE、设置、聊天室、任务授权、记忆知识、多媒体播放器、视觉实验、诊断日志、浏览器 MVP、终端命令面板；并新增方案文档 `docs/web-ui-window-d2-implementation-plan-2026-05-17.md`，明确 P0/P1/P2 顺序、后端缺口、TDD 和 worker 写入边界 |
| 2026-05-17 | 更新 | `REQ-WEB-WIN-001/003` D2 第一批落地：多 agent 并行完成工程目录只读 API 与前端接入，新增 `/api/project/tree`、`/api/project/file/meta`、`/api/project/file`、`/api/project/diff`；聊天室窗口改为独立消息滚动区和固定底部输入区；移除展开窗口内重复的竖向标题条，只保留左侧统一 dock；新增前端契约测试覆盖工程目录 API 接入、50 行聊天室区域、标题左到右显示和重复竖标题条移除；截图 `tmp/web-win-remove-inner-title-1920x1080.png`；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 243 passed |
| 2026-05-16 | 更新 | `REQ-WEB-UI-010` 布局比例修正为上下两区：上区 20%~30%、下区 70%~80%，默认 24% / 76%；所有窗口折叠后，下部分展开区域用于 3D 动画状态场景；补充当前布局所需图标、窗口组件、Logo 背景、日志背景和 3D 状态场景素材清单，先锁定区域布局再进入前端实现 |
| 2026-05-16 | 更新 | `REQ-DESK-PET-003` 后端/API 完成并进入测试中：新增 `/api/pet/state`、`POST /api/pet/event`、`/api/pet/events` SSE；新增后端 `PetStateSnapshot` 状态快照、事件 bus、事件到 `idle/blink/thinking/warning/success` 映射和 Tauri 单实例 `--pet-state/--pet-message` 触发参数；非流式/流式聊天发送、推理开始、持久化失败、handoff 失败、聊天完成和工具执行 Ok/DryRun/Rejected/Failed/Timeout 均会更新桌宠状态；TDD `pet_` 3 passed，`coolzhu-web-console` 全量 234 passed；按用户要求当前需求完成后暂停，下一步评估未实现需求保留/裁撤与统一界面布局 |
| 2026-05-16 | 更新 | `REQ-LLM-005` 后端/API 补强完成：Custom provider 诊断不再按模型名误判为固定厂商，允许本地 OpenAI-compatible endpoint 无 API Key，`base_url + endpoint` 统一拼接并传入 agent diagnostics；`provider_client_for_agent` 对 Custom 优先使用自定义 endpoint，未配置 base_url 时回退 `http://127.0.0.1:11434/v1` 并保留 endpoint；补齐 llm-adapter `MessageRequest.reasoning_effort` 测试样例字段；`coolzhu-llm-adapter` 全量测试通过，`coolzhu-web-console` 全量 231 passed；状态保持测试中，前端布局后续统一设计 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D5 后端/API 闭环：新增 `chat_handoff` LLM tool definition，默认 whitelist/all 模式暴露；`run_model_tool_dispatch` 增加 handoff 分支，解析 `to/intent/chat_room_id/from_agent_id/attach/attach_message_ids/depth` 后复用 `create_manual_handoff` 写入 SQLite `chat_handoffs`、生成目标 Agent `handoff-inbound` 消息，并以 `caller=llm/tool_name=chat_handoff` 追加 `tool-audit.jsonl`；需求状态 `开发中 → 测试中`，前端布局效果后续统一设计与交互确认；`cargo test` 全量 229 passed |
| 2026-05-15 | 完成 | `REQ-WEB-SESSION-007` Phase B 收口并更新为已完成：`memory_beads.origin_* / token_count` 与 `attachment_refs` 进入 SQLite 持久化；聊天室删除改为 SQL transaction `DELETE`，由 FK/trigger 回收消息和衍生 beads；附件 GC 仅删除无引用文件；Web UI 新增聊天室重命名、聊天室删除 impact 确认、所选消息删除确认、bead 列表单条删除确认。`REQ-MEM-006` 随 origin/token 持久化和级联验收更新为已完成；`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 211 passed |
| 2026-05-15 | 完成 | `REQ-WEB-CTX-001` LLM 历史上下文装配完成：新增 `ContextAssembly/ContextBuildOptions/ContextTokenBudget`，非流式、流式、tool-loop 三条真实 LLM 调用路径统一装配 system、相关 memory beads、聊天室最近历史和当前 user turn；新增 `GET /api/sessions/{session_id}/context-preview` 输出 messages 与 token budget；TDD 覆盖相关 bead/L4 过滤、历史窗口裁剪、request system/messages 保真；`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量通过 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D2 完成：在 `ContextAssembly` 基础上为真实非流式、流式、tool-loop LLM 请求注入当前聊天室 roster 协作提示；新增 `HandoffDirective`、fenced `handoff` / JSON handoff 解析、`resolve_handoff_target` 名称/ID 解析；TDD 覆盖 roster prompt 注入、基础 handoff 解析、坏块跳过、大小写名称解析；`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量通过；需求保持开发中，下一步进入 D3 投递和防环 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D3a 完成：新增 `ChatHandoffRecord`、`HandoffGateOptions`、`HandoffGateDecision`、`validate_handoff_gate` 与 `handoff_intent_hash`，覆盖 self-loop、depth>=4、A→B→A cycle、单 turn quota=8、60s dedup window；`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量通过；需求保持开发中，下一步进入 D3b 持久化任务链表与真实投递 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D3b 完成：新增 SQLite `chat_handoffs` schema v3、`GET /api/chat/rooms/{room_id}/handoffs`、`POST /api/chat/rooms/{room_id}/handoffs/manual`，手工 handoff 通过 D3a 防环闸门后写入任务链并向目标 Agent 注入 `handoff-inbound` 消息；`save_session_state_to_sqlite` 保留同 workspace 的任务链记录，避免全量重写时被 FK cascade 清空；新增手工投递和 save 后查询 TDD，`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量 225 passed；需求保持开发中，下一步进入 D3c 自动投递与 D4 前端任务链抽屉 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D3c 完成：新增 `AutoHandoffCandidate`、自动 handoff 处理链和 persisted-to-chat DTO 转换；非流式与流式 `/api/chat/send` 在消息持久化后解析 assistant 回复中的 fenced handoff，自动创建任务链记录并向目标 Agent 写入 `handoff-inbound` 消息；自动转交使用当前 assistant message id 作为附件锚点，链式转交从最近已投递给当前 Agent 的 handoff 继承 `originating_user_msg_id` 与 `depth+1`，继续复用 D3a 防环闸门；TDD 覆盖自动投递和 A→B→A 回环拒绝；`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量 227 passed；需求保持开发中，下一步进入 D4 前端任务链抽屉和手工转交入口 |
| 2026-05-16 | 更新 | `REQ-WEB-CHAT-007` Phase D4 代码完成并待交互确认：Web GUI 新增聊天室 roster 成员条、任务链抽屉、任务链计数/状态列表、手工“转交”按钮；切换聊天室、发送消息、流式完成后会刷新 `/roster` 与 `/handoffs`；手工转交复用 `/handoffs/manual`，可用已选历史作为 `message_ids` 附件；新增静态前端契约 TDD，`node --check src/app.js` 通过，`cargo test -p coolzhu-web-console --offline -- --test-threads=1` 全量 228 passed；涉及布局变更，需用户截图确认后再推进 D5 |
| 2026-05-15 | 完成 | `REQ-TOOL-011` Tool Loop 超时与并发控制闭环：自动回归 `cargo test -p coolzhu-web-console --offline tool -- --test-threads=1` 38 passed；新增真实模型验收脚本 `tmp/tool011-real-llm-multi-tool-check.ps1`，在 `enable_real_llm=true`、`enable_llm_tools=true` 下创建临时聊天室，真实模型同一轮触发 `read_file` + `glob_search` 两个 ReadOnly tool_use，`/api/tools/audit` 出现两条新增工具记录，临时聊天室已删除；状态更新为已完成 |
| 2026-05-15 | 完成 | `REQ-CORE-TOOL-001` 工具调用编排闭环：复核 CLI/MCP runtime bridge 状态，MCP 真实 stdio fake server 进程交互用例 `manager_call_tool_through_runtime_*` 2 passed，覆盖允许工具真实 `tools/call` 与越界 WorkspaceWrite 在 MCP 调用前 dry-run 拦截；`coolzhu-core-runtime` 串行全量 123 passed。并行全量曾因环境变量共享测试竞态出现 `parses_plugin_config` 偶发失败，定向测试与串行全量均绿，记录为测试隔离注意事项；状态更新为已完成 |
| 2026-05-15 | 完成 | `REQ-TOOL-008/009/010` 工具权限安全组闭环：新增 `coolzhu.toml` 配置健康检查 `config.coolzhu_toml`，解析失败会在 `/api/diagnostics/health` 输出 error 与修复建议，加载 malformed config 不再覆盖原文件；新增 `tmp/tool-permission-acceptance.ps1` 覆盖 ReadOnly 自动执行、Protected pending、reject/approve、审计脱敏；新增 `tmp/tool-permission-ui-cdp-check.mjs` 通过 Headless Edge/CDP 验证真实 Web UI 审批浮层、拒绝/授权按钮和审计表脱敏；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 207 passed，状态更新为已完成 |
| 2026-05-13 | 更新 | `REQ-CORE-TOOL-001` CLI runtime 入口验证完成：同步 Cargo TUNA 双 hash cache 后，`coolzhu-cli` 的 `CliToolExecutor` 通过 `ToolInvoke{caller=Cli}` 走 `runtime_tool_execute` 执行 registry 工具；新增 CLI ReadOnly 与 workspace-write 外部路径闸门 TDD，`coolzhu-command-line` 全量 77 passed；状态保持开发中，剩 MCP 入口未收口 |
| 2026-05-13 | 更新 | `REQ-CORE-TOOL-001` MCP runtime 入口代码完成并进入测试中：`McpServerManager` 新增 `call_tool_through_runtime`，强制 `ToolInvoke(caller=Mcp)` 先过 `runtime_tool_execute`；ReadOnly 放行后调用原 `tools/call`，WorkspaceWrite 越界在发起 MCP 调用前返回 `dry-run-only`；新增 2 条 TDD，`coolzhu-core-runtime` 全量 123 passed |
| 2026-05-13 | 更新 | `REQ-WEB-PROJECT-003` 按当前优先级进入开发中：范围限定为 WorkspaceScope reload、session store 随 workspace 切换、attachment/audit/config scope 路径验证和 `/api/workspace/reload` 后端闭环；涉及 Web-GUI 工程目录切换效果，代码完成后先等待人工确认 |
| 2026-05-14 | 更新 | `REQ-WEB-PROJECT-003` 代码完成并进入待交互验证：新增 WorkspaceScope 路径派生、`SessionStore::load_for_workspace` 和 `/api/workspace/reload`；工程目录切换现在同步替换 active workspace、workspace config 与 session store；新增 session 隔离和 scope path TDD，workspace/attachment/audit 分组及 web-console 全量测试通过 |
| 2026-05-14 | 修复 | `REQ-WEB-PROJECT-003` 交互复测反馈：工程目录和会话配置已随 workspace 切换，但发送对象列表与聊天室消息仍保留旧目录状态；已新增 `refreshWorkspaceBoundState` / `resetWorkspaceBoundUiState`，切目录后清空旧前端状态并重拉 sessions、Agent targets、chat rooms、工具目录与审计；composer 草稿 key 加入 workspace 维度，继续待人工复测 |
| 2026-05-14 | 完成 | `REQ-WEB-PROJECT-003` 用户复测 PASS：切换工程目录后发送对象和聊天室聊天记录均已刷新到当前 workspace，会话配置保存显示正常；状态从 `待交互验证` 更新为 `已完成` |
| 2026-05-14 | 更新 | `REQ-VIS-008` / Precise-Click Grounding 补真实交互验收脚本 `tmp/precise-click-grounding-acceptance.ps1`：覆盖 UIA Start button、无目标不回退固定锚点、安全视觉点击、右键菜单、拖拽框选、Win+E、浏览器地址栏/搜索/页面按钮定位；脚本首尾自动发送 `Alt+F9` 作为录屏开始/结束，正式运行需显式 `-EnableRealInput -IAcknowledgeRealInput` |
| 2026-05-14 | 验收 | `REQ-VIS-008` 录屏 `Desktop 2026.05.14 - 01.53.04.02.mp4` 与 `precise-click-grounding-20260514-015301` 日志审查完成：`PC-GR-001/002` 通过，`PC-SAFE-003` 通过；`PC-SAFE-001` 记录真实点击未命中，`PC-SAFE-002` 为 safe-context-menu ready 失败，`PC-BR-001` 为 low-confidence 未执行点击；状态保持 `测试中`，详见 `docs/work-logs/2026-05-14-precise-click-grounding-recording-review.md` |
| 2026-05-14 | 完成 | `REQ-VIS-008` / Precise-Click Grounding Router 问题修复并闭环：修复截图逻辑坐标到物理输入坐标换算、safe-context-menu 目标项坐标解析、LocalVLM 低置信绿色按钮颜色区域兜底、测试服务 `COOLZHU_WEB_BIND_ADDR`/`COOLZHU_DISABLE_DESKTOP_PET` 覆盖与浏览器渲染截图验收；`cargo test -p coolzhu-web-console --offline` 205 passed，`cargo check -p coolzhu-web-console --offline` 通过；最终 `precise-click-grounding-20260514-073146` 中 `PC-PRE-001/002`、`PC-GR-001/002`、`PC-SAFE-001/002/003`、`PC-BR-001` 均 PASS，状态更新为 `已完成` |
| 2026-05-13 | 更新 | `REQ-LLM-005` 代码完成并进入测试中：三合一卡片 Provider 新增 `Custom`，Custom 时显示自定义模型、Base URL、Endpoint；普通 provider 隐藏并保存空 URL/Endpoint；后端 `SessionStore` 仅在 Custom provider 保留 custom URL，切换回目录 provider 自动清空旧覆盖；新增前端静态与后端存储 TDD |
| 2026-05-13 | 更新 | `REQ-WEB-CHAT-007` Phase D1 完成：新增 `ChatRosterResponse/ChatRosterMemberDto` 与 `/api/chat/rooms/{room_id}/roster?me=`，支持按当前 agent 排除 self、标记 active/available/model_type；新增 2 条 roster TDD，chat 组回归 10 passed |
| 2026-05-13 | 更新 | `REQ-WEB-CHAT-007` 进入 Phase D1 开发：优先实现聊天室 roster 契约与 `/api/chat/rooms/{room_id}/roster`，作为后续 handoff 和任务链防环的低风险前置能力 |
| 2026-05-13 | 更新 | `REQ-TOOL-011` Phase D 代码完成并进入测试中：新增 `[tool.execution] default_timeout_ms/max_concurrency`；bash/PowerShell/REPL 自动注入默认 timeout；LLM runtime 工具调用使用 deadline，超时映射 `runtime-timeout` 并写审计；流式和非流式 Tool Loop 改为限流并发 dispatch 且保持 ToolResult 顺序 |
| 2026-05-13 | 更新 | `REQ-TOOL-011` 进入 Phase D 开发：依据 `tool-permission*` Phase C 日志补齐 Tool Loop 超时、并发控制和 shell 默认 timeout 注入，目标是把 `REQ-TOOL-007` 主体后的剩余稳定性缺口收口 |
| 2026-05-13 | 更新 | `REQ-VIS-008` + Precise-Click Grounding Router 代码收口：移除 `system-vision-agent` 与 ShowUI 视觉 Agent 混用；新增 `/api/agents/understanding` 与 `/api/vision/grounding/backends` alias；默认 `ConfigVision.router` 生效；`api_tool_execute` 真实点击统一走 locate router，删除旧 taskbar 硬编码锚点和多采样 median fallback；状态 `开发中 → 测试中`，剩余真实桌面交互验收 |
| 2026-05-13 | 更新 | 复盘 `docs/README.md`、需求表变更记录和 2026-05-10~2026-05-12 work-log 后重排优先级：`REQ-VIS-008` 升 P0；`REQ-WEB-SESSION-007` 升 P0；新增/补入 `REQ-WEB-PROJECT-003`、`REQ-WEB-CTX-001`、`REQ-MEM-006`、`REQ-TOOL-009/010/011`；`REQ-TOOL-007` 主体修正为已完成，`REQ-TOOL-008/009/010` 修正为测试中；重复的 ShowUI 生命周期编号改为 `REQ-VIS-011`；`REQ-LLM-005` 因前端自定义 endpoint/base_url 缺口回调开发中 |
| 2026-05-13 | 更新 | 根据用户最新排序调整：`REQ-VIS-008` 与 Precise-Click Grounding Plan 合并为第一优先级开发项，验收新增 `ConfigVisionRouter` 生效、真实点击走 locate router 和 router TDD；工具权限链路为第二优先级；会话管理/Agent 协同/记忆链路为第三优先级；`REQ-LLM-005` 收敛为 provider=Custom 时才显示 base_url/endpoint；打包迁移继续冻结并取消联网注册/机器指纹机制，仅保留安装包、加密与完整性校验方向 |
| 2026-05-05 | 新增 | 建立 codex 仓库需求管理表 |
| 2026-05-05 | 新增 | 纳入真实流式聊天室、分层记忆、内视觉、工具调度、多媒体索引需求 |
| 2026-05-05 | 新增 | 纳入 Windows 打包、跨设备迁移、安装验收需求 |
| 2026-05-05 | 更新 | 将 GUI 主线明确为 Web GUI + Tauri 桌宠壳优先 |
| 2026-05-05 | 新增 | 建立变更记录与需求管理工作流 |
| 2026-05-05 | 更新 | 完成三合一卡片字段收敛、工程目录滚动、内视觉缩略图；WebView 字号和富媒体点击进入测试中 |
| 2026-05-05 | 更新 | 移除三合一卡片 beads 调试列表，工程目录去掉分支/变更，内视觉缩略图区域扩展 |
| 2026-05-05 | 新增 | 规划工具卡片 catalog、opencode 插件/SKILL 迁移、内视觉工具化和桌宠气泡状态联动 |
| 2026-05-05 | 更新 | 富媒体消息普通链接/图片/视频去重显示，补无扩展名图片 URL 识别与工程/实验室滚动条样式 |
| 2026-05-05 | 更新 | 根据新优先级调整：先 beads 会话与记忆层，再工具卡片，第三桌宠，最后打包迁移 |
| 2026-05-05 | 更新 | 完成 beads 会话记忆 API：summary、prompt preview、query、add/update/delete、去重和容量裁剪 |
| 2026-05-05 | 更新 | 落地工具卡片 catalog 第一阶段：新增 `/api/tools/catalog`、`/api/tools/{tool_id}`，前端按 Core/Vision/Computer Use/Plugins/Skills 分类展示并展开 schema/风险/候选迁移说明 |
| 2026-05-05 | 更新 | 落地工具卡片 dry-run 第二阶段：新增 `/api/tools/{tool_id}/dry-run`，开放 10 个安全预演工具；插件/SKILL 和 execute 继续禁用 |
| 2026-05-05 | 新增 | 补充 computer-use 鼠标左键/右键/右键菜单/拖拽框选与内视觉区域识别方案，明确 LLM tool calling 前置门槛 |
| 2026-05-05 | 更新 | 落地 computer-use 鼠标 down/up/drag/Esc 原语、vision point/bbox/confidence 解析、Web action-plan dry-run 和新增工具目录项；强视觉 safe-click 禁止几何回退 |
| 2026-05-05 | 更新 | 落地 safe-context-menu 与 safe-drag-select 靶场 dry-run：右键菜单只命中目标 ACTION 项，拖拽需有效移动释放；工具卡片新增专用 dry-run 摘要 |
| 2026-05-05 | 更新 | 接入 vision.find_target/find_region 主动本地 VLM dry-run：显式 `use_model=true` 时调用 OpenAI-compatible 端点，返回 backend trace 和错误分类 |
| 2026-05-05 | 更新 | 扩展 LLM 工具语义 dry-run 协议：`/api/tools/dispatch` 稳定返回 `dispatch_plan.llm_tool_call`，新增 double-click、scroll、text_input、press_key、hotkey 计划与工具卡片入口 |
| 2026-05-05 | 更新 | 聊天室接入语义工具 dry-run 回显：流式和非流式发送均可追加 `tool-summary`，展示 `LLM tool call dry-run`、动作步骤与 `execute_allowed=false` 安全闸门 |
| 2026-05-05 | 更新 | 收口 P1 低风险项：Provider 诊断进入测试中，消息附件按钮支持元数据发送，`vision.describe_screen` 接入结构化 dry-run 和只读描述 API |
| 2026-05-05 | 更新 | 补强 LLM tool calling 选择器：非流式直接提取结构化 `ToolUse`，流式纯 tool call 不再回退，模型工具仍只转 dry-run dispatch |
| 2026-05-05 | 更新 | 落地 `computer.visual_action` 组合 dry-run：先内视觉 grounding，再生成 computer-use action plan；无 grounding 不退回固定几何点 |
| 2026-05-05 | 更新 | P1 SQLite 会话存储第一阶段落地：新增 `.coolzhu/web-sessions.sqlite3`、JSON 迁移/备份、消息和 beads 容量老化策略；已完成离线 `cargo check` 和两项关键单测复验 |
| 2026-05-05 | 更新 | P1 音频富文本播放和桌宠状态联动低风险项完成：音频 URL/MIME 渲染 `<audio controls>`，桌宠事件映射补单测 |
| 2026-05-05 | 更新 | 接入 opt-in 真实 LLM tool schema：`COOLZHU_ENABLE_LLM_TOOLS=1` 时注入 `tools_semantic_dispatch`，捕获流式/非流式 tool_use 并转换为 dry-run `tool-summary`，真实执行继续禁用 |
| 2026-05-05 | 更新 | 补充音频需求：复用现有 STT/TTS API，独立语音监听小卡片新增状态开关；opencode `voice_wake.py` 因依赖麦克风、Picovoice key 和 Python 包，归入后置交互验证 |
| 2026-05-05 | 新增 | 新增消息文件发送按钮、聊天室音频富文本播放、工程目录路径切换需求；工程路径切换需先评估工具权限、记忆归属和聊天室数据隔离 |
| 2026-05-05 | 更新 | 桌宠状态协议补齐 `bubble` 和 `frames`，`pet-mini.html` 支持状态气泡，warning/success 使用独立动作帧；交互窗口验收后置 |
| 2026-05-05 | 更新 | 移除卡片右上角状态角标文字：总览、三合一卡片、内视觉、外视觉和工具调用不再显示 `运行中/就绪/预留/正常` |
| 2026-05-05 | 更新 | 落地 P1 只读健康检查 API：新增 `/api/diagnostics/health`，覆盖 Web、SQLite 会话库、LLM provider、内视觉、语音监听、工具 catalog、桌宠可执行文件，并补自动化测试 |
| 2026-05-05 | 更新 | 按模块梯队重排需求管理：Web-GUI 卡片功能接入列为第一梯队，Core Runtime 与记忆系统列为第二梯队，Computer Use 与内视觉列为第三梯队；新增 `待交互验证` 状态，并将纯人工窗口/硬件验证项单独标记 |
| 2026-05-05 | 更新 | 推进 `REQ-MEM-002/004/005` 依赖落地：core-runtime 下沉 beads 签名、summary、query、prompt context、容量裁剪规则；Web prompt preview 支持 q/layer/kind/prompt_only 查询过滤 |
| 2026-05-05 | 更新 | 推进 `REQ-WEB-CHAT-003` 回复引用与转发：后端生成结构化引用上下文并沉淀 reference-forward bead，前端新增引用预览和清除引用操作 |
| 2026-05-05 | 更新 | 推进 `REQ-WEB-PROJECT-001` 工程目录路径切换第一阶段：新增 `/api/workspace`、allowed workspace roots、工程路径双击编辑和目录树刷新 |
| 2026-05-05 | 修复 | 修复桌宠双击切换 Web 控制台回归：拖拽改为移动阈值触发，避免 mousedown 延时拖拽吞掉 dblclick |
| 2026-05-05 | 新增 | 用户反馈桌宠双击不弹出 Web UI 与动作帧显示中心不一致；`REQ-DESK-PET-002` 回到开发中，新增 `REQ-DESK-PET-005` 作为 P0 问题修复项 |
| 2026-05-06 | 修复 | 完成 `REQ-DESK-PET-002/005` 自动化修复：桌宠双击加入 `mouseup` 兜底和窗口 present 决策，动作帧资产统一中心/底部锚点，剩余真实窗口交互确认 |
| 2026-05-06 | 更新 | 推进 `REQ-WEB-API-001` 缺口清单阶段：新增 `/api/web/cards` 只读审计端点，覆盖 10 张主卡片 endpoint 与 loading/error/empty 状态，并补单测 |
| 2026-05-06 | 更新 | 完成 `REQ-WEB-API-001` 主卡片三态补齐：外视觉、语音监听、会话/Agent 加载失败均有前端降级状态，卡片审计全部 ready，进入测试中 |
| 2026-05-06 | 更新 | 推进 `REQ-WEB-PROJECT-001` 隔离底座：`/api/state` 与 `/api/workspace` 输出稳定 `workspace_id`，为会话、记忆、附件和工具权限按 workspace 隔离提供边界键 |
| 2026-05-06 | 更新 | 推进 `REQ-WEB-MEDIA-003`：消息输入框新增按聊天室隔离的草稿保存/恢复，发送成功后清理当前草稿，自动化测试通过 |
| 2026-05-06 | 更新 | 推进 `REQ-WEB-MEDIA-003`：消息输入框支持从剪贴板粘贴图片生成附件 chip，沿用 object URL 预览与发送元数据链路 |
| 2026-05-06 | 完成 | 完成 `REQ-WEB-MEDIA-003/005`：新增附件 multipart 上传与持久化文件服务，前端发送前上传本地/粘贴附件并将稳定 URL 写入消息和附件索引 |
| 2026-05-06 | 完成 | 完成 `REQ-DIAG-001`：总览卡片接入 `/api/diagnostics/health`，展示健康摘要、检查项和修复建议，并保留加载/错误/空状态 |
| 2026-05-06 | 更新 | 推进 `REQ-DIAG-002`：健康检查输出 bind 地址/备用端口、WebView2 Runtime、LLM API key/provider/base_url 定向修复建议，进入测试中 |
| 2026-05-06 | 完成 | 完成 `REQ-WEB-MEDIA-006`：Markdown/裸 URL 中的音频链接渲染 `<audio controls>`，附件音频预览和点击排除链路保持通过 |
| 2026-05-06 | 新增 | 确认打包技术选型：P1 使用 NSIS，在线激活绑定隐私最小化机器指纹；新增安装前环境/硬件检测、首次启动诊断向导、加密资源镜像、授权激活机器绑定、安装态交互验收矩阵和模型资源可选下载需求 |
| 2026-05-06 | 更新 | 调整推进闸门：先闭环 `REQ-WEB-UI-002`、桌宠真实窗口和 `REQ-VIS-001` 交互验证，再完成第三梯队 `REQ-CU/REQ-VIS/REQ-TOOL` 全量落地验证；`REQ-PACK-001~012` 在 G1/G2 完成前冻结实现 |
| 2026-05-06 | 新增 | 新增 `REQ-VIS-005` 本地 VLM 启动检查资源集成：项目资源内提供 launcher/checker，辅助 `REQ-VIS-001` G1 验证 |
| 2026-05-07 | 新增 | 新增 `REQ-PACK-013` 内视觉模型资源随包内置与 Web UI 自启动：后续打包阶段统一处理模型资源内置、服务脚本、运行环境检测和自动拉起；当前 G1 先验证已手动拉起的 `qwen2.5-vl-3b` 服务 |
| 2026-05-07 | 更新 | G1 人工截图回传：`REQ-WEB-UI-002`、`REQ-DESK-PET-001/002` 验证完成；`REQ-DESK-PET-004` 因气泡不显示回到开发中，`REQ-DESK-PET-005` 因 warning 与 blink 动作观感一致回到开发中 |
| 2026-05-07 | 修复 | 修复 `REQ-DESK-PET-004/005`：pet-mini 支持 message 文字气泡、状态默认气泡和 payload frames，新增脚本化状态触发入口，tauri-shell 单测 12 项通过，两个需求回到待交互验证 |
| 2026-05-07 | 更新 | 用户复测反馈桌宠动作帧仍有左右平移；`REQ-DESK-PET-005` 回到开发中，优先修复主体视觉锚点 |
| 2026-05-07 | 修复 | 修复 `REQ-DESK-PET-005` 动作帧左右平移回归：Rust payload 增加 `frame_offsets`，pet-mini 每帧应用 `translateX` 补偿；tauri-shell 单测 13 项通过，需求回到待交互验证 |
| 2026-05-07 | 修复 | 继续修复 `REQ-DESK-PET-005` 资源裁切回归：确认 warning/success PNG 后几帧存在左侧直边裁切，改为从 `pet-sprite-sheet.png` 连通主体重生成 `pet-actions`，按最大连通主体校验中心/底线，并重启 Tauri 做 warning/success/sleeping 桌面截图预检 |
| 2026-05-07 | 更新 | 用户复测确认 `REQ-DESK-PET-005` 动作帧平移已修复，状态转为已完成；同时确认 `REQ-DESK-PET-004` 存在双气泡/空气泡、`REQ-DESK-PET-002` 存在再次双击不能隐藏 WebView，两个问题回到开发中优先修复 |
| 2026-05-07 | 修复 | 修复 `REQ-DESK-PET-002/004`：控制台可见且未最小化时再次双击即隐藏；pet-mini 文本气泡独占显示并移除 idle/blink 空气泡贴图；15 项 tauri-shell 单测、本机气泡截图和脚本化双击 show/hide 预检通过，两个需求回到待交互验证 |
| 2026-05-07 | 完成 | 用户确认桌宠双击显示/隐藏和单气泡复测通过，`REQ-DESK-PET-002/004` 转为已完成；G1 交互清单仅保留 `REQ-VIS-001` |
| 2026-05-07 | 更新 | 完成 `REQ-VIS-001` G1 本地模型交互验证：Qwen `describe-screen` 通过；ShowUI 与 Qwen 同跑因资源不足失败，停 Qwen 后 ShowUI 在 `8000/v1` ready，`find-target` 返回 point 和截图证据；bbox/confidence 缺失和复杂目标偏移转入 `REQ-VIS-004/REQ-CU-002` |
| 2026-05-08 | 新增 | 新增 `REQ-VIS-006` 统一 Vision Tool Service 能力接口：业务层统一走 `describe/ocr/ground_point/ground_bbox/visual_action` 能力，`describe`/`ocr` 本轮只预留接口，不与 grounding/action 并行联测；外部 OpenAI-compatible VLM 作为后续兜底工具服务方向 |
| 2026-05-08 | 完成 | 完成 `REQ-VIS-006`：新增 `VisionToolService` 能力枚举和 point-only confidence 降级策略，Web 暴露 `/api/vision/tool-service/capabilities`、`describe/ocr` reserved 端点、`ground-point/ground-bbox` alias，`computer.visual_action` 和 semantic dispatch 输出 screenshot/target/point/backend/confidence evidence；vision-service 18 项、web-console 126 项离线测试通过 |
| 2026-05-08 | 完成 | 完成 `REQ-VIS-004`：grounding parser 支持 candidates/results/detections/items 候选数组并按最高 confidence 选择，point-only 结果保留低置信降级原因；vision-service 19 项、web-console 126 项离线测试通过 |
| 2026-05-08 | 更新 | 推进 `REQ-CU-002/REQ-TOOL-005/REQ-CU-008`：semantic dispatch 在视觉输入可用时通过 `visual_action` 生成动作计划，`drag_select` 支持 bbox 直接生成拖拽起止点和 path；web-console 128 项离线测试与 `cargo check` 通过，`REQ-CU-002` 转入测试中 |
| 2026-05-08 | 更新 | 推进 `REQ-CU-005`：computer-use action plan、visual_action 和 semantic dispatch 统一输出 `ComputerUseAuditRecord`，包含 audit_id、execute 权限闸门、截图证据路径和审计日志路径；web-console 129 项离线测试与 `cargo check` 通过，需求转入测试中 |
| 2026-05-08 | 更新 | 推进 `REQ-CU-003`：computer-use core 增加浏览器确认按钮与表单输入目标和默认回归场景，连同既有地址栏/页面搜索形成浏览器内操作 dry-run 矩阵；core 8 项、web-console 129 项离线测试与两个包 `cargo check` 通过，需求转入测试中 |
| 2026-05-08 | 更新 | 推进 `REQ-CU-004`：computer-use core 增加 Windows 记事本文本区、文件选择框路径输入、系统确认按钮目标和默认回归场景；core 9 项、web-console 129 项离线测试与两个包 `cargo check` 通过，需求转入测试中 |
| 2026-05-08 | 新增 | 新增总览卡片指标重构、默认 workspace 与权限边界、本地/远端视觉模型 profile 容量评估、本地/自定义 OpenAI-compatible 模型配置四项需求；按 P0 UI/权限边界优先，模型配置和远端 GLM 兜底随后推进 |
| 2026-05-08 | 更新 | 完成 `REQ-WEB-OVERVIEW-001/REQ-WEB-PROJECT-002` 自动化闭环：总览改用 `/api/state.overview` 业务指标并移除 health debug；默认 workspace 指向用户目录 `coolzhuagent`，文件工具 dry-run 路径限制在当前工程目录；web-console 133 项离线测试通过，两个需求转入测试中 |
| 2026-05-09 | 完成 | 完成 P0 解除环境依赖与硬编码路径：所有 `COOLZHU_ENABLE_REAL_LLM`/`CLAW_LOCAL_VISION_*` 等环境变量迁移到 `coolzhu.toml`；新增 `real_llm_enabled()`/`desktop_pet_disabled()` 等 config-first 函数；所有 env var 保留兜底 |
| 2026-05-09 | 完成 | 完成 P1 视觉Agent会话选择与模型类型标记：`model_type` 全链路 (ConfigModel/PersistedSession/SQLite/SessionSummaryDto)；MODEL_TYPE_MAP 分类 (text/vision/multimodal)；三合一卡片模型类型 select；总览卡片视觉Agent下拉+持久化；`vision_session_config`；grounding(ShowUI)与视觉理解(远程)分离 |
| 2026-05-09 | 更新 | REQ-LLM-005 从待开发推进到测试中：reasoning_effort 选择器 (28模型×5级)、thinking/reasoning level 前端 select 联动已落地；自定义 endpoint/base_url 延期 |
| 2026-05-09 | 更新 | LLM 链路全通：DeepSeek/阿里百炼/智谱 AI 均验证通过；新增 `real_llm_enabled()` config-first 读取链；`diag!` 宏 + `err.log` 诊断系统；消息发送卡片布局重构（附件浮动/发送对象缩小/框选监控移入视觉卡片） |
| 2026-05-09 | 更新 | 图片附件→LLM视觉传输链路打通：`encode_attachment_images` base64 编码 → `InputMessage::user_text_with_image_urls` → 远程视觉模型；视觉API调用链路补 `effective_agent_base_url_impl` provider 默认 URL 映射 |
| 2026-05-09 | 更新 | 桌宠退出联动：`launch_desktop_pet` 返回 `Child` 句柄，`spawn_blocking` 等待进程退出后 `process::exit(0)` 关闭 Web 服务 |
| 2026-05-10 | 完成 | TDD 闭环 REQ-MEM-002~005：补 4 个验收测试 (CRUD/签名/去重/L4过滤/limit/pin保留/容量裁剪/摘要统计)，全量回归 138 passed |
| 2026-05-10 | 完成 | 第三梯队 13 项闭环：ShowUI grounding 端到端验证 (REQ-VIS-001) + 强视觉 safe-click 实测 (REQ-CU-002) + CU-001/003~008 自动化联测 + TOOL-005/006 工具链路；全量 142 passed |
| 2026-05-10 | 完成 | ShowUI 集成适配：默认端口 8001→8000，默认模型 qwen2.5-vl-3b→showui-2b，grounding 与视觉理解链路分离，`effective_agent_base_url_impl` provider 默认 URL 映射 |
| 2026-05-10 | 新增 | 新增 `REQ-WEB-SESSION-007` 会话内容删除联动记忆删除：删除会话时 CASCADE 删除关联消息和 beads；单条消息/bead 删除；P1 优先级，待开发 |
| 2026-05-12 | 新增 | 新增 `REQ-TOOL-007` LLM 多工具调用适配 + `REQ-TOOL-008` 工具权限分级审批：暴露 21 个内置工具，4级权限模型 (Protected/DangerFullAccess/WorkspaceWrite/ReadOnly)，workspace 内自动执行、外弹审批 |
| 2026-05-12 | 更新 | 落地 Grounding Router Step A+B+E：新增 `modules/vision/packages/vision-service/src/locate.rs` (定位请求/响应契约+8测试)，新增 `modules/vision/packages/uia-resolver` (UIA PowerShell 脚本解析开始按钮 0,1368,83×72)，Web 端新增 3个 `/api/vision/locate*` 端点，UIA 命中置信度 0.99。LocalVlm/RemoteVlm backend 待后续 |
| 2026-05-12 | 更新 | 落地 Grounding Router Step C：新增 `local_backend.rs` (区域裁剪+DBSCAN聚类+prompt变体，6测试)，LocalVlm backend 已接入 router (调用 grounding_median_point/ShowUI) |
| 2026-05-12 | 分析 | ShowUI grounding 与 Vision Agent 职责混淆：`system-vision-agent` 同时承载 grounding 后端和视觉 Agent 两个矛盾语义，`build_overview_metrics` 回退暴露 ShowUI 给用户，`is_multimodal_agent` 错误包含 "showui" 关键词，总览只用硬编码列表不查询用户保存的视觉会话。详见 `docs/work-logs/2026-05-12-showui-vision-agent-confusion.md` |
| 2026-05-10 | 新增 | 新增 `REQ-WEB-SESSION-007` 会话内容删除联动记忆删除：删除会话时 CASCADE 删除关联消息和 beads；单条消息/bead 删除；P1 优先级，待开发 |
| 2026-05-10 | 新增 | 补落方案文档 `docs/precise-click-grounding-plan-2026-05-10.md`：UIA + Local VLM + Remote VLM GroundingRouter 根治 ShowUI 对系统级控件定位不准问题；关联 REQ-VIS-007、REQ-CU-002 |
| 2026-05-10 | 新增 | 补落方案文档 `docs/tool-calling-permission-plan-2026-05-10.md`：REQ-TOOL-007/008/009/010/011 统一 `ToolInvoke/ToolOutcome` 协议、registry 全量暴露、4 级权限闸门、审批 UI + 审计日志；REQ-TOOL-009/010/011 作为新增子项 |
| 2026-05-10 | 新增 | 补落方案文档 `docs/session-memory-workspace-integration-plan-2026-05-10.md`：WorkspaceScope 一体化、级联删除流水线、ContextBuilder 历史窗口 + FTS5 bead 召回、附件 GC；新增 REQ-MEM-006（bead origin 归因）、REQ-WEB-PROJECT-003（workspace reload）、REQ-WEB-CTX-001（LLM 历史上下文装配） |
| 2026-05-10 | 新增 | 补落方案文档 `docs/hard-requirements-implementation-plan-2026-05-10.md`：REQ-DESK-PET-003 事件总线、REQ-AUDIO-003 唤醒词、REQ-VIS-009/010 监控链路、REQ-PACK-001/003/007/008/009/010/012/013 安装授权体系落地步骤 |
| 2026-05-11 | 更新 | Phase A 落地：core-runtime 新增 `tool` / `permission_gate` 契约层、tool-registry 新增 `path_effect` 抽取；`PermissionMode` 补 serde；`MemoryBeadDto` 扩 `origin_message_id/origin_table/token_count` 字段；SQLite Schema v2（`memory_beads` 扩列 + `attachment_refs` + 2 个 trigger + `PRAGMA user_version=2`，幂等）；新增 4 条 DELETE/GET 路由、`SessionStore.delete_chat_room/delete_chat_room_message/delete_session_message/chat_room_impact`；新增 29 个 TDD 用例；web-console 147 全量通过；REQ-WEB-SESSION-007 状态 `待开发 → 测试中`；备份 `tmp/backups/phase-a-tool-session-20260510-{pre,post}/`；落地日志 `docs/work-logs/2026-05-10-tool-permission-session-cascade-phase-a.md` |
| 2026-05-11 | 更新 | Phase B 落地：(B-1) `persist_auto_memory_beads` 写 origin 归因 + 新增 `estimate_bead_tokens` CJK/ASCII 粗估；`AddMemoryBeadRequest` 扩 3 个可选字段并派生 `Default`；(B-2) core-runtime 新增 `ToolInvocationExecutor` trait + `RuntimeToolContext` + `runtime_tool_execute` 脚手架（evaluate → dispatch → executor；executor gate 被 runtime 覆写），尚未接入 web-console 调用点；新增 7 个 TDD；core-runtime 139 / tool-registry 34 / web-console 149 / linkage_smoke 4 全绿；REQ-MEM-006 新增并推进至 `测试中`，REQ-TOOL-007/008 从 `待开发 → 开发中`；备份 `tmp/backups/phase-b-tool-session-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-b.md` |
| 2026-05-11 | 更新 | Phase C-1 落地：web-console 新增 `ReadOnlyRegistryExecutor`（桥接 `tools::execute_tool`、仅 handle mvp ReadOnly 档工具）、`required_permission_for_tool`、`extract_path_targets`、`preview_tool_permission`(#[cfg(test)])；均未接入 prod 调用点（`run_model_tool_dispatch` 保持硬白名单），仅作为 Phase C-2 审批端点 + Phase C-3 替换 LLM 白名单的前置组件；新增 5 个 TDD；web-console 154 / core-runtime 139 / tool-registry 34 / linkage_smoke 4 全绿；备份 `tmp/backups/phase-c1-readonly-bridge-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c1.md` |
| 2026-05-11 | 更新 | Phase C-2 落地：web-console 新增 4 条审批 HTTP API（`/api/tools/protected-paths`、`/pending`、`/approve`、`/reject`）+ `SessionGrants`（30 min TTL）+ `PendingApprovals`（5 min TTL）内存结构 + `build_input_summary` 白名单脱敏；`preview_tool_permission` 从 test-only 晋升为正式函数（仍无 prod 调用点）；新增 6 个 TDD（含 "SECRET_KEY 不落日志" 断言）；web-console 160 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；REQ-TOOL-009 从 `—` 推进至 `开发中`；备份 `tmp/backups/phase-c2-approval-api-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c2.md` |
| 2026-05-11 | 更新 | Phase C-3 落地：新增 `POST /api/tools/runtime-execute` —— 这是 `runtime_tool_execute` 首次挂到 prod HTTP 路径；ReadOnly 直返 Ok、Protected/WorkspaceWrite 外部自动 enqueue pending、未知工具 Failed；旧 `run_model_tool_dispatch`/`/api/tools/execute` 完全未动；并发抗扰修复 Phase C-2 的 pending 测试；新增 3 个 TDD；web-console 163 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿（多线程 & --test-threads=1 两种模式都稳定）；REQ-TOOL-007 首次有 prod 调用点（"可演示"）；备份 `tmp/backups/phase-c3-runtime-execute-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c3.md` |
| 2026-05-11 | 更新 | Phase C-4 落地：新增 `GET /api/tools/events` SSE 端点 + `tool_event_bus`（tokio broadcast，容量 128）+ `ToolEvent` 枚举（`permission-required` / `approved` / `rejected`）；`enqueue_pending_approval` / `api_tools_approve` / `api_tools_reject` 成功后广播事件；无订阅者时 `send()` Err 被静默吞没，不阻塞；容量满时 `lagged` 事件提醒前端走 pending 补齐；新增 3 个 TDD（含"无订阅者不阻塞"与 Approved/Rejected 扫描）；web-console 166 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；REQ-TOOL-008 审批后端事件通道已就绪；备份 `tmp/backups/phase-c4-tool-events-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c4.md` |
| 2026-05-11 | 更新 | Phase C-5 落地：REQ-TOOL-010 完成——新增 `WorkspaceConfig.tool: ConfigTool` + `ConfigToolProtectedPaths` + `ConfigProtectedRule` 配置段，`coolzhu.toml [tool.protected_paths]` 支持 `rules`（完全替换默认）/ `append_defaults`（逃生舱）/ `extra_rules`（精准追加）三种组合模式；`From<ConfigProtectedRule> for runtime::ProtectedRule` 转换器 + `effective_protected_rules()` 中心化函数；3 处原 `default_protected_rules()` 调用点（preview_tool_permission / api_tools_protected_paths / api_tools_runtime_execute）全部切换；测试新增 `config_test_guard()` 串行化锁保护全局 workspace_config 的临时替换；新增 4 个 TDD（空配置 fallback / 完全替换 / append_defaults 合并 / 端到端 preview 命中用户 glob）；web-console 170 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿（--test-threads=1）；REQ-TOOL-010 从 `—` 推进至 `测试中`；备份 `tmp/backups/phase-c5-protected-config-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c5.md` |
| 2026-05-11 | 更新 | Phase C-6 落地：REQ-TOOL-009 完成——新增 `/api/tools/audit` GET（默认 50 条 / 上限 500 / 尾部截取）+ `append_tool_audit_record` 追加到 `.coolzhu/tool-audit.jsonl`；`api_tools_runtime_execute` 每次调用都落审计（Ok/DryRunOnly/Failed/Rejected 全覆盖）；`input_summary` 白名单投影，原始值严禁落盘；`PendingApprovalPermission` 补 Deserialize；测试用 `scoped_session_db_env` 通过 `COOLZHU_WEB_SESSION_DB` 隔离到 tempdir；新增 3 个 TDD（SECRET_KEY 不泄漏 + limit/tail 尾截取 + 脏行容忍）；web-console 173 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿（--test-threads=1）；REQ-TOOL-009 从 `开发中` 推进至 `测试中`；备份 `tmp/backups/phase-c6-audit-jsonl-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c6.md` |
| 2026-05-11 | 更新 | Phase C-7 落地：REQ-TOOL-008 前端可演示——`index.html` 新增 `.tool-approval-panel` 悬浮面板（工具/调用方/入参摘要/原因/影响路径 + 3 按钮）；`app.js` `startToolApprovalStream()` 订阅 `/api/tools/events` SSE（permission-required 渲染 / approved+rejected 隐藏 / lagged 时拉 pending 补齐 / onerror 1.5s 重连）+ `respondToApproval(approve/reject, once/session)` 调 `/api/tools/approve|reject`；`styles.css` 新增红蓝绿三色按钮样式；零后端改动，兼容既有 computer-use tool-exec-actions；手工验证 7 步清单；web-console 173 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；REQ-TOOL-008 从 `开发中` 推进至 `测试中`；备份 `tmp/backups/phase-c7-approval-ui-20260511-post/`（含 main.rs + app.js + styles.css + index.html）；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c7.md` |
| 2026-05-11 | 更新 | Phase C-8 落地：REQ-TOOL-009 前端可视化——`index.html` 工具卡片内新增 `.tool-audit` 块（标题 + 状态 pill + 刷新按钮）；`app.js` `refreshToolAudit()` 拉 `/api/tools/audit?limit=50`，表格化渲染（时间/工具/调用方/状态/决策/耗时）+ 行点击展开明细（call_id/workspace/session/input_summary/reason/paths/summary_text）；`respondToApproval` 成功后自动刷新审计表；`escapeHtml` 防御性转义；`styles.css` 新增 `.tool-audit*` 样式（220px 滚动、状态色映射 ok=绿/dry-run-only=黄/rejected=红）；零后端改动；web-console 173 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；app.js 语法检查通过；备份 `tmp/backups/phase-c8-audit-ui-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c8.md` |
| 2026-05-11 | 新增 | Phase C-9 分析文档：`docs/work-logs/2026-05-11-tool-permission-phase-c9-dispatch-switch-analysis.md`——梳理 `run_model_tool_dispatch` 切换到 `runtime_tool_execute` 的三步走方案（C-10 暴露扩张、C-11 内部切换、C-12 ToolResult 回灌）；精确标注两条 Tool Loop 调用链行号（流式 3948-4003 / 非流式 7115-7143 / run_model_tool_use_message 8814-8842）；兼容性矩阵 + 风险回滚；不改代码 |
| 2026-05-11 | 更新 | Phase C-10 落地：REQ-TOOL-007 从 25% → 45%——`ConfigModel.llm_tool_exposure: Option<String>` 支持 `"dispatch-only"`/`"whitelist"`/`"all"`，默认 whitelist；`llm_tool_definitions()` 重构为从 `mvp_tool_specs` 按 `PermissionMode::ReadOnly` 自动筛出 10 个 ReadOnly 工具 + `tools_semantic_dispatch` 元工具共 11 个暴露给 LLM；description 追加 `(Permission: ...)` 标注让模型自我约束；`run_model_tool_dispatch` 内部白名单保持不变（留 Phase C-11 切换）；新增 4 个 TDD（disabled / default whitelist / all mode / dispatch-only）；web-console 177 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；备份 `tmp/backups/phase-c10-llm-tool-definitions-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c10.md` |
| 2026-05-11 | 更新 | Phase C-11 落地：REQ-TOOL-007 从 45% → 85%——`run_model_tool_dispatch` 内部分流：path A `tools_semantic_dispatch` 提取到 `legacy_semantic_dispatch` 函数保持 computer-use dry-run plan 契约不变；path B 其它 registry 工具走新 `invoke_through_runtime` → `runtime_tool_execute`（构造 `ToolInvoke{caller=Llm}` + `RuntimeToolContext` + `ReadOnlyRegistryExecutor`）+ `tool_outcome_to_dispatch_response` 映射回 ToolDispatchResponse（route=`runtime-executed/dry-run/rejected/failed/timeout`，safety_gate 取自 permission_gate.decision，mode="runtime"）；DryRunOnly 自动 `enqueue_pending_approval`（SSE 实时广播）+ `append_tool_audit_record`（caller=llm）；上层 Tool Loop / run_model_tool_use_message 签名不变；新增 5 个 TDD（semantic legacy 零回归 / ReadOnly 成功 / write_file+coolzhu.toml DryRunOnly / 未知工具 Failed 不 panic / LLM 调用落审计）；web-console 182 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿；运行时紧急回退：`coolzhu.toml [model] llm_tool_exposure="dispatch-only"`；备份 `tmp/backups/phase-c11-dispatch-runtime-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c11.md` |
| 2026-05-11 | 更新 | Phase C-12 落地：REQ-TOOL-007 从 85% → 92%——非流式 Tool Loop 按 Anthropic / OpenAI 标准 tool_use 协议回灌 ToolResult blocks：`model_tool_requests_from_blocks` 返回 `(tool_use_id, name, input)` 三元组；`AgentModelResponse.tool_requests` 类型同步；新 `agent_message_request_with_history(agent, stream, messages)` + `agent_message_request_build` 私有助手；`call_agent_model_with_tool_loop` 重写 round 0/1/2 为 `[user, assistant(ToolUse), user(ToolResult)]` 三段式 history，舍弃 `"工具执行结果:\n..."` 文本拼接；流式路径（`model_tool_calls: BTreeMap<u32,(String,String)>`）沿用旧文本拼接留到 Phase C-13；4 处 callsite 类型跟进；新增 2 个 TDD（保留 tool_use_id / history builder 保留 tools+system+model）；既有 `non_stream_model_tool_use_is_extracted_from_output_blocks` 断言元组索引更新；web-console 184 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿（--test-threads=1）；备份 `tmp/backups/phase-c12-tool-result-block-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c12.md` |
| 2026-05-11 | 更新 | Phase C-13 落地：REQ-TOOL-007 核心完成（92% → 100% 主体）——流式 Tool Loop 切结构化 ToolResult 回灌：`model_tool_calls: BTreeMap<u32,(String,String)>` → `BTreeMap<u32,(String,String,String)>`（tool_use_id / name / argsJson）；`ContentBlockStart(ToolUse{...})` 解构保留 `id`；`InputJsonDelta` append 读第 3 位；round 2 改用 `agent_message_request_with_history(stream=true, [user, assistant(ToolUse), user(ToolResult)])` + `provider_client.stream_message(&request)`，彻底替代 `"工具执行结果:\n..."` 文本拼接；ToolResult blocks `is_error` 由 `dispatch.status` 映射；round 2 流式 event loop 新增 ThinkingDelta 追加到 reasoning_message；3 处 callsite 同步改为 `(_id, name, input)` 解构；清理旧 `Ok(mut round2)/Err(e)` match 残留；新增 2 TDD（tuple 三元组 slot / ContentBlockStart 解构）；web-console 186 / core-runtime 121 / tool-registry 34 / linkage_smoke 4 全绿（--test-threads=1）；REQ-TOOL-007 主体由 `开发中` → `已完成`（并发 `join_all` 留 REQ-TOOL-011）；备份 `tmp/backups/phase-c13-stream-tool-result-20260511-post/`；落地日志 `docs/work-logs/2026-05-11-tool-permission-session-cascade-phase-c13.md` |
| 2026-05-11 | 新增 | 落地审计文档 `docs/work-logs/2026-05-11-precise-click-grounding-audit.md`：对照 `precise-click-grounding-plan-2026-05-10.md` 逐项盘点——契约层（`locate.rs` / types） 90%；`uia-resolver` crate 存在但只有 PowerShell 脚本版 `resolve_system_control`（~55%，未按方案用 windows-rs IUIAutomation）；`local_backend.rs` 开了文件但未落区域裁剪/多采样/DBSCAN；`remote_backend.rs` 缺失（0%）；`router.rs` 独立模块缺失（pipeline 逻辑写在 `api_vision_locate` handler 内联，~55%）；`/api/vision/locate`、`/locate/backends`、`/locate/verify` 三端点已注册；**关键差距**：`api_tool_execute` 真实点击仍用 2026-05-10 硬编码锚点，未切换到 locate router；`ConfigVisionRouter` 未挂入 `ConfigVision`，`coolzhu.toml` 配置 silent 失效；整体完成度 ~45% |
| 2026-05-11 | 新增 | REQ-WEB-CHAT-007 聊天室多 agent 角色感知与消息流转（P1 待开发）+ 方案文档 `docs/multi-agent-chatroom-collaboration-plan-2026-05-11.md`：核心概念 roster / @寻址（L1 文本 / L2 fenced `handoff` block / L3 `chat_handoff` 工具）/ handoff 任务链（depth≤4、per-turn≤8、60s 去重、禁自环+回环）；Schema v3 新表 `chat_handoffs`；新增 HTTP `/roster`、`/handoffs[/manual|/cancel]` + SSE `chat-roster-updated/chat-handoff-{fired,rejected,completed}`；复用 REQ-TOOL-007/008 审批+审计链；`chat_handoff` 工具注入 runtime；分 5 阶段落地 D1~D5；15+ TDD 用例矩阵；配置 `[chat.collaboration]` 控制 enable/prompt_verbosity/阈值 |
| 2026-05-11 | 新增 | 脚本化需求功能交互验证方案 `docs/interactive-verification-automation-plan-2026-05-11.md`：入口 `scripts/verify-all.ps1` 一条命令走完已完成需求；10 个 group（env/session/chat/media/tool/vision/computer-use/workspace/pet/audio）含 40+ 场景；每场景 `Prepare/Trigger/UiChecklist/Cleanup` 四段；产物 `tmp/verification-runs/<ts>/summary.{json,html}`；默认 `-Offline`，`-EnableRealLlm` / `-EnableRealInput` 需显式开启并二次确认；分 V1~V7 阶段落地；可选前端"验证面板"增强；用户只需观察 WebUI 回答 y/n/s 即可完成端到端交付验证 |
| 2026-05-12 | 新增 | REQ-VIS-008 Grounding Backend 与 Vision Understanding Agent 职责分离（P1 待开发）+ 方案文档 `docs/showui-vision-agent-separation-plan-2026-05-12.md`：问题来源 `docs/work-logs/2026-05-12-showui-vision-agent-confusion.md`——ShowUI（坐标识别工具）与 Vision Understanding Agent（用户可选的多模态会话）在 DTO/下拉/路由中被当作同一实体；方案核心：删除 `system-vision-agent` 硬编码、`is_multimodal_agent` 移除 `"showui"`、`build_overview_metrics` 改查 session_store（永不回退 ShowUI）、新增 `UnderstandingAgentDto / GroundingBackendHealth / /api/agents/understanding / /api/vision/grounding/backends`；前端 `renderVisionAgentSelect` 仅显示用户多模态会话；分 Phase E1~E4 落地，E1+E2 纯后端重构即解决 5 个问题点；向后兼容（`/locate/backends` 留 alias） |
| 2026-05-18 | 更新 | 新增并推进 `REQ-WEB-OFFICE-001`：折叠态 3D 像素 robot 办公室从 `REQ-WEB-UI-010` 拆出；使用 imagegen 生成无角色办公室背景 `assets/ui-redesign/office-status-bg.png`，robot 由前端 CSS/DOM 可控层渲染；新增 `/api/office/scene` 聚合 active agents、chat rooms、memory beads、pending approvals、recent tools；自动验证 `node --check`、D2 静态契约、`coolzhu-web-console` 测试和 `cargo build` 均通过；Edge CDP 截图确认折叠态可见，状态转为测试中 |
| 2026-05-18 | 更新 | `REQ-WEB-OFFICE-001` 视觉修订：用户反馈 CSS robot 形象违和后，使用 imagegen 生成 6 帧 robot 动作帧 sprite sheet，经 chroma-key 转透明后保存为 `assets/ui-redesign/office-robot-sprites.png`；前端从 CSS 拼装形象切换为 sprite 帧显示，状态到帧映射 idle/active/waiting/warning/archiving/chatting；自动验证与 1920x1080 截图通过 |
| 2026-05-18 | 修复 | `REQ-WEB-OFFICE-001` robot 脚底锚点：按透明 sprite alpha bbox 计算可见底边，CSS 裁剪角色视窗并以可见脚底作为定位锚点，取消上下 bob 位移动画，避免脚和阴影分离导致漂浮；自动验证与截图通过；随后 `REQ-WEB-WIN-005` 回到开发中，推进记忆窗口真实功能闭环 |
| 2026-05-18 | 更新 | `REQ-WEB-WIN-005` 推进到测试中：记忆窗口接入 summary / prompt preview / context preview 三类后端 API，新增 pin/edit/delete 治理按钮，修复新窗口内 bead 列表受旧按钮宽度样式影响导致文本压扁的问题；自动验证与 Edge CDP 截图通过 |
| 2026-05-18 | 更新 | `REQ-WEB-WIN-004` 补齐工具授权风险解释层：任务 / 授权窗口接入 `/api/tools/protected-paths`，显示当前生效 Protected 路径规则，并在 pending approval 项中显示 `protected_match`；自动验证与 Edge CDP 截图通过 |
| 2026-05-18 | 更新 | `REQ-WEB-WIN-007` 补齐视觉原生后端能力入口：视觉实验窗口接入 `/api/vision/locate`、`/api/vision/locate/verify`、`/api/vision/grounding/backends`、`/api/vision/tool-service/capabilities`；只做 locate/verify 预演和能力可视化，真实输入仍默认关闭 |
| 2026-05-18 | 更新 | `REQ-WEB-WIN-002` / `REQ-TOOL-012` 工具治理前端 MVP：设置窗口工具区 Inspect 改为调用 `/api/tools/{tool_id}` 详情 API，新增 Semantic dispatch dry-run 调用 `/api/tools/dispatch`，新增 Scenario / permission matrix；自动验证、离线构建和 Edge CDP 截图通过 |
| 2026-05-19 | 更新 | `REQ-GOAL-001` 推进到测试中：新增 Goal G1 SQLite schema v4（`goals`、`goal_phases`、`goal_events`）、Goal 创建/查询/详情/取消 API，并将任务 / 授权 / Goals 窗口从占位改为读取 `/api/goals` 的真实列表与 create/cancel 入口；不启动自主 loop、不触发工具执行；自动验证和 Edge CDP 截图通过 |
| 2026-05-19 | 更新 | `REQ-GOAL-002/003` 推进到测试中：新增 CompletionCondition DSL 结构校验 API 与 GoalPlan phase DAG 持久化 API，任务窗口增加 Seed plan 入口；统一验证 `tmp/run-office-scene-validation.ps1` 通过 |
| 2026-05-19 | 新增 | 按用户新增需求调整优先级：`REQ-GOAL-004` 扩展为每会话角色配置，新增 P0 `REQ-GOAL-010` 指挥官/心跳/超时/长任务风险管理，新增 P0 `REQ-TOOL-013` 完全访问权限显式授权开关，新增 P2 `REQ-AUDIO-002` IndexTTS provider 集成，新增 P1 `REQ-TOOL-014` OpenCLI 工具集成；打包冻结不变 |
| 2026-05-19 | 更新 | `REQ-GOAL-004/010` 第一阶段完成并进入开发中：新增 `goal_role_configs` schema v5、Goal role config/heartbeat API、commander 唯一标记、online/stuck/risk_level 状态计算；设置窗口新增 Role、Responsibility、Commander、Heartbeat/Task timeout 配置和 Heartbeat 操作；针对性验证 `goal-role-validation.20260519-074357` 通过，完整 Web Console 验证 255 passed + cargo build 通过 |
| 2026-05-19 | 更新 | `REQ-GOAL-010` 风险看板切片完成：`/api/goals/roles` 评估 role offline/stuck 后，对当前 workspace 非终态 Goal 去重写入 `goal-role-risk` 事件；任务 / 授权窗口新增 Role risks 摘要卡片，显示离线/卡住角色；针对性验证 `goal-role-risk-validation.20260519-082054` 通过，完整 Web Console 验证 257 passed + cargo build 通过 |
| 2026-05-19 | 更新 | `REQ-GOAL-004` Goal role session bootstrap 切片完成：新增 `/api/goals/roles/bootstrap`，设置窗口新增 Bootstrap role session 按钮；后端按选中角色或默认角色列表创建缺失的 `goal-<role>` session，克隆当前会话 provider/model/base_url/endpoint/key/reasoning，并写入 pinned `goal-role-template-*` bead；针对性验证 `goal-role-bootstrap-validation.20260520-001138` 通过，完整 Web Console 验证 259 passed + cargo build 通过 |
| 2026-05-20 | 更新 | `REQ-GOAL-004` 推进到测试中：Goal DTO 的 phase 增加 `assigned_session_id`、`assigned_session_display_name`、`assigned_session_available`，按 `assigned_role` 解析到确定性 `goal-<role>` 会话；任务 / 授权窗口 Goal 列表新增 phase target 明细，显示 ready/missing，便于 commander/Goal Loop 后续按目标会话分发；针对性 TDD 与完整 `tmp/run-office-scene-validation.ps1` 通过 |
| 2026-05-20 | 更新 | `REQ-GOAL-010` commander review 切片完成：新增 `POST /api/goals/{goal_id}/commander/review`，返回 `pause_recommended`、blocking reasons 和 phase review actions；识别 missing `goal-<role>`、role stuck/offline、依赖未完成，并落 `goal-commander-review` 审计事件；任务窗口新增 Review 按钮；针对性 TDD 与完整 `tmp/run-office-scene-validation.ps1` 通过 |
| 2026-05-20 | 更新 | `REQ-TOOL-013` 推进到测试中：新增 full access 显式授权 API 和任务窗口开关；必须风险确认 + 二次确认，TTL 默认 10min/最大 30min，可撤销，按 workspace+session 隔离，授权生效后同 session 的危险工具可命中临时 grant；grant/revoke 写入工具审计；针对性 TDD 与完整 `tmp/run-office-scene-validation.ps1` 通过 |
| 2026-05-20 | 更新 | `REQ-GOAL-006` 进入开发中：新增 `POST /api/goals/{goal_id}/dispatch-ready`，复用 commander review，只派发 `ready_to_dispatch` phase；派发复用 chat handoff gate/inbound message，成功后 phase 更新为 `running` 并写入 `goal-phase-dispatched` 事件；任务窗口新增 Dispatch 按钮并刷新 handoff 摘要；针对性 TDD 与完整 `tmp/run-office-scene-validation.ps1` 通过 |
| 2026-05-20 | 更新 | `REQ-GOAL-007` 进入开发中：新增 Goal status/pause/resume API 和 `/api/goals/{goal_id}/events` SSE 事件流；GoalEvent 写入 SQLite 后广播到独立 Goal event bus，任务窗口新增 Status/Pause/Resume 按钮并订阅 Goal EventSource 自动刷新；针对性 TDD 通过，完整验证见 work-log |
| 2026-05-20 | 更新 | `REQ-GOAL-009` 进入开发中：新增 `[goal].enabled` 回滚开关、`GET/POST /api/goals/runtime` 和 diagnostics `goal.runtime` 检查；禁用时 `dispatch-ready` 返回 pause/skipped，不创建 handoff，并写入 `goal-runtime-disabled` 事件；Goal Loop 派发/审视事件补 `caller=goal-loop`；针对性 TDD 通过，完整验证见 work-log |
| 2026-05-20 | 调整 | 按用户确认回撤调试拦截口径：Goal 功能完成后不保留 `[goal].enabled=false`、runtime API 或禁用派发类闸口；只保留 `goal_events` caller/payload 与日志诊断。新增 `REQ-TOOL-015`，工具调用细节从聊天流迁出，在工具窗口用灰/红/绿状态灯表达未调用/执行中/完成 |
| 2026-05-20 | 更新 | `REQ-TOOL-015` 推进到测试中：设置窗口新增工具调用状态灯 strip 和目录条目状态灯；semantic dispatch 请求开始置红、结束置绿，未调用保持灰；移除 dry-run 结果向聊天室追加 `Tool governance` 详情消息；同时删除 Goal runtime 调试拦截 API/配置/事件，完整验证通过 |
| 2026-06-18 | 新增 | 用户批准桌宠 blink 尺度、本地模型切换、会话协议和 Agent Reach 推荐整改方案；`REQ-DESK-PET-005` 与 `REQ-LLM-005` 回到开发中，新增 `REQ-WEB-LOCAL-MODEL-001`、`REQ-LLM-006`、`REQ-TOOL-016`；设计文档写入 `docs/superpowers/specs/2026-06-18-pet-local-model-session-protocol-agent-reach-design.md` |
| 2026-06-18 | 调整 | 用户要求 blink 禁止拉伸，必要时用 Image Gen 参考原图按 idle 尺度重生成；设置窗口扩展为全控件、工具详情和 TTS/STT 链路审计，前端设置参数统一迁入 `coolzhu.toml`，移除隐藏环境变量/global gate；功能验收必须通过 computer-use 操作真实前端；会话协议改采用方案 C 定向架构根治，高风险修改前备份完整源码目录 |
| 2026-06-19 | 更新 | UI Redesign V3 Batch 2 纳入并完成总览卡、任务卡、聊天室三项主设计目标，同时重排工程目录、浏览器、终端、任务授权和视觉实验；新增静态布局契约并通过 103 项目标测试、package all、HTTP 200 启动和 Computer Use packaged Tauri 前端复验；详细记录见 `docs/work-logs/2026-06-19-ui-redesign-v3-batch2.md` |
| 2026-06-24 | 修复 | 修复大附件与本地模型会话链路：附件上传路由解除 Axum 默认 2 MiB multipart 限制并改由 `[attachment].max_upload_bytes` 管理；本地模型启动、健康检查、context/output/tool budget 统一服从 `[model]` 配置，否定式搜索不再误开工具；3 MiB 实际上传、540 项串行测试和真实聊天室 `LOCAL_CHAIN_OK` 通过。按用户要求本轮不使用 computer-use，视觉与前端交互改由用户人工确认 |
