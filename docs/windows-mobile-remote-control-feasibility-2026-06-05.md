# Windows 手机远程控制 —— 可实施性分析（2026-06-05）

> 需求：手机控制本机 Windows（remotedesk 形态）。用户倾向：**(A) Android app + 内网穿透**，或 **(B) 利用现存聊天软件 MCP/CLI 接入**。

## 一、关键结论先行
**可实施性高**。当前项目**已具备远程控制的全部"执行引擎"**，缺的只是"手机端前端 + 网络通道"：
- **看屏**：`/api/vision/describe-screen`（截屏 + 视觉模型描述）、`/api/vision/realtime/*`（实时感知/元素表）。
- **定位**：`/api/vision/find-target`、`/api/vision/locate`、`tool-service/ground-point|ground-bbox|ocr`。
- **操作**：`computer-use-core`（`MouseActionKind`、`RelativeAnchor`、`anchor_to_physical_pixel` 分辨率映射）+ 键盘输入。
- **安全**：默认 `execute=false` + 人工确认 + screenshot evidence（安全点击护栏，已内建）。

即手机端本质是 **web-console（:8765）的一个远程客户端**——所有控制能力已是 HTTP API。问题收敛为**怎么把 :8765 安全地暴露给手机**。

## 二、方案 A：Android 客户端 + 内网穿透（推荐，最快落地）

### 架构
```
[Android] --(穿透通道)--> [本机 web-console :8765 HTTP API]
   │  截屏预览(describe-screen/realtime frame)        │
   │  指令(点击/输入/locate)→ computer-use 引擎 → Windows
   └  人工确认(execute=true 才真点)
```

### 网络通道选型
| 方案 | 优 | 劣 | 推荐度 |
|---|---|---|---|
| **Tailscale**（零配置 WireGuard VPN） | 无需公网IP/端口转发；端到端加密；Android 官方 app；私有 tailnet 仅自己设备 | 依赖 Tailscale 账号/服务 | ⭐⭐⭐⭐⭐ |
| **frp/自建反代** | 完全自主可控 | 需公网服务器 + 自己做 TLS/鉴权 | ⭐⭐⭐ |
| ngrok/localtonet | 即开即用 | 公网随机域名、免费版限制、暴露面大 | ⭐⭐ |

**推荐 Tailscale**：把本机与手机加入同一 tailnet，手机直接访问 `http://<本机tailscale-ip>:8765`，无公网暴露、WireGuard 加密。

### 手机前端选型
- **最快：PWA / 移动端自适应页面**——web-console 已是 web，做一个**移动端精简视图**（截屏预览 + 点击坐标转发 + 指令输入），加进 `gui-web`，零新 app。
- **进阶：原生 Android app**——封装 WebView + 原生手势（拖拽映射到鼠标）+ 推送。工作量大，非首选。

### 落地步骤（A）
1. web-console 加 **移动端视图路由**（`/m` 或响应式）：显示 `describe-screen`/`realtime/frame` 截屏，触摸点→`locate`/`computer-use` 坐标（复用 `anchor_to_physical_pixel`）。
2. 加**远程访问鉴权**（token / 一次性配对码）——`:8765` 暴露后必须鉴权（当前可能仅本机用，需加 auth 中间件）。
3. 本机 + 手机装 Tailscale，手机浏览器开 `http://<tailnet-ip>:8765/m`。
4. 保留 `execute=false` 默认 + 手机端二次确认（安全）。

### 工作量：**中**（复用全部引擎，主要做移动端视图 + 鉴权 + Tailscale 文档）。

## 三、方案 B：聊天软件 MCP/CLI 接入（自然交互，OpenClaw 模式）

### 架构
```
[手机 Telegram] → BotFather Bot → [Bot 中间层] → web-console API → computer-use → Windows
   "帮我点开始菜单" → agent 理解 → describe-screen + locate + click
```

### 选型
- **Telegram Bot 最易**（BotFather 拿 token；Android 原生 app 成熟；支持图片回传截屏、按钮确认）。参考 TRPCC / Telegram-Remote-Desktop / OpenClaw（2026，连 Telegram/WhatsApp 跑 shell/控制）。
- 微信：无官方 bot 开放（需企业微信/第三方 hook，合规风险高），**不推荐**。
- 复用项目现有 MCP：本机起一个 **MCP server 暴露 computer-use 工具**，Bot 中间层作为 MCP client；或 Bot 直接调 web-console HTTP。

### 落地步骤（B）
1. 起一个 Bot 中间层（小服务）：收 Telegram 消息 → 调 web-console `/api/vision/*` + `/api/.../computer-use` → 截屏图回传 Telegram。
2. 自然语言指令 → 现有 agent（语义动作 `visual_action` 路由 vision agent）→ 安全点击。
3. 危险操作用 Telegram **inline 按钮二次确认**（对齐 `execute=false` 护栏）。

### 工作量：**中-高**（多一个 Bot 中间层 + 消息/图片往返 + 会话态）。优点是"对话式控制"最自然，且天然走 Telegram 的公网通道（免内网穿透）。

## 四、对比与推荐

| 维度 | A: app+穿透(Tailscale) | B: 聊天软件(Telegram) |
|---|---|---|
| 交互形态 | remotedesk（看屏+点） | 对话式（发指令+回截图） |
| 网络 | Tailscale(私有,安全) | Telegram 服务器(公网,便捷) |
| 复用现有 | web-console 全 API ✅ | API + Bot 中间层 |
| 实时性 | 高（直连截屏流） | 中（消息往返） |
| 安全面 | 私有 tailnet,小 | 经第三方,需谨慎 |
| 落地速度 | **最快**（移动视图+Tailscale） | 中 |

**推荐路线**：
- **首选 A（Tailscale + 移动端视图）**：复用全部现有引擎，仅加移动视图 + 鉴权，Tailscale 解决通道，安全且快。
- **B 作为补充**：想要"对话式遥控"再做 Telegram Bot；微信不建议（无官方开放 + 合规风险）。

## 五、安全红线（两方案通用）
1. `:8765` 一旦可远程访问，**必须加鉴权**（token/配对码 + 速率限制），否则等于把电脑控制权裸奔。
2. 保留 `execute=false` 默认 + 危险动作二次确认（现有护栏勿绕过）。
3. 聊天方案警惕第三方 skill 数据外泄（OpenClaw 已有此类安全研究警示）。
4. 内网穿透优先**私有 VPN（Tailscale）**而非公网反代，缩小暴露面。

## 来源
- [Access remote desktops using Windows RDP — Tailscale Docs](https://tailscale.com/docs/solutions/access-remote-desktops-using-windows-rdp)
- [Remotely Access PC via Tailscale + Microsoft Remote Desktop](https://najad.dev/blog/how-to-remotely-access-your-pc-from-anywhere-using-tailscale-and-microsoft-remote-desktop/)
- [TRPCC — Telegram bot PC control](https://github.com/xzripper/trpcc)
- [Self-Host OpenClaw and Access Remotely — Localtonet](https://localtonet.com/blog/how-to-self-host-openclaw)
