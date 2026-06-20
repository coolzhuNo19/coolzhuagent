# 2026-05-21 当前未闭环问题与未完成需求

范围：只记录当前仍未完成、仍影响真实使用或后续开发的事项；已冻结的安装包/加密、外视觉、双视觉模型常驻不纳入本表。

## 四大核心功能验证主线

后续所有需求和问题修复都按以下四条主线做优先级仲裁；发生冲突时，以核心主线可真实落地为准：

1. 会话配置和真实会话链路：已配置会话必须能走真实模型回复，禁止把 fallback、prompt 回显或空回复判为通过。
2. 工具真实调用：文件读写、脚本执行、浏览器/搜索等常用 Agent 操作必须走真实 runtime/tool audit 链路。
3. compute use 工具化真实调用：保留 grounding compute-use 和云端识图方向，真实输入默认受权限控制，验证时要有截图/坐标/审计证据。
4. 多 Agent 协同与 Goal 长程任务：以 test3 指挥官、test1 规划、test2 执行产物生成作为最小真实回归场景，逐步闭环自动分发、心跳、超时和风险管理。

四大核心功能后续需要补齐 imagegen 操作流程指导图和 Remotion 视频化操作指导，确保用户按流程操作能得到真实场景效果。

## P0

| ID | 模块 | 当前状态 | 需要完成的闭环 |
| --- | --- | --- | --- |
| CUR-CHAT-REAL-001 | 聊天真实模型链路 | `test3` DeepSeek 流式真实回复通过；多工具 `read_file + glob_search` 真实 tool_use 与审计通过 | 每轮修改继续跑真实模型链路，避免 fallback 或配置丢失；把回归脚本保留为硬失败 |
| CUR-UI-I18N-001 | 全窗口中文化 | 设置窗口、Goal、任务按钮、部分空状态仍有英文，如 `Status/Pause/Resume/Dispatch/Seed plan` | 全窗口按钮、输入框、空状态和错误提示统一中文 |
| CUR-CHAT-AUTO-001 | 聊天室任务链/转交 | 后端已具备 roster、handoff parser、`chat_handoff` tool；前端仍保留手工“任务链/转交”按钮 | 移除手工任务链/转交按钮，改为提示词语义自动规划和自动流转，只在任务/工具窗口展示状态 |
| CUR-TOOL-CHAT-001 | 工具调用展示 | 聊天消息仍追加 `tool-summary`，且文本包含旧的 `dry-run` 调试说明 | 聊天区不显示工具调用细节；工具窗口用红/绿/灰状态灯和审计详情承载 |
| CUR-CONFIG-NOENV-001 | 配置文件化 / 环境变量清理 | 本轮 WebSearch 业务配置已改读 `coolzhu.toml [web_search]`，但仓内仍有历史 `COOLZHU_*` / `CLAW_*` env 兼容债务 | 后续新增功能禁止 env；逐步把仍影响四大核心链路的 env 读取迁移为 config-first，并在代码注释记录不可避免例外 |

## P1

| ID | 模块 | 当前状态 | 需要完成的闭环 |
| --- | --- | --- | --- |
| CUR-GOAL-REG-001 | Goal 最小真实回归 | 2026-05-22 已通过 API 级最小协同回归：角色配置、心跳、两阶段 plan、指挥官审视、dispatch-ready handoff、status 和取消清理；尚未跑通“test3 指挥官、test1 plan、test2 执行生成 Word/PPT”的完整真实产物场景 | 下一步把 API 级回归升级为真实会话链路：test3 分配、test1 搜索整理、test2 生成文档或演示稿，并沉淀审计/记忆证据 |
| CUR-GOAL-LOOP-001 | Goal 自动循环 | 当前主要是手动创建、审视、派发准备；自动 plan -> execute -> verify loop 未完成 | 完成阶段启动、执行结果回收、失败/超时/暂停状态机和审计事件汇总 |
| CUR-WEB-WIN-002 | 设置窗口 | 会话、工具、音频、视觉、Goal role 接入；仍有英文和布局细节，工具状态灯只完成部分链路 | 中文化、配置保存后状态一致、工具状态灯与真实审计联动 |
| CUR-WEB-WIN-004 | 任务/授权/Goals 窗口 | pending approval、Protected、full access、Goal status/dispatch 已接入 | Goal 最小回归和自动流转完成后，把阶段、角色心跳、风险阻塞统一展示 |
| CUR-WEB-WIN-008 | 诊断日志窗口 | health、suggestions、audit 摘要可用；logs tail/SSE 不完整 | 补日志 tail、关键步骤诊断流和 WebSearch/工具失败的可读定位 |

## P2

| ID | 模块 | 当前状态 | 需要完成的闭环 |
| --- | --- | --- | --- |
| CUR-WEB-WIN-009 | 浏览器窗口 | 仍是 URL/search + iframe MVP | 明确是否保留真实浏览器自动化；若保留，和 WebSearch/Browser tool service 打通 |
| CUR-WEB-WIN-010 | 终端窗口 | 单条命令可通过 runtime tool 执行；无 PTY/xterm | 后续按安全策略决定是否接 PTY；当前先保留单命令面板 |
| CUR-WEB-WIN-006 | 多媒体窗口 | 附件媒体库和播放列表 MVP | 后续如需完整播放器，再补本地媒体目录、播放控制、元数据和状态保存 |
| CUR-UI-SCALE-001 | 全局缩放策略 | 主控制台 app 大量用固定 px（像素风设计）+ 部分 `%`/`1fr` 弹性容器，整体未做等比缩放。左侧导航 `.window-tab` 在视口高 <~720px 时图标/文字溢出边框，已**局部缓解**（2026-06-07：字号 `clamp(9px,1.4vh,12px)`、图标 `height:100%` 随行高、`overflow:hidden` 兜底，实测 600 高 0 溢出、1080 高维持原样）；但顶部任务卡片 ellipsis 截断、大屏下方留白、其它固定 px 元素在极端缩放下仍可能不协调 | 评估整体方案：以设计稿为基准 `transform: scale` 等比缩放，或全面响应式（相对单位/容器查询 `cqw`/`cqh`）。**高风险、需整体回归**，暂遗留；当前仅修复导航破框 |

## 当前窗口后端接入概览

| 窗口 | 后端接入状态 |
| --- | --- |
| 工程目录 / IDE | `/api/project/tree`、file meta/read、diff 已接入；继续做交互确认和 IDE 细节 |
| 设置 | sessions、tools、audio、vision、goal roles 已接入；中文化和工具状态灯未完 |
| 聊天室 | 真实 LLM、stream、rooms、roster、handoff、attachments 已接入；手工按钮和工具详情展示需要调整 |
| 任务 / 授权 / Goals | pending approvals、Protected、full access、Goal CRUD/status/dispatch-ready 已接入；自动 Goal loop 未完 |
| 记忆 / 知识 | beads summary、prompt/context preview、pin/edit/delete 已接入；继续测试中 |
| 多媒体 | 附件索引、预览、播放列表 MVP 已接入 |
| 视觉实验 | grounding/capabilities/locate/verify 已接入；只保留 grounding compute-use 和云端识图方向 |
| 诊断日志 | health、suggestions、audit 摘要已接入；logs tail/SSE 未完 |
| 浏览器 | iframe/search MVP；WebSearch 工具链路已补 Windows PowerShell fallback，真实浏览器自动化仍未接 |
| 终端 | runtime single-command 已接入；无 PTY |

## 本轮验证证据

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 真实流式模型回复 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260521-072227/summary.md` |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260521-072227/summary.md` |
| runtime WebSearch panic 修复 | PASS | `tmp/logs/websearch-runtime-test-20260521-012315.status.log` |
| workspace 写文件 / 授权 PowerShell 单测 | PASS | `tmp/logs/runtime-tool-real-ops-tests-20260521-064648.status.log` |
| HTTP API 读/写/脚本/WebSearch 回归 | PASS | `tmp/verification-runs/runtime-tool-api-real-ops-20260521-072227/summary.md` |
| WebSearch Windows fallback / 并发回归 | PASS | `tmp/logs/tool-registry-websearch-tests-20260521-072154.status.log` |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-072155.status.log` |
| WebSearch 配置文件化 cargo check | PASS | `tmp/logs/tool-registry-check-20260521-222239.status.log` |
| Web Console 接入 config root cargo check | PASS | `tmp/logs/web-console-check-20260521-222239.status.log` |
| WebSearch 配置文件化格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-222740.status.log` |
| WebSearch 配置文件化 targeted test | PASS | `tmp/logs/websearch-config-test-20260522-002148.status.log`：安装 Visual Studio Build Tools 后 `link.exe` 恢复，配置文件化回归通过 |
| 最新 Web Console 构建 | PASS | `tmp/logs/web-console-build-msvc-20260522-003223.status.log`：MSVC linker 修复后 `cargo build -p coolzhu-web-console` 通过 |
| 真实会话链路回归 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260522-004040/summary.md`：`test3` DeepSeek 会话真实流式回复，未命中 fallback |
| 工具真实调用 HTTP 回归 | PASS | `tmp/verification-runs/runtime-tool-api-real-ops-20260522-003902/summary.md`：workspace、文件写/读、授权 PowerShell、WebSearch、清理链路通过 |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260522-004203/summary.md`：模型返回 `read_file` 与 `glob_search` 等至少两次真实 tool_use |
| compute-use / grounding 真实输入回归 | PASS/CHECK | `tmp/verification-runs/precise-click-grounding-20260522-004722/summary.md`：接口、权限、浏览器准备通过；真实键鼠视觉命中项仍需录屏/人工确认 |
| Goal API 最小协同回归 | PASS | `tmp/verification-runs/goal-api-real-smoke-20260522-063331/summary.md`：角色配置、心跳、两阶段 plan、commander review、dispatch-ready handoff、status 与取消清理通过 |
