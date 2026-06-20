# 宇宙飞船控制室 · 3D 元素组件文生图提示词集

> 日期：2026-06-12
> 用途：分组件生成图片素材，后续在 web-console 中以「分层视差 + CSS/JS 动画」组合成
> 宇宙飞船控制室 3D 动画场景（替换 Agent Office 的进阶版）。
> 适配模型：agnes-image-2.1-flash / 任意文生图（中英提示词均给出）。
> 上轮教训：纯代码手搓 SVG+Three.js 场景质感不足（已回退），改走「AI 生成组件 → 代码组装动效」路线。

## 〇、统一风格规范（每条提示词都要附带）

**风格基线（中）**：16-bit 马里奥像素风与科幻太空舱的融合；深蓝夜空底色（#071827），
金黄高亮（#ffd552），霓虹青蓝辅助光（#3ec6ff）；粗黑描边、内发光、像素颗粒质感；
干净轮廓便于抠图。

**Style suffix (EN)**：
```
16-bit Super Mario pixel-art style fused with retro sci-fi spaceship aesthetics,
deep navy background (#071827), golden-yellow accents (#ffd552), neon cyan glow (#3ec6ff),
bold dark outlines, inner glow, crisp pixel clusters, clean silhouette, game asset,
high contrast, centered composition
```

**通用负向提示（EN negative）**：
```
blurry, photorealistic, 3d render, watermark, text, signature, cluttered background,
gradient banding, soft edges, anti-aliased curves
```

**输出规格建议**：单组件 1024×1024（标注比例的除外）；**主体居中、背景纯色或留空**便于抠图；
同一组件出 2–4 张备选。

---

## 一、背景层（舷窗外宇宙，多层视差）

### 1. 深空星野（最远层，可平铺）
- 中：无缝平铺的深空星野贴图，深蓝近黑底色，三档大小的像素星星（1px/2px/4px），
  少量金色与青色星点点缀，疏密自然，无星云，可四方连续平铺。
- EN: `seamless tileable deep-space starfield texture, near-black navy background, pixel stars in three sizes (1px/2px/4px), sparse golden and cyan accent stars, natural density variation, no nebula, tileable on all edges` + 风格后缀
- 规格：1024×512，平铺测试通过为准。

### 2. 银河带（中远层，横向长条）
- 中：横贯画面的像素银河带，斜向 15 度，紫粉-青蓝渐变星尘，夹杂金色亮星，
  边缘羽化成稀疏像素颗粒，透明背景。
- EN: `pixel-art milky way galaxy band crossing diagonally at 15 degrees, purple-pink to cyan gradient stardust, scattered bright golden stars, edges dissolving into sparse pixels, transparent background` + 风格后缀
- 规格：2048×768 横条，PNG 透明。

### 3. 红色蘑菇行星（中层，马里奥彩蛋）
- 中：像素风红色行星，表面纹理致敬马里奥蘑菇的白色圆斑，带一圈金黄色光环，
  右上receive青蓝色环境光，透明背景，居中。
- EN: `pixel-art red planet with white circular spots like a Mario mushroom cap, golden ring orbiting at slight tilt, cyan rim light from upper right, transparent background, centered game asset` + 风格后缀

### 4. 绿色水管行星（中层，马里奥彩蛋）
- 中：像素风绿色气态行星，表面有深绿横向条带（水管绿配色），一颗小卫星，
  透明背景，居中。
- EN: `pixel-art green gas planet with darker green horizontal bands (warp-pipe green palette), one tiny rocky moon nearby, transparent background, centered` + 风格后缀

### 5. 黑洞（中层，视觉焦点之一）
- 中：像素风黑洞，纯黑视界球心，橙金色吸积盘呈椭圆环绕（上窄下宽透视），
  盘面有旋转流动感的像素条纹，外缘紫色引力光晕，透明背景。
- EN: `pixel-art black hole, pure black event horizon sphere, orange-gold accretion disk in elliptical perspective (narrow top, wide bottom), swirling pixel streak pattern in disk, purple gravitational lensing glow at rim, transparent background` + 风格后缀

### 6. 流星/彗星（动效点缀，小件）
- 中：像素风彗星，青白色头部，金色拖尾渐隐成像素颗粒，45 度角，透明背景。
- EN: `pixel-art comet, cyan-white head, golden tail dissolving into pixel particles, 45-degree angle, transparent background, small game asset` + 风格后缀

---

## 二、控制室结构层（前景框架）

### 7. 舷窗框架（核心结构件）
- 中：宇宙飞船舰桥全景舷窗框架，弧形上沿，两根金属支柱将舷窗分成三格，
  金黄色描边 + 深蓝金属机身，边角有铆钉与马里奥问号块装饰，窗内完全透明（镂空），
  底部连接控制台台面上沿，16:6 宽幅。
- EN: `spaceship bridge panoramic window frame, arched top edge, two metal pillars dividing the viewport into three panes, golden-yellow trim on deep navy metal hull, rivets and Mario question-block ornaments at corners, window panes fully transparent (cut out), bottom edge meeting a console deck, wide 16:6 aspect` + 风格后缀
- 规格：2048×768 PNG 透明（窗格镂空是关键，生成后人工抠掉窗内）。

### 8. 主控制台台面（前景底部）
- 中：舰桥主控制台俯视前缘，梯形台面，嵌入 4-6 块发光仪表屏（青蓝底金色波形/坐标图），
  实体按钮成排（红黄绿小圆钮），左右各一个马里奥问号块开关，深蓝金属 + 金边描线，16:4 宽幅。
- EN: `spaceship bridge main console front edge, trapezoid deck, 4-6 embedded glowing instrument screens (cyan base with golden waveforms and radar charts), rows of physical round buttons (red yellow green), one Mario question-block switch on each side, navy metal with golden trim lines, wide 16:4 aspect` + 风格后缀
- 规格：2048×512 PNG 透明顶部。

### 9. 全息投影底座（中央焦点底座）
- 中：圆形全息投影底座，三层金属圆盘叠起，顶面发青蓝色光，环形金色刻度圈，
  侧面有散热格栅与小指示灯，透明背景，正面略俯视角。
- EN: `circular hologram projector base, three stacked metal discs, top surface emitting cyan light, golden tick-mark ring, side vents and tiny indicator LEDs, slight top-down front view, transparent background` + 风格后缀

### 10. 悬浮全息地球（核心动效件，序列帧）
- 中：全息投影风格的像素地球，青蓝色半透明线框球体，大陆呈亮青色像素块，
  环绕一圈金色赤道环，底部光锥渐隐，透明背景。**需要 8 帧自转序列**（每帧地球经度旋转 45 度）。
- EN: `holographic pixel-art Earth, translucent cyan wireframe sphere, continents as bright cyan pixel clusters, golden equatorial ring, light cone fading below, transparent background` + `, rotation frame X of 8, longitude rotated {45*X} degrees` + 风格后缀
- 规格：512×512 ×8 帧（或生成 1 张后由代码旋转贴图替代）。

### 11. 舰长椅（可选前景剪影）
- 中：舰桥舰长椅背面剪影，高背弧形，深蓝金边，扶手末端各一个小蘑菇装饰，
  底部单柱旋转支架，透明背景。
- EN: `spaceship captain chair seen from behind, high curved backrest silhouette, navy with golden trim, small mushroom ornament on each armrest tip, single rotating pedestal, transparent background` + 风格后缀

---

## 三、动效与状态小件

### 12. 机器人船员（复用现有 office 机器人即可，缺席时再生成）
- 中：像素机器人船员坐姿背影，面向控制台操作，橙色机身 + 屏幕脸，透明背景。
- EN: `pixel robot crew member seated facing away toward console, orange body with screen face, operating controls, transparent background` + 风格后缀

### 13. 仪表屏内容动画（序列帧，4 帧）
- 中：青蓝底仪表屏画面：金色雷达扫描线 / 波形图 / 星图坐标 / 进度条四款，
  每款 4 帧轻微变化（扫描线角度、波形相位），方形。
- EN: `sci-fi instrument screen graphics on cyan base: golden radar sweep / waveform / star chart / progress bars, 4 subtle animation frames each (sweep angle, wave phase shift), square format` + 风格后缀

### 14. 警报灯与状态灯（小件套图）
- 中：一组飞船状态指示灯：绿色正常圆灯、黄色警告三角灯、红色警报旋转灯（含发光 halo），
  每个 2 帧（亮/暗），透明背景，整齐排版于一张图。
- EN: `set of spaceship status indicator lights: green normal round lamp, yellow warning triangle, red alert rotating beacon with glow halo, 2 frames each (lit/dim), arranged in a grid sheet, transparent background` + 风格后缀

### 15. 跃迁/曲速特效（横向拉伸星线，序列帧 4 帧）
- 中：曲速跃迁特效，星星拉成水平青白色光线，中心向外辐射，4 帧渐强，透明背景，宽幅。
- EN: `warp-speed effect, stars stretched into horizontal cyan-white light streaks radiating from center, 4 frames increasing intensity, transparent background, wide format` + 风格后缀

---

## 四、组装蓝图（生成后实施参考）

```
z-index 由远及近：
 L0 深空星野(1, 平铺+极慢平移) → L1 银河带(2, 慢速平移+视差) →
 L2 行星(3/4, 上下浮动+自转贴图) / 黑洞(5, 吸积盘旋转) / 彗星(6, 间歇飞过) →
 L3 舷窗框架(7, 静态) → L4 全息底座(9)+地球(10, 8帧轮播自转+上下呼吸) →
 L5 主控制台(8, 仪表屏(13)轮播+状态灯(14)闪烁) → L6 舰长椅(11)/船员(12)
视差：鼠标移动 → L0-L2 反向小位移（远层慢、近层快）；
入场：跃迁特效(15) 播一次 → 星野淡入；
数据挂点：HUD/遥测/活动条沿用 office-* data-role 钩子（renderOfficeScene 兼容）。
```

## 五、生成与验收流程

1. 用 agnes-image 会话逐条生成（中文提示词直接发；英文为备选/其它模型用），每条出 2-4 张。
2. 选片标准：轮廓干净可抠、风格统一（描边粗细/发光强度一致）、像素颗粒大小一致。
3. 素材归档：`modules/gui-web/packages/web-console/assets/ui-redesign/bridge/`（按编号命名 01-starfield.png…）。
4. 齐 7/8/9/10 + 任一背景层即可先组装最小场景；其余渐进增强。
