# 2026-06-11 马里奥 3D UI 重设计（SVG + Three.js）

## 备份
- `tmp/backups/web-ui-mario3d-20260611-pre/`（index.html 59KB / app.js 402KB / styles.css 122KB）。
- 回退方式：还原三件套 + 删 `assets/bridge3d.js`、`assets/vendor/three.*`，或仅去掉 `<body class="ui-3d">`（CSS 层失效）。

## 架构（零破坏覆盖层）
- **body.ui-3d CSS 覆盖层**（styles.css 追加）：所有新样式带 ui-3d 前缀，原样式为基底；app.js **零改动**
  （保留全部 data-role / data-window-target / data-bind 钩子）。
- **assets/bridge3d.js**（运行时读盘，免编译迭代）：A) Three.js 舰桥场景；B) 窗口 3D 切换引擎。两块独立防御式初始化。
- **Three.js 0.184** 本地化：`assets/vendor/three.module.min.js + three.core.min.js`（npm pack + tar 解包；
  npm install 在本环境静默失败）。

## 落地内容
1. **侧边栏 → 页眉标签**：`.layout-workbench` 改 rows[40px,1fr]，window-dock 横排 flex（icon 20px + 标题 12px），
   hover 3D 抬升（translateZ+rotateX）、active 金光脉冲（ui3dActivePulse）。窗口区因此满宽。
2. **"COOLZHU CODE" logo 中心视觉不变**（brand-banner 未动）。
3. **窗口 3D 切换**：
   - 点击标签：MutationObserver 监听 is-active → `win3d-enter-left/right`（perspective 1500px、rotateY ±26°、
     translateZ -340px、blur 7px → 回弹 2.2° → 落定，560ms cubic-bezier）；方向按标签顺序差。
   - **长按拖动**：空白处按住 320ms（交互元素/移动>10px 取消）→ 抓取模式：窗口跟手 3D 倾斜
     （rotateY 0.045°/px + translateZ 下沉 + 亮度衰减），底部浮层显示 ◀上一个/当前/下一个▶（方向高亮），
     拖过 90px 释放即切（轮播循环），不足回弹（240ms spring）。ESC/失焦取消。
4. **办公室 → USS COOLZHU 舰桥**：
   - Three.js 舷窗外宇宙：2600 星空壳 + 2200 粒子银河带 + 蘑菇红行星(金环)/水管绿行星（马里奥配色，
     浮动+自转）+ 黑洞（黑核+CanvasTexture 渐变吸积盘旋转+光晕脉动）。
   - **中央全息地球**：双层 wireframe 球（外层正转 0.55rad/s、内层反转干涉）+ 半透明蓝皮 + 赤道环 +
     全息光锥 + 底座金环，整体浮动呼吸。
   - SVG 舰桥框（viewBox 1200×460 拉伸适配）：金描边弧形舷窗 + 双支柱三分格 + 梯形控制台 + 4 块仪表屏 +
     左右马里奥 ? 块装饰。
   - office-* 数据钩子全保留：HUD 改胶囊（USS COOLZHU·舰桥 + 遥测计数），robots 重排为控制台前船员列队
     （点击直达窗口的交互不变），活动条胶囊化。
   - 鼠标视差相机、ResizeObserver 自适配、document.hidden 暂停、prefers-reduced-motion 静帧降级。

## 排障记录
- preview WebView 拦截网络层 ESM import（fetch 同 URL 200 + 正确 MIME 但 import 失败）→
  **fetch + Blob URL import** 绕过；three 0.18x 拆 module/core 两文件，blob base 解析不了相对 specifier →
  fetch core 先做 blob，再把 module 源码里 `./three.core.min.js` 重写为 core blob URL 后导入（双 blob 链）。
- styles.css/index.html 为编译期内联（改后须 cargo build）；assets/*.js 运行时读盘（免编热改）。

## 验证（preview 实测）
- 页眉标签 flex 渲染 ✓；canvas 1203×415 Three 接管 ✓；舰桥截图：星空/行星×2/黑洞/全息地球/SVG 框/?块/
  HUD 遥测（Agents 9/Chats 2/Memory 356）/船员列队 全部在画 ✓。
- 交互：tab 点击 `win3d-enter-left` 触发 ✓；长按 320ms `win3d-grab`=true ✓；hint 浮层 visible ✓；
  窗口跟手 transform=perspective(1400px) translateX(-84px) rotateY(...) ✓；左拖 140px 释放 settings→chat 切换 ✓。
- `cargo build` OK；双击 active 标签折叠即见舰桥（原有行为保留）。
## 2026-06-12 修正轮（用户反馈：窗口反复翻转 BUG / 滑动没做好 / 舰桥糟糕）

### 翻转 BUG 根因与修复
- 根因：v1 用 MutationObserver 监听 `.workbench-window` 的 is-active class 触发进场动画，
  而 app.js 的 setActiveWindow / 周期刷新会反复重写 class（值未变也触发 attribute mutation）
  → 动画被不断重放 = "窗口一直在翻转变动"。
- 修复（bridge3d.js v2 重写）：**废弃 class 观察**，改为「用户动作驱动」——仅在点击页眉标签 /
  长按拖动释放时显式调用 playSlideIn() 播一次；dataset.slideAnimating 防重入 + animationend/800ms 双清。

### 动画语义：翻转 → 滑动
- v1 rotateY±26° 翻转感重 → v2 `win-slide-from-left/right`：translateX(±56%) 滑入 +
  仅 ±7° 轻透视 + 70% 处 1.2% 回弹，420ms。拖动跟手系数 rotateY 0.045→0.016（滑动主导）。
- 验证（preview 实测）：**静置 3 秒 idleAnimations=0**（不再自动触发）；点击标签 during=win-slide-from-left
  → afterCleared=true（一次性）；长按拖动 grabbed ✓ / transform=translateX(-108px) rotateY(-2.4deg) ✓ /
  释放切换 settings→chat ✓。

### 舰桥回退
- index.html 恢复原 Agent Office 场景段（office-scene-shade/HUD/robots/activity 原结构）；
  bridge3d.js 删除 Three.js 场景块；three vendor 文件保留备后续组装。
- 截图确认：像素办公室 + 机器人员工 + HUD 遥测完全如原。
- 保留项：页眉标签（含金光脉冲）、滑动切换 v2、长按拖动 + 提示浮层。

### 新路线：AI 生成组件 → 代码组装
- 纯代码手搓 SVG/Three 场景质感不足（教训）。新文档
  `docs/plans/spaceship-bridge-assets-prompts.md`：15 个组件的中英文生图提示词
  （统一风格规范/负向提示/规格/序列帧要求）+ 分层组装蓝图（z-index/视差/动效/数据挂点）
  + 生成与验收流程。待用 agnes-image 生成素材后再组装舰桥 3D 动画场景。
## 2026-06-12（二）UI 升级设计总文档 + P0 全屏适配落地

### 设计总文档（主交付）
`docs/plans/ui-redesign-throne-metal-2026-06-12.md` —— 可直接进入开发的前端设计文档：
- §1 黑边诊断（.shell aspect-ratio 1672/941 锁死=根因）+ 两步技术路线 + 标签溢出修法；
- §2 金属质感设计系统：CSS 令牌（金/钢渐变、拉丝、镜面扫光、倒角、四色宝石）+ 三个工具类
  （metal-card / specular-sweep / lift-3d）+ 元素应用映射表；
- §3 Logo 区砖墙→黄金王座长椅（宝石+蘑菇扶手+红毯）：banner 生图提示词（中英）+ 文字翻车
  备选方案（空白牌匾+前端文字层）+ 集成点（throne-seat 锚点）；
- §4 桌宠×王座加冕联动技术路线：Rust 侧窗口 rect 重叠判定（扩展 stabilize 周期）→
  pet-throne 事件（near/seated/left）→ 吸附 set_position → crowned 状态+王冠 overlay 落冠动画
  → 控制台宝石齐闪呼应（复用 pet 事件总线）+ 验收三步；
- §5 十窗口创意设计表（藏宝图卷轴/引擎机房/通讯舱/观测站/水晶厅/反应堆/金库门禁/水晶库/
  雷达舱/维修舱），标注 CSS/JS 落点与素材需求（6 个纯 CSS 零素材先行）；
- §6 飞船场景两步生图策略：先整景定调（16:6 全景提示词中英）→ 选稿后回填风格词到组件文档
  分件生成；整景图可先当 office 静态背景立刻提升观感；
- §7 补充素材提示词（左右幕布柱 E1/E2、桌宠王冠 E3）；
- §8 分阶段路线图（P0→P3+，每阶段文件/工时/验收）+ 通用约束（备份/覆盖层/钩子不动/
  动画用户驱动原则/编译内联 vs 读盘热改）。

### P0 实施（用户点名"需要补齐/跟随解决"）
- styles.css ui-3d 层：`.shell` 解除比例锁（100vw/100vh, aspect-ratio:auto）+ 超宽屏(≥2:1)
  左右列上限 18%→22%；页眉标签 `flex:1 1 0 + min-width:44px + ellipsis`，≤1280px 退化纯 icon。
- 验证（preview resize 三档）：2560×1080 `noBlackBars=true` + 10 标签全可见；
  1280×800 `iconOnlyMode=true` + 无黑边；1920×1080 截图正常。CUR-UI-SCALE-001 随侧栏取消归档。
- `cargo build` OK。
## 2026-06-12（三）IDE 工程目录窗口实施方案文档
`docs/plans/ide-project-window-plan-2026-06-12.md`：
- 现状盘点（5 个 project API + 前端函数名清单 + 工具条按键现状）；
- 索引数据落工程目录 `<workspace>/.coolzhu/ide-index/`（symbols/files/meta，mtime 增量，gitignore 内）；
- 轻量 ctags 式符号提取规则（rs/js/ts/py 正则表）+ 新增 3 端点设计
  （symbol-index 构建 / symbols 模糊搜 / search-files，带打分排序与安全约束）；
- 前端：ideState 多标签模型（view tab + diff tab 共用 tabbar）、omni-search 语法
  （文件 / @函数 / :行号，跨文件跳转）、Ctrl+点击取词跳转、行号双栏 gutter（大文件行窗口加载）、
  **View/Diff 合并按钮状态机**（默认 self-diff → 右侧路径回车或树拖拽换源）；
- 8 条验收口径 + A-E 分阶段路线（A 后端索引 / B 行号跳转 / C 搜索跳转 / D 合并按钮 / E 多标签）
  + 通用约束（备份/钩子保留/编译内联/动画一次性）。
## 2026-06-13 逐窗视觉差距分析（离线对照，未开 web-console）
`docs/plans/ui-window-visual-gap-analysis-2026-06-13.md`：
- 输入：2 张设计效果图 + Pictures\截图\ 10 张窗口实测；方法纯离线对照。
- 校准口径：效果图是"多窗同屏高密度仪表盘"，实现是"单窗+Window Dock+折叠看场景"（v3 契约），
  分歧刻意——只迁移「比例/留白·组件icon·图像动画」三类，不照搬同屏多窗密度。
- 全局 8 差距 G1-G8（金属外框/铭牌头/3D 按钮/图标体系/状态可视化/留白密度/顶栏立绘+健康条/氛围），
  统一用总文档 §2 metal/specular/bevel 工具类批量套用。
- 逐窗（10）差距+补足：聊天室直接落 chat-room 文档（最成熟）；工程目录并入 ide-project 文档；
  其余按 §5 主题皮肤（终端反应堆/多媒体水晶/记忆水晶库/视觉雷达/诊断维修舱等）。
- 缩放回归红线 7 条：核心是**禁止改回 100vw/100vh aspect-ratio:auto 拉伸**（已被 v3 min()+16:9 覆盖，
  styles.css:6667）、禁 background-size:100% 100%、禁子窗反向撑大、禁重建左侧竖窗栏、三栏比例锁 22.5/52.5/22.5。
- 边缘未覆盖根因 E1-E5：核心是缩放契约只管"16:9 画布内部"，**画布外 letterbox（延展景未实现，
  grep 证实 body 仅纯渐变）+ 画布缘装饰（仅 4px 平线无金属框）+ 无全局底栏**三层未覆盖；
  E1 延展景素材 + E2 金属外框 + E3 全局底栏(RUN/VOICE/READ/SCREEN/STOP) 为 P0 补足。
- 素材排产表 S1-S25+（延展景/纹理/图标组/头像/黑猫），S1 延展景 P0 优先。