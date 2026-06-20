# work-log 2026-06-19 定时 loop / GLM5.2 协议 / 项目备份

## 目的
用户 5 项任务：①读 obsidian-vault 建立架构认知（脚本/产物入 tmp，重定向 err.log，改动同步 vault）；
②桌面建 coolzhu-agent-project 备份有效文件；③校验修复 GLM5.2 API 协议（OpenAI 兼容 + 最高思考，规避百炼 Anthropic 协议思考强制检查冲突，完整链路检查）；
④开发定时 loop 任务（两类：轮询 / Goal 推进），前端与定时任务并排；⑤指派 GLM5.2、各模块解耦编译、更新 vault、package 组合运行、验收。

## 涉及模块与改动
- **llm-adapter**
  - `providers/openai_compat.rs`：新增 `normalize_openai_reasoning_effort()`，下发前把内部 5 档（low/medium/high/xhigh/max）钳到 OpenAI 协议合法值（xhigh/max/超高/最高→high；未知→medium），根治"非法 reasoning_effort 致服务端 400 协议冲突"。+1 单测。
  - `registry.rs`：`register_alibaba_models()` 补注册 `glm-5.2` + 别名，消除与 `providers/mod.rs` 双注册表不一致。
- **gui-web/web-console**
  - `main.rs`：`ConfigScheduledTask`/`TaskScheduleCreateRequest` 加 `task_kind`+`goal_id`；新增 `deliver_goal_scheduled_task`+`goal_status_is_finished`；重写 `run_due_task_schedules_once` 按类型分流（轮询不变重排 / Goal 推进回写进度、完成清空）；`api_create_task_schedule` goal 校验；+1 静态资源测试。
  - `index.html`/`app.js`/`styles.css`：定时任务面板加"任务类型"下拉 + Goal 选择器（拉 `/api/goals`）、列表类型徽标/目标/状态/错误行。

## 验证
- `cargo build/test -p coolzhu-llm-adapter --lib --offline` → 73 passed。
- `cargo build -p coolzhu-web-console --offline` OK；`cargo test ...schedul` → 12 passed；`module_linkage_smoke` → 4 passed。
- 打包：`cargo build ... --target-dir modules/gui-web/target` → `package.ps1 all -SkipBuild`（发布+备份）→ `package/run.ps1 -Component app`（health 200）。
- API 验收（新二进制 @8765）：轮询型(内容不变重排)/Goal 推进型(整体完成→status=completed 清空)/绑定不存在目标→404，全过。
- GLM5.2 会话（session-1781738898772）：provider=阿里百炼、model=glm-5.2、base_url 空、reasoning_effort=max。

## 链路协议结论（任务3）
会话 provider="阿里百炼"→AlibabaBailian→OpenAiCompatClient→resolver 判 OpenAiChatCompletions→`compatible-mode/v1/chat/completions`，
**非** Anthropic 协议，规避百炼"思考模式强制检查"冲突。reasoning_effort=max 在 UI 表达"最高"，wire 层安全钳到 high。
详见 `tmp/glm5.2-protocol-link-check.txt`。

## 备份（任务2）
`tmp/backup-coolzhu-agent-project.ps1` → `C:\Users\zhupu\Desktop\coolzhu-agent-project`（排除 target/node_modules/models/tmp 等）。
源码改动后于本轮末尾再次刷新备份以反映最新状态。

## 风险 / 回滚
- 新增字段均 serde default，旧 coolzhu.toml/前端兼容；scheduled_tasks 存 TOML 不触发 SQLite 级联清空陷阱；goal 走既有只读+update。
- 回滚：package/backup 保留旧 web-console.exe；llm-adapter 改动为纯增量函数，可单点 revert。

## 残留 / 后续
- DashScope 原生深度思考可能用 `enable_thinking`(+thinking_budget)，需联网+DASHSCOPE_API_KEY 现场核验（当前以 reasoning_effort=high 为协议内最强安全基线）。
- 定时 loop 真实窗口交互（浏览器打开 8765 观察面板）建议人工确认；状态标 REQ-WEB-SCHED-LOOP-001 测试中。
- Goal 推进型 schedule 建议用 interval/daily（once+goal 仅推进一次）。
