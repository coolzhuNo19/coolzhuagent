# Computer Use 动作原语与内视觉 dry-run 落地记录

日期：2026-05-05  
范围：`modules/computer-use`、`modules/vision`、`modules/gui-web/packages/web-console`

## 已完成

1. `computer-use` 补齐鼠标动作原语：
   - `move_mouse_absolute`
   - `mouse_button_down_point`
   - `mouse_button_up_point`
   - `drag_path`
   - `drag_point`
   - `press_escape`
   - `MouseButton`、`MousePoint`

2. `vision` 补齐 grounding 解析协议：
   - 兼容旧格式 `[x, y]`
   - 支持 JSON `point`
   - 支持 JSON `bbox`
   - 支持 `confidence`、`score`、`label`
   - 坐标越界或无效 bbox 会拒绝，不再误回落为旧格式点位

3. Web 后端补齐 dry-run 工具：
   - `vision.find_target`
   - `vision.find_region`
   - `computer.left_click`
   - `computer.right_click`
   - `computer.context_menu_select`
   - `computer.drag_select`
   - `computer.visual_action`

4. Web 后端新增 API：
   - `POST /api/vision/find-target`
   - `POST /api/computer-use/action-plan`

5. 安全策略更新：
   - action-plan 阶段拒绝 `execute=true`
   - 工具卡片新增动作工具只开放 dry-run，execute 按钮仍禁用
   - `safe-click` 强视觉模式下 grounding 失败时拒绝几何回退点击

## HTTP Smoke

已重建并启动 `coolzhu-web-console.exe`，服务地址：

`http://127.0.0.1:8765/`

验证结果：

| 检查 | 结果 |
| --- | --- |
| catalog summary | 5 类，75 项 |
| 新增工具 | `computer.context_menu_select`、`computer.drag_select`、`computer.left_click`、`computer.right_click`、`computer.visual_action`、`vision.find_region`、`vision.find_target` |
| `computer.drag_select` dry-run | `executed=false`，返回 17 个轨迹点 |
| `vision.find_region` dry-run | `grounding-parsed`，可解析 point 和 bbox |
| `POST /api/computer-use/action-plan` with `execute=true` | HTTP 400，按预期拒绝 |

## 验证命令

```powershell
node --check modules\gui-web\packages\web-console\src\app.js
cargo test -p coolzhu-computer-use-core
cargo test -p coolzhu-vision-service
cargo test -p coolzhu-web-console
cargo check -p coolzhu-web-console
cargo build -p coolzhu-web-console
```

通过结果：

| 包 | 结果 |
| --- | --- |
| `coolzhu-computer-use-core` | 7 passed |
| `coolzhu-vision-service` | 13 passed |
| `coolzhu-web-console` | 82 passed |
| `app.js` | syntax ok |

## 未完成与下一步

1. `safe-context-menu` 靶场尚未实现，需要验证右键菜单项识别、点击和 `Esc` 恢复。
2. `safe-drag-select` 靶场尚未实现，需要验证 bbox 到拖拽起止点的真实框选。
3. `vision.find-target` 当前支持 `raw_response` 解析和截图证据，尚未主动调用本地 VLM 生成真实 grounding。
4. LLM tool calling 暂不推进真实执行；下一阶段只能接 dry-run action plan。
