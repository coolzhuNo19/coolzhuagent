# 会话头像、本地模型路径与 Goal 执行技能设计

## 目标

1. 清除聊天室消息中遗留的 Mario 头像回退，统一使用武侠桌宠视觉。
2. 把本地文本模型文件路径纳入 `coolzhu.toml`，允许用户从设置窗口输入或通过 Windows 文件选择器选择 `.gguf` 文件。
3. 本地模型对用户可见的会话名、思考卡片、回复卡片和状态信息只显示 `coolzhu-model`，底层模型文件名仅用于内部请求与日志定位。
4. 把 GLM5.2 执行长时 Goal 时暴露的问题拆成三个独立 Skill，并让 Goal 阶段提示实际加载 Skill 正文。

## 根因

- 消息更新路径会把 `mario` 转成武侠头像，但消息首次创建路径直接使用 `iconUrl(icon)`；普通用户消息的 `iconForMessage()` 仍返回 `mario`，因此历史引用消息首次渲染时继续出现 Mario。
- `start_local_gemma()` 在 Rust 中直接拼接用户目录和固定 GGUF 文件名，前端没有对应配置入口。
- 本地模型品牌化只覆盖部分会话显示名和系统提示；推理消息作者仍使用 `agent.name`，服务状态与启动结果仍出现 `Gemma`。
- Goal 的 `skills_required` 目前只进入提示中的名称列表；工具目录只读扫描 `SKILL.md`，没有把技能正文装配进 Goal 阶段提示。

## 方案

### 头像

- `defaultIconUrlForMessage()` 继续作为消息图标唯一回退入口。
- 消息首次创建和增量更新都调用该入口，禁止直接使用 `iconUrl("mario")`。
- `iconForMessage()` 的普通用户消息语义图标改为 `robot-message`，最终仍由统一入口映射为武侠头像。

### 本地模型配置

- 在 `[model]` 增加：
  - `local_chat_model_path`
  - `local_chat_mmproj_path`（可选，仅保留已有多模态投影能力）
- `/api/local-models/status` 返回当前模型路径及文件存在状态。
- 新增：
  - `POST /api/local-models/model-path`：校验并持久化用户输入的 `.gguf` 文件。
  - `POST /api/local-models/pick-model-file`：在 Windows 上打开原生 `OpenFileDialog`，选择后复用同一校验和持久化逻辑。
- 启动本地模型只读取 typed config，不读取新增环境变量，不在业务代码中拼接模型路径。
- 路径修改时若本地文本模型正在运行，先提示用户关闭后重新启动，不静默切换正在使用的模型文件。

### 品牌名

- 增加单一的用户可见作者名函数：
  - 本地端点回复：`coolzhu-model`
  - 本地端点推理：`coolzhu-model 推理`
  - 远端模型保持现有名称。
- 本地服务状态、切换反馈和错误信息使用“本地文本推理”或 `coolzhu-model`，不显示 `Gemma` 和底层 GGUF 文件名。
- API 请求仍使用会话内部配置的真实模型标识，不改 Provider 协议。

### Goal Skill

在仓库 `skills/` 中创建并跟踪：

- `coolzhu-goal-session-chain`
- `coolzhu-goal-model-reasoning`
- `coolzhu-goal-tool-execution`

Goal 每个阶段自动加载这三个基础 Skill；阶段显式声明的 `skills_required` 继续追加加载。加载规则：

1. 只读取已配置 Skill 根目录中的 `SKILL.md`。
2. 单个 Skill 正文设置长度上限，防止无限扩张系统提示。
3. 未找到 Skill 时在提示中明确标记，不阻断 Goal。
4. Skill 内容作为执行约束进入阶段 prompt，而不是只展示名称。

## 风险与回滚

- 配置、进程启动和 Goal prompt 属高风险修改，修改前备份完整 `packages/web-console` 目录并生成 SHA-256 清单。
- 不修改已有会话数据库结构；新增 TOML 字段由 serde 默认值兼容旧配置。
- 回滚时恢复备份目录、恢复原 `coolzhu.toml`，再重新执行 `package all`。

## 验证

- TDD 契约覆盖：
  - 首次消息渲染不再直接使用 Mario 图标。
  - 本地模型路径校验、持久化和启动参数读取配置。
  - 本地回复与推理作者名均品牌化。
  - Goal prompt 包含三个基础 Skill 的正文。
- 执行 `cargo fmt/check/test`、`package all`，输出写入 `tmp/logs/`。
- HTTP 验证状态接口、路径保存接口和 Skill catalog。
- 前端视觉与原生文件选择交互由用户人工确认。
