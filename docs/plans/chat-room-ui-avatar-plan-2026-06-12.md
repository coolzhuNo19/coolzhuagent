# 聊天室对话框 · UI 设计与会话头像配置方案

> 日期：2026-06-12
> 性质：可直接进入开发的设计文档（聊天室通讯舱视觉细化 + **每会话可配头像**功能 + 头像图片库规格）。
> 关联：`docs/plans/ui-redesign-throne-metal-2026-06-12.md` §5（聊天室=通讯舱主题的细化版）。

---

## 1. 聊天室对话框视觉设计（通讯舱主题细化）

> 2026-06-13 布局修订：设计效果图中的左侧竖向窗口栏不实施。工程目录、设置、聊天室、
> 浏览器等窗口入口已统一迁移到总体布局 D 区横向 Window Dock；聊天室 E 区只保留频道、
> 消息流、任务链抽屉、头像选择浮层和输入区。

### 1.1 布局分区（结构不动，皮肤升级）
```
┌ 窗口头：对话回复和推理 + 操作按钮组（通讯舱舱门铭牌风格：金属拉丝底+铆钉）
├ 会话标签条（roster chips）：每个会话 = 一枚「通讯频道徽章」（头像+名字+在线灯）
├ 消息流（核心区）：全息投影信风格消息卡
└ 输入条：发送目标徽章 + 附件 + 输入框（控制台麦克风台风格）+ 发送/语音
```

### 1.2 消息卡（全息投影信）规格
- **assistant 消息**：左侧头像（§2 配置的会话头像，44px 圆角方框 + 青色全息描边 +
  底部小光锥 ::after），气泡深蓝半透明 + 1px 青描边 + 顶部 2px 扫描线动画
  （一次性扫过，message 入场时播 600ms，遵守"动画用户驱动/一次性"原则）；
  作者名用会话主题色（按头像主色取，见 §2.4 配色映射）。
- **user 消息**：右对齐，金黄描边气泡（马里奥金），头像=马里奥（现状保留，亦可走 §2 配置）。
- **reasoning / tool-summary**：折叠态细条（图标+一行摘要），点击展开——皮肤换为
  「磁带记录条」：左侧小转轮 icon，展开时转轮旋转 0.4s 一次。
- **流式输出中**：气泡右下角三点光标改为「信号波纹」（三圈扩散，CSS 一次性循环仅在
  is-streaming 期间，结束即停）。
- **消息入场**：新消息 translateY(14px)+opacity 0→1（240ms，一次性）；不得对历史消息重放。

### 1.3 发送交互（信号发射）
- 点击发送：输入条向消息流方向发出一圈「信号波」（::after 圆环 scale+fade 380ms 一次）；
  发送按钮按下时 3D 下沉（translateY(1px) + 阴影收紧，现有像素按钮规范）。
- 失败重试：气泡边框转红 + 抖动 2 次（240ms）。

### 1.4 CSS 落点
- 全部走 `body.ui-3d` 覆盖层追加（chat-panel / message / .bot / .user / .attachments 选择器均已存在）；
- 新增类：`.msg-holo`（全息气泡）、`.msg-scanline`（入场扫描线）、`.signal-wave`（发送波）、
  `.chip-channel`（频道徽章）——由 `kindForMessage` / roster 渲染处追加 class，**不改动现有 class**。

---

## 2. 会话头像配置功能（核心新功能）

### 2.1 需求
每个会话对象（session/agent）可配置**独立显示头像**：聊天消息、roster 徽章、发送目标、
任务卡片等处统一生效；提供**内置头像图片库**（§3）九宫格选择；不配置则回退现状 kind 图标。

### 2.2 数据模型（后端 main.rs）
- `PersistedSession` / `AgentSessionDto` / `SessionSummaryDto` 增加字段：
  ```rust
  #[serde(default)]
  avatar: Option<String>,   // 相对路径，如 "assets/avatars/robot-gold.png"
  ```
- `UpsertSessionRequest` 增加 `avatar: Option<String>`；`update_session` 的 merge 逻辑
  照 `model_type` 同模式（Some 才覆盖；空字符串=清除回退默认）。
- sqlite：`ensure_session_column(connection, "avatar", "TEXT")` + 读写两处补列
  （照 `model_type` 列的三处样板：ensure / SELECT / INSERT-UPDATE）。
- **校验**：avatar 仅允许 `assets/avatars/` 前缀（白名单），杜绝任意路径注入。
- 默认值：`None` → 前端回退 `iconForMessage` 现状逻辑，**零破坏**。

### 2.3 前端改造点（app.js）
1. **头像解析函数**（新增，单一来源）：
   ```js
   function avatarForAuthor(author) {
     const sessions = sessionRegistry?.sessions || [];
     const hit = sessions.find(s => author?.startsWith(s.display_name) || author?.startsWith(s.name));
     return hit?.avatar || null;   // null = 回退 kind 图标
   }
   ```
2. **消息渲染**：`addMessage` / `upsertMessage` 中 portrait 的 src 改为
   `avatarForAuthor(message.author) || ./assets/icons/${iconForMessage(message)}.png`
   （两处 img.src 赋值点，搜 `iconForMessage(` 全部调用即触点清单）。
3. **会话配置 UI**（设置窗口会话区）：「头像」字段 = 当前头像缩略 + 点击弹**九宫格选择浮层**
   （data-role="avatar-picker"；扫描 §3 清单渲染网格；选中 → PATCH /api/sessions/{id}
   {avatar} → refreshState）。浮层首格为「默认」（清除配置）。
4. **roster 徽章 / 发送目标**：renderChatRoster / agent-targets 渲染处同样接 avatarForAuthor。
5. **头像库清单**：`assets/avatars/manifest.json`（数组：{file, name, theme_color}）；
   前端 fetch 渲染九宫格；theme_color 用于 §1.2 作者名配色（无则默认金）。

### 2.4 头像→主题色映射
manifest.json 每项带 `theme_color`（如金 #ffd552 / 青 #3ec6ff / 紫 #a55eea / 绿 #2ecc71 /
红 #ff5a4e），消息作者名与气泡描边随头像主题色——多 Agent 群聊一眼分清谁在说话。

### 2.5 验收
1. 设置里给 agnes-text 选「黄金指挥官」头像 → 聊天消息/roster/发送目标三处头像即时生效；
2. 重启 app 头像保留（sqlite 持久）；
3. 未配置会话显示与现状完全一致（回退 kind 图标）；
4. PATCH avatar 传非白名单路径 → 400；
5. 群聊两个会话不同头像/主题色，消息区分明显。

### 2.6 开发顺序
后端字段+校验（0.5d）→ manifest+素材落库（生图后）→ avatarForAuthor+两处渲染（0.5d）→
选择浮层（0.5d）→ roster/目标位接入+主题色（0.5d）。

---

## 3. 头像图片库（assets/avatars/，生图规格与清单）

### 3.1 统一规格
- 256×256、**透明背景**、胸像构图（头+肩，占画面 78%）、视线朝向镜头微偏左；
- 16-bit 马里奥像素风、粗深描边、单一主题色光晕；同批次光照一致（左上暖光）；
- 命名 `{theme}-{name}.png`；负向提示统一：
  `photorealistic, blurry, watermark, text, full body, busy background, soft edges`。

### 3.2 清单与提示词（中英对照；EN 统一加后缀
`16-bit Mario pixel-art style portrait bust, bold dark outline, transparent background,
single-color rim glow, head and shoulders framing, game avatar, centered`）

**机器人船员系（主推，配多 Agent）**
1. robot-gold 黄金指挥官：金色机器人，舰长帽，胸前星徽，金色光晕。
   EN: `golden robot commander wearing a captain hat, star badge on chest, golden rim glow`
2. robot-cyan 视觉观察员：青蓝机器人，单只大镜头眼，头顶小雷达，青色光晕。
   EN: `cyan robot observer with one large camera-lens eye, tiny radar dish on head, cyan rim glow`
3. robot-green 代码工程师：绿色机器人，护目镜推在额头，手持扳手露肩，绿色光晕。
   EN: `green robot engineer with goggles pushed up on forehead, wrench over shoulder, green rim glow`
4. robot-purple 记忆档案员：紫色机器人，头部水晶体，胸前数据卷轴，紫色光晕。
   EN: `purple robot archivist with crystal dome head, data scroll on chest, purple rim glow`
5. robot-red 警卫官：红色机器人，方下颌，肩甲带警示灯，红色光晕。
   EN: `red robot guard with square jaw, shoulder armor with warning light, red rim glow`

**马里奥风角色系**
6. mushroom-butler 蘑菇管家：蘑菇头戴单片眼镜打领结，奶金光晕。
   EN: `mushroom-headed butler with monocle and bow tie, cream-gold rim glow`
7. star-sprite 星星精灵：发光五角星脸蛋眯眼笑，亮黄光晕。
   EN: `glowing star sprite with squinting happy face, bright yellow rim glow`
8. turtle-mechanic 乌龟技师：绿壳乌龟戴黄色安全帽，橙色光晕。
   EN: `green-shell turtle wearing yellow hard hat, orange rim glow`

**动物系**
9. cat-black 黑猫女爵：黑色优雅猫，金项圈小铃铛，半眯慵懒眼，金紫光晕（与王座黑猫同款形象）。
   EN: `elegant black cat with golden bell collar, half-closed lazy eyes, gold-purple rim glow`
10. shiba-captain 柴犬机长：柴犬戴飞行护目镜围巾，天蓝光晕。
    EN: `shiba inu wearing aviator goggles and scarf, sky-blue rim glow`

**科幻系**
11. astronaut-pixel 像素宇航员：白色宇航服头盔反射星空，面罩半透出笑眼，冰蓝光晕。
    EN: `white spacesuit astronaut, helmet visor reflecting starfield, smiling eyes visible, ice-blue rim glow`
12. alien-jelly 果冻外星人：半透明青绿色外星人，三只圆眼，触角顶小星，薄荷光晕。
    EN: `translucent teal jelly alien with three round eyes, antenna topped with tiny star, mint rim glow`
13. ai-core AI 核心：悬浮发光立方体核心，环绕光环与电路纹，白金光晕。
    EN: `floating glowing cube AI core with orbiting ring and circuit patterns, platinum rim glow`

### 3.3 manifest.json 样例
```json
[
  { "file": "robot-gold.png", "name": "黄金指挥官", "theme_color": "#ffd552" },
  { "file": "robot-cyan.png", "name": "视觉观察员", "theme_color": "#3ec6ff" },
  { "file": "cat-black.png",  "name": "黑猫女爵",   "theme_color": "#a55eea" }
]
```

### 3.4 选片标准
轮廓干净可抠、五官在 256px 下清晰可辨、同批光照/描边一致、主题色光晕明显（供取色）。

---

## 4. 约束
- 改前备份三件套；`body.ui-3d` 覆盖层追加；现有 data-role / class 全保留；
- index.html/styles.css/app.js 编译期内联（改后 cargo build）；assets/ 运行时读盘；
- 动画一次性/用户驱动原则；reduced-motion 降级；
- avatar 路径白名单校验（仅 assets/avatars/）；manifest 不存在时头像功能整体静默隐藏（零破坏）。

## 5. 实施状态（2026-06-14）

- [x] 后端 `avatar` 字段、sqlite 列、PATCH 合并、路径白名单与清空回退已完成。
- [x] 13 张头像与 `manifest.json` 已归档；默认头像从 manifest 数据读取，不在会话业务逻辑散落文件名表。
- [x] `avatarForAuthor` / `avatarForSession` 已作为消息、CHANNEL LINK roster、发送目标的单一头像解析入口。
- [x] 设置窗口九宫格选择器、缩略预览、主题色映射已完成；未配置头像仍按 model type 回退原图标。
- [x] demo seed 与新建会话自动获得 manifest 默认头像；真实 `test5` 会话已验证 sqlite/API 持久化后，
  设置预览、roster、历史消息同时显示“黄金指挥官”。
- [x] 全息消息卡、频道徽章、信号发射台和流式扫描线已接入；动画包含 reduced-motion 降级。

对应回归测试：`session_avatar_is_persisted_and_exposed_in_summaries`、
`new_session_without_avatar_uses_manifest_default`、
`web_frontend_session_avatar_picker_drives_messages_roster_and_targets`。
