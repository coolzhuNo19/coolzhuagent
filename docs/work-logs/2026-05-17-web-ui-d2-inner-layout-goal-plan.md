# 2026-05-17 Web UI D2 窗口内布局与 Goal 工具需求落表

时间：2026-05-17 16:49 CST  
范围：`REQ-WEB-UI-010`、`REQ-WEB-WIN-002/004/005/006/007/008`、新增 `REQ-GOAL-001~009`、新增 `REQ-TOOL-012`

## 背景

用户确认整体布局可继续推进，要求优先准备每个窗口内部布局设计、加入设计图 icon/组件，按功能必要性归入对应窗口，并把 `goal.txt` 与 `goal-driven-multi-agent-orchestration-plan-2026-05-13.md` 中的 Goal 工具纳入需求管理表。

## 并行审计

本轮启动 3 个只读 explorer：

- Goal 需求拆分：建议将 `REQ-CORE-AGENT-001` 拆成 `REQ-GOAL-001~009`，UI 不单独开 Goal 窗口。
- 功能归窗审计：梳理当前 API/DOM 与 10 个下区窗口的归属，指出工具审计应迁到任务授权窗口，工具目录保留在设置窗口。
- 窗口实现边界审计：确认 `index.html/app.js/styles.css` 热点文件的并行写入边界，要求按窗口根类和函数前缀隔离。

## 文档变更

- 新增 `docs/web-ui-window-d2-inner-layout-goal-plan-2026-05-17.md`：
  - 记录外部设计参考：IDE、设置、项目管理、终端、浏览器、媒体播放器等同类设计模式。
  - 明确 10 个下区窗口的功能归属和页面展示必要性。
  - 细化工程目录、设置、聊天室、任务/授权/Goals、记忆、多媒体、视觉实验、诊断日志、浏览器、终端的内部布局。
  - 列出可复用 icon 和缺口 icon。
  - 定义当前可并行 worker：TasksGoal、MemoryMedia、VisionLogs。
- 更新 `docs/requirements-management.md`：
  - 新增 0.3 “D2 窗口内布局与 Goal 工具新增需求”。
  - `REQ-WEB-WIN-004` 从“任务 / 授权独立窗口”调整为“任务 / 授权 / Goals 独立窗口”。
  - 新增 `REQ-GOAL-001~009`。
  - 新增 `REQ-TOOL-012` 工具 / 插件 / SKILL 场景目录与适配矩阵。
  - 更新执行顺序和需求统计。
- 更新 `docs/README.md`：
  - 补充 D2 窗口方案和窗口内布局 / Goal 工具方案入口。
- 更新 `docs/web-ui-window-d2-implementation-plan-2026-05-17.md`：
  - 增加 2026-05-17 补充，锁定 Goal 不新开窗口、先归任务/授权窗口。

## 需求状态

- `REQ-WEB-WIN-001`：保持 `测试中`。
- `REQ-WEB-WIN-003`：保持 `测试中`。
- `REQ-WEB-WIN-004`：保持 `待开发`，范围扩展为任务 / 授权 / Goals。
- `REQ-GOAL-001~009`：新增，状态 `待开发`。
- `REQ-TOOL-012`：新增，状态 `待开发`。

## 并行开发启动

已启动 3 个 worker：

- `Frontend-TasksGoal`：实现任务 / 授权 / Goals 窗口首版内部布局。
- `Frontend-MemoryMedia`：实现记忆 / 知识与多媒体窗口首版内部布局。
- `Frontend-VisionLogs`：实现视觉实验与诊断日志窗口首版内部布局。

每个 worker 都限定了 DOM、JS 函数前缀和 CSS 根选择器，避免同时改聊天发送链、工程目录和设置保存链路。

## 备份

- 变更前备份：`tmp/backups/web-ui-d2-inner-goal-plan-20260517-164931-pre`

## 验证

- `rg "REQ-GOAL|REQ-TOOL-012|任务 / 授权 / Goals|web-ui-window-d2-inner-layout-goal"` 已确认需求表、README、D2 方案和新方案文档均可检索到新增项。

## 后续

1. 等待 3 个 worker 返回代码修改。
2. 合并时优先处理互不冲突的窗口区块。
3. 合并后运行 `node --check modules/gui-web/packages/web-console/src/app.js` 和 `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`。
4. 启动/复用 8765 预览服务，截图确认 `tasks/memory/media/vision/logs` 窗口视觉效果。
