# 2026-05-05 工具卡片、插件/SKILL 与桌宠状态联动方案

## 范围

本方案只规划，不在本轮直接落地完整实现。范围包含：

- 工具卡片接入后端 API。
- 同步/吸收 `C:\Users\zhupu\Desktop\opencode\master-project` 中新增插件和 SKILL。
- 将内视觉截图识别转文字描述能力作为工具提供。
- 将内视觉 + computer-use 的目标识别点击能力作为工具提供。
- 桌宠 idle、thinking、sleeping、回复气泡等状态接入后端状态。

## 工具卡片技术路线

### 目标形态

工具卡片按类别显示：

| 类别 | 内容 |
| --- | --- |
| Core Tools | CLI、文件、会话、记忆、诊断 |
| Vision Tools | 截图、OCR/视觉描述、目标定位 |
| Computer Use | safe-click、closed-loop、浏览器/Windows 应用操作 |
| Plugins | 从 `.coolzhu/plugins` 和 opencode 可迁移插件导入 |
| Skills | 从 `.coolzhu/skills` 和 opencode 可迁移 SKILL 导入 |

每个工具/插件/SKILL 行提供：

- 名称。
- 类别。
- 状态：可用、缺依赖、禁用、危险需确认。
- `可用` 按钮：点击后展开可用动作、输入 schema、dry-run/execute 支持和风险说明。

### API 规划

| API | 用途 |
| --- | --- |
| `GET /api/tools/catalog` | 返回工具、插件、SKILL 分类目录 |
| `GET /api/tools/{tool_id}` | 返回单个工具详情、输入 schema、风险级别 |
| `POST /api/tools/dispatch` | 现有语义调度入口，后续接入 catalog |
| `POST /api/tools/{tool_id}/dry-run` | 执行安全预演 |
| `POST /api/tools/{tool_id}/execute` | 显式授权后执行真实动作 |

### 内视觉工具

| 工具 | 输入 | 输出 | 风险 |
| --- | --- | --- | --- |
| `vision.describe_screen` | 最新截图或即时截图 | 文字描述、主要 UI 区域、可点击目标摘要 | 需要本地 VLM/OCR，模型延迟和准确度不稳定 |
| `vision.find_target` | 截图 + 目标文字/语义 | 目标框、点位、置信度、来源截图 | 错点会影响后续点击，必须返回置信度 |
| `computer.safe_click_target` | 目标描述、execute、confirm_after | dry-run 计划或真实点击结果 | 真实点击必须显式授权，默认 dry-run |

## opencode 迁移评估

迁移步骤：

1. 扫描 `C:\Users\zhupu\Desktop\opencode\master-project` 的插件/SKILL 清单。
2. 与当前 `.coolzhu/plugins`、`.coolzhu/skills` 做名称、版本、入口、依赖对比。
3. 只迁移可独立运行且不依赖 opencode 私有路径的项目。
4. 迁移后写入工具 catalog，并在 diagnostics 中增加依赖检查。

风险：

- 插件可能携带不同配置目录假设。
- SKILL 文档可能引用 opencode 专属命令或路径。
- 工具执行可能涉及文件/网络/桌面输入，需要统一权限。

## 桌宠状态联动技术路线

### 状态模型

| 状态 | 触发 |
| --- | --- |
| `idle` | 无任务、控制台隐藏/待命 |
| `thinking` | 发送消息后，SSE 未完成前 |
| `success` | 回复完成、工具执行成功 |
| `warning` | 模型错误、工具 dry-run 风险、截图失败 |
| `sleeping` | 长时间无交互或用户手动休眠 |

### 气泡内容

气泡只显示短文本：

- 最近一条 assistant 回复摘要。
- 工具执行状态。
- 视觉识别结果摘要。
- 错误提示。

### API/事件规划

| 方向 | 方案 |
| --- | --- |
| Web 后端到桌宠 | `POST /api/pet/status` 写入状态，并通过 Tauri command/event 推送 |
| Web 前端到后端 | 聊天发送、完成、错误时调用状态 API |
| Tauri shell | 订阅 `pet-status`，更新动画和气泡 |
| 持久化 | 只保留最近状态，不写入长期会话 |

## 验收标准

| 项 | 标准 |
| --- | --- |
| 工具卡片 | 能按类别显示工具、插件、SKILL，点击可用按钮能展开详情 |
| 视觉描述工具 | 能把最新截图转换为文字描述，并返回来源截图 |
| 目标点击工具 | 默认 dry-run，execute=true 时才执行真实点击 |
| 桌宠状态 | 聊天发送进入 thinking，回复完成进入 success，空闲回 idle |
| 桌宠气泡 | 能显示最近回复摘要或工具状态，内容不遮挡桌宠主体 |

## 关键风险

| 风险 | 处理 |
| --- | --- |
| 真实点击误操作 | 所有真实输入默认关闭，execute 必须显式传入 |
| 视觉识别不稳定 | 返回置信度、目标框、截图证据，低置信度不执行 |
| 桌宠气泡遮挡/抢焦点 | 保持 Tauri pet window no-activate，不抢焦点 |
| 插件来源不一致 | opencode 插件/SKILL 先做清单和依赖扫描，再迁移 |

## 2026-05-05 第一阶段落地记录

已完成低风险 catalog 阶段：

- Web 后端新增 `GET /api/tools/catalog` 和 `GET /api/tools/{tool_id}`。
- catalog 按 `Core Tools`、`Vision Tools`、`Computer Use`、`Plugins`、`Skills` 分类返回。
- Core Tools 复用 `coolzhu-tool-registry` 的 `mvp_tool_specs()` 与权限信息。
- Vision/Computer Use 先映射当前已有 Web API 与规划工具，不从工具卡片触发真实执行。
- Plugins 扫描当前 `C:\Users\zhupu\Desktop\codex\.coolzhu\plugins` 与 `C:\Users\zhupu\Desktop\opencode\master-project\.coolzhu\plugins`，opencode 项标记为 `candidate`。
- Skills 扫描当前 `.coolzhu/skills` 与 opencode `.coolzhu/skills`，只读展示 frontmatter 名称和描述。
- 前端工具卡片新增分类列表、可用按钮、schema/风险/来源/迁移说明展开区。
- `dry-run` 与 `execute` 按钮在前端保留但禁用，后续统一接入权限闸门。

验证：

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo check -p coolzhu-web-console
```

下一阶段：

- 将 `POST /api/tools/{tool_id}/dry-run` 接入只读和安全预演工具。
- 将插件候选迁移验证写入 diagnostics，特别是 `coolzhu-session-manager` 的清理工具。
- 将 LLM tool calling 的 schema 选择接入 catalog，替换当前关键词式 dispatch。

## 2026-05-05 第二阶段落地记录

已完成安全 dry-run 接入：

- Web 后端新增 `POST /api/tools/{tool_id}/dry-run`。
- 工具卡片的 `dry-run` 按钮只对安全子集开放，`execute` 继续禁用。
- 当前开放 dry-run 的工具：
  - `vision.capture_desktop`
  - `vision.describe_screen`
  - `computer.closed_loop`
  - `computer.profile`
  - `tools.semantic_dispatch`
  - `core.read_file`
  - `core.glob_search`
  - `core.grep_search`
  - `core.ToolSearch`
  - `core.Sleep`
- `vision.describe_screen` 当前只返回截图元数据、尺寸和预览地址，尚未宣称完成 OCR/VLM 文字描述。
- `tools.semantic_dispatch` 复用原 `/api/tools/dispatch` 语义路由，强制 `execute=false`。
- `computer.closed_loop` 和 `computer.profile` 复用已有 computer-use 后端流程，默认只做截图、坐标规划、ROI 和前后截图确认。
- Core read-only 工具使用默认安全输入，避免从 UI 触发写入、shell、agent 或插件脚本。
- 插件/SKILL 和 opencode candidate 仍只读展示，不执行生命周期、hook、脚本或命令。

验证：

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo check -p coolzhu-web-console
cargo test -p coolzhu-web-console
```

下一阶段：

- 将 `/api/tools/dispatch` 从关键词路由升级为 catalog schema 选择。
- 为 dry-run/execute 增加统一审计记录和显式授权结构。
- 接入本地 VLM/OCR，让 `vision.describe_screen` 返回文字、区域、可点击目标摘要。
- 逐项迁移 opencode 插件/SKILL；优先评估 `coolzhu-session-manager.status_tmp`，清理类工具必须保持 dry-run 默认。
