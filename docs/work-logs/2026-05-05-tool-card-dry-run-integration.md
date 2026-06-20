# 2026-05-05 工具卡片 dry-run 接入

## 实现内容

- 新增 `POST /api/tools/{tool_id}/dry-run`。
- 工具卡片 `dry-run` 按钮接入后端安全预演。
- `execute` 保持禁用，不开放真实执行。
- catalog 扫描根目录改为向上定位 codex 项目根，减少运行目录偏差。
- `vision.describe_screen` 暂以截图元数据 dry-run 结果返回，避免误导为完整 OCR/VLM。
- `tool-registry` 核心只读工具加入安全预演默认输入。

## 安全边界

- 不执行插件/SKILL 的 hook、生命周期或命令。
- 不触发真实键鼠输入。
- 不打开写文件、编辑文件、shell、agent、PowerShell 的 execute 路径。
- opencode 来源仍标记 candidate，仅展示与迁移评估。

## 验证

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
```

## 备注

- `vision.describe_screen` 后续需要本地 VLM/OCR 才能升级为真正的图像文字描述工具。
- `tools.semantic_dispatch` 后续需要 catalog schema 驱动的 tool calling，而不是关键词路由。

## 追加记录：LLM 语义工具 dry-run 协议

实现日期：2026-05-05

### 实现内容

- `/api/tools/dispatch` 的 `dispatch_plan` 固定暴露 `tool_id`、`action`、`dry_run_input`、`action_plan`、`llm_tool_call`、`execute_allowed=false`、`safety_gate` 和 `rationale`。
- `tools.semantic_dispatch` dry-run 与直接 `/api/tools/dispatch` 使用同一份结构，后续真实 LLM tool calling 可直接消费 `dispatch_plan.llm_tool_call`。
- Computer Use 工具卡片新增 dry-run 计划项：
  - `computer.double_click`
  - `computer.scroll`
  - `computer.text_input`
  - `computer.press_key`
  - `computer.hotkey`
- 语义识别扩展到中文/英文的双击、滚动、文字输入、按键、快捷键意图。

### 安全边界

- 本阶段仍不开放真实键鼠执行。
- dispatch plan 永远返回 `execute_allowed=false`。
- `hotkey`、`text_input`、`press_key` 只生成虚拟键计划和步骤说明，不调用输入后端。
- 真实执行后续必须补人类确认、截图证据、审计日志和失败恢复。

### 验证

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
cargo build -p coolzhu-web-console
```

通过结果：

| 项目 | 结果 |
| --- | --- |
| `node --check app.js` | 通过 |
| `cargo check -p coolzhu-web-console` | 通过 |
| `cargo test -p coolzhu-web-console` | 89 passed |
| `cargo build -p coolzhu-web-console` | 通过 |
| Web 服务 | 已重启到 `http://127.0.0.1:8765/` |

HTTP smoke：

| 场景 | 结果 |
| --- | --- |
| `使用 Ctrl+L 快捷键聚焦地址栏` | `dispatch_plan.tool_id=computer.hotkey`，`llm_tool_call.name=computer.hotkey`，`execute_allowed=false` |
| `向下滚动当前浏览器页面` | `dispatch_plan.tool_id=computer.scroll`，2 个 dry-run steps |
| `输入文字 hello` | `dispatch_plan.tool_id=computer.text_input`，2 个 dry-run steps |
| `按下回车` | `dispatch_plan.tool_id=computer.press_key`，1 个 dry-run step |
| `computer.text_input` 工具卡片 dry-run | 返回 `action=text_input`，2 个 steps |
| `computer.double_click` 工具卡片 dry-run | 返回 `action=double_click`，1 个 step |

## 追加记录：聊天室 tool-summary 回显

实现日期：2026-05-05

### 实现内容

- 聊天室的非流式发送也接入语义工具回显，和流式路径保持一致。
- 当消息命中工具语义时，`tool-summary` 会展示：
  - `LLM tool call dry-run`
  - `execute_allowed=false`
  - 安全闸门说明
  - 动作步骤摘要
- `prepare_chat_dispatch` 已改为识别 `semantic_action_from_intent`，因此 `Ctrl+L`、滚轮、文本输入、按键等语义会触发工具侧路由。

### 验证

```powershell
cargo test -p coolzhu-web-console
```

结果：

| 项目 | 结果 |
| --- | --- |
| `coolzhu-web-console` | 91 passed |

HTTP smoke：

| 场景 | 结果 |
| --- | --- |
| `POST /api/chat/send` with `使用 Ctrl+L 快捷键聚焦地址栏` | 200，返回 3 条消息，其中包含 `tool-summary` |
| `tool-summary` 内容 | 含 `LLM tool call dry-run：computer.hotkey` 和 `execute_allowed=false` |

## 追加记录：真实 LLM tool schema opt-in 桥接

实现日期：2026-05-05

### 实现内容

- 新增 `COOLZHU_ENABLE_LLM_TOOLS=1` 开关，默认关闭，避免影响 `agent-test001/agent-test002` 现有真实聊天行为。
- 开关开启时，真实模型请求会注入一个函数工具：
  - `tools_semantic_dispatch`
  - 参数：`intent`、`execute`、`confirm_after`、`roi_radius`、`text`、`target`、`menu_item`
- 非流式模型响应中的 `OutputContentBlock::ToolUse` 会转换为 dry-run dispatch，并追加 `tool-summary`。
- 流式模型响应中的 tool call 参数按 block index 累积 `InputJsonDelta`，避免 OpenAI-compatible 增量 JSON 参数丢失；完成后同样转换为 dry-run `tool-summary`。

### 安全边界

- 即使模型传入 `execute=true`，后端也强制转为 `execute=false`。
- 只开放 `tools_semantic_dispatch`，其它模型工具名会返回未开放错误。
- 本阶段不回传 tool result 给模型继续二轮推理，只在聊天室展示 dry-run 计划。

### 验证

```powershell
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
cargo build -p coolzhu-web-console
```

结果：

| 项目 | 结果 |
| --- | --- |
| `coolzhu-web-console` 单测 | 92 passed |
| `/api/state` | 200 |
| `/api/tools/dispatch` with `使用 Ctrl+L 快捷键聚焦地址栏` | `dispatch_plan.tool_id=computer.hotkey`，`execute_allowed=false` |

### 后续

- 下一步需要把 tool result 回灌给模型做第二轮回答，但仍需保持真实执行禁用。
- 需要补一个本地 mock provider 级 E2E，模拟真实模型返回 `tools_semantic_dispatch` tool call。
