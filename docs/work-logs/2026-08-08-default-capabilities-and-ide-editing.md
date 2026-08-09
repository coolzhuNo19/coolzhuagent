# 2026-08-08 默认能力与 IDE 编辑闭环

## `coolzhu.toml` 布尔项清单

以下是 `WorkspaceConfig` 可落盘配置树内的全部布尔项。原则是“能力默认可用，授权仍需显式授予”：能力开关、无副作用辅助能力和安全护栏默认开启；完全访问、危险授权、资源高风险并发与进程联动保持保守默认。`Option<String>` 凭据继续为 `None`，安装包不包含 API Key、会话或私人路径。

| 配置项 | 首次安装默认 | 分类 | 说明 |
|---|---:|---|---|
| `session.context.cleanup_goal_scratch_on_compact` | `true` | 生命周期能力 | compact 后清理临时目标上下文 |
| `computer_use.enabled` | `true` | 能力开关 | 只声明能力；真实动作仍经过权限/审批 |
| `computer_use.desktop.enabled` | `true` | 能力开关 | 桌面适配器可用 |
| `computer_use.desktop.require_window_identity` | `true` | 安全护栏 | 限定目标窗口身份 |
| `computer_use.desktop.block_webview2_surface_conflict` | `true` | 安全护栏 | 避免 WebView2 表面冲突 |
| `computer_use.browser.enabled` | `true` | 能力开关 | 浏览器适配器可用 |
| `computer_use.browser.allow_drag` | `true` | 能力开关 | 支持拖拽动作；不等同授权 |
| `computer_use.browser.allow_key_combinations` | `true` | 能力开关 | 支持组合键；不等同授权 |
| `computer_use.browser.allow_multiple_tabs` | `true` | 能力开关 | 支持多标签 |
| `audio.realtime.auto_send_transcript` | `true` | 会话能力 | 仅在用户启动实时会话后生效 |
| `audio.realtime.auto_tts_reply` | `true` | 会话能力 | 仅在用户启动实时会话后生效 |
| `audio.realtime.barge_in.enabled` | `true` | 会话能力 | 支持打断 |
| `audio.realtime.barge_in.browser_echo_cancellation` | `true` | 音频护栏 | 浏览器回声消除 |
| `audio.realtime.barge_in.noise_suppression` | `true` | 音频护栏 | 降噪 |
| `audio.realtime.barge_in.auto_gain_control` | `true` | 音频护栏 | 自动增益 |
| `vision.router.cross_verify` | `true` | 能力开关 | 默认交叉验证；缺后端时明确降级 |
| `vision.router.detection.enabled` | `true` | 能力开关 | 检测后端可用 |
| `vision.router.resource_switch.allow_concurrent` | `false` | 资源危险项 | 默认单模型，避免显存耗尽，不属于授权后的功能缺失 |
| `vision.router.uia.enabled` | `true` | 能力开关 | UIA 路由可用 |
| `vision.router.local_vlm.enabled` | `true` | 能力开关 | 本地 VLM 路由可用 |
| `vision.router.remote_vlm.enabled` | `true` | 能力开关/凭据依赖 | 默认启用；未配置 provider/Key 时显示未配置 |
| `model.enable_real_llm` | `true` | 能力开关/凭据依赖 | 默认启用；未配置 Key 显示“未配置（能力已启用）” |
| `model.enable_llm_tools` | `true` | 能力开关 | 工具可见；执行仍经过权限闸门 |
| `model.enable_semantic_memory` | `true` | 能力开关/端点依赖 | 缺 embedder 时显式降级到本地召回 |
| `model.enable_memory_decay_ordering` | `true` | 能力开关 | 默认启用衰减排序 |
| `pet.enabled` | `true` | 能力开关 | 桌宠入口可用 |
| `pet.pet_exit_closes_console` | `false` | 进程联动危险项 | 防止桌宠异常退出带停控制台 |
| `browser.use_system_proxy` | `true` | 网络能力 | 默认继承系统代理，不放入私人代理地址 |
| `self_update.rollback_enabled` | `true` | 安全能力 | 保留回滚槽 |
| `tool.execution.command_gate_enabled` | `true` | 安全护栏 | 危险命令继续经过闸门 |
| `tool.dev_open_permissions` | `false` | 危险授权 | 不默认开放全权限 |
| `tool.protected_paths.append_defaults` | `false` | 规则合并语义 | 空规则本身已回退默认保护；此项不是关闭保护 |

`Default` 与 serde 缺字段语义已对齐；已有配置文件不会被重写，用户显式写入的 `false` 保持有效。

## IDE 编辑闭环

- `GET /api/project/file/meta` 返回 `editable/revision/encoding/line_ending/has_utf8_bom/max_edit_bytes`。
- `PUT /api/project/file` 基于 revision 保存；外部修改返回 409；同目录临时文件写入、`sync_all` 后原子替换。
- `POST/PATCH/DELETE /api/project/entry` 实现新建、重命名和确认删除。
- 写操作只接受 workspace 相对路径，canonical 后限定当前 workspace；拒绝路径穿越、symlink/reparse point、纯点名、Windows 保留名。
- UTF-8 与 UTF-8 BOM 可编辑；保存保持 BOM 与原 CRLF/LF。二进制、权限只读或超过 256 KiB 的文件只读预览。
- 前端具有可编辑文本区、多标签、dirty 标记、Ctrl+S、保存按钮、冲突提示/重载、新建文件/目录、重命名、删除二次确认与统一状态栏。
- 同一路径复用已有 view tab，避免同一文件双标签产生两个编辑副本；重命名同步 tab/path，删除同步关闭关联 tab。
- 目录扫描对单项 metadata/read_dir 失败继续，累计 `warnings` 与 `omitted_count`，前端显示可悬停警告，不再截断后续文件。

本轮合理裁剪“另存为”：现有 workspace 模型下“新建文件 + 编辑 + 保存”已覆盖安全闭环；另存为涉及跨目录覆盖确认与覆盖现有文件语义，留待独立需求实现。

## 验收记录

- `node --check modules/gui-web/packages/web-console/src/app.js` 与 `cargo build -p coolzhu-web-console --offline` 通过；`cargo test -p coolzhu-web-console --offline` 共 810 项通过（lib 8 + native host 1 + main 801）。
- 图标契约静态枚举全部 `iconUrl("字面量")`、`icon:` 三元结果，以及 `iconForMessage` / `projectIconForEntry` 动态闭集；逐项核对 `WUXIA_ICON_ALIASES`、旧 PNG 白名单和实际资源。未知动态名称安全回退到已打包 `icons-wuxia/file.svg`，不再拼出缺失 PNG。最终 MSI 解包首启后，Playwright 往返切换 View/Diff，`diff.svg`、`vision.svg` 均为 200，控制台 0 error、网络 0 个 404。
- Playwright 真实页面完成新建、编辑、dirty、Ctrl+S、重命名后标签/路径同步、删除当前打开文件；API 另覆盖 400/403/409/413 与 stale revision 内容保护。
- Windows 实机测试确认 `std::fs::rename` 可替换已存在目标，保存实现未先删除旧文件；写入或替换失败时旧文件仍保留。
- 首次启动缺失凭据时，状态统一显示 `未配置（能力已启用；凭据引用 … 不可用）`，不会把启用的能力伪装成关闭，也不会把不存在的引用显示成已配置。
- 最终 MSI：`dist/CoolzhuAgent-0.2.4.msi`，SHA-256 `31A7BEFF28AB3486A61EFBD448B588BCC03AD233D78355ED0A90B3B00A89F7A0`，开发发布证书签名状态 `Valid`，未加时间戳。
- MSI 行政解包得到 783 个文件：`PFiles64/CoolzhuAgent` 产品树与 package safety 均为 782 个，行政安装根目录额外生成 1 个 MSI 数据库副本，数量差异合理且不是产品泄漏。包内无 `coolzhu.toml`；解包 release 在隔离 HOME/LOCALAPPDATA/runtime 下首次启动后真实生成配置，实读断言 28 个能力/护栏为 `true`、4 个危险授权/语义项为 `false`、full-access=false、聊天室为 workspace-write 且无非空凭据。
