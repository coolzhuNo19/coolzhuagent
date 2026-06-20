# Precise-Click Grounding Plan 落地审计（2026-05-11）

对照方案：`docs/precise-click-grounding-plan-2026-05-10.md`  
审计范围：`modules/vision/` + `modules/gui-web/packages/web-console/src/main.rs`  
整体完成度：**约 45%**（契约 + UIA resolver + router 雏形 OK；Local 深度、Remote、前端、诊断、锚点兜底未做）

## 1. 逐步审计

### 步骤 A：契约 & 配置（完成度 ~90%）

| 方案项 | 落地情况 | 证据 |
| --- | --- | --- |
| A1 `locate.rs` 纯类型 + serde | ✅ | `modules/vision/packages/vision-service/src/locate.rs`（303 行，含 `LocateRequest / LocateResponse / LocateTarget / SystemControlId / RegionHint / RegionAnchorKind / BackendId / BackendAttempt / AttemptStatus / PointPx / BBoxPx / ScreenInfo`；5 个 round-trip 测试） |
| A2 `lib.rs` 导出 | ✅ | `pub mod locate;` 已挂；测试通过 |
| A3 `ConfigVisionRouter` 挂进 `ConfigVision.router` | ⚠️ 部分 | `main.rs:1495-1572` 定义了 `ConfigVisionRouter / UiaRouterConfig / LocalVlmRouterConfig / RemoteVlmRouterConfig / RemoteVlmProviderConfig`；但 `ConfigVision` 结构体未嵌 `router` 字段，所以 `coolzhu.toml` 里填 `[vision.router]` **当前不会被解析**，全靠代码里硬编码默认 |
| A4 `From<ConfigVisionRouter> for RouterConfig` | ❌ | 未见 `RouterConfig`（详见 §E） |
| A5 `coolzhu.toml` 默认模板含 `[vision.router]` | ❌ | 未写入模板段；即便嵌进 `ConfigVision` 也不会在首次运行时落到磁盘 |

### 步骤 B：UIA Resolver（完成度 ~55%）

| 方案项 | 落地情况 | 证据 |
| --- | --- | --- |
| B1 新 crate `uia-resolver` | ✅ 骨架 | `modules/vision/packages/uia-resolver/` 存在，有 `Cargo.toml` + `src/lib.rs` (138 行) + `src/windows_impl.rs` |
| B2 `UiaResolver` trait + `resolve_system / resolve_query / resolve_natural / enumerate_taskbar` | ⚠️ 不匹配方案 | 实际只暴露 `pub fn resolve_system_control(id) -> Result<UiaHit, UiaError>`（无 trait、无 query/natural/enumerate 能力） |
| B3 `windows` crate IUIAutomation | ❌ | `resolve_via_script` 用 PowerShell 脚本实现，**不是方案里的 windows-rs IUIAutomation + CoInitializeEx 路径**；无 DPI 感知、无 Win10/Win11 分支 |
| B4 手工交互测试脚本 | ❌ | `tests/` 目录或 examples 未见 |
| B5 `modules/vision/INTERFACE.md` 更新 | ❌ | 未改 |

**评价**：UIA 有最小可行实现但做工粗：PowerShell 脚本方式性能差（每次 ~500ms~1s 起）、DPI/Win11 适配不稳、不带 `enumerate_taskbar` 诊断能力。方案里 "windows crate + IUIAutomation" 的工程方案整体没做。

### 步骤 C：Local VLM Backend 升级（完成度 ~25%）

| 方案项 | 落地情况 | 证据 |
| --- | --- | --- |
| C1 `local_backend.rs` 新文件 | ✅ 存在 | `modules/vision/packages/vision-service/src/local_backend.rs` |
| C1 区域裁剪、prompt 变体、DBSCAN 聚类 | ❌ 未做 | 未见 DBSCAN / region crop / prompt variation；仍走旧 `run_visual_action_dry_run` 链路 |
| C2 `LocalVlmBackend` trait + `LocalVlmKind::{ShowUi, Qwen}` | ❌ | 未导出 trait |
| C3 聚类 TDD | ❌ | 无 |
| C4 region_crop TDD | ❌ | 无 |

**评价**：只是开了个文件名，内容和真正的 `ShowUI 多采样 + 聚类 + 裁剪` 差距很大。

### 步骤 D：Remote VLM Backend（完成度 ~0%）

| 方案项 | 落地情况 |
| --- | --- |
| D1 `remote_backend.rs` | ❌ 文件不存在 |
| D2 `llm-adapter` provider kinds 补齐 VLM | ❌ 未核查；API 未调用 |
| D3 JSON 解析 TDD（7 种响应） | ❌ |
| D4 api_key secret 不落日志 TDD | ❌ |

**评价**：完全空白。方案里"远端 VLM 作为兜底"的核心差异化价值尚未兑现。

### 步骤 E：GroundingRouter 与 HTTP API（完成度 ~55%）

| 方案项 | 落地情况 | 证据 |
| --- | --- | --- |
| E1 `router.rs` + `RouterContext` | ⚠️ 直接写在 handler | `modules/vision/packages/vision-service/src/router.rs` **不存在**；pipeline 逻辑写在 `api_vision_locate` 内联（`main.rs:4726-4835`） |
| E2 TDD：pipeline 4 场景 | ❌ | 无 `router_pipeline` 测试文件 |
| E3 HTTP 3 端点 | ✅ 注册 | `main.rs:238-240` 已挂三条路由；handler `api_vision_locate / _backends / _verify` 已实现 |
| E4 `api_tool_execute` 改走 router | ❌ | 旧 `api_tool_execute` 仍用 `grounding_median_point` + `target_anchor_for_taskbar` + `verify_cursor_on_target` 硬编码兜底，**未切到 router** |
| E5 axum test `api_vision_locate` | ❌ | 无 |
| E6 `INTERFACE.md` 补 3 条端点 | ❌ | 未改 |

**评价**：端点是通的（pipeline 默认跑 UIA→Local→Remote），但没独立的 router 模块、没有 cross_verify 实装、没有 deadline 控制、没有 TDD 钉住 4 场景分支行为。`api_tool_execute` 真实点击路径还停留在 2026-05-10 的硬编码锚点策略，本次 grounding plan 的最大价值（避免 ShowUI 定位不准）未兑现到真实点击。

### 步骤 F：前端与 Diagnostics（完成度 ~5%）

| 方案项 | 落地情况 |
| --- | --- |
| F1 `capture-native` 新 crate（GDI/DXGI 无窗口截图） | ❌ 不存在 |
| F2 `vision-service/monitoring.rs` | ❌ 不存在 |
| F3 web-console "Grounding backend" 下拉（UIA/Local/Remote/Auto） | ❌ 前端未加 |
| F4 diagnostics `vision_router` 健康检查 | ❌ |
| F5 `tests/manual-visual-confirmation.md` 补 5 控件用例 | ❌ |

### 步骤 G：文档 & 需求（完成度 ~30%）

| 方案项 | 落地情况 |
| --- | --- |
| REQ-VIS-007 新增 | ⚠️ 表格未见显式新条目 |
| REQ-CU-002 状态推进 | ⚠️ 无对应变更记录 |
| `docs/work-logs/2026-05-1X-grounding-router-implementation.md` | ❌ 无专门落地日志 |
| `module-completion-status.md` 数字上调 | ❌ 无对应更新 |

## 2. 被遗漏的高风险项

1. **真实点击路径仍用 2026-05-10 硬编码锚点**（`api_tool_execute` 未改）。grounding plan 的用户价值"开始按钮打得准"没实质落地。
2. **uia-resolver 的 PowerShell 脚本实现**在生产环境有性能/稳定性隐患；Win11 任务栏居中、DPI>100% 用户上会漂移。
3. **Remote VLM 完全缺失**，本地 VRAM 不够时的兜底能力为 0。
4. **没有 router 层的 TDD**，4 场景分支行为没有回归保护；下一次重构一改就可能 break 默认管道。
5. **`ConfigVisionRouter` 未挂入 `ConfigVision`**，用户在 `coolzhu.toml` 写的配置不会生效，是 silent misconfig bug。

## 3. 推进建议（不写代码，仅排序）

| 优先级 | 动作 | 方案依据 |
| --- | --- | --- |
| P0 | 把 `ConfigVisionRouter` 嵌进 `ConfigVision.router`，补默认 toml 模板段 | 方案 §3.3 |
| P0 | `api_tool_execute` 真实点击切到 `POST /api/vision/locate` → 放弃硬编码锚点 | 方案 §5.4 |
| P0 | 抽 `router.rs` 独立模块 + 补 4 场景 TDD（UIA OK / UIA Skipped + Local LowConf 转 Remote / 全失败 / cross_verify 不一致） | 方案 §4.4 |
| P1 | `remote_backend.rs` 首版（接智谱 glm-4.6v 或阿里 qwen-vl-max 任一）| 方案 §4.3 / §D1 |
| P1 | `local_backend.rs` 补区域裁剪 + 3 次采样聚类 | 方案 §4.2 |
| P1 | `uia-resolver` 换 `windows-rs IUIAutomation`（放弃 PowerShell 脚本） | 方案 §4.1 / §B3 |
| P2 | 前端 "Grounding backend" 下拉 + diagnostics 健康检查 | 方案 §F3/F4 |
| P2 | `manual-visual-confirmation.md` 的 5 控件用例 | 方案 §F5 |

---

结论：grounding plan 骨架已搭（契约 + UIA 最小 + 路由端点），**但关键收益路径（真实点击用 UIA + 远端兜底）未通**。如果现在关停远端 VLM 或 ShowUI，系统回到 2026-05-10 硬编码锚点行为，方案兑现度约 45%。
