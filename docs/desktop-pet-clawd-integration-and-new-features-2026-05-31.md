# 桌宠：clawd-on-desk 集成完成度分析 + 两个新需求方案（2026-05-31）

> 用户要求：检视桌宠代码，分析 clawd-on-desk 迁移集成完成度（排除不适用项），
> 并规划两个新需求（拖拽=超人飞行帧、空闲5分钟随机表演）。原始版本只做方案；
> 2026-06-03 已按方案完成首轮代码和资源落地。

## 一、当前桌宠代码现状（已排查的代码事实）

### 后端（web-console/src/main.rs）— 事件→状态机
- `PetStateSnapshot { sequence, state, message, event_type, source, updated_at_ms }`。
- `pet_status_for_backend_event(event_type, msg, source)`：把后端事件映射到 state：
  - chat.completed→success，chat/llm/reasoning→thinking，goal→working/paused→attention，
    permission→attention，notification→notification，tool.ok→success，tool→working，
    audio→blink，其余→idle。
- `emit_backend_pet_event` → `record_pet_event` → `pet_event_bus`(broadcast 128) → `dispatch_desktop_pet_action`。
- 路由：`/api/pet/state`、`/api/pet/event`、`/api/pet/events`(SSE)。
- 传递：`desktop_pet_action_args` → `--pet-state <state> --pet-message <msg>` 给 tauri-shell。

### 桌面壳（gui-desktop/tauri-shell）— 独立悬浮窗 + 帧动画
- `pet-theme.json`（include_str!，5985 字节）：**13 个动画态**——
  idle / blink / thinking / working / carrying / juggling / sweeping /
  notification / attention / warning / success / **dragging** / **sleeping**。
  每态含 `frame_pattern`(如 `assets/pet-actions/idle-{index}.png`) / `frame_count`(多为8) /
  `interval_ms` / `priority` / `min_duration_ms` / `auto_return_ms` / `message` / `bubble`。
- pet window：`transparent(true)` + `always_on_top(true)` + `strip_pet_window_chrome`(无边框) +
  `stabilize_pet_window` + `normalize_pet_window_bounds`。
- 拖拽：`start_pet_dragging` → `start_native_pet_drag` → tauri `window.start_dragging()`（294/629 行）。
- 托盘：`build_tray` + console toggle。
- 测试：`pet_theme_manifest_declares_migrated_clawd_states`（**证明 clawd 状态已迁移进主题清单**）。

### 前端渲染器（tauri-shell/ui/pet-mini.html）
- `frameSets` / `frameIntervals` / `stateSprites`：每态帧序列与播放间隔。
- `startPetAnimation(state)`：requestAnimationFrame 按 interval 循环播帧。
- `setStatus(state, message, timeout)`：切态 + 气泡 + 自动回 idle。
- `mousedown` → `start_dragging`（拖拽）；双击显示/隐藏 web console；右下角关闭 ShowUI。
- 监听 tauri 事件接收 `--pet-state` 更新。

## 二、clawd-on-desk 迁移集成完成度评估

> 对照联网核实的 clawd 真实功能（[clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk)：
> agent 活动驱动的 12 状态像素宠物 + 3 主题 + 眼动跟随 + 60s 睡眠）。

| clawd 能力 | coolzhu 现状 | 完成度 |
| --- | --- | --- |
| agent 活动→动画态映射 | `pet_status_for_backend_event` 全覆盖 chat/tool/goal/permission/notification | ✅ 已完成（核心） |
| 多动画态(12+) | 13 态主题清单 + 帧播放 | ✅ 已完成（已含 dragging/sleeping） |
| 透明置顶悬浮窗 | tauri transparent+always_on_top+无边框 | ✅ 已完成 |
| 拖拽 | start_pet_dragging / native drag | ✅ 已完成（基础） |
| 点击交互(poke/flail) | 双击/4击 | ✅ 已完成 |
| 气泡(bubble) | pet-theme bubble + status-bubble | ✅ 已完成 |
| SSE 事件流 | /api/pet/events | ✅ 已完成 |
| 帧动画系统 | frame_pattern/count/interval | ✅ 已完成 |
| **眼动跟随光标** | 无 | ❌ 未做 |
| **睡眠序列(60s→yawn/doze/sleep，鼠标惊醒)** | sleeping 态 + 10 分钟空闲自动触发 + 活动惊醒 | ✅ 已完成（首轮） |
| **空闲自主行为(walk/随机)** | 5 分钟空闲随机表演，保持固定位置不 walk | ✅ 已完成（首轮） |
| 多主题(Clawd蟹/Calico猫/Cloudling云) | 单主题(coolzhu 机器人) | ⚠️ 单主题(自研形象，按设计无需多主题) |
| 多 agent 共存追踪 | 单 agent(coolzhu 自身) | N/A |
| Codex Pet 动画包导入 | 无 | ❌ 未做 |

### 应排除的 clawd 项（不适用于 coolzhu）
1. **多主题切换 + Codex Pet 导入**：clawd 为通用工具要支持多 agent/多皮肤；coolzhu 桌宠是**自研单一形象**，
   无需多主题切换与第三方动画包导入。**排除。**
2. **多 agent 共存追踪**：clawd 同时盯十几种 AI CLI；coolzhu 桌宠只反映 coolzhu agent 自身状态。**排除。**
3. **各 AI CLI 的 hooks 安装器**（gemini/cursor/kimi... hooks）：coolzhu 用自己的 `/api/pet/event` 事件总线，
   不需要 clawd 那套给外部 CLI 装 hooks 的机制。**排除。**

### 建议补齐的 clawd 项（适用且有价值）
- **眼动跟随光标**（idle 时）：低成本、提升生动感。P2。
- **睡眠自动触发**：已随新需求2 首轮落地；后续可继续补 yawn/doze 过渡帧。P2。

**总体完成度：核心骨架 ~80% 完成**（事件→态→帧动画→悬浮窗→拖拽全通），缺的是"空闲自主行为"
（眼动/睡眠自动/随机表演），正好对应用户两个新需求。

## 三、新需求方案

### 新需求 1：拖拽动作帧改为「超人飞行」

**落点**：`dragging` 态已存在，只需替换其帧资源与参数。
1. **美术**：新增超人飞行精灵帧 `assets/pet-actions/superman-fly-0..N.png`（建议 6-8 帧：
   起飞蓄力 → 身体前倾平飞 → 披风飘动循环 → 轻微上下浮动）。形象保持 coolzhu 机器人 + 披风。
2. **pet-theme.json**：把 `dragging` 态的 `frame_pattern` 改为 `assets/pet-actions/superman-fly-{index}.png`，
   `frame_count` 设为新帧数，`interval_ms` 调快（如 100ms）表现飞行动感；可加 `message: "起飞！"`。
3. **pet.html**：`frameSets.dragging` / `stateSprites.dragging` 同步指向新帧（渲染器有独立 frameSets，需一并改）。
4. **触发链**：`mousedown → start_dragging` 时 `setStatus("dragging", ...)`（确认现渲染器拖拽时是否已切 dragging 态，
   若没有需补一行 setStatus）。
5. 验证：拖动桌宠 → 显示超人飞行帧 → 松手回 idle。

**改动面**：纯资源 + 配置 + 渲染器 frameSets，**不动 Rust 后端**。低风险。

### 新需求 2：空闲 5 分钟触发随机表演（MJ舞蹈 / 拳击 / 武术）

**触发条件**：无桌宠交互 **且** 无 coolzhu web-console 操作，持续 5 分钟 → 随机播一个表演动作。

**落点与设计**：
1. **新增表演态**（pet-theme.json）：`perform_dance` / `perform_boxing` / `perform_martial`，各 8-12 帧，
   `priority` 设为低（1，低于任何 agent 事件态，确保表演不打断真实工作状态），
   `auto_return_ms` 设为动作时长后自动回 idle，`min_duration_ms` 保证播完一轮。
2. **美术**：3 套表演帧 `assets/pet-actions/perform-dance-*.png` / `-boxing-*` / `-martial-*`
   （MJ 招牌动作如月球漫步/45度前倾；拳击直拳勾拳组合；武术抱拳/出拳/踢腿）。
3. **空闲计时器**（pet.html 渲染器，纯前端）：
   - 维护 `lastActivityAt`，在以下事件刷新：桌宠 mousedown/move/拖拽、收到任意非 idle 的 `--pet-state` 事件。
   - **"web-console 操作"判定**：渲染器订阅 `/api/pet/events`，后端在用户 web 操作时已 `emit_backend_pet_event`
     （chat/tool/goal 等都会发），所以只要 5 分钟内没收到任何活动事件即视为"无操作"。
     （更精确可在后端新增"前端心跳"事件：web-console app.js 在用户交互时 POST `/api/pet/event {type:"ui.activity"}`，
     但 MVP 可先靠现有事件流近似。）
   - `setInterval` 每 30s 检查：`now - lastActivityAt >= 5min` 且当前态==idle → 随机选一个 perform_* 调 `setStatus`。
   - 表演播完(auto_return_ms)回 idle；若期间来真实事件，因 priority 低被立即打断切走（符合预期）。
4. **可选后端协同**：若想让"表演"也能被后端统一调度/记录，可在 main.rs 加一个空闲检测（基于
   `pet_state_store` 的 `updated_at_ms`），到点 `emit_backend_pet_event("perform.random", ...)`；
   但 MVP 推荐**纯前端计时器**实现，零后端改动、最简。

**改动面**：MVP = pet-theme.json 加 3 态 + pet.html 加空闲计时器 + 3 套美术帧。**不动 Rust 后端**（可选协同才动）。

### 落地优先级
- P1：需求1 超人飞行拖拽帧（改动最小，dragging 态已在）。
- P1：需求2 空闲随机表演（纯前端计时器 + 3 态 + 美术）。
- P2（顺带）：睡眠自动触发（复用需求2 的空闲计时器：先 5min 表演，更久如 10min 进 sleeping）+ 眼动跟随。

### 需美术产出的精灵帧清单（汇总）
| 动作 | 帧数 | 说明 |
| --- | --- | --- |
| superman-fly | 6-8 | 替换 dragging：起飞→平飞→披风飘动循环 |
| perform-dance(MJ) | 8-12 | 月球漫步/45度前倾/招牌pose |
| perform-boxing | 8-12 | 直拳/勾拳/防守组合 |
| perform-martial | 8-12 | 抱拳/出拳/踢腿/收势 |
| （可选）sleep 序列 | 4-6 | 打哈欠→打盹→睡着（sleeping 态已在，补过渡帧） |

## 四、风险/注意
- `pet-mini.html` 渲染器有**独立的 frameSets/stateSprites**（与 pet-theme.json 并行维护）——改帧资源时**两处都要改**，
  否则后端态切了但渲染器没对应帧。这是最易漏的点。
- 表演态 priority 必须低于所有 agent 事件态，确保"真在干活时不会乱跳舞"。
- 5 分钟计时的"无操作"判定，MVP 靠现有事件流近似即可；要精确需补一个前端 UI 活动心跳事件（已在方案中标注）。
- 改完需 `cargo build -p coolzhu-tauri-shell`（pet-theme.json 是 include_str! 编译期内联）+ 重启桌宠进程。

## 五、2026-06-03 首轮实施记录

### 已落地功能

- `dragging` 态改为超人飞行帧：`assets/pet-actions/superman-fly-0..7.png`，拖动桌宠时显示飞行动作，释放后回落。
- 新增空闲表演态：`perform_dance`、`perform_boxing`、`perform_martial`，每态 8 帧，低优先级，播完自动回 `idle`。
- `pet-mini.html` 新增空闲自治：
  - 5 分钟无桌宠/状态事件活动时，随机触发一个表演态。
  - 10 分钟无活动时进入 `sleeping`。
  - 鼠标拖拽、移动、收到非 idle 状态事件会刷新活动时间；若正在 sleeping，会先唤醒到 `idle`。
- Rust 测试覆盖：
  - 主题清单声明超人飞行拖拽和三类表演态。
  - `pet-mini.html` 包含空闲表演、睡眠和活动唤醒逻辑。
  - 新增动作帧纳入透明画布、锚点稳定和边缘裁切检查。

### 生成与裁剪资源

- 源图：
  - `ui/assets/pet-generated-performance-actions-2026-06-03.png`
  - `ui/assets/pet-generated-superman-fly-2026-06-03.png`
- 项目使用帧：
  - `ui/assets/pet-actions/superman-fly-0..7.png`
  - `ui/assets/pet-actions/perform_dance-0..7.png`
  - `ui/assets/pet-actions/perform_boxing-0..7.png`
  - `ui/assets/pet-actions/perform_martial-0..7.png`
- 审查图：
  - `ui/assets/pet-performance-actions-contact-2026-06-03.png`

### 裁切审查结论

- 所有旧动作和新增动作帧均为 `256x256` 透明画布。
- 审查覆盖：`idle/blink/thinking/working/carrying/juggling/sweeping/notification/attention/dragging/resting/sleeping/warning/success/superman-fly/perform_dance/perform_boxing/perform_martial`。
- 审查结果：未发现四边残留其它帧、主体贴边截断或直边硬裁切；`warning` 仍为 7 帧，符合现有 manifest。
- 后续若重新生成动作帧，必须先生成接触表再跑 `pet_action_frames_have_no_straight_edge_cuts`，确认无串片和截断后再接入主题清单。

## 六、2026-06-16 侠客桌宠重设计落地

> 最新用户口径已替代 2026-06-03 的“超人飞行 + MJ/拳击/武术表演”方案：桌宠整体切换为银白金属质感 Q 版武侠侠客，只保留御剑飞行、侧卧睡眠、剑术攻击、基础状态和登上王座坐姿。

### 已落地功能

- 通过 Image Gen 生成新侠客母版：参考用户提供的 Q 版古装侠客形象，银白服装为主色，带金属盔甲高光，
  腰带保留 `ZP` 标识。
- `dragging` 改为 `sword-flight-0..7.png` 御剑飞行，替换旧 `superman-fly`。
- `sleeping` 改为侧卧睡眠动作：单手撑头、手肘撑地、闭眼、口含柳叶；生成时剔除了额外睡眠字母符号。
- `perform_martial` 改为完整剑术攻击序列，并联动泛 `chat/llm/tool` 活动，用于模型回复与工具执行期间。
- `crowned` 改为角色坐姿 + 皇冠落下帧，帧内不含小王座，专门叠到控制台现有王座上。
- 删除 `perform_dance` / `perform_boxing` 主题状态、右键菜单入口和空闲随机触发；空闲表演只保留剑术。

### 资源与验证

- 新动作帧已写入：`modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/`。
- 旧动作帧备份：`output/pet-actions-backup/2026-06-16-before-wuxia/`。
- 预览图：`output/pet-wuxia-frames/2026-06-16/wuxia-pet-frames-preview.png`。
- 帧质量：所有运行帧为 256×256 RGBA；主连通主体中心约束在 x=128，底边基线 y=216；无四边串片或硬裁切。
- 自动回归：`cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml`，33/33 通过。
