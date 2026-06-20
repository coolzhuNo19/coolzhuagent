# 桌宠、设置配置、会话协议与 Agent Reach 根治设计

日期：2026-06-18

## 1. 目标与范围

本轮拆成四个可独立验证的工作包：

1. 修复桌宠 `blink` 相对 `idle` 明显缩小的问题，禁止拉伸原图；必要时使用 Image Gen 参考原图重新生成。
2. 全面排查设置窗口所有控件，包括本地模型、工具详情和 TTS/STT；修复同类事件、请求、错误反馈和配置失效问题。
3. 采用方案 C 根治会话 API 协议：从 GUI 巨型文件抽离协议解析、能力路由、URL、鉴权和请求序列化。
4. 在独立 Python 3.11 环境中安装 Agent Reach 基础渠道并执行健康检查。

本轮不做与上述目标无关的全仓重构，不自动下载新本地大模型，不自动登录或导入 Twitter、小红书、Reddit 等账号 Cookie，也不把 Agent Reach 私自注册进现有 runtime。

## 2. 已确认根因

### 2.1 桌宠闭眼帧

运行时只播放 `blink-0..5`。这些帧的主体高度约 227px、脸高约 40px；idle 主体约 239px、脸高约 44px。活动 blink 因源资源和生成策略而小约 5%～9%。`blink-6/7` 不参与运行，只污染全八帧统计。

现有测试只验证 blink 内部稳定，没有验证 blink 与 idle 的跨状态视觉尺度。

### 2.2 设置窗口按钮

已确认本地模型切换 POST 缺少 `Content-Type: application/json`，Axum 在 handler 前返回 415；`requestJson` 又先解析纯文本为 JSON，按钮回调还使用空 `catch`，所以错误完全不可见。

同类缺陷可能存在于工具详情、TTS/STT 和其它设置控件，需要按统一矩阵全面排查。

### 2.3 会话协议

当前存在三类协议：

- OpenAI Chat Completions：OpenAI、xAI、智谱、百炼、百度、火山、DeepSeek、Custom。
- Anthropic Messages：ClawApi/Anthropic。
- 媒体直连：图片和视频生成。

分类本身合理，但协议职责散落在 Web Console 和 llm-adapter，存在重复 `/v1`、`Bearer EMPTY`、model_type 丢失、媒体直连、隐式 base_url 改协议等风险。

## 3. 方案选择

### 方案 A：最小热修

只修 blink 和缺失的请求头。改动小，但设置和协议债务继续存在。

### 方案 B：局部完整修复

修复高风险协议点，但继续保留 GUI 中的 URL 拼接和媒体请求。风险适中，结构问题未根治。

### 方案 C：定向架构根治（采用）

只围绕本轮问题抽离设置配置、本地服务控制和模型协议路由，统一 provider、capability、protocol、URL 和 auth schema。改动较大，必须按阶段备份、迁移和回滚。

## 4. 工作包 A：桌宠 blink 无拉伸修复

### 4.1 硬约束

- 禁止 CSS `scale`、单轴 resize、非等比拉伸或其它改变人物比例的补偿。
- 优先只使用帧选择、透明边距、画布定位、主体中心和脚底基线校正。
- 不把低分辨率小人物直接放大成正式资源。

### 4.2 Image Gen 兜底

若现有源帧无法通过无损裁切和定位达到 idle 尺度，则使用 Image Gen：

- idle 原图作为身份、服装、武器、像素风、颜色和比例参考。
- 画布固定 256×256。
- 人物可见包围盒、脸部尺寸和脚底基线与 idle 对齐。
- 仅改变眼睑状态和轻微呼吸动作。
- 发型、姿势、服装、剑、披风、光照和人物比例保持不变。
- 使用内置 Image Gen 生成纯色键背景候选，再本地去背并验证 alpha。
- 候选使用版本化文件名，不能直接覆盖正式资源。

### 4.3 最小 TDD

新增一个跨状态测试：

- blink 活动帧与 idle 主体高度中位数差异不超过 3%。
- 脸部高度中位数差异不超过 5%。
- blink 指标帧数等于主题实际 `frame_count=6`。

### 4.4 验收

运行真实桌宠，通过 computer-use 触发和观察 idle→blink，输出连续帧截图。人工确认无缩小、比例变化、跳动和裁切。

## 5. 工作包 B：设置窗口与配置闸口全面审计

### 5.1 控件矩阵

枚举设置窗口全部 `button`、`select`、`input`、`data-action` 和 `data-role`，形成：

`控件 → 前端 handler → HTTP 路由 → 配置字段/运行状态 → UI 成功/失败反馈`

重点覆盖：

- Gemma、UI-DETR/ShowUI 和全部关闭。
- 工具详情、Inspect、语义调度、权限、审计和状态灯按钮。
- TTS/STT 启动、停止、听写、朗读、声音选择和实时音频按钮。
- 会话、模型、视觉、workspace、Goal 和其它设置控件。

检查事件未绑定、Content-Type 缺失、空 catch、错误不可见、忙碌态不恢复、路由缺失、设置值未实际生效和固定延时误判完成。

### 5.2 前端统一行为

- JSON 设置请求统一通过一个 helper 自动设置 Content-Type。
- `requestJson` 支持 JSON 和纯文本错误，保留 HTTP 状态和安全正文摘要。
- 设置按钮必须有 pending、success、error 可见状态。
- 禁止空 `catch`。
- 异步服务使用有限轮询与超时，不用单次固定延时冒充完成。

### 5.3 配置与隐藏闸口

全仓检索：

- `std::env::var`
- `COOLZHU_*`、`CLAW_*`
- 全局 `OnceLock/Mutex` 功能开关
- 不受前端设置影响的 hidden gate

迁移原则：

- 端口、路径、模型名、启动器、启动参数、超时、轮询、provider endpoint、功能开关和权限策略统一进入 workspace 根 `coolzhu.toml` typed 配置。
- 前端写入与后端读取必须使用同一配置作用域。
- 删除或迁移会覆盖用户设置的环境变量和全局 gate。
- 不新增业务环境变量。
- OS/工具链变量、第三方认证协议强制变量、进程 one-shot 协议变量可例外，但必须在代码和 work-log 说明。
- 默认值由配置模块集中生成，不允许 GUI 与后端重复硬编码。

### 5.4 功能验收

- 必须启动真实前端，通过 computer-use 产生鼠标点击、选择和键盘输入。
- 同时核对前端反馈、`coolzhu.toml`、后端日志和服务状态。
- 直接 API、静态字符串扫描和纯函数测试只能作辅助。
- 每类设置控件覆盖一个基本成功场景和一个失败反馈场景，不做无收益的全排列测试。

## 6. 工作包 C：会话协议方案 C 根治

### 6.1 新架构

在 `llm-adapter` 内建立集中式协议路由层，Web Console 只提交会话配置和调用意图：

- `ProviderProtocol`
  - `OpenAiChatCompletions`
  - `AnthropicMessages`
  - `OpenAiImages`
  - `OpenAiVideos`
  - `Unsupported`
- `RequestCapability`
  - `Chat`
  - `VisionChat`
  - `ImageGeneration`
  - `VideoGeneration`
  - `Audio`
  - `Embedding`
- `ResolvedProviderRoute`
  - provider
  - protocol
  - capability
  - base URL
  - endpoint
  - auth policy
  - model
  - reasoning policy
- `EndpointResolver`
  - 接受 host、`host/v1` 和完整 endpoint。
  - 去除重复版本路径。
- `AuthPolicy`
  - Bearer
  - Anthropic key
  - OAuth
  - None
- OpenAI-compatible 和 Anthropic 使用各自 serializer/parser。
- image/video client 从 Web Console 迁入 llm-adapter。

### 6.2 配置结构

- provider 协议、能力、默认 endpoint、鉴权方式、模型能力和 reasoning 支持范围集中在 `coolzhu.toml` typed provider 配置。
- GUI 不再判断协议或拼接供应商 URL。
- 内置默认配置由配置模块集中生成，不允许多个模块重复维护 URL、模型名、端口或 gate。
- API Key 使用安全引用或现有凭据机制，不回传明文。

### 6.3 迁移阶段

1. 建立新协议类型和 endpoint/auth resolver，不切生产调用点。
2. 用最小协议测试复现重复 `/v1`、`Bearer EMPTY`、model_type 丢失等根因。
3. 文本 ProviderClient 切到新 resolver 和专用 serializer。
4. 图片/视频直连迁入 llm-adapter。
5. Web Console 切换到统一 capability dispatch。
6. audio/embedding 未实现专用 adapter 时返回明确 `unsupported capability`。
7. 删除旧 GUI URL 拼接、隐式 base_url 改协议和重复媒体请求代码。
8. 通过真实前端创建/修改会话并发送请求，验证协议选择。

### 6.4 兼容与测试

- 保留现有 SQLite/JSON 字段，新增字段可选并有默认推断。
- `PersistedSession::to_agent_session()` 保留显式 model_type。
- create/update 使用同一套 model_type 校验。
- Custom 空 Key 不发送 Authorization。
- OpenAI tool result 只发送标准字段。
- Anthropic 请求移除 OpenAI 专属字段，图片转换为 Anthropic source。
- audio/embedding 不得落入 Chat Completions。

最小 TDD 只覆盖共享协议边界：

- Anthropic `/v1/messages` 去重。
- OpenAI-compatible host/base/full endpoint。
- model_type 持久化往返。
- Custom 无 Key。
- Anthropic 请求结构。
- 标准 OpenAI tool result。
- 图片/视频 endpoint 去重。
- unsupported capability。

不为每个 provider 重复同一组用例。每种协议选择一个代表 provider，通过 computer-use 操作真实前端做功能验收。

## 7. 工作包 D：Agent Reach

- 使用 `C:\Users\zhupu\.agent-reach-venv` Python 3.11 独立环境。
- 安装官方 `agent-reach`。
- 运行 `agent-reach install --env=auto` 和 `agent-reach doctor`。
- 基础渠道：网页、YouTube、GitHub 公共信息、RSS、Exa、V2EX、B站基础。
- 需要 Cookie/登录的渠道只报告状态和后续命令。
- 若出现大文件或慢速下载，停止并提供下载 URL 与放置路径。
- 至少完成一个无需登录的公共渠道 smoke test。
- 日志写入 `tmp/logs/agent-reach-*.log`，不得记录 Cookie、token 或 API Key。

## 8. 备份、执行与日志

高风险修改前备份完整源码目录：

- `tmp/backups/20260618-pet-pre/`
- `tmp/backups/20260618-settings-config-pre/`
- `tmp/backups/20260618-session-protocol-c-pre/`

备份后生成文件清单和 SHA-256 摘要，写入 `tmp/logs/*backup*.log`。

其它规则：

- 临时脚本放 `tmp/`。
- 所有运行命令设置超时。
- 脚本输出重定向到 `tmp/logs/`。
- 失败先读取日志定位。
- 每个根因只写一个准确的基本红灯测试，不做组合爆炸。
- 用户可见功能必须通过 computer-use 驱动真实前端验收。
- 每个工作包依次执行最小定向测试、包级测试、构建和前端验收。
- 最终在 `docs/work-logs/` 写详细记录并回写需求状态。

## 9. 验收标准

- blink 与 idle 视觉尺寸一致且未拉伸；若使用 Image Gen，身份和造型保持一致。
- 设置窗口全部控件有完整链路矩阵；本地模型、工具详情和 TTS/STT 能通过真实前端操作生效。
- 用户设置不再被隐藏环境变量或全局 gate 覆盖。
- OpenAI-compatible、Anthropic 和媒体协议职责集中在 llm-adapter，GUI 不再直接拼供应商协议。
- Agent Reach 独立环境安装成功，doctor 可复核，至少一个公共渠道可用。

## 10. 回滚

- 桌宠：恢复 `tmp/backups/20260618-pet-pre/`。
- 设置配置：恢复 `tmp/backups/20260618-settings-config-pre/`。
- 会话协议：恢复 `tmp/backups/20260618-session-protocol-c-pre/`，或按 resolver、DTO、auth、adapter 阶段回滚。
- Agent Reach：删除独立虚拟环境和官方用户配置目录。

## 11. 仓库状态说明

当前工作目录不是 Git 仓库，无法执行设计规范中的 commit 步骤。变更通过备份、测试日志和 work-log 留痕。
