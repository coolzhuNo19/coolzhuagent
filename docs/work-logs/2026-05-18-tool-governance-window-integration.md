# 2026-05-18 工具治理前端 MVP 接入日志

## 背景

用户要求在后端功能完成后持续推进前端接入，并优先把记忆管理、工具治理、Goal 相关能力接入新 D2 多窗口布局。记忆窗口与任务授权窗口已完成真实 API 接入，本轮推进 `REQ-WEB-WIN-002` 设置窗口内的工具治理区，并启动 `REQ-TOOL-012` 场景目录与适配矩阵。

## 修改内容

1. 设置窗口工具区新增 `Semantic dispatch dry-run` 面板：
   - 输入框 `data-role="tool-dispatch-intent"`。
   - 按钮 `data-action="tool-dispatch-run"`。
   - 输出区 `data-role="tool-dispatch-output"`。
   - 前端调用 `POST /api/tools/dispatch`，固定 `execute=false`、`confirm_after=true`、`use_latest_capture=true`，只生成 dry-run plan，不触发真实键鼠输入。

2. 工具目录 `Inspect` 行为从本地 catalog 展开升级为详情 API：
   - 新增 `loadToolDetail()`。
   - 调用 `GET /api/tools/{tool_id}`。
   - 增加 `toolDetailCache`，避免重复请求。
   - 详情区显示 `Detail loaded from /api/tools/{tool_id}`，便于验证已走后端详情接口。

3. 新增工具治理场景矩阵：
   - `Workspace read`：read_file / glob_search / grep_search，ReadOnly，审计行 + 输出预览验证。
   - `Semantic routing`：tools.semantic_dispatch 或 `/api/tools/dispatch`，dry-run only，验证 dispatch_plan 且不执行真实输入。
   - `Grounded UI action`：vision.find_target / computer.visual_action / computer.closed_loop，Timed input grant，验证 locate evidence + confirmation。
   - `Protected writes`：runtime-execute + approval SSE，WorkspaceWrite / Protected，验证 pending approval + audit trail。

4. 样式补充：
   - `.tool-governance-grid`
   - `.tool-dispatch-card`
   - `.tool-scenario-matrix`
   - `.tool-scenario-row`
   - `.tool-detail-api-trace`

5. TDD / 静态契约：
   - 新增 `web_frontend_settings_window_connects_tool_governance_api`，锁定工具治理面板 DOM、`/api/tools/dispatch`、`/api/tools/{tool_id}`、`loadToolDetail()`、`runToolSemanticDispatch()`、`renderToolScenarioMatrix()` 和 CSS 类。

## 验证

执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-office-scene-validation.ps1
```

结果：

- `office-scene-cargo-fmt ok`
- `office-scene-node-check ok`
- `office-scene-d2-contract ok`
- `office-scene-web-console-tests ok`
- `office-scene-cargo-build ok`
- `office scene validation completed`

执行截图 / DOM 验证：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-tool-governance-capture.ps1
```

结果：

- 截图：`tmp/web-ui-tool-governance-1920x1080.png`
- `active=settings`
- `catalogItems=24`
- `scenarioRows=4`
- `dispatchHasPlan=true`
- `detailLoadedViaApi=true`
- dispatch 输出命中 `computer.hotkey`，`execute_allowed=false`

## 需求状态

- `REQ-WEB-WIN-002`：保持 `测试中`，备注新增工具区详情 API、dispatch dry-run 和场景矩阵。
- `REQ-TOOL-012`：从 `待开发` 推进到 `开发中`。当前完成前端 MVP，后续仍需补常用外部工具、Goal skill registry 绑定和人工交互验收。

## 备份

- 修改前备份：`tmp/backups/web-tool-governance-20260518-090301-pre`
- 修改后备份：`tmp/backups/web-tool-governance-20260519-000052-post`
