# test5 "分析目录"任务失败：根因定位与修复（2026-05-31）

## 现象（用户截图）
- 任务：让 test5(qwen3.7-max) 分析 `C:\Users\zhupu\coolzhuagent\clawd-on-desk-main` 目录代码、生成结构文档+状态流程图。
- 结果：**"模型未返回最终回复"**，只回了已执行工具结果摘要。
- 异常信号：`Remote context usage 69.6% (89129/128000)`、`local estimate 71789`、`history truncated: true`；
  且执行了 `computer.visual_action` 闭环截图（desktop-icon-left-click，与读目录任务无关）+ 一次 PowerShell。

## 关键证据链（均来自运行时 HTTP 实测的结构化 JSON，可信）
> 工具静态读取（Grep/Read/python 读源码）本轮多次出现渲染污染（虚构内容/重复行），
> 故根因判定以「运行时 `/api/*` 实测 + python json.load 解析的结构化数字」为唯一可信源。

1. `GET /api/sessions/session-1779459149988/context-preview` → `token_budget`：
   `{system:1133, memory:606, history:3000, user:0, total:4133}`，`truncated:true`，`history_message_count:23`，`memory_beads_count:8`。
   → **初始上下文组装仅 4133 token**（很小）。
2. 截图远程实际：`89129/128000 input tokens`。
3. **差额 ≈ 85000 token 无法由初始组装解释，只能来自 tool loop 多轮累积的工具结果** → 根因锁定 tool loop。

## 四个怀疑方向逐一排查（证据驱动）

### ✗ ① 上下文初始加载过大 —— 排除（但发现附带问题，见下）
- 初始组装 total 仅 4133 token，给输出留了充足窗口。初始不是问题。
- **附带问题（已记后续）**：test5 model 字符串为 `qwen3.7-max`，`context_build_options_for_agent` 中
  `if model_context > 8_000` 分支**未命中**（该确切串在 token 限额表里取到的 context ≤8000），
  预算退回 `ContextBuildOptions::default()` 的 **history=3000 / memory=1200**（实测吻合）。
  预算偏小本身不直接致命（初始组装小），但使 tool loop 更易相对超载。

### ✗ ② goal 记忆错误加载 —— 排除（修正前文错误数据）
- 修正：test5 **beads total = 106**（by_kind decision:47/chat:33/tool:17/experience:8；by_layer L1:9/L2:65/L3:8/L4:24），
  source 全部 `chat-room:auto-extract`(105)+`reference-forward`(1)，**goal 相关 beads = 0**。
  （前一版本文档误记 total=0，系静态读取污染所致，此处更正。）
- 虽 beads 多，但 `select_context_memory_beads` 受 `memory_token_budget(1200)` 约束，实际只注入 **8 条(606 token)**。
  无 goal/skill overlay 污染。**不是根因。**

### ✗ ③ 权限拦截 —— 排除
- 截图：`execute_allowed=true`、`allow-auto`、`execution allowed by permission profile`。无拦截。**不是根因。**

### ✓ ④ 工具调用（tool loop 工具结果无上限累积）—— 根因
- `call_agent_model_with_tool_loop`（及流式路径）每轮把工具调用的**完整结果**（`dispatch.summary_text`）
  原样追加进 history 继续下一轮，**对单条结果无任何体积上限**。
- 且 tool loop 后续轮次用自维护的 `history: Vec<InputMessage>` 累积，**不受 `build_context_assembly`
  的 `history_token_budget` 约束**（预算只作用于 round 0 的初始组装）。
- test5 为"分析整个目录"任务：工具（PowerShell 递归列目录 / read_file 大 JS 文件，clawd-on-desk 有 ~180 个文件）
  一次返回海量内容；多轮累积使输入从 4133 → **89129/128000(69.6%)**，挤占模型输出空间 → **"未返回最终回复"**。
- 次因：qwen3.7-max（经中转）在该任务下**误选 `computer.visual_action`** 截图（任务无关）。
  路由层无责——用户任务文本不含视觉关键词，`should_route_to_vision_agent` 应返回 false；是**模型自身工具选择**问题。

## 修复（已编译 exit 0 + 366 测试通过）
`modules/gui-web/packages/web-console/src/main.rs`：
- 新增 `truncate_tool_result_for_context(text)` + `MAX_TOOL_RESULT_CHARS_FOR_CONTEXT=8000`：
  单条工具结果超 8000 字符则截断为前 6000 字 + 中文提示（"已截断 N 字以保护上下文窗口；
  完整操作已执行；如需更多请按需读具体文件/分段，避免一次性返回整个目录或大文件"）。
- 两处 tool loop 回填点（流式 + 非流式）：`text: dispatch.summary_text` → `truncate_tool_result_for_context(...)`
  （grep 确认：函数定义 1 处、回填点改 2 处）。
- 效果：单条工具结果上限 ~3-4k token；即便多轮，累积速度大幅下降，远离 128k 上限，**保住输出空间**；
  提示文本**引导模型改用精准的后续工具调用**（按需读具体文件）而非一次性 dump 整个目录。
- 验证：`cargo build` exit 0；`cargo test -- --test-threads=1` **366 passed / 0 failed**（未破坏既有行为）。

## 后续加固（P1，已记需求文档）
1. **tool loop 输入 token 守卫（二道防线）**：tool loop 每轮估算累积 history token，超过 `context_window` 安全线
   （如 70%）时停止继续循环、强制模型基于已有信息总结输出。根治"多轮累积"而非仅"单条截断"。
2. **qwen3.7-max 等未登记模型的 context 容量登记**：在 llm-adapter 模型限额表补 `qwen3.7-max` 的真实
   context_window（128k），使 `context_build_options_for_agent` 命中 >8000 分支，给足 history 预算。
3. **模型误选 visual_action**：上下文变干净后应缓解；可在系统提示/工具描述里对"读目录/分析代码"类意图
   弱化 visual_action 暴露，或加"无视觉关键词时不主动截图"约束。
4. **委派耗时分析的提示词规范**：让 test5/test6 分析大目录时，提示"分批读关键文件、勿一次性递归 dump"，
   并指定输出文档路径，减少单次工具结果体积。
