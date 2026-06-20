# 2026-06-20 UI round3：设置窗口工具与审批栏设计图对齐

## 需求来源

用户反馈当前设置窗口中部“工具与审批”仍沿用旧的控制面板布局，没有对齐已批准设计图。本轮目标：

1. 默认视图改为紧凑的工具状态清单。
2. 对齐设计图中的本地模型、CLI、MCP、Skill、compute-use 和 Semantic Dispatch Plan 六个条目。
3. 保留既有真实功能，但详细控制、目录、审计与 dry-run 配置不再常驻占用首屏空间。
4. 通过真实前端点击验证展开、收起和计划配置入口。

## 根因

- 上一轮前端契约只覆盖了设置窗口三列外壳和 Goal 配置迁移，没有约束“工具与审批”卡片内部的信息架构。
- 旧实现直接常驻渲染本地模型切换、工具目录、语义派发、权限矩阵和审计信息，因此虽然外层窗口风格已经迁移，中栏仍然显得拥挤且与设计图不一致。
- 本轮将设计图中的默认清单结构写入契约测试，避免后续样式调整退回旧布局。

## 风险与回滚

- 本轮只修改 Web Console 前端 HTML、CSS、JavaScript、SVG 图标和前端契约测试；未修改工具后端、模型协议、会话配置或权限执行逻辑。
- 可用源码备份：`tmp/backups/ui-round3-20260620-091452`
- package 旧二进制备份：
  - `package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260620-104543467.exe`
- 如需回滚：
  1. 从源码备份恢复本轮涉及的 Web Console 文件。
  2. 或将上述 package 备份二进制恢复为 `package/bin/coolzhu-web-console.exe`。
  3. 重新执行 package 启动与健康检查。

## TDD 记录

### Red

- 在 `modules/gui-web/packages/web-console/src/main.rs` 新增：
  - `web_frontend_round3_tool_approval_matches_inventory_design_reference`
- 契约要求六个 `data-tool-inventory` 条目、管理入口、旧控制区折叠角色和四列清单布局。
- 日志：`tmp/logs/ui-round3-tool-approval-red.log`
- 预期失败：旧页面缺少 `data-tool-inventory="local-model"`。

### Green

- 实现后定向测试通过：
  - 日志：`tmp/logs/ui-round3-tool-approval-green.log`
- JavaScript 语法检查通过：
  - 日志：`tmp/logs/ui-round3-tool-approval-node-check.log`
- Web 前端完整契约测试：
  - 日志：`tmp/logs/ui-round3-tool-approval-web-frontend-tests.log`
  - 结果：`117 passed; 0 failed`
- package 专属格式检查通过：
  - 日志：`tmp/logs/ui-round3-tool-approval-cargo-fmt-package-2.log`
- workspace 全量 `cargo fmt --check` 仍被其它模块已有格式漂移阻断：
  - 日志：`tmp/logs/ui-round3-tool-approval-cargo-fmt.log`
  - 本轮未修改或批量格式化无关文件。

## 实现内容

### 1. 默认工具清单

文件：`modules/gui-web/packages/web-console/index.html`

“工具与审批”中栏默认显示：

1. 本地模型服务：显示在线、未启用或错误状态。
2. CLI：显示实际可用数量。
3. MCP 工具：显示实际可用数量。
4. Skill：显示实际可用数量。
5. compute-use：显示目录中的真实可用状态。
6. Semantic Dispatch Plan：保留语义调度计划入口。

每行采用图标、名称与说明、状态、管理操作四列结构；默认不展示旧的详细面板。

### 2. 按需管理详情

文件：`modules/gui-web/packages/web-console/src/app.js`

- “管理/启用/计划配置”统一通过 `data-action="tool-inventory-manage"` 处理。
- 点击同一入口可展开或收起对应详情。
- 展开时只显示当前条目的关联区域：
  - 本地模型控制。
  - 工具目录。
  - compute-use 过滤后的工具目录。
  - Semantic Dispatch dry-run、场景/权限矩阵。
  - 审计信息。
- 工具目录加载后同步更新 CLI、MCP、Skill 和 compute-use 的真实数量或可用状态。

### 3. 视觉组件

文件：`modules/gui-web/packages/web-console/src/styles.css`

- 新增标记：`ui-feedback-round3-tool-approval-inventory-card`
- 使用深色金属玻璃、玉绿色状态光点和收敛的金色描边。
- 详细管理区作为有界滚动面板展开，不破坏设置页三列布局。

新增武侠风格 SVG 图标：

- `assets/icons-wuxia/model-scroll.svg`
- `assets/icons-wuxia/mcp-tools.svg`
- `assets/icons-wuxia/skill-star.svg`
- `assets/icons-wuxia/compute-use.svg`
- `assets/icons-wuxia/route-plan.svg`

## Package 构建

- 完整命令：`package all`
- 日志：`tmp/logs/ui-round3-tool-approval-package-all.log`
- package 报告：`package/package-report.json`
- 新二进制：
  - `package/bin/coolzhu-web-console.exe`
  - SHA-256：`48B3084F3594C8F0C1D849AEC44B21270CA01A15C8A5A23B19A2D06C5DD405FF`
- package 自检：
  - `tmp/logs/package-selfcheck-last.json`
  - 结果：`overall=ok`，`ok=12`，`warn=0`，`error=0`

## 运行与 Computer Use 验证

package 版本已拉起：

- `coolzhu-web-console.exe`
- `coolzhu-tauri-shell.exe`
- Web health：HTTP 200
- 进程扫描：`tmp/logs/ui-round3-tool-approval-process-scan-after-runner.log`

使用 Computer Use 在 `COOLZHU AGENT 控制台` 中完成真实点击：

1. 点击“设置”进入设置窗口。
2. 确认中栏默认显示六行工具清单，不再常驻旧控制面板。
3. 点击“本地模型服务”的“管理”，对应模型详情展开。
4. 再次点击同一按钮，详情收起。
5. 点击“Semantic Dispatch Plan”的“计划配置”，仅语义派发详情展开。
6. 再次点击，详情收起。
7. 可访问性树确认 CLI、MCP 工具、Skill、compute-use 等条目和操作按钮均存在。

启动脚本的超时包装器因后台子进程继承句柄而记录 timeout，但实际进程、HTTP health 和 package 自检均成功；该现象不等同于应用启动失败。

## 结果

- 设置窗口工具与审批栏已对齐批准设计图的默认信息层级。
- 旧功能没有删除，只从首屏常驻改为按需管理。
- 当前 package 版保持运行，设置页停留在详情收起状态，便于人工确认。
