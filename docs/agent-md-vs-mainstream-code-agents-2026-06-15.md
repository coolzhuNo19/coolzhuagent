# AGENT.md 与主流 code agent 系统提示词对标分析（2026-06-15）

## 1. 现状定位

本项目的 `AGENT.md` 是**工具调用参考表**（每次工具调用前注入，见系统提示 "follow the local AGENT.md tool calling guide"），不是完整 system prompt。完整 system prompt 在：
- `modules/gui-web/.../main.rs`：每会话拼装的 "You are a COOLZHU AGENT chat agent…"（含工具策略、AGENT.md 引用）。
- `modules/core-runtime/.../prompt.rs`：`load_system_prompt` / `SystemPromptBuilder`。

`AGENT.md` 现有内容：硬规则（顶层 JSON 参数、不要 `raw` 包装、缺字段重试、写文件优先 write_file/edit_file、OS 专属 shell、目录非文件、写后 read_file 验证）、工具 demo 表、坏例子、Goal artifact 清单。

**已做得好（对齐主流、保留）**：
- ✅ **具体工具示例 + 精确参数**（对齐 Cursor "specify expected patterns explicitly / reference canonical examples"）。
- ✅ **负面示例**（`raw` 包装坏例）——明确"不要这样"。
- ✅ **OS 专属 shell 指引**（环境上下文）。
- ✅ **写后验证 + Goal artifact 校验清单**（对齐 "verifiable success criteria"）。

## 2. 主流实践（来源见末尾）

| 实践 | 代表 | 要点 |
|---|---|---|
| 规划先行 | Cursor / Claude Code | 多步任务先研究代码库 + 出计划再动手 |
| 自主探索 | Cursor | 用 grep/glob/语义检索自己找上下文，少让用户贴文件 |
| 迭代验证闭环 | Cursor / Cline | 改完跑 test/lint/build，按具体信号（类型、退出码）验证而非假设 |
| 范围控制 | Claude Code / 2026 综述 | 默认会过度构建；约束"最小改动、勿加未要求的抽象/复杂度" |
| 结构化工具用法 + 防一次性过量调用 | Cline | 工具有 header/分隔/markdown，逐步确认 |
| 并行工具调用 | Claude Code | 无依赖的读取/检索一次并发 |
| 何时问 vs 自己决定 | Cursor | 前置决策到规划期；执行中尽量不打断；明确哪些需人确认 |
| 持续性/能动性 | Claude Code / Codex | 未彻底解决前不要提前交还控制权 |
| 避免交互式命令 | Cursor | 命令用参数/配置文件，勿依赖执行中用户输入 |
| 安全确认 | 综述 | 破坏性/对外动作先确认 |

## 3. 差距与可借鉴项（建议加入 AGENT.md）

| # | 缺口 | 借鉴 | 落地到 AGENT.md |
|---|---|---|---|
| 1 | 无"规划先行" | Cursor/Claude Code | 加"多步任务先探索+列步骤再动手" |
| 2 | 无并行工具调用 | Claude Code | 加"无依赖的 read/glob/grep 一次并发" |
| 3 | 无范围控制 | Claude Code | 加"最小改动、勿过度设计、勿加未要求的抽象" |
| 4 | 无自主探索 | Cursor | 加"先 grep/glob 自查上下文，别假设" |
| 5 | 验证偏浅（仅 read_file） | Cursor/Cline | 加"改代码后跑 build/test 看退出码；Goal Command verification 非零退出回 implementer"（coolzhu 已支持，明示之） |
| 6 | 无"何时问/决定" | Cursor | 加"goal/自动场景用合理默认值自走，不中途等输入；破坏性动作先确认" |
| 7 | 无错误恢复策略 | 综述 | 把"缺字段重试"泛化为"诊断根因，勿对同一失败命令循环重试" |
| 8 | 无能动性 | Codex/Claude Code | 加"任务未彻底完成+验证前不交还" |
| 9 | 环境上下文偏薄 | Cursor | 补关键命令（如 `cargo build -p <crate> --offline`）、工作区结构指针 |

## 4. 建议追加到 AGENT.md 的段落（可直接粘贴）

```markdown
## Working Approach (执行准则)

- 规划先行：多步任务先用 grep_search/glob_search 自查上下文，列出步骤再动手；不要凭假设。
- 并行调用：彼此无依赖的 read_file/glob_search/grep_search 在一次回复里并发，提速。
- 最小改动：只做被要求的改动，勿过度设计、勿引入未要求的抽象或重构无关代码。
- 验证闭环：改代码后用 build/test 验证（看退出码），不要只靠"看起来对"。
  Goal 的 Command verification 非零退出会自动回 implementer——据此修到通过。
- 能动性：任务未彻底完成并验证前，不要提前交还；遇阻先诊断根因，不要对同一条
  失败命令反复重试。
- 自动场景（Goal 阶段等）用合理默认值自走，不中途等待用户输入；
  破坏性/对外动作（删除、覆盖、push）先确认。
```

## 5. 落到完整 system prompt（main.rs / prompt.rs）的项

以下更适合放进会话 system prompt 而非每次工具调用的 AGENT.md：
- 语气/简洁度（少前言废话）、能动性、范围控制——这些是会话级行为，放 `SystemPromptBuilder`。
- 记忆相关：可提示"系统会注入相关记忆 beads，较新记忆覆盖较旧"（与已落地的 A–H 记忆架构呼应）。

## 来源
- [Best practices for coding with agents · Cursor](https://cursor.com/blog/agent-best-practices)
- [How System Prompts Define Agent Behavior · dbreunig](https://www.dbreunig.com/2026/02/10/system-prompts-define-the-agent-as-much-as-the-model.html)
- [Prompt Engineering for AI Agents · PromptHub](https://www.prompthub.us/blog/prompt-engineering-for-ai-agents)
- [Agent Experience · marmelab](https://marmelab.com/blog/2026/01/21/agent-experience.html)
