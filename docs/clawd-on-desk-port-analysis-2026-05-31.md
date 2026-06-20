# clawd-on-desk 桌宠移植分析（2026-05-31）

> 任务18。源码：`C:/Users/zhupu/coolzhuagent/clawd-on-desk-main`（Electron + Vite + TypeScript + React + Anthropic SDK）。
> 本文基于源码 `src/lib/constants.ts`(PET_CONFIG)、`README.md`、文件清单与行为 hooks 结构分析。
> 说明：原计划委派 test5 联合分析，但本轮本机 web-console 服务无法稳定启动（代码已编译通过+测试 366 passed，
> 纯启动环境问题），test5 委派依赖服务器故受阻，改由本 agent 直接基于一手源码素材完成。

## 一、功能点清单（clawd-on-desk）
- 🐾 **桌面常驻宠物**：透明置顶窗，Clawd 在屏幕上自主游走。
- 💬 **点击聊天**：点击桌宠唤起聊天窗，接 Claude API（Anthropic SDK）。
- 🎨 **动画**：idle / walking / sleeping / talking / dragging 五态精灵动画。
- 🖱️ **可拖拽**：鼠标拾起并移动到任意位置。
- 🌙 **睡眠模式**：长时间空闲后进入睡觉。
- 🗨️ **气泡**：SpeechBubble 组件显示说话内容。

## 二、行为状态机表（源自 PET_CONFIG）

| 状态 | 触发条件 | 计时/概率 | 退出到 |
| --- | --- | --- | --- |
| idle 待机 | 默认；动作完成后回落 | IDLE_TIMEOUT=5000ms 后评估下一步；IDLE_VARIANTS=[idle, look-around, stretch] | walking / sleeping |
| walking 游走 | idle 评估命中 WALK_PROBABILITY=0.3 | WALK_SPEED=2 px/帧；DIRECTION_CHANGE_PROBABILITY=0.2 每步可能转向；到屏幕边界反向 | idle |
| sleeping 睡觉 | 持续空闲达 SLEEP_TIMEOUT=30000ms | 唤醒条件=用户交互(点击/拖拽) | idle / talking |
| talking 说话 | 点击桌宠发起聊天、收到回复 | 配合 SpeechBubble；回复结束回 idle | idle |
| dragging 拖拽 | 鼠标按下并移动 | 跟随光标；松开回 idle（落到当前位置） | idle |

通用参数：ANIMATION_FPS=8，PET_SIZE=128，SPRITE_FRAMES=4。

## 三、动画帧映射表（ANIMATION_FRAMES，单张精灵图 clawd-sprite.png 切帧）

| 状态 | 帧序号 | 帧数 |
| --- | --- | --- |
| idle | [0,1,2,3] | 4 |
| walking | [4,5,6,7] | 4 |
| sleeping | [8,9,10,11] | 4 |
| talking | [12,13,14,15] | 4 |
| dragging | [16,17] | 2 |

播放：按 ANIMATION_FPS=8 循环当前状态的帧序列（usePetAnimation 钩子用定时器推进帧索引）。

## 四、关键实现拆解（行为逻辑，与美术解耦）
- `useIdleBehavior.ts`：idle 计时器 → 到点按 WALK_PROBABILITY 决定是否 walk；walk 中按 DIRECTION_CHANGE_PROBABILITY 转向；累计空闲超 SLEEP_TIMEOUT → sleep。
- `usePetAnimation.ts`：根据当前 state 取 ANIMATION_FRAMES[state]，按 FPS 推进帧。
- `useDragging.ts`：mousedown→state=dragging+记录偏移；mousemove→更新窗口/精灵坐标；mouseup→state=idle。
- `main/window.ts`：Electron 创建透明、无边框、置顶、(可选)鼠标穿透的窗口；桌宠区域可点击。
- `main/ipc.ts`：渲染进程↔主进程通信（聊天请求、窗口移动）。
- `lib/anthropic.ts`：聊天接 Claude API。

## 五、移植到 coolzhu 桌宠的映射方案（只移植行为逻辑，形象自研）

coolzhu 现有积木（已确认）：
- 后端：`PetStateSnapshot`（字段含 state，当前值 idle/working）、`pet_state_store()`、`pet_event_bus()`(broadcast)、
  `emit_backend_pet_event(event_type, message, source)`、`record_pet_event`、`dispatch_desktop_pet_action`。
- 路由：`/api/pet/state`、`/api/pet/event`、`/api/pet/events`(SSE)。
- 入口：`coolzhu-tauri-shell.exe`（web-console 启动时自动拉起）。
- 前端：office-robot（`renderOfficeRobot`，state class `is-<state>`，--x/--y 定位，robot-sprite）。

### 映射表
| clawd 行为 | coolzhu 落点 |
| --- | --- |
| 五态状态机 | 扩展 `PetStateSnapshot.state` 枚举：idle/walking/sleeping/talking/dragging(+ 现有 working) |
| idle/walk/sleep 自动转移 | 新增 `pet_behavior` 逻辑模块（Rust 或前端 JS）：计时器+概率驱动，输出 state；通过 `pet_event_bus` 广播 |
| 事件驱动 talking/working | 复用 `emit_backend_pet_event`：chat.started→talking，tool.running→working，长 idle→sleeping |
| FPS 帧播放 | 前端 robot-sprite 用 CSS steps() 或 JS 帧索引按 8fps 播放当前 state 的帧带 |
| 拖拽 | tauri-shell 窗口拖拽 + state=dragging（桌面悬浮窗）；web 内 office-robot 可省略拖拽 |
| 透明置顶窗 | tauri-shell 已是独立窗，配置 transparent/alwaysOnTop/skipTaskbar |
| 点击聊天 | 点击桌宠 → 调 `/api/chat/send` 或聚焦主控制台聊天框 |

### 落地优先级
- P0：扩展 `PetStateSnapshot.state` 枚举 + `pet_behavior` 自动状态机（idle↔walk↔sleep，计时+概率），广播到现有事件总线。
- P1：前端帧动画（自研 sprite 帧带，按 state 切换 + 8fps 播放）。
- P2：tauri-shell 悬浮窗拖拽 + 透明置顶 + 点击聊天。

## 六、需美术新设计的桌宠动作精灵帧清单（coolzhu 自研像素机器人，替换 Clawd 美术）

> 与控制台 8-bit 城堡场景统一的像素风机器人吉祥物。单张精灵表横向切帧，PET_SIZE 建议 128。

| 动作 | 用途 | 建议帧数 | 触发来源 |
| --- | --- | --- | --- |
| idle 待机（呼吸/眨眼） | 默认 | 4 | 默认/动作结束回落 |
| look-around 四顾 | idle 变体 | 4 | IDLE_VARIANTS |
| stretch 伸懒腰 | idle 变体 | 4 | IDLE_VARIANTS |
| walk 行走（左/右） | 自主游走 | 4–6 | walk 状态 |
| sleep 睡觉（Zzz） | 长 idle | 4 | 超 SLEEP_TIMEOUT |
| wake 苏醒 | 睡眠被唤醒 | 2 | 交互唤醒 |
| talk 说话（配气泡） | 聊天 | 4 | chat 事件 |
| work 工作（敲键盘/看屏） | 工具运行 | 4–6 | tool 事件 |
| drag 被拖拽（挣扎） | 鼠标拖动 | 2–4 | dragging |
| cheer 庆祝 | 任务完成 | 4 | goal/任务完成事件 |
| alert 警示 | 失败/需审批 | 4 | 失败/审批事件 |

## 七、结论
clawd-on-desk 的价值在于**轻量、清晰的桌宠行为状态机**（计时+概率驱动的 idle/walk/sleep + 事件驱动 talk/drag）。
coolzhu 已具备事件总线与独立桌宠窗，**移植成本主要在：①把状态机逻辑落为 `pet_behavior` 模块 ②自研像素帧动画**。
形象完全自研（上表），不沿用 Clawd 美术。建议按 P0→P2 渐进。
（注：本文为基于一手源码的分析；待 web-console 服务恢复后，可再委派 test5 交叉补充 hooks 的逐行细节。）
