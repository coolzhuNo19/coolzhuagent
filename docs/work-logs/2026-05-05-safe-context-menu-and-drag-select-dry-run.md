# Safe Context Menu / Drag Select Dry-Run 落地记录

日期：2026-05-05  
范围：`modules/gui-web/packages/web-console`、`modules/gui-web/packages/web-console/src/app.js`

## 已完成

1. 新增并接入两个 Computer Use 靶场 API：
   - `POST /api/computer-use/safe-context-menu`
   - `POST /api/computer-use/safe-drag-select`

2. 工具卡片 catalog 新增两个高风险、默认 dry-run 工具：
   - `computer.safe_context_menu`
   - `computer.safe_drag_select`

3. `safe-context-menu` 靶场收紧命中条件：
   - 随机窗口内打开 WinForms `ContextMenuStrip`。
   - 只有点击目标菜单项 `ACTION {target_number}` 才写入 `hit` marker。
   - 点击非目标菜单项写入 `miss:*`，不再把任意菜单点击当作命中。
   - action plan 返回右键触发点、目标菜单项点和失败后的 `Esc` 恢复建议。

4. `safe-drag-select` 靶场收紧命中条件：
   - 靶场显示带编号的金色目标区域。
   - 鼠标左键按下后必须产生有效拖动距离，释放时才写入 `hit` marker。
   - 单纯 `MouseDown` 不再算命中。
   - dry-run 返回目标区域、起止点和 17 点拖拽路径。

5. 前端工具卡片补齐默认 dry-run 输入和摘要：
   - `computer.safe_context_menu` 默认 `{ execute:false, layout:"random" }`。
   - `computer.safe_drag_select` 默认 `{ execute:false, layout:"random" }`。
   - 摘要显示目标编号、菜单项坐标、拖拽起止点和路径点数。

## 验证结果

| 检查项 | 结果 |
| --- | --- |
| `node --check modules\gui-web\packages\web-console\src\app.js` | 通过 |
| `cargo check -p coolzhu-web-console` | 通过 |
| `cargo test -p coolzhu-web-console` | 84 passed |
| `cargo test -p coolzhu-computer-use-core` | 7 passed |
| `cargo test -p coolzhu-vision-service` | 13 passed |
| `cargo build -p coolzhu-web-console` | 通过 |
| Web 服务 | 已重启到 `http://127.0.0.1:8765/` |

## HTTP Dry-Run Smoke

| 接口 | 结果 |
| --- | --- |
| `GET /api/tools/catalog` | 5 类、77 项；两个新工具均 `dryRun=true`、`execute=false` |
| `POST /api/tools/computer.safe_context_menu/dry-run` | `status=context-menu-dry-run`，`executed=false`，返回 `ACTION 321` 目标菜单项坐标 |
| `POST /api/tools/computer.safe_drag_select/dry-run` | `status=drag-select-dry-run`，`executed=false`，返回目标区域、起止点和 17 点路径 |

## 风险与后续

1. 真实鼠标执行仍保持显式门禁；工具卡片 `execute` 继续禁用。
2. 当前完成的是靶场和 dry-run 计划验证，尚未接入主动本地 VLM/OCR grounding。
3. 右键菜单和拖拽真实执行下一步需要人工显式触发验证，并记录 before/target/after 截图证据。
4. LLM tool calling 下一阶段只能接入 dry-run action plan，不能让模型直接触发真实输入。
