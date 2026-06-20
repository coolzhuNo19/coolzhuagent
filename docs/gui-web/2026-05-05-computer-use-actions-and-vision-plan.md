# Computer Use 鼠标动作与内视觉区域框选补齐方案

更新日期：2026-05-05  
范围：`modules/computer-use`、`modules/vision`、`modules/gui-web/packages/web-console`

## 1. 审视结论

当前 `computer-use` 已具备左键点击、右键点击、双击、左右键组合、文本输入、滚轮、相对移动和输入后端预检能力。`MouseActionKind::Drag` 已在枚举中预留，但 Web 执行层会直接返回“拖拽动作尚未开放真实执行”，底层 `input.rs` 也还没有左键按下、移动轨迹、左键抬起的拖拽原语。

当前 `vision` 已具备 ShowUI 风格单点 grounding：`build_showui_grounding_request`、`parse_relative_point`、`relative_point_to_pixel`。它只能稳定表达 `[x, y]`，还不能表达目标区域、矩形框、置信度和多候选结果，因此无法支撑“视觉识别区域框选”和“右键菜单项选择”的严格验收。

Web 后端已经接入工具目录和安全 dry-run：

| 能力 | 当前状态 | 主要入口 |
| --- | --- | --- |
| 工具目录 | 已接入 | `GET /api/tools/catalog` |
| 工具详情 | 已接入 | `GET /api/tools/{tool_id}` |
| 安全预演 | 已接入 | `POST /api/tools/{tool_id}/dry-run` |
| 语义工具路由 | 基础关键词路由 | `POST /api/tools/dispatch` |
| closed-loop | dry-run 和显式 execute 参数已有 | `POST /api/computer-use/closed-loop` |
| safe-click | 随机数字靶场已有，视觉 grounding 可选 | `POST /api/computer-use/safe-click-test` |

主要缺口：

1. `use_visual_grounding=true` 时，目前视觉失败会回退几何点位，不满足“必须由视觉识别确认点击位置”的强验收。
2. 缺少拖拽输入原语与轨迹规划，无法做左键拖拽、区域框选、窗口内选择。
3. 缺少右键菜单组合动作：右键打开菜单、识别菜单项、点击菜单项、失败后按 `Esc` 恢复。
4. 缺少视觉区域协议：bbox、center、confidence、source_capture、raw_response、candidate list。
5. 工具目录中 `vision.find_target` 仍为规划项，computer-use 工具还未细分到 left/right/context-menu/drag-select。

## 2. 技术路线

### 2.1 输入原语层

在 `computer-use::input` 增加低层能力：

| 原语 | 行为 | SendInput 路线 | Interception 路线 |
| --- | --- | --- | --- |
| `mouse_button_down` | 指定坐标按下左/右键 | `SetCursorPos` 后 `SendInput down` | `interception_send` down state |
| `mouse_button_up` | 指定坐标释放左/右键 | `SetCursorPos` 后 `SendInput up` | `interception_send` up state |
| `drag_point` | 从 start 到 end 按轨迹拖拽 | 左键 down，插值移动，左键 up | down，分段 relative move，up |
| `move_mouse_absolute` | 绝对移动到屏幕点 | `SetCursorPos` | Interception 可先用 SetCursorPos，后续补绝对坐标 |
| `escape_context_menu` | 恢复右键菜单 | `VK_ESCAPE` | 键盘 stroke `Esc` |

保守选择：优先用 SendInput 实现全部路径，Interception 保持兼容但不作为首要验收依赖。原因是 SendInput 对普通 Windows 应用和浏览器覆盖更快，Interception 适合后续高权限或游戏/全屏场景，但部署成本高。

### 2.2 动作计划层

新增结构化 action plan，先在 Web 后端内部使用，后续下沉到 `computer-use` crate：

```json
{
  "action": "drag_select",
  "target": "screen region containing the search result title",
  "execute": false,
  "requires_visual_grounding": true,
  "start": { "x": 420, "y": 310 },
  "end": { "x": 860, "y": 540 },
  "roi": { "left": 400, "top": 300, "width": 480, "height": 260 },
  "evidence": {
    "capture_path": "...",
    "vision_source": "local-openai-compatible",
    "raw_response": "..."
  }
}
```

动作类型建议：

| action | 用途 | execute 默认 |
| --- | --- | --- |
| `left_click` | 点按钮、桌面图标、浏览器元素 | false |
| `right_click` | 打开上下文菜单 | false |
| `context_menu_select` | 右键后选择菜单项 | false |
| `drag_select` | 左键拖拽框选区域 | false |
| `visual_action` | 自然语言目标转视觉点位再规划动作 | false |

### 2.3 视觉区域协议

扩展 `vision` 的解析能力，保留单点兼容，同时新增 JSON/bbox：

```json
{
  "point": [0.52, 0.34],
  "bbox": [0.42, 0.28, 0.68, 0.46],
  "confidence": 0.82,
  "label": "CONFIRM 583",
  "reason": "gold button with matching number"
}
```

解析规则：

1. 支持旧格式 `[x, y]`，用于现有 ShowUI 单点模型。
2. 支持 `{"point":[x,y]}`，用于点击中心点。
3. 支持 `{"bbox":[x1,y1,x2,y2]}`，用于区域框选和菜单项定位。
4. 所有坐标先按 `[0,1]` 相对坐标校验，再映射为原始截图像素。
5. `confidence` 低于阈值时只能 dry-run，不能真实 execute。

### 2.4 Web API 与工具目录

建议先新增 dry-run API，再开放 execute：

| API | 作用 | 安全策略 |
| --- | --- | --- |
| `POST /api/vision/find-target` | 根据截图和目标描述返回点/框/置信度 | 只读 |
| `POST /api/computer-use/action-plan` | 生成左键、右键、菜单、拖拽计划 | 只读 |
| `POST /api/computer-use/execute-action` | 执行动作计划 | 初期禁用，后续显式授权 |
| `POST /api/tools/dispatch` | 语义路由到 vision/computer-use | 默认 dry-run |

工具目录增加或细分：

| tool_id | 分类 | 第一阶段能力 |
| --- | --- | --- |
| `vision.find_target` | Vision Tools | 返回 point/bbox/confidence，dry-run |
| `vision.find_region` | Vision Tools | 返回 bbox 和区域截图元数据，dry-run |
| `computer.left_click` | Computer Use | 生成点击计划，execute 禁用 |
| `computer.right_click` | Computer Use | 生成右键计划，execute 禁用 |
| `computer.context_menu_select` | Computer Use | 右键菜单选择计划，execute 禁用 |
| `computer.drag_select` | Computer Use | 生成拖拽轨迹和 ROI，execute 禁用 |
| `computer.visual_action` | Computer Use | 目标描述 -> 视觉定位 -> 动作计划，execute 禁用 |

## 3. 测试方案

### 3.1 单元测试

| 模块 | 测试点 |
| --- | --- |
| `computer-use` | 拖拽轨迹插值、起止点越界裁剪、按钮 down/up 顺序、空轨迹拒绝 |
| `vision` | `[x,y]` 解析、JSON point 解析、bbox 解析、confidence 阈值、越界坐标拒绝 |
| `gui-web` | 工具 catalog 暴露新增工具、dry-run 不执行真实输入、dispatch 语义映射正确 |

### 3.2 API dry-run 测试

1. `POST /api/tools/computer.left_click/dry-run` 返回 action plan，`executed=false`。
2. `POST /api/tools/computer.right_click/dry-run` 返回右键点位和恢复建议，`executed=false`。
3. `POST /api/tools/computer.drag_select/dry-run` 返回 start/end/path/roi，`executed=false`。
4. `POST /api/tools/vision.find_region/dry-run` 返回 bbox 结构或明确的模型未配置错误。
5. `POST /api/tools/dispatch` 对“右键点击当前图标并选择属性”“框选页面中搜索结果区域”等意图能路由到正确工具。

### 3.3 人工真实输入测试

真实输入必须由用户明确触发，且每次记录 before/target/after 截图和 action plan。

| 场景 | 验收 |
| --- | --- |
| 随机数字 safe-click | `use_visual_grounding=true` 时，视觉失败必须失败，不允许几何回退；命中 marker 才算通过 |
| 浏览器左键 | 随机目标按钮/链接可由视觉定位并点击，after 截图显示变化 |
| 浏览器右键菜单 | 页面元素右键后能识别菜单区域，失败可 `Esc` 恢复 |
| Windows 应用左键 | 记事本/文件选择框可点击指定 UI 元素 |
| Windows 应用右键菜单 | 文本区右键打开菜单，识别并点击指定菜单项，失败恢复 |
| 左键拖拽区域框选 | 浏览器页面或记事本文本区域能拖拽选择，起止点来自视觉 bbox |

### 3.4 靶场扩展

现有 safe-click 靶场继续保留，并扩展两个独立靶场：

1. `safe-context-menu`：WinForms 窗口生成随机目标项，如 `ACTION 472`。测试流程为右键打开自定义 context menu，视觉识别目标项并点击，marker 记录命中。
2. `safe-drag-select`：WinForms 窗口生成随机矩形目标区域和编号。测试流程为视觉识别 bbox，拖拽框选目标区域，marker 验证拖拽起止点覆盖区域。

## 4. 风险与抉择

| 风险 | 影响 | 方案 |
| --- | --- | --- |
| 视觉误识别后真实点击 | 高 | execute 前要求 confidence、bbox、截图证据、显式授权；强视觉模式不允许几何回退 |
| DPI/缩放导致坐标偏移 | 高 | 截图与输入进程均设置 DPI aware，使用原始截图尺寸映射 |
| 多显示器覆盖不足 | 中 | 当前先主屏验收，多屏作为后续需求 |
| 右键菜单残留 | 中 | context menu 测试加入 `Esc` 清理和 after 截图 |
| Interception 部署成本 | 中 | 第一阶段以 SendInput 验收，Interception 做增强路径 |
| LLM 过早触发执行 | 高 | LLM tool calling 初期只能生成 dry-run action plan，execute 工具不暴露给模型 |

## 5. 分阶段落地

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| A | 本文档和需求管理更新 | 已完成方案记录 |
| B | 补 `computer-use` 拖拽/down/up/恢复原语和 CLI dry-run/真实命令 | `cargo test -p coolzhu-computer-use-core` |
| C | 补 `vision` point/bbox/confidence 解析 | `cargo test -p coolzhu-vision-service` |
| D | Web 新增 action-plan、find-target/find-region dry-run API 和工具目录 | `cargo test -p coolzhu-web-console` |
| E | 扩展 safe-click、context-menu、drag-select 靶场 | 人工真实输入验收 |
| F | 接入 LLM tooling calling | 模型只触发 dry-run 工具，execute 保持人类授权 |

## 6. LLM Tool Calling 前置门槛

进入 LLM tool calling 前必须满足：

1. `vision.find_target` 和 `vision.find_region` 能稳定返回结构化证据。
2. `computer.left_click/right_click/context_menu_select/drag_select` 都可 dry-run 生成 action plan。
3. 强视觉 safe-click 至少完成 3 次随机数字命中，且无几何回退。
4. 右键菜单靶场和拖拽框选靶场至少各完成 1 次真实验收。
5. `/api/tools/dispatch` 对自然语言意图只返回候选工具和 dry-run 计划，不直接真实执行。
## 7. 2026-05-05 落地补充

已完成 `safe-context-menu` 和 `safe-drag-select` 的 dry-run 靶场落地：

1. `POST /api/computer-use/safe-context-menu`：返回右键触发点、目标菜单项点、目标 `ACTION {target_number}` 和恢复步骤；真实执行路径中只有目标菜单项写入 `hit`，非目标项写入 `miss:*`。
2. `POST /api/computer-use/safe-drag-select`：返回目标区域、起止点和 17 点拖拽路径；真实执行路径中必须完成有效拖动并释放才写入 `hit`。
3. 工具 catalog 新增 `computer.safe_context_menu`、`computer.safe_drag_select`，两个工具均 `dryRun=true`、`execute=false`。
4. 前端工具卡片已补默认 dry-run 输入和摘要展示。

下一阶段仍需保持顺序：

1. 人工显式授权后验证真实右键菜单选择和真实拖拽框选。
2. 接入主动本地 VLM/OCR grounding，使菜单项点和拖拽 bbox 来自视觉识别，而不是 dry-run 几何计划。
3. LLM tool calling 只接 dry-run action plan；真实 execute 不暴露给模型。
