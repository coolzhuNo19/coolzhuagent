# COOLZHU CODE · 窗口视觉差距分析与补足方案

> 日期：2026-06-13
> 输入：设计效果图（王座仪表盘整图 + 王座/黑猫特写）× `C:\Users\zhupu\Pictures\Screenshots\截图\` 10 张窗口实测截图。
> 方法：纯离线对照（未启动 web-console），结论用于指导后续 UI 补足。
> 关联：`ui-redesign-throne-metal-2026-06-12.md`（设计系统 §1-§9）、
> `ui-layout-geometry-spec-2026-06-13.md`（布局坐标契约 v3）、
> `chat-room-ui-avatar-plan-2026-06-12.md`（聊天室+头像）、`ide-project-window-plan-2026-06-12.md`（IDE 功能）。

---

## 0. 对照基准说明（先校准"差距"口径）

设计效果图是**多窗同屏的高密度仪表盘**（项目目录/控制台/浏览器/媒体/Diff 四五窗并列 + 顶部状态卡 + 底部命令栏）。
当前实现按 v3 几何契约是**单活动窗口 + 顶部三栏 + 横向 Window Dock + 折叠看场景**。

**这是一处刻意的架构分歧，不是缺陷**：效果图的"同屏多窗"是**单窗视觉密度与组件质感的参照**，
不是要照搬布局。因此下文"差距"只取三类可迁移项：
1. **比例/留白**（单窗内部分区是否拥挤或空旷）；
2. **组件/icon 设计**（边框、按钮、图标、徽章、状态点的质感与一致性）；
3. **图像/动画效果**（3D 金属、镜面、主题皮肤、状态动效）。
设计图里"把所有窗口塞满一屏"的密度本身**不迁移**（违背 §7 单窗契约）。

---

## 1. 全局差距（10 窗共有，最高优先）

| # | 维度 | 设计效果图 | 当前实测 | 补足方案（链接） |
|---|---|---|---|---|
| G1 | **窗口外框** | 厚重金属边框，四角铆钉/螺丝，立体倒角，金边+深蓝面 | 细平线边框（1-2px），无倒角无铆钉 | §2 `.metal-card`（钢色变体）套到所有 `.window-panel` 外框 + 四角 `::before/::after` 铆钉 |
| G2 | **窗口标题头** | 金属铭牌：拉丝底+刻字+左右铆钉 | 纯文字 `<strong>+<small>` | §2 `--metal-steel`+`--metal-brush` 套 `.window-panel-head`，加铭牌描边 |
| G3 | **按钮质感** | 立体宝石/金属键，明显高光与按压深度 | 扁平金渐变，按压反馈弱 | §2 `.specular-sweep`+3D 倒角套 `.pixel-button`/`.mini-button` 全量 |
| G4 | **图标体系** | 每窗一枚高辨识像素图标，统一描边/光照，带主题色 | Dock 图标尺寸偏小、描边/光照不统一，窗内功能按钮多为同款通用图标 | 见 §3「图标补足清单」——按窗补主题色描边 + 重绘 6 枚低辨识图标 |
| G5 | **状态可视化** | 状态点(红黄绿)+进度条+成功率条，信息层级清晰 | 多为纯文字键值对，绿色 pill 已有但无进度/占比可视化 | 各窗状态区加 §2 宝石点 + 进度条（纯 CSS） |
| G6 | **留白/密度** | 子面板分格清晰、信息填充饱满 | 终端/浏览器/工程 Diff 三窗**大面积空旷**；设置窗**过度拥挤** | §4 逐窗比例调整表 |
| G7 | **顶部三栏内容** | 左卡有机器人立绘+System Health 条；右卡状态点+成功率条+「VIEW ALL」 | 左卡纯指标无立绘无健康条；右卡拥挤无可视化 | §5 顶栏补足 |
| G8 | **全局氛围** | 高对比、深空冷调+金暖点缀、整体"控制中心"沉浸感 | 对比偏平、冷调够但金色点缀不足、缺沉浸感 | §2 设计令牌全局换肤 + §6 边缘延展景 |

> 落地顺序：G1/G2/G3（一套 CSS 工具类批量套用，半天见效）→ G7 → G5 → G4（含重绘）→ G6 逐窗。

---

## 2. 逐窗差距与补足（10 窗）

> 每窗列：实测现状 → 设计目标可迁移点 → 比例差 / icon差 / 图像动画差 → 补足（主题皮肤见总文档 §5）。

### 2.1 工程目录（治理：IDE 主窗，藏宝图卷轴主题）
- **实测**：左树（coolzhuagent/.coolzhu/.sandbox-* 等）+ 右侧 预览/Diff/刷新 工具条 + 双路径输入 + 空预览区。
- **比例差**：右侧预览区大面积空白（无文件时）；树与预览 1:2 尚可。
- **icon 差**：树节点**无文件类型图标、无 git 状态徽章**（设计图有 M/Y 橙色徽章）；工具条按钮通用图标。
- **图像/动画差**：Diff 区是纯文字占位，设计图为**带行号 gutter + 红绿增删着色 + Unified/Split/Side-by-Side 切换**的真实分屏；无藏宝图皮肤。
- **补足**：① 文件类型图标 + git 状态徽章（M/A/D/U 角标，复用 §2 宝石点配色）；② 分支页脚条（BRANCH/ahead/behind）；③ Diff gutter+着色+视图切换 → 并入 `ide-project-window-plan` 的 B/D 阶段；④ 皮肤=羊皮纸纹理（§5，需 1 张素材）+ 节点展开「墨迹晕开」clip-path 动画。

### 2.2 设置（引擎机房主题）
- **实测**：会话与模型 / 工具与审批 / TTS-STT 三列，字段密集，绿色状态 pill（在线·7/7），右下 JSON dump。
- **比例差**：**过度拥挤**——字段行距小、三列挤满，是 10 窗里唯一"太满"的。
- **icon 差**：配置组无分组图标；状态 pill 已 OK。
- **图像/动画差**：字段扁平无金属感；无"引擎"主题。
- **补足**：① 加行距/分组卡间距（G6 反向：留白）；② 每配置组头加"引擎仪表"小图标 + §2 钢框；③ 保存时活塞下压动画（translateY 序列，§5）；④ JSON dump 区折叠收纳，腾出呼吸。

### 2.3 聊天室（通讯舱主题，已立项 chat-room 文档）
- **实测**：通信舱 header + CHANNEL LINK 会话 chip 行 + 消息卡（**头像为同款通用机器人图标**）+ 输入条。
- **比例差**：消息区与输入条比例 OK（契约 84%/16%）。
- **icon 差**：**每会话头像相同**——设计图中 Commander/Vision/Code/Report 各有不同配色机器人立绘。→ 正是 `chat-room-ui-avatar-plan` §2 头像配置功能要解决的。
- **图像/动画差**：消息卡无全息描边/扫描线；作者名无主题色区分；发送无信号波。
- **补足**：直接落 `chat-room-ui-avatar-plan` §1（全息消息卡/扫描线/信号波）+ §2（每会话头像）+ §3（13 头像库）。**本窗是已最成熟的补足项**。

### 2.4 浏览器（天文观测站主题）
- **实测**：地址栏 + 加载/刷新/搜索/打开/独立窗口 + System proxy 开关 + 空占位"OBSERVATORY·输入 URL 开始观测"。
- **比例差**：内容区**大面积空旷**（无页面时）。
- **icon 差**：工具按钮通用；地址栏扁平。
- **图像/动画差**：设计图地址栏=望远镜目镜环、内容区有 project-map 节点图；当前全无视觉化。
- **补足**：① 地址栏左端加"目镜环"图标（§5，需 1 张素材）+ 加载时镜筒旋转；② 空态占位升级为**星图观测网格背景**（纯 CSS conic/radial），不再是裸文字；③ project-map 节点图属内容功能，非本轮视觉范围，标注为后续。

### 2.5 多媒体（影音水晶厅主题）
- **实测**：全部/图片/音频/视频 tab + 附件媒体库列表 + Now Playing（裸截图预览）+ 播放列表。
- **比例差**：三栏比例 OK。
- **icon 差**：媒体类型用同款"图片预览"图标，无音频/视频区分图标。
- **图像/动画差**：播放控件极简、无水晶质感；Now Playing 预览无相框。
- **补足**：① 音频/视频/图片分类图标区分；② 播放卡=水晶碟皮肤 + 播放时碟片旋转+虹彩 conic-gradient（§5，纯 CSS）；③ Now Playing 加金属相框 + 进度条宝石滑块。

### 2.6 终端（反应堆控制台主题）
- **实测**：PowerShell 面板 + 命令输入 + Timeout + 运行 + 就绪提示，**大量空白**。
- **比例差**：输出区空旷占 70%（无输出时）。
- **icon 差**：运行按钮通用图标。
- **图像/动画差**：纯文字终端，无反应堆视觉。
- **补足**：① 输出区底加"反应堆视窗"皮肤（§5，纯 CSS：堆芯径向光 + 扫描线）；② 执行命令时堆芯亮度脉冲 box-shadow 呼吸（命令期间循环，结束即停——遵守动画一次性原则的"事件区间"变体）；③ 运行按钮换电源/启动图标。

### 2.7 任务授权（金库门禁主题）
- **实测**：默认权限 / workspace 外目录 / Full access 三卡 + 授权目录/开启 + 待审批空。
- **比例差**：三卡比例 OK。
- **icon 差**：授权按钮通用；缺"锁/盾"状态图标。
- **图像/动画差**：扁平卡，无金库视觉；授权态切换无动效。
- **补足**：① 每卡加金库转盘锁图标（§5，需 1 张素材）+ 授权通过时转盘旋转+门开（rotate+clip 一次性）；② 三档权限用红/黄/绿宝石点表示风险级别。

### 2.8 记忆知识（数据水晶库主题）
- **实测**：筛选器 + TOTAL/PINNED/PROMPT/CONTEXT TOKENS 统计 + Beads 列表 + 记忆星图 + 来源追踪。
- **比例差**：四区比例较好，是**完成度较高**的窗。
- **icon 差**：Beads 用通用方块图标。
- **图像/动画差**：星图散点已有雏形（不错）；Beads 无水晶质感；pin 无动效。
- **补足**：① Beads = 悬浮水晶（`--gem-*` 按 layer 配色，纯 CSS）；② pin 时水晶升起发光；③ 星图散点连线可加极慢漂移（仅此窗激活，离开暂停）。

### 2.9 视觉实验（雷达观测舱主题）
- **实测**：Capture/Describe/Locate 左栏 + 截图证据 + execute=false/BBOX/CONFIDENCE/PROFILE/MODE 面板。
- **比例差**：左操作栏 + 中证据 + 右参数，比例 OK。
- **icon 差**：三个动作按钮通用图标。
- **图像/动画差**：结果区扁平；无雷达主题。
- **补足**：① 截图证据框加雷达扫描盘叠层（识别中 conic-gradient mask 旋转，仅"识别中"区间激活）；② Capture/Describe/Locate 配相机/眼/坐标三枚区分图标；③ 命中 bbox 用青色脉冲描边高亮。

### 2.10 诊断日志（维修舱主题）
- **实测**：Health/Audit + WARN(0/1/0) + Web Console ok + 修复建议 + 工具审计摘要 + Self updater + Log tail。
- **比例差**：多列表堆叠，比例 OK 但偏"纯文字报表"。
- **icon 差**：error/warn 无状态图标。
- **图像/动画差**：扁平列表；健康度无可视化。
- **补足**：① 健康度=压力表盘（SVG 弧 stroke-dashoffset，纯 CSS/SVG）；② error/warn 行配火花/三角图标，error 出现时火花闪烁一次（事件触发，非自动重放）；③ Log tail 等宽终端皮肤微调。

---

## 3. 图标补足清单（G4 落地）

**A. 统一描边/光照（全部 Dock + 窗内图标）**：现图标尺寸偏小、描边粗细不一。规范：
统一 24×24（Dock）/16×16（窗内），2px 深描边，左上暖高光，按窗主题色加 1px rim。可纯 CSS `filter: drop-shadow` 加 rim，无需重绘。

**B. 需重绘/新增的低辨识图标（6 枚，生图或像素手绘）**：
1. 文件类型图标组（.rs/.js/.ts/.py/.toml/.md/folder/file，工程目录树用）
2. git 状态角标（M 改 / A 增 / D 删 / U 未跟踪，4 色小角标）
3. 媒体类型（音频波形 / 视频胶片 / 图片，多媒体用）
4. 权限锁组（盾/转盘锁/全开锁，任务授权用）
5. 动作三件（相机/眼/坐标准星，视觉实验用）
6. 诊断状态（火花/三角警告/压力表，诊断日志用）

> 统一提示词后缀（生图时）：`16-bit Mario pixel-art icon, 2px dark outline, top-left warm highlight,
> transparent background, single-color rim glow, centered, crisp pixel clusters` + 负向 `blurry, photorealistic, text`。

---

## 4. 比例调整速查（G6 落地）

| 窗 | 问题 | 调整 |
|---|---|---|
| 设置 | 过挤 | 加组间距、字段行高，JSON dump 折叠 |
| 浏览器 | 空旷 | 空态铺星图观测网格背景 |
| 终端 | 空旷 | 输出区铺反应堆视窗皮肤 |
| 工程目录 | Diff 区空 | 空态铺羊皮纸纹理 + 引导文案居中卡片化 |
| 其余 6 窗 | 比例 OK | 仅换皮肤，不动比例 |

> 原则：空旷窗用**主题背景皮肤**填充观感（纯 CSS/1 张纹理），不强行塞功能；拥挤窗加留白。

---

## 5. 顶部三栏补足（G7）

- **左·Agent 总览**：加机器人吉祥物立绘（左侧 1/3，复用桌宠/头像库素材即可）+ System Health 进度条（纯 CSS，绑现有健康度数据）。当前纯指标列表 → 立绘+健康条+指标三段式。
- **右·任务卡片**：当前拥挤的"任务/Realtime.../工具审批/计划"→ 改设计图式：Running/Queued/Completed/Failed **状态点(红黄绿) + 数字**，底部 **Success Rate 进度条**，可选「查看全部任务」按钮（已有任务链按钮，复用）。
- **中·王座**：已基本到位（王座图+黑猫已上线）。保持 §9.1 契约：上方无内容、居中置顶；黑猫动画按 §9.3 姿态集渐进补。

---

## 6. 缩放回归注意点（防止重新触发已解决的黑边问题）

> 现行契约（**唯一正确方案**）：`ui-layout-geometry-spec-2026-06-13.md` —— 1920×1080 / 16:9 固定设计画布，
> 整张 `.shell` 等比缩放（`body.ui-3d .shell { width:min(100vw, calc(100vh*16/9)); height:min(100vh, calc(100vw*9/16)); aspect-ratio:16/9 }`，styles.css:6667），非 16:9 视口靠 letterbox。

**红线（任一触碰即回归黑边/错位）**：
1. **禁止**再改回 `.shell { width:100vw; height:100vh; aspect-ratio:auto }`（我方早前 P0 试过的"拉伸填满"方案）——
   它会让顶部三栏/Dock/工作区按视口比例各自拉伸、相互错位。v3 已用 min()+16:9 覆盖，**保持等比缩放**。
2. **禁止** `background-size: 100% 100%` 贴任何位图（王座图/场景图/纹理）——必须 `cover` 或 `contain`，否则非整数缩放下图像变形（契约 §1.4）。
3. **禁止**子窗内容反向撑大父区：窗内长列表/宽表格必须 `min-width:0 / min-height:0 + overflow:auto`，
   不得让内容把工作区或 shell 顶破（契约 §1.6）。曾因 `min-width` 缺失导致 grid 列被内容撑爆。
4. **禁止**重建左侧竖向窗口栏：设计图有它，但契约 §1.7 明确 Window Dock 是唯一入口；
   E 区/各子窗内不得再放纵向窗口列表（否则双导航 + 占宽）。
5. 顶部三栏比例锁定 **22.5% / 52.5% / 22.5%**（契约 §2），王座横幅目标比 **3.524:1**；
   改三卡内容时只动内部，不动这三个外部百分比，否则王座失中。
6. 新增覆盖样式一律走 `body.ui-3d` 前缀追加，可整层回退；改 index.html/styles.css 后**必须 `cargo build`**
   （编译期内联），否则浏览器看不到。
7. 多分辨率自测三档：1920×1080(1:1) / 1280×720(2/3 等比) / 2560×1080(左右 letterbox)——
   截图确认无变形、无错位、letterbox 区为延展景（见 §7）而非裸黑。

---

## 7. 边缘未被设计覆盖区域 · 根因分析

> 实测：截图四周/底部仍有"非设计"的暗区。逐条定位根因（已读 styles.css 证实）：

| 区域 | 现象 | 根因（已核 CSS） | 处置 |
|---|---|---|---|
| **E1 letterbox 边带** | 非 16:9 视口时左右/上下暗带 | `body` 背景（styles.css:46）是**纯渐变**，几何契约 §1.2 要求的"延展场景背景"**尚未实现**（grep `stage-curtain/延展` 无命中） | 生成 1 张深空城堡延展景（与王座/飞船同世界观）铺 `body`，`object-fit:cover`；letterbox 即变"舞台幕布"而非裸黑 |
| **E2 shell 外缘** | shell 四周一圈细平线 | `.shell` 仅 `outline:4px #26384a + box-shadow 0 0 0 4px #111a23`（styles.css:65-70），无设计图的**金属铆钉外框** | 加全屏金属边框（§2 metal 工具类 + 四角铆钉 ::before/::after），把 4px 平线升级为厚框 |
| **E3 底部带** | 工作区下方/部分窗底部留暗条 | 设计图有**全局底部命令+状态栏**（COMMAND INPUT/STATUS），当前实现无此全局条，命令输入仅在聊天窗内 | 决策：要么补一条全局底栏（RUN/VOICE/READ/SCREEN/STOP + 系统状态），要么把工作区下沿延伸到契约 99% 吃掉暗条。**建议补全局底栏**——既消暗条又补设计图核心元素 |
| **E4 Dock↔工作区 接缝** | 两区间 1-2px 暗缝 | 百分比锚定（28.33%→34.8% 间有 ~6% 间隙带）+ 取整误差 | gap 带用 §2 金属分隔条填充（装饰性，非留白） |
| **E5 顶卡间隙** | 三卡之间缝隙为底色 | grid gap 露出 `body` 底 | gap 用深金属描边或与延展景同纹理填充 |

**总根因**：缩放契约只规定了**核心 16:9 画布内部**的坐标，**画布之外（letterbox）与画布边缘装饰**两层尚未设计覆盖——
E1（画布外）靠延展景素材，E2/E4/E5（画布缘）靠金属边框/分隔条，E3（底部）靠补全局底栏。三者补齐后边缘即全覆盖。

---

## 8. 优先级与排期建议（接 §8 路线图）

| 优先级 | 项 | 依赖 | 见效 |
|---|---|---|---|
| **P0** | §7 边缘三补：E1 延展景 + E2 金属外框 + E3 全局底栏 | E1 需 1 张素材；E2/E3 纯 CSS/HTML | 边缘"非设计暗区"清零，沉浸感立升 |
| **P1** | §1 全局 G1/G2/G3：metal/specular/bevel 工具类批量套窗框+标题+按钮 | 纯 CSS（总文档 §2 令牌已备） | 10 窗统一金属质感 |
| **P1** | §5 顶部三栏 G7：左卡立绘+健康条、右卡状态点+成功率条 | 立绘复用素材 | 顶栏对齐设计图 |
| **P2** | 聊天室 chat-room 文档全量（头像+全息卡） | 13 头像素材 | 最成熟、记忆点强 |
| **P2** | §2 纯 CSS 主题皮肤 6 窗（终端/多媒体/记忆/视觉/诊断/浏览器空态） | 零素材 | 逐窗记忆点 |
| **P3** | 需素材 4 窗皮肤（工程藏宝图/设置引擎/浏览器目镜/授权金库） + §3 图标重绘 | 各 1 张素材 | 渐进 |
| **P3** | 工程目录 IDE 功能（ide-project 文档 A-E） + Diff 着色 | 后端索引 | 功能+视觉双补 |

**通用约束**：沿用总文档 §8——`body.ui-3d` 覆盖层可回退、data-role 钩子不动、改前端必 `cargo build`、
动画一次性/区间触发不自动重放、`prefers-reduced-motion` 降级、素材归档 `assets/ui-redesign/`。

---

## 9. 待生成素材汇总（供一次性排产）

| 编号 | 素材 | 规格 | 用途 |
|---|---|---|---|
| S1 | 深空城堡延展景 | 2560×1440 cover | E1 letterbox 背景 |
| S2 | 羊皮纸纹理 | 1024×1024 平铺 | 工程目录藏宝图皮肤 |
| S3 | 引擎面板框 | 512×512 透明 | 设置引擎机房 |
| S4 | 望远镜目镜环 | 256×256 透明 | 浏览器观测站 |
| S5 | 金库转盘锁 | 256×256 透明 | 任务授权 |
| S6-S11 | §3 六组图标 | 见 §3 | 全窗图标补足 |
| S12-S24 | 13 头像 | 256×256 透明 | chat-room 文档 §3 |
| S25+ | 黑猫姿态集 6 帧 | 256×256 透明 | 总文档 §9.3 |

> 延展景 S1 与 §7 E1 是 P0 见效最快项，建议优先生成。提示词后缀统一沿用各主题文档既定风格词。

---

## 10. 飞船舱窗口逐项差距（折叠场景 vs 设计整景图）

> 依据：当前折叠态实测（附图①，纯 CSS 手搓）对照设计整景图（附图②，§9.4 v2 提示词产出，已达可用）。
> 已核实（preview eval）：`.bridge-viewport` 背景为纯渐变，`usesGeneratedImage=false`——**零生成图，100% 手搓 CSS**。
> shell 在 1920×1080 下 `fillsViewport=true`（无布局 bug，小图是 preview dpr 1.5 缩放假象）。

### 10.1 组件级差距

| 组件 | 设计图（目标） | 当前实测（手搓 CSS） | 差距根因 |
|---|---|---|---|
| 行星 | 立体带土星环红行星 + 表面纹理 + 绿条纹行星 + 多颗小行星 | 平涂红圆+3 白点（radial-gradient）、平涂绿条纹圆 | 渐变无法表现球体光照/环/质感；缺小行星 |
| 银河 | 紫青螺旋星系（细密星尘旋臂） | 无（仅几颗十字星 + 一道斜向微光） | 缺银河素材层 |
| 黑洞 | 多层橙金吸积盘 + 紫边引力透镜 + 黑核 | 黑圆 + 单段 conic 橙弧（半透明） | conic 单层无盘体积/分层 |
| 控制台环 | 环形台体嵌数十块发光仪表屏（雷达/波形/图表）+ 成排彩色按钮 | 一条深色弧形带 + 青色竖纹 repeating-gradient | 无屏幕/按钮细节，纯纹理填充 |
| 全息桌台 | 大型多层圆形金属桌台 + 发光同心环 + 边缘灯带 | 扁椭圆 + 微弱同心环 + 2px 金边 | 体量偏小、无金属层次、无灯带 |
| 全息地球 | 大型青色线框地球 + 经纬网格 + 多条轨道环 + 光锥 | 小圆 + 十字两线"经纬" + 微弱光锥三角 | 仅两条线无球网格感，尺寸过小 |
| 座椅 | 2 把高背科幻椅（深蓝金边，朝向桌台） | 无（用 4 个旧 office 机器人站姿顶替） | 缺座椅素材；角色错位站在台面 |
| 立柱/装饰 | 左右金属立柱 + 挂灯笼 + ? 块 + 台阶星徽 | 无 | 缺结构层素材 |
| 地面 | 红毯 + 金边几何纹 | 无（深色平底） | 缺地面层 |
| 整体 | 第一人称舱内纵深透视，元素分层有序 | 平面正视、元素零散漂浮 | 无纵深/层次，各元素各自为政 |

### 10.2 根因（一句话）
**飞船舱是 100% 手搓 CSS 渐变拼贴——正是 `spaceship-bridge-assets-prompts.md` 开篇明令避免的路线。**
设计整景图（附图②）已达可用质量，却**未入库、未使用**。

### 10.3 补足方案（两步，接 spaceship 文档 §6.2）
1. **立即（零代码见效）**：把附图②烘焙为 `assets/ui-redesign/bridge/bridge-scene.png`，
   设为 `.bridge-viewport`（或 `.starship-bridge`）背景图 `object-fit:cover`，**移除/隐藏手搓的
   `.bridge-planet/.bridge-black-hole/.bridge-holo-*/.bridge-console-ring/.bridge-window-rim` 等 span**
   （保留 `office-*` 数据钩子：HUD/activity/robots）。观感立刻对齐设计图。
2. **渐进（分层动效）**：按 `spaceship-bridge-assets-prompts.md` §四组装蓝图，把以下做成叠加透明层：
   - 全息地球 8 帧自转（§10 组件）叠在桌台中心锚点；
   - 吸积盘旋转 / 行星浮动（透明 PNG 各一，CSS rotate/translate）；
   - 鼠标视差（远层星野/银河反向小位移）；
   - 机器人船员（office 数据钩子）叠到**座椅锚点**而非台面（修正当前"站错位"）。
3. **约束**：背景图 `cover` 不可 `100% 100%`（契约 §1.4）；动效一次性/区间触发；reduced-motion 降级。

---

## 11. 全局根因分层（为何各窗与设计图都有差距）

> 本轮跑通 web-console + 查代码后的总判断：**差距主因是"实现进度"，不是"方案缺失"。**
> 设计已成体系（4 份文档），但实现停在"骨架 + 王座"阶段，三层均大面积未落地。

### A. 代码层（设计系统 specced-but-not-coded）
- **§2 金属/镜面/宝石/3D 工具类完全未实现**：grep `--metal-gold / --metal-steel / --specular /
  .specular-sweep / .lift-3d / .metal-card / --gem-*` = **0 命中**。
  → 这是全局差距 G1/G2/G3（窗框/标题/按钮无金属质感）的**直接根因**：所有窗口仍套旧扁平
  `.window-panel`/`.pixel-button`，金属设计只活在文档里。
- **飞船舱用手搓 CSS 而非生成图**（§10）。
- 已落地的：✅ 王座 banner 烘焙图 + 黑猫帧（`brand-banner-image` object-fit:cover、`throne-cat`/
  `throne-cat-frame` 锚点+帧在）；✅ 页眉 Dock + 滑动切换 v2；✅ 16:9 等比缩放契约（`body.ui-3d .shell`
  styles.css:6667，shell fillsViewport=true）。
- **判断**：文档（意图）远超代码（实现），P1/P2 绝大部分未动 → "看着差很多" = 实现进度差。

### B. 素材层（图片未生产）
- 关键素材尚未入库：延展景 S1、飞船整景（附图②**现已可入库**）、各窗主题纹理 S2-S5、
  图标组 S6-11、头像 S12-24、黑猫姿态集、座椅/立柱组件。
- 无素材 → 即便代码就绪也只能 CSS 占位 → 观感差（飞船舱即典型）。
- **可立即动作**：附图② + 早前王座图已达标，应先入库消化。

### C. 动效层（几乎空白）
- 现有动效：仅窗口滑动切换（v2）+ 黑猫帧轮播 +（可能的）王座宝石闪。
- 设计意图动效（§5 各窗标志动效 / 全息地球自转 / 吸积盘旋转 / 视差 / 镜面扫光 / 状态脉冲）
  **基本未实现**。
- 根因：动效依赖 B 层序列帧素材 + A 层 CSS 工具类，二者都未就绪；叠加 v1 翻转 BUG 教训 → 动效推进保守。

### 收敛路径（不需新方案，按既有文档推进即可）
1. **A 层先行（半天，纯 CSS、零素材）**：落 §2 设计令牌 + 三工具类，批量套窗框/标题/按钮
   → G1/G2/G3 一次性消除，10 窗立刻"金属化"。
2. **B 层并行**：先入库附图②（飞船背景）+ 延展景 S1 → 飞船舱与边缘 letterbox 当天提升。
3. **C 层渐进**：素材到位后按 §5/§10 逐窗加标志动效。
> 即：**先 A（CSS 设计系统）+ 飞船背景图烘焙，是投入产出比最高的两步**，能让整体观感最快逼近设计图。
---

## 12. 完成度复核（2026-06-13 晚，跑 web-console + 查实时代码/素材取证）

> 重要：本文件 §1-§11 与另两份设计文档**已部分过时**——期间发生大量实现，许多"待办"已完成。
> 以下为**实时取证**的真实完成度（grep 实时文件 + preview eval + 素材目录清点）。

### 已完成（DONE，勿重复做）
| 项 | 证据 |
|---|---|
| 16:9 等比缩放契约 | preview eval `shellFills=true`（1280×720/1920 均填满） |
| 王座 banner + 黑猫 | `throne-banner-v3-baked.png` 接线、`throne-cat`/帧在 |
| 顶卡边框/图标素材 | `top-agent-card-frame/top-task-card-frame/top-*-icon` 已生成 |
| **飞船舱整景图** | `bridge-scene.png`(2.6MB) 已接线 styles.css:6422，**手搓 span 已从 DOM 删除**（eval `无该元素`） |
| **10 窗主题** | 全部挂 `data-window-theme`（treasure-map/engine-room/communication-bay/observatory/crystal-hall/reactor-console/vault-access/crystal-archive/radar-bay/maintenance-bay），且有真实皮肤（reactor 面板 radial-gradient 实测） |
| **头像功能闭环** | 后端 avatar 字段（main.rs 73 处）+ `avatar-picker`(九宫格，eval 13 选项)+ `chip-channel` + `signal-wave` 均落地 |
| **13 张头像素材 + manifest** | `assets/avatars/` 全齐 |
| 页眉 Dock + 滑动切换 v2 | 已上线 |

### 仍是缺口（真实剩余）
| 缺口 | 现状 | 性质 |
|---|---|---|
| **G1/G2/G3 金属质感框架** | 窗框=2.67px 青光边（eval），**非**设计图的金边厚框+铆钉+3D 键 | §2 金属令牌系统（`--metal-gold/.specular-sweep/.lift-3d/.metal-card/--gem-*`）**grep 0 命中，未实现** ← 与设计图最大视觉差 |
| **头像未上身** | 功能+素材+选择器全有，但 `sessionsWithAvatar=[]`（无会话配过头像）→ 消息/roster 仍回退通用图 | 数据/配置缺口，非代码 |
| **签名动效层** | signal-wave/黑猫帧/滑动已有；飞船全息地球自转+视差、reactor 脉冲、radar 扫描、vault 转盘等 | 多为未实现/部分 |
| §4 桌宠加冕联动 | 跨进程（tauri-shell + pet-mini），本轮未见实现 | 较大，独立项 |
| §7 边缘 E1/E3 | body 仍纯渐变（letterbox 延展景未做）、无全局底栏 | 非 16:9 视口才显，优先级低 |

### 下一步重点（按 ROI 排序）
1. **【P0·最高 ROI】§2 金属质感 3D 框架系统**：实现 `--metal-gold/--metal-steel/--specular/--bevel/--gem-*`
   令牌 + `.metal-card/.specular-sweep/.lift-3d` 工具类，批量套 `.window-panel` 框 / `.window-panel-head` 铭牌 /
   `.pixel-button`·`.mini-button` / 顶部三卡。**纯 CSS、零素材、一次套全窗**——这是当前与设计图差距的主因，
   补上后整体"控制中心金属感"立现。各窗主题皮肤已就绪，金属框是缺的最后一层外壳。
2. **【P1】头像上身闭环**：给 mario-demo/agnes-* 等会话**默认分配头像**（写入 sqlite avatar 字段或前端首配引导），
   验证消息/roster/发送目标三处渲染配置头像（功能已通，差"配数据 + 看一眼"）。
3. **【P1】签名动效补全**：飞船 `bridge-scene.png` 上叠**全息地球自转 + 鼠标视差**（透明层）；
   各窗标志动效（reactor 脉冲/radar 扫描/vault 转盘/crystal 旋转）逐窗补。
4. **【P2】文档对账**：把本 §12 的 DONE 项回填 `ui-redesign-throne-metal` §8 路线图与 `chat-room` §2.6，
   标记已完成，避免后续照旧文档重做飞船/主题/头像。
5. **【P2】§4 桌宠加冕 + §7 边缘**：独立较大项，排在视觉主体完成之后。

> 一句话：**主体骨架 + 王座 + 飞船图 + 10 窗主题 + 头像功能均已落地（约 75%）；
> 与设计图最后的硬差距是「金属质感 3D 框架（G1/G2/G3）」这层外壳——纯 CSS、一次套全窗，应作为下一步首要工作。**

## 13. P0-P2 落地复核（2026-06-14）

- [x] **P0 金属 3D 框架系统**：在 `.ui-redesign` 建立 `--metal-*`、`--bevel-*`、`--gem-*` 令牌；
  `.metal-card` / `.metal-titleplate` / `.metal-button` / `.specular-sweep` / `.lift-3d` 与实际顶部卡片、
  Window Dock、全局状态栏、十个 `.window-panel` 共用同一套外框、铭牌和按压深度。实现只叠加视觉层，未改变
  1920×1080 几何契约。
- [x] **P1 头像数据闭环**：demo seed 与未显式指定头像的新会话从
  `assets/avatars/manifest.json` 按顺序取得默认头像；既有 `avatar` 白名单、sqlite 持久化、九宫格选择器继续复用。
  真实会话 `test5` 已持久化为 `robot-gold.png`，浏览器实测设置预览、CHANNEL LINK roster、历史消息三处同步。
- [x] **P1 签名动效层**：折叠舰桥在 `is-folded` 期间启用 `bridgeSceneDrift` 轻微视差；十窗在切换为 active 时
  播放一次 `windowSignatureSweep`，并保留 reactor、radar、crystal、maintenance 等主题动效。全部接入
  `prefers-reduced-motion` 降级，不对历史内容循环重放。
- [x] **P2 文档对账**：本文件与总设计、聊天室头像方案同步当前实现状态和验证证据。

验证截图：
- `output/ui-redesign-verification/2026-06-14-p0-p2/settings-metal-avatar-1920.png`
- `output/ui-redesign-verification/2026-06-14-p0-p2/chat-metal-avatar-1920.png`
- `output/ui-redesign-verification/2026-06-14-p0-p2/folded-bridge-metal-1920.png`

## 14. G7 顶部双卡仪表化（2026-06-14）

- [x] **Agent 总览卡**：复用会话头像素材作为左侧视觉主体；健康度直接由 `/api/agents` 的
  `selectable/enabled/api_key_status/active_agent_ids` 聚合，不增加诊断接口或平行状态源。健康条按
  good/warn/critical 三态着色，并继续保留 ShowUI 生命周期开关、聊天室数量、Goal roles 与视觉模型选择。
- [x] **任务卡片**：从当前 `collectTaskTodoItems()` 统一聚合 Running/Queued/Completed/Failed 四态与
  Success Rate；当前任务标题、进度、todo、工具审批和计划仍使用原数据链，任务链按钮继续作为详情入口。
- [x] **几何与溢出验证**：1920×1080 实测左右卡均为 `432×286`，两卡 `scrollHeight == clientHeight`
  且无横向溢出。2026-06-14 根据实机反馈将顶部三栏收敛为 22.5% / 55% / 22.5%，列间距归零，
  三栏总宽恰好 1920px，不再透出浅蓝底图层。
- [x] **真实状态验证**：实测 Agent Health=`9/9 ready · 1 active`；当前 UI-DETR 资源异常被统一映射为
  Failed=1、Success Rate=0%，证明状态来自运行数据而非静态装饰。

验证截图：
- `output/ui-redesign-verification/2026-06-14-top-cards-g7-1920.png`

## 15. 金属外框与六组图标复核修正（2026-06-14）

- [x] **重复金边根因已修正**：截图中的多层金边来自基础 `border/outline`、`ui-3d` inset 边、顶卡
  `::before` 内框、v5 `0 0 0 4/6px` 外圈同时叠加。已收敛为主容器统一使用
  `--metal-frame-outer`，标题条/按钮使用 `--metal-frame-inner`，顶卡伪元素只保留铆钉点，不再画第二层内框。
- [x] **六组专用图标已补齐并归档**：新增 image-gen sprite 源
  `assets/ui-redesign/icon-groups-v2-sheet.png`，裁切入库 12 张透明 PNG：
  `git-modified/git-added/git-deleted/git-untracked`、`media-audio-wave/media-video-film`、
  `permission-shield-lock/permission-unlock/permission-vault-dial`、`vision-crosshair`、
  `diagnostic-spark/diagnostic-pressure-gauge`。
- [x] **接线范围**：Dock 与十窗主题主图标改用高辨识资产；工程目录节点预留文件类型与 git 状态角标；
  多媒体筛选和媒体库按 image/audio/video 使用独立图标；任务授权卡使用金库盘与解锁态；视觉 Locate 使用准星；
  诊断健康卡使用压力表，warn/error 行使用状态图标。
- [x] **验证**：新增 `web_frontend_primary_metal_frames_do_not_stack_gold_rings` 与
  `web_frontend_special_icon_groups_have_generated_asset_coverage` 回归测试；12 张新图标透明四角为真且 `green_leak=0`。

### 15.1 内部金边降噪复核（2026-06-14）
- [x] **同窗多重金边收敛**：保留顶卡、Dock、全局状态栏、十窗 `.window-panel` 的唯一主金属外框；
  通信舱标题条、消息区、composer、头像弹层等内部子区域统一使用 `--metal-edge-muted` /
  `--metal-edge-accent` 弱边线，避免同一窗口内出现多层金色主框叠加。
- [x] **顶部卡片内框降噪**：`.top-status-card .compact-card-head` 不再套内层金属框，只保留标题文字、
  状态内容和外层金属边框，减少“卡片里又一张卡片”的贴图感。
- [x] **静态 icon 引用扫描**：修复 `robot.png`、`tool-check.png` 两个不存在资产引用；
  当前 HTML/CSS/JS 静态 `assets/icons/*.png` 引用扫描为 `missing=0`。
- [x] **回归测试**：新增 `web_frontend_nested_surfaces_use_muted_edges_not_primary_gold_frames` 与
  `web_frontend_known_static_icon_references_resolve_to_assets`，配合既有图标覆盖测试防止边框和破图回退。

## 16. 十窗逐项动效与顶部无缝布局（2026-06-14）

- [x] **统一状态协议**：新增 `setWorkbenchMotionState` / `pulseWorkbenchMotionState`，由
  `data-motion-state` 作为功能状态与视觉动效之间的唯一契约，避免在业务请求中散落 CSS 类名和计时器。
- [x] **十窗真实状态联动**：工程目录=`mapping`、设置=`engine-save`、聊天室=`transmitting`、
  浏览器=`observing`、多媒体=`playing`、终端=`reactor-run`、任务授权=`unlocked`、
  记忆知识=`crystal-rise`、视觉实验=`scanning`、诊断日志=`repair-scan`。动效分别由目录加载/展开、
  会话保存、模型流式回复、浏览器导航、音视频播放、PowerShell 执行、完全访问状态、记忆置顶、
  实时视觉循环和健康检查触发，不再无条件常驻播放。
- [x] **减少动态效果**：十窗状态动效、窗口切换扫光和舰桥视差统一接入
  `prefers-reduced-motion: reduce`，禁用动画时不影响任何功能状态。
- [x] **顶部无缝三栏**：A/B/C 顶栏采用 `22.5% / 55% / 22.5%` 与 `0px` gap；浏览器实测
  总览→王座与王座→任务两处边界差均为 `0px`，三列宽度合计 `1920px`。
- [x] **逐窗浏览器验收**：十窗均以 `1896×641` 可见区域加载，主题契约完整、损坏图片为 0；
  截图归档于 `output/ui-redesign-verification/2026-06-14-ten-window-motion/`。

关键截图：
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/top-region-seam-free-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-project-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-settings-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-chat-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-browser-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-media-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-terminal-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-tasks-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-memory-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-vision-1920.png`
- `output/ui-redesign-verification/2026-06-14-ten-window-motion/window-logs-1920.png`

## 17. 王座安全构图与桌宠加冕闭环（2026-06-14）

- [x] **王座原生安全构图**：以旧王座图作为 Image Gen 编辑参考，生成
  `throne-banner-v6-wide-sword.png`。中央王座与牌匾重新加宽，恢复王座左侧独立仪仗宝剑；两名金甲侍卫
  保持双手压剑、剑尖朝地并位于牌匾与侧卡之间。素材按原生 3:1 母版使用 `object-fit: contain`，不拉伸、
  不手绘补边、不裁王冠/牌匾/剑尖。
- [x] **顶部蓝缝与比例**：顶部区域从 `y=0` 起排版，三栏使用
  `23.75% / 52.5% / 23.75%`、`gap=0`，消除外层浅蓝底图缝隙。
- [x] **黑猫独立图层**：锚点更新为 `x=66%, y=43%`，位于牌匾右上及王座右扶手外侧；加冕事件触发
  `throneCatYield` 让位，主图中不烘焙猫。
- [x] **跨进程加冕代码闭环**：Web Console 根据 `.brand-banner` 实际 DOM rect、CSS 锚点和 DPR 上报
  `report_throne_zone`；Tauri shell 在原生拖拽释放后按桌宠窗口中心命中落座区，吸附到座位、切换持久
  `crowned` 状态并发送 `pet-throne`；拖离后恢复 idle 和黑猫常态。无屏幕分辨率硬编码。
- [x] **独立加冕动作帧**：以现有橙白 CRT 桌宠为角色参考，通过 Image Gen 生成 4×2 八帧加冕母图，
  拆分为 `crowned-0.png` 至 `crowned-7.png`。八帧统一为 256×256 透明画布、主主体中心 x=128、
  基线 y=216；皇冠落下序列只播放一次，随后仅循环 6/7 两张王座待机帧，不再复用 `success` 动作。
- [x] **自动回归**：桌面壳 `33/33`、Web Console `497/497` 通过；运行时单实例命令实测已显示独立皇冠王座帧。
- [ ] **真实拖放录屏**：新版 Tauri shell 重启后，录制“拖入王座→吸附/猫让位→拖离恢复”一次人工视觉验收。

验证截图：
- `output/ui-redesign-verification/2026-06-14-throne-v5/throne-v6-wide-sword-1920x1080.png`
- `output/pet-crowned-frames/crowned-frames-preview.png`
- `output/pet-crowned-frames/crowned-live-runtime-closeup.png`

至此，截图中曾列出的 G5/G7 顶卡内容、六组专用图标、E1 letterbox、十窗主题与签名动效均已落地；
真实剩余项收敛为桌宠加冕的最终录屏验收，不再把旧章节中的已完成项视为开发缺口。

---

## 13. 完成度二次复核（2026-06-14，基于最新代码）

> 结论先行：**本文件 §1/§12 已大幅过时**。两轮之间用户高速实现，§12 列为"P0 缺口"的金属系统、
> 签名动效、全局底栏均已落地。当前文档化视觉愿景**完成度约 90%**。grep 实时 styles.css/index.html 取证。

### 自 §12 以来新增完成（DONE）
| 项 | 证据（实时代码） |
|---|---|
| **§2 金属设计令牌系统** | styles.css:7890+ `--metal-gold/-light/-dark`、`--metal-steel*`、`--bevel-*`、`--gem-red/blue` 全定义 |
| **G1 金属窗框 + 四角铆钉** | `.workbench-window[data-window-theme] > .window-panel` 2px 金边 + 四角 radial-gradient 铆钉 + bevel（7931-7941），**10 窗全覆盖** |
| **G2 金属铭牌标题** | `.window-panel-head/.panel-title/.compact-card-head` 拉丝+bevel 铭牌（7943-7955） |
| **顶卡/Dock/底栏金属化** | `.top-status-card/.window-dock/.global-system-bar` 套金边+frame-shell（7922-7929） |
| **G3 镜面/浮起** | `.specular-sweep`(8015)+`.lift-3d`(8028)+`dockSpecularSweep`/`windowSignatureSweep` 已定义 |
| **E3 全局底栏** | index.html:903 `<footer class="global-system-bar">` 在 DOM 且金属化（=设计图底部状态栏 + 上轮 E3 缺口） |
| **签名动效层（19 具名 keyframes）** | 每窗一个：`treasureRouteTrace/enginePistonCycle/communicationSignalPulse/observatoryReticleSweep/crystalDiscSpin/reactorCorePulse/vaultDialUnlock/memoryCrystalRise/radarEvidenceSweep/maintenanceSpark` + `bridgeSceneDrift`(飞船视差)+`holoMessageScan`+`throneCatYield`+`winSlideFromLeft/Right` |
| **头像功能闭环** | chat-room §5 标注完成 + 3 回归测试；`avatarForSession/avatarForAuthor` + manifest 默认 + demo seed |
| **飞船舱整景图** | `bridge-scene.png` 接线，手搓 span 已删（§10/§12 证） |

### 仍开放（真实剩余，约 10%）
| 项 | 状态 | 优先级 |
|---|---|---|
| §4 桌宠加冕联动（跨进程） | `pet-throne` 仅 3 处 + web 侧 `throneCatYield` 有；tauri-shell pet 窗握手/吸附/落冠**疑未完成** | 中（独立大项） |
| §7 E1 letterbox 延展景 | grep `延展景/stage-curtain`=0，body 疑仍纯渐变（非 16:9 视口才显） | 低 |
| §3 自定义图标组（文件类型/git/媒体/锁/动作/诊断） | 未见专用图标素材接线，疑仍通用图标 | 低-中 |
| G5 状态可视化 / G7 顶卡内容 | 金属框已套，但"红黄绿状态点+成功率条+左卡立绘"等内容级补足程度待核 | 中 |
| 头像"上身"数据 | 功能通；demo seed 已配默认头像，真实会话需各自选配（chat-room §5 称 test5 已验证） | 低（数据） |
| 各窗内容功能（IDE 搜索/Diff 着色等） | 属 `ide-project-window-plan`，非本视觉文档范围 | 独立 |

### 三份文档现状（需对账）
- `chat-room-ui-avatar-plan`：**已自更新** §5 实施状态（2026-06-14）标完成 + 测试 ✓，最准。
- `ui-redesign-throne-metal` §8 路线图：**滞后**——P1a 金属系统/P2b 六窗动效/§6 飞船图均已完成，仍标待办。
- 本文件 §1/§12：**滞后**——G1/G2/G3 与签名动效已 DONE（本 §13 修正）。

### 建议下一步（剩余 10% 按 ROI）
1. **桌宠加冕联动（§4）**：唯一较大未完项，web 侧 throneCatYield 已备，补 tauri-shell pet 窗 rect 命中→吸附→落冠握手。
2. **顶卡内容级补足（G5/G7）**：左卡机器人立绘+健康条、右卡状态点+成功率条（金属外壳已就位，填内容即可）。
3. **文档对账**：把 `ui-redesign-throne-metal` §8 路线图与本文件 §1 的 G1/G2/G3 标记为已完成，避免重做。
4. （低）E1 延展景背景图、§3 自定义图标组。

## 18. 飞船舱船员层与侠客桌宠替换（2026-06-16）

- [x] **飞船舱去机器人化**：通过 Image Gen 生成 1 名 Commander + 5 名星际宇航员船员母版，
  入库为 `assets/ui-redesign/bridge/crew-*.png`。`/api/office/scene` 返回 6 个 crew：
  Commander / Pilot / Operations / Memory / Envoy / Security；前端按 `--x/--y` 绝对锚点摆到舰桥座位，
  不再使用 `office-robot-sprites.png`、通用机器人头像或底部 flex 队列。
- [x] **飞船舱动效**：船员状态继续跟随 active/chatting/archiving/waiting/warning，点击 crew 可跳转对应窗口；
  CSS 保持 `prefers-reduced-motion` 兼容，舰桥视差与状态动效仍由已有 motion matrix 管控。
- [x] **新侠客桌宠素材**：以用户提供的 Q 版古装侠客为参考，通过 Image Gen 生成银白主色、金属盔甲高光、
  腰带 `ZP` 标识的基础状态、御剑飞行、侧卧睡眠、剑术攻击、加冕坐姿母版。切帧后写入
  `modules/gui-desktop/packages/tauri-shell/ui/assets/pet-actions/`，旧素材备份在
  `output/pet-actions-backup/2026-06-16-before-wuxia/`。
- [x] **动作语义收敛**：拖拽态从 `superman-fly` 改为 `sword-flight`；移除跳舞/拳击状态、菜单入口和随机空闲触发；
  模型回复与工具执行的泛 `chat/llm/tool` 活动映射到 `perform_martial` 剑术攻击帧，完成/失败仍走
  success/warning。
- [x] **帧质量验证**：所有新桌宠帧归一到 256×256、主连通中心 x≈128、桌宠基线 y=216；裁边检测通过。
  预览图：`output/pet-wuxia-frames/2026-06-16/wuxia-pet-frames-preview.png`、
  `output/pet-wuxia-frames/2026-06-16/bridge-crew-preview.png`。
- [x] **自动回归**：桌面壳 `33/33`、Web Console `501/501` 通过。
