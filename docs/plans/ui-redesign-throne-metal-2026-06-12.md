# COOLZHU CODE · UI 升级设计总文档（王座 / 金属质感 / 全屏适配 / 飞船场景）

> 日期：2026-06-12
> 性质：**可直接进入开发**的前端设计文档（含问题诊断→技术路线→提示词→分阶段验收）。
> 关联：`docs/plans/spaceship-bridge-assets-prompts.md`（飞船组件提示词集，本文档 §6 为其前置整景）。
> 现状基线：页眉标签 + 滑动切换 v2 已上线（bridge3d.js v2）；办公室场景为原版；
> 风格底座 = 马里奥像素风（金黄 #ffd552 / 深蓝 #071827 / 霓虹青 #3ec6ff）。

---

## 1. 全屏黑边问题（P0，纯 CSS 当天可落）

### 1.1 诊断（实测）
- `styles.css:57` `.shell` 锁死 `aspect-ratio: 1672/941` 且 `width: min(100vw, calc(100vh*1672/941))`，
  `body`（:36）flex 居中 —— **屏幕宽高比 ≠ 1672:941 时必然出黑边**（宽屏左右黑、窄屏上下黑）。
- 这是「设计稿等比缩放」策略的代价（CUR-UI-SCALE-001 选择了固定比例）。

### 1.2 技术路线（两步走）
**Step A（保守，零回归风险）— 黑边变"延展景"**：shell 比例不动，把 body 背景从纯深色
改为与 shell 同主题的延展画面（星空/砖墙纹理 + 两侧装饰柱），黑边变成「舞台幕布」：
```css
body { background: var(--stage-curtain-bg) center / cover, #07131d; }
/* 另生成 2 张窄长装饰图（§7 提示词 E1/E2）absolute 贴在 shell 左右外侧 */
```
**Step B（根治）— 解除比例锁，弹性填满**：
```css
.shell { width: 100vw; height: 100vh; aspect-ratio: auto; }
```
配套（必须同时做，否则内部错位）：
1. `.layout-top-region` 高度 `var(--top-region-ratio)`（百分比，OK 自适应）；
   其 grid 三列 `minmax(280px,18%) 1fr minmax(280px,18%)` 已弹性 ✓。
2. `.layout-workbench` 同理 ✓。
3. 全局像素值审计：固定 px 的组件在超宽屏只是变"稀疏"不破——可接受；
   遗留极端情况用 `@media (min-aspect-ratio: 2/1)` 把左右两列上限提到 22% 吃掉空间。
4. 回归点：顶部三卡、页眉标签行、聊天室输入条、各窗口 panel —— preview 在
   1280×800 / 1920×1080 / 2560×1080 三档截图比对。

### 1.3 icon/标签溢出遗留（与黑边同 PR 解决）
- 页眉 dock 现为 `overflow-x:auto` 隐滚动条，窄屏靠滑动（截图右端"视觉…"被截）。
- 改法（styles.css ui-3d 层覆盖）：
```css
body.ui-3d .window-dock { display:flex; }
body.ui-3d .window-tab { flex: 1 1 0; min-width: 44px; justify-content: center; }
body.ui-3d .window-tab span { overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1280px) { body.ui-3d .window-tab span { display: none; } } /* 窄屏只留 icon */
```
  → 任意宽度 10 个标签全部在画，窄屏退化为纯 icon 模式（title 属性已有 tooltip）。
- 旧 CUR-UI-SCALE-001（视口高 <720 侧栏溢出）随侧栏取消自然消亡，文档归档该条目。

---

## 2. 金属质感 · 镜面光泽 · 3D 组件设计系统（P1）

> 原则：**纯 CSS 配方系统化**（变量 + 工具类），所有窗口/按钮/卡片统一换肤，不逐个手调。

### 2.1 CSS 设计令牌（styles.css 头部追加）
```css
:root {
  --metal-gold: linear-gradient(160deg,#fff3b0 0%,#ffd552 18%,#b8860b 42%,#ffd552 58%,#8a5a00 82%,#ffe9a8 100%);
  --metal-steel: linear-gradient(165deg,#e8eef4 0%,#9fb2c4 22%,#5a6e80 50%,#8fa3b5 72%,#dfe8f0 100%);
  --metal-brush: repeating-linear-gradient(105deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px);
  --specular: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.5) 47%, rgba(255,255,255,.85) 50%, rgba(255,255,255,.5) 53%, transparent 62%);
  --bevel-out: inset 0 2px 0 rgba(255,255,255,.45), inset 0 -3px 0 rgba(0,0,0,.45), inset 2px 0 0 rgba(255,255,255,.18), inset -2px 0 0 rgba(0,0,0,.3);
  --gem-red: radial-gradient(circle at 32% 28%, #ffb3c0 6%, #ff2d55 38%, #7a0017 88%);
  --gem-blue: radial-gradient(circle at 32% 28%, #b8e6ff 6%, #2d8cff 38%, #002a7a 88%);
  --gem-green: radial-gradient(circle at 32% 28%, #c4ffd0 6%, #2ecc71 38%, #00521f 88%);
  --gem-purple: radial-gradient(circle at 32% 28%, #ecd0ff 6%, #a55eea 38%, #3a0a66 88%);
}
```

### 2.2 工具类（核心三件）
```css
/* 金属边框卡片：双层边 + 拉丝 + 倒角 */
.metal-card { border: 3px solid #3a2a08; background: var(--metal-gold); box-shadow: var(--bevel-out), 0 10px 24px rgba(0,0,0,.5); position: relative; }
.metal-card::before { content:""; position:absolute; inset:0; background: var(--metal-brush); pointer-events:none; }

/* 镜面扫光：hover/激活时高光横扫一次（背景位移动画，60fps 便宜） */
.specular-sweep { position: relative; overflow: hidden; }
.specular-sweep::after { content:""; position:absolute; inset:-20%; background: var(--specular); background-size: 280% 100%; background-position: 120% 0; pointer-events:none; }
.specular-sweep:hover::after, .specular-sweep.is-active::after { animation: specSweep .9s ease; }
@keyframes specSweep { from { background-position: 120% 0; } to { background-position: -60% 0; } }

/* 3D 浮起组件：透视抬升 + 动态阴影（标签/按钮/卡片通用） */
.lift-3d { transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease; transform-style: preserve-3d; }
.lift-3d:hover { transform: translateY(-2px) translateZ(18px) rotateX(7deg); box-shadow: 0 14px 26px rgba(0,0,0,.55), 0 0 16px rgba(255,213,82,.4); }
```

### 2.3 应用映射（开发者按表套用）
| 目标元素 | 套用类 | 备注 |
|---|---|---|
| 页眉 window-tab | lift-3d + specular-sweep | is-active 时扫光 |
| 顶部三卡（总览/logo/任务卡） | metal-card（边框层） | 内容区底色不动 |
| pixel-button 全量 | specular-sweep | hover 扫光 |
| 窗口 panel 外框 | metal-card 变体（钢色 --metal-steel） | 区分内容区 |
| 王座/宝石（§3） | --gem-* 径向渐变 + 高光点 ::after | 纯 CSS 宝石 |

---

## 3. Logo 区：砖墙 → 黄金王座长椅（P1）

### 3.1 视觉设计
"COOLZHU CODE" 字样保持**中心视觉不变**，但承载物从砖墙横幅改为：
**一张黄金王座长椅**（横向长椅式王座，椅背即 logo 牌位），镶嵌红/蓝/绿/紫四色宝石，
扶手为金狮头/蘑菇头混搭，底座红毯。桌宠可"坐"上去（§4）。

### 3.2 生图提示词（banner 全景，2048×640，3 张备选）
- 中：横向黄金王座长椅全景，椅背是巨大的金色牌匾刻着浮雕大字"COOLZHU CODE"（像素衬线体），
  牌匾四角镶嵌红蓝绿紫四颗切面宝石（发光），扶手两端是金色蘑菇头雕塑，椅面铺深红色丝绒坐垫，
  底部金色台阶铺红毯，背景马里奥像素蓝天白云，16-bit 像素风+金属浮雕质感，宽幅 16:5。
- EN: `panoramic golden throne bench, backrest is a giant engraved golden plaque reading "COOLZHU CODE" in pixel serif relief, four faceted glowing gems (red blue green purple) at plaque corners, golden mushroom-head sculptures on both armrest ends, deep red velvet seat cushion, golden steps with red carpet below, Mario pixel blue sky background, 16-bit pixel art fused with metallic bas-relief, wide 16:5`
- 负向：`blurry, photorealistic, watermark, extra text, distorted letters`
- **文字易翻车**：若生成字样畸形，则提示词去掉文字改留**空白牌匾**，"COOLZHU CODE"
  由前端文字层叠加（现 brand-banner 文字即可复用，金色浮雕用 CSS text-shadow 多层实现）。

### 3.3 前端集成
- `index.html` brand-banner 区：背景图换王座图（`assets/ui-redesign/throne-banner.png`），
  保留（或叠加）文字层；宝石四点用 `--gem-*` CSS 加 `gemTwinkle` 闪烁动画增强。
- 王座"座位锚点"：banner 内放一个不可见定位元素 `<div data-role="throne-seat">`（供 §4 联动）。

---

## 4. 桌宠 × 王座联动：加冕玩法（P2，跨进程）

### 4.1 行为定义
1. 桌宠（Tauri 独立窗口）被拖到屏幕上 **控制台窗口的王座区域**上方 → 触发"靠近王座"
   动作（挥手/星星眼，attention 帧 + 气泡"要加冕吗？"）。
2. 在王座区域释放（停留 >600ms）→ 桌宠窗口**吸附**到王座座位坐标 → 播放**加冕动画**：
   王冠从上方落下戴到头上 + 金色粒子 + 控制台侧王座宝石齐闪 → 桌宠进入 `crowned` 状态
   （戴冠 idle 帧，气泡"国王驾到！"）。
3. 拖离王座 → 摘冠回普通 idle。

### 4.2 技术路线（开发者实操）
- **坐标层**（tauri-shell main.rs）：
  - 已有 `stabilize_pet_window_command` 周期（1.2s）→ 扩展：读桌宠窗口 `outer_position/size` +
    控制台窗口 `outer_position/size`（Tauri `WebviewWindow::outer_position`）。
  - 王座区域 = 控制台窗口 rect 内的相对区域（顶部中央 banner：x∈[36%,64%], y∈[3%,26%]，
    常量可调）。命中判定在 Rust 侧做，向桌宠 webview `emit("pet-throne", {phase:"near"|"seated"|"left", seat_x, seat_y})`。
  - 吸附：`phase=seated` 时 Rust 调 `set_position(seat_x, seat_y)`（座位屏幕坐标 = 控制台 rect
    × 王座锚点比例 - 桌宠窗口高度偏移）。
- **桌宠层**（pet-mini.html）：
  - 监听 `pet-throne` 事件：near → `applyStatus({state:"attention", message:"要加冕吗？"})`；
    seated → 播加冕序列（见下）；left → 回 idle。
  - **加冕动画**：新增状态 `crowned`（idle 帧 + 王冠 overlay 图层 `<img id="crownOverlay">`
    绝对定位头顶；入场 keyframes：王冠从 -40px 落下 + 2 次弹跳 + 金色 box-shadow 闪光）。
    素材：王冠 PNG（§7 提示词 E3）+ 可选粒子（CSS 径向渐变点阵动画即可，不必图片）。
  - 控制台侧呼应：web-console 收 SSE/事件后给 throne-seat 加 `.coronation` class
    （宝石齐闪 + 扫光）——通道复用既有 `emit_backend_pet_event`（后端已有 pet 事件总线）。
- **状态持久**：crowned 仅会话内（不持久），避免状态机复杂化。

### 4.3 验收
- 拖桌宠进王座区 → 气泡提示；释放 → 吸附+王冠落下动画+控制台宝石闪；拖走 → 摘冠。
- 控制台最小化/移动时桌宠不误吸附（rect 实时读取）。

---

## 5. 各窗口 UI 创意设计（P2-P3，逐窗渐进）

> 原则：**结构不动（data-role 全保留），只做"皮肤+一个标志性创意"**；每窗一个记忆点。

| 窗口 | 主题创意 | 标志性元素（CSS/JS 落点） | 提示词需求 |
|---|---|---|---|
| 工程目录 | 藏宝图卷轴 | 目录树节点=藏宝路线，展开时"墨迹晕开"动画（clip-path） | 羊皮纸纹理 1 张 |
| 设置 | 引擎机房 | 每个配置组=一台引擎，保存时活塞压下动画（translateY 序列） | 引擎面板框 1 张 |
| 聊天室 | 通讯舱 | 消息气泡=全息投影帧（青色描边+扫描线 ::after），发送时"信号波"扩散 | 无（纯 CSS） |
| 浏览器 | 天文观测站 | 地址栏=望远镜目镜环，加载中镜筒旋转 | 目镜环 1 张 |
| 多媒体 | 影音水晶厅 | 播放卡=水晶碟，播放中碟片旋转+虹彩（conic-gradient hue 旋转） | 无（纯 CSS） |
| 终端 | 反应堆控制台 | 输出区=反应堆视窗，执行命令时堆芯亮度脉冲（box-shadow 呼吸） | 无（纯 CSS） |
| 任务授权 | 金库门禁 | 授权按钮=金库转盘锁，授权通过=转盘旋转+门开（rotate + clip） | 转盘锁 1 张 |
| 记忆知识 | 数据水晶库 | 每条记忆=悬浮水晶（--gem-* 随 layer 配色），pin=水晶升起发光 | 无（纯 CSS） |
| 视觉实验 | 雷达观测舱 | 结果区=雷达扫描盘，识别中扫描线旋转（conic-gradient mask 动画） | 无（纯 CSS） |
| 诊断日志 | 维修舱 | error 行=火花图标闪烁，健康度=压力表盘（SVG 弧 stroke-dashoffset） | 无（纯 CSS） |

> 开发顺序建议：先做纯 CSS 的 6 个（零素材依赖），再做需素材的 4 个。

---

## 6. 飞船控制室：先整景后组件（两步生图策略）

### 6.1 第一步：整体效果图（先看整体设计效果，定调用）
> 目的：一张全景定构图/配色/质感基调，**人工选定满意稿后**，再按
> `spaceship-bridge-assets-prompts.md` 的 15 个组件提示词分件重生成（保持同款风格词）。

**整景提示词（16:6 宽幅，出 4 张选 1）**：
- 中：宇宙飞船舰桥控制室第一人称全景：弧形全景舷窗占画面上 2/3，窗外深空有
  红色蘑菇斑行星（金环）、绿色条纹行星、旋转金橙吸积盘黑洞、斜跨的紫青银河带与漫天像素星；
  舷窗下方是弧形主控制台，嵌发光青蓝仪表屏与成排彩色按钮，台面中央升起全息投影蓝色线框地球
  （底部光锥）；左右各一根金色描边支柱，角落马里奥问号块装饰；整体 16-bit 马里奥像素风
  融合复古科幻，金黄 #ffd552 描边 + 深蓝 #071827 基调 + 霓虹青 #3ec6ff 光效，金属浮雕质感，
  禁止出现人物，宽幅 16:6。
- EN: `first-person panoramic view inside a spaceship bridge: curved panoramic viewport fills upper 2/3, outer space shows a red planet with white mushroom spots and golden ring, a green banded planet, a black hole with swirling orange-gold accretion disk, a diagonal purple-cyan galaxy band and pixel starfield; below the viewport a curved main console with glowing cyan instrument screens and rows of colorful buttons, a holographic blue wireframe Earth rising on a light cone at console center; golden-trimmed pillars on both sides, Mario question-block ornaments in corners; 16-bit Mario pixel-art fused with retro sci-fi, golden #ffd552 trim, deep navy #071827 base, neon cyan #3ec6ff glow, metallic bas-relief texture, no characters, wide 16:6`
- 负向：`photorealistic, blurry, humans, astronaut, text, watermark, cluttered`

**选稿标准**：舷窗/控制台分界清晰（便于后续分层）、地球居中、配色与现 UI 一致、像素颗粒均匀。

### 6.2 第二步：组件分件
- 按选定整景的风格词微调 `spaceship-bridge-assets-prompts.md` 各组件提示词
  （把整景里满意的措辞回填到风格后缀），再分件生成 → 按其 §四 组装蓝图分层组装。
- 整景图本身可同时用作**过渡期静态背景**（office 场景背景图直接换它，立刻提升观感，零代码）。

---

## 7. 补充素材提示词（黑边装饰 / 王冠）

- **E1 左侧幕布柱**（窄长 512×2048）：
  中：竖向装饰柱，黄金管道与绿色水管交错盘绕，缠绕像素藤蔓与小蘑菇，深蓝底，顶端火炬。
  EN: `vertical decorative pillar, golden pipes interlaced with green warp pipes, pixel vines and tiny mushrooms wrapped around, deep navy background, torch flame on top, tall 1:4`
- **E2 右侧幕布柱**：同 E1 镜像（提示词加 `mirrored composition`）。
- **E3 桌宠王冠**（256×256 透明 + 4 帧落下序列可选）：
  中：像素风黄金王冠，五齿，每齿顶一颗小宝石（红蓝绿紫金），底圈红丝绒，微微发光，透明背景，正面。
  EN: `pixel-art golden crown, five prongs each topped with a tiny gem (red blue green purple gold), red velvet base band, soft glow, transparent background, front view, small game asset`

---

## 8. 分阶段开发路线图（直接按此排期）

| 阶段 | 内容 | 改动文件 | 工时感 | 验收 |
|---|---|---|---|---|
| **P0** | §1 黑边 Step A/B + 标签溢出 | styles.css（ui-3d 层） | 半天 | 三档分辨率截图无黑边/无截断 |
| **P1a** | §2 金属质感令牌+工具类+映射表套用 | styles.css | 1 天 | 页眉/三卡/按钮扫光+倒角生效 |
| **P1b** | §3 王座 banner（生图→集成→宝石闪烁） | index.html + assets | 半天+生图 | logo 中心视觉不变，王座+宝石在画 |
| **P2a** | §4 桌宠加冕联动 | tauri-shell main.rs + pet-mini.html + 王冠素材 | 1-2 天 | §4.3 三步验收 |
| **P2b** | §5 纯 CSS 六窗创意 | styles.css（+少量 app.js class 钩子） | 2 天 | 每窗标志性动效可演示 |
| **P3** | §6 飞船整景→组件→组装（替换 office） | assets + bridge3d.js v3 | 生图节奏定 | 分层视差+全息地球动效 |
| **P3+** | §5 余下四窗（需素材） | 同上 | 渐进 | — |

**通用约束**（每阶段必须遵守）：
- 改前备份到 `tmp/backups/`（沿用 web-ui-* 命名）；styles.css 只追加 ui-3d 前缀覆盖层，可整层回退。
- data-role / data-window-* / data-bind 钩子一律不动（app.js 零改动原则）。
- styles.css / index.html 为编译期内联 → 改后必须 `cargo build -p coolzhu-web-console --offline`；
  assets/*.js、图片为运行时读盘 → 免编译热改。
- 动画必须「用户动作驱动或一次性」，禁止观察 class 自动重放（v1 翻转 BUG 教训）；
  全部动画带 `prefers-reduced-motion` 降级。
- 素材归档 `assets/ui-redesign/`（throne-banner.png / bridge/01-*.png / pillars/ / crown/）。

---

## 9. v2 修订（2026-06-12 二轮，依据首轮生成效果图反馈）

### 9.1 总体布局修订（王座区）
- **保留窗口折叠设计**（双击页眉标签折叠看场景，机制不变）。
- **王座元素居中置顶**：王座顶到 banner 区上边缘，**上方不放任何内容**（首轮图中王座上方的
  四张状态卡取消——状态卡移到王座**左右两侧**的卡片位，HTML 层渲染，不画进图）。
- **王座整体上移 + 压扁**：banner 区高度占比下调（--top-region-ratio 适当减小），给下方窗口留足空间。
- 王座扶手两侧：**左扶手放一把黄金权杖**（画进主图），**右扶手上卧一只黑色卡通小猫**
  （独立透明素材 + 前端动画层叠加，见 9.3——不画进主图，否则无法做动画）。

### 9.2 王座 banner 提示词 v2（替代 §3.2；2048×512 扁宽 16:4，出 4 选 1）
- 中：黄金王座长椅特写，水平居中、紧贴画面顶部，左右两侧留出干净的深蓝色城堡夜景背景
  （供前端放置状态卡片）；椅背是金色牌匾刻浮雕大字"COOLZHU CODE"（像素衬线体），
  牌匾四角嵌红蓝绿紫四颗发光切面宝石；左扶手斜倚一把黄金权杖（杖头镶红宝石球），
  右扶手台面平整留空（后续叠加素材）；椅面深红丝绒坐垫，底部两级金色台阶铺红毯；
  16-bit 马里奥像素风 + 金属浮雕质感，金黄 #ffd552 主调、深蓝 #071827 夜空背景，扁宽 16:4，
  王座占画面中央 1/3 宽度。
- EN: `golden throne bench close-up, horizontally centered and flush to the top edge, both sides left as clean dark-navy castle night background (reserved for UI cards); backrest is a golden plaque with engraved pixel-serif relief text "COOLZHU CODE", four glowing faceted gems (red blue green purple) at plaque corners; a golden scepter with ruby orb leaning on the left armrest; right armrest top kept flat and empty; deep red velvet cushion, two golden steps with red carpet below; 16-bit Mario pixel art with metallic bas-relief, golden #ffd552 dominant, deep navy #071827 night sky, wide 16:4, throne occupies central 1/3 width`
- 负向：`photorealistic, blurry, watermark, extra text, distorted letters, characters, animals`
- 文字翻车备选同 §3.2（空白牌匾 + 前端文字层）。

### 9.3 黑色卡通小猫（独立动画组件，透明背景多姿态）
> 叠加在右扶手锚点（data-role="throne-cat"），JS 按状态轮播姿态帧 + CSS 微动画
>（尾巴摇/呼吸縮放）；与桌宠加冕（§4）联动时让位（猫跳下扶手）。

---

## 10. v3 布局坐标契约（2026-06-13，覆盖 §1.2 Step B）

- 不再采用 `width: 100vw; height: 100vh; aspect-ratio: auto` 的内部拉伸方案。
- 页面统一使用 1920 × 1080、16:9 设计坐标，整张画布等比缩放。
- 顶部三栏固定为 23.75% / 52.5% / 23.75%，列间距为 0；中间王座横幅显示生成式 3:1 安全母版，
  使用 `object-fit: contain` 保持原生比例，不裁切或拉伸。
- `COOLZHU CODE` 文字直接烘焙在王座图片中，不创建独立 HTML 文字层。
- 详细坐标、响应式规则和规范图见：
  `docs/plans/ui-layout-geometry-spec-2026-06-13.md`。

> **逐窗视觉差距分析 → `docs/plans/ui-window-visual-gap-analysis-2026-06-13.md`**
> （10 窗实测对照设计效果图：全局 8 项差距 G1-G8 + 逐窗补足 + 图标清单 + 缩放回归红线 +
> 边缘未覆盖区域 E1-E5 根因 + 素材排产表。是 §2/§5 在各窗的落地展开。）

- **姿态集（每条 256×256 透明 PNG，同一只猫、同角度同光照）**：
  1. 卧睡卷成团（尾巴绕身）2. 伸懒腰（前爪前伸塌腰）3. 端坐舔前爪 4. 端坐尾巴轻摇（出 2 帧）
  5. 抬头眯眼优雅回望 6. 趴卧下巴贴爪（半睡）
- 中（以姿态 1 为例，其余替换动作描述）：一只黑色卡通小猫卧睡卷成一团，尾巴优雅地绕住身体，
  金色细项圈带小铃铛，16-bit 像素风，粗深色描边，黑色毛发用深蓝高光提亮，慵懒优雅气质，
  透明背景，侧面视角，居中，游戏素材。
- EN 模板: `a black cartoon cat {pose}, slender golden collar with tiny bell, 16-bit pixel art, bold dark outline, black fur highlighted with deep navy sheen, lazy elegant attitude, transparent background, side view, centered, game asset` —— {pose} 依次：
  `curled up sleeping with tail wrapped around body` / `stretching with front paws extended and back arched down` / `sitting upright licking front paw` / `sitting upright with tail mid-swish (frame 1 of 2 / frame 2 of 2)` / `glancing back over shoulder with half-closed elegant eyes` / `lying with chin resting on paws, half asleep`
- 前端动画：常态循环「卧睡 3min → 伸懒腰 → 舔爪 ×2 → 尾巴摇 2 帧 ×6 → 回卧睡」；
  鼠标 hover 王座 → 抬头回望姿态；桌宠加冕时播"跳下"位移动画（translateY+缩放过渡用现有帧）。

### 9.4 飞船舱整景提示词 v2（替代 §6.1；解决"中间空旷"——中央大桌台 + 环绕座椅）
- 中：宇宙飞船舰桥控制室第一人称全景：弧形全景舷窗占上半部，窗外有红色蘑菇斑行星（金环）、
  绿色条纹行星、金橙吸积盘黑洞、紫青银河带与漫天像素星；**画面中央是一张巨大的赛博朋克风
  圆形全息会议桌台**——多层金属台体嵌青蓝发光环带与数据刻度，桌面中央升起蓝色线框全息地球
  （底部光锥、环绕数据环），**桌台四周环绕 5-6 把高背科幻座椅**（深蓝金边、空置、朝向桌台）；
  外圈是环形控制台带发光仪表屏与彩色按钮；左右金色立柱挂壁灯，角落马里奥问号块；
  16-bit 马里奥像素风融合复古科幻，金黄 #ffd552 描边 + 深蓝 #071827 基调 + 霓虹青 #3ec6ff 光效，
  金属浮雕质感，红毯铺地，无人物，宽幅 16:6。
- EN: `first-person panoramic spaceship bridge interior: curved panoramic viewport fills the upper half showing a red planet with white mushroom spots and golden ring, a green banded planet, a black hole with orange-gold accretion disk, purple-cyan galaxy band and pixel starfield; at the center of the room a huge cyberpunk circular holo-conference table — multi-tier metal base with glowing cyan light rings and data tick marks, a blue wireframe holographic Earth rising from its center on a light cone with orbiting data rings; 5-6 empty high-back sci-fi chairs (navy with golden trim) arranged around the table facing it; an outer ring console with glowing instrument screens and colorful buttons; golden pillars with wall lamps on both sides, Mario question-blocks in corners; 16-bit Mario pixel art fused with retro sci-fi, golden #ffd552 trim, deep navy #071827 base, neon cyan #3ec6ff glow, metallic bas-relief, red carpet floor, no characters, wide 16:6`
- 负向：`photorealistic, blurry, humans, astronaut, text, watermark, cluttered, empty center`
- 座椅留空：后续按角色素材（机器人船员/嘉宾）逐个"入座"（独立透明素材叠加到椅位锚点）。

### 9.5 布局规格补充（开发对照）
- 王座 banner 区：王座图 z-0；左右卡片位各 `minmax(280px, 22%)`（现三卡布局即可复用，
  仅把中列背景换王座图、上方留白删除）；黑猫锚点 `right-armrest` ≈ 中列 x 62%, y 38%（相对中列）。
- 权杖如需独立闪光动画，可后续单独生成透明权杖素材替换画内权杖（锚点 x 38%, y 40%）。

## 10. 实施状态（2026-06-14）

- [x] 王座与 `COOLZHU CODE` 已烘焙在 `throne-banner-v3-baked.png`，黑猫保持独立动作层。
- [x] 固定 1920×1080 / 16:9 画布、A/B/C/D/E 锚点、横向 Window Dock、全局底部状态栏已接入。
- [x] 深空城堡 letterbox 延展景与生成式 `bridge-scene.png` 已接入；舰桥不再使用手搓行星/黑洞 DOM。
- [x] 金属系统已令牌化：`--metal-gold`、`--metal-steel`、`--metal-specular`、`--bevel-*`、`--gem-*`；
  顶卡、Dock、全局状态栏、十窗外框/标题铭牌/按钮共用统一 3D 框架。
- [x] 动效遵循状态触发：Window 激活扫光一次，舰桥仅折叠显示期间缓慢视差，reduced-motion 下全部停用。

视觉验收基准保存于 `output/ui-redesign-verification/2026-06-14-p0-p2/`。

## 11. 王座 v6 与桌宠加冕实施状态（2026-06-14）

- [x] `throne-banner-v6-wide-sword.png` 由旧王座图经 Image Gen 图生图生成：宽王座、宽牌匾、四角宝石、
  左侧独立仪仗宝剑、两名双手压剑金甲侍卫均烘焙在主图中。
- [x] 黑猫继续作为独立动作层，锚点为中列 `x=66%, y=43%`。
- [x] §4 跨进程协议完成：Web DOM 上报落座 rect；Tauri shell 原生拖拽释放命中、吸附、`crowned`；
  `pet-throne` 事件驱动黑猫让位与恢复。
- [x] `crowned` 使用 Image Gen 单独生成的八帧透明动作资源；0-7 帧完成皇冠落下与金光入场，入场结束后
  只循环 6-7 帧王座待机，不再复用 `success` 帧。
- [x] 代码回归：Tauri shell 33 项、Web Console 497 项全部通过；运行时截图已验证新加冕帧加载成功。
- [ ] 最终人工验收：录制桌宠拖入王座和拖离王座两个动作，确认吸附位置与猫让位的视觉节奏。
