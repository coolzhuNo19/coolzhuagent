# 聊天室富文本/媒体渲染分析（2026-06-04）

> 用户任务2：分析聊天室富文本渲染逻辑，是否满足"大模型回复里嵌入音频/视频/图片网络链接，能在聊天室直接显示"。

## 一、现状（代码事实）

聊天消息主渲染：`addMessage()` → `renderRichText()` → `richTextNodes()` → `appendInlineRichText()`（app.js）。
**已实现的富文本解析**（正则匹配）：
- `![alt](url)` markdown 图片
- `[text](url)` markdown 链接
- 裸 URL `https://...`
- `` `code` `` 行内代码
- `**bold**` 加粗

类型判断：`attachmentKindForUrl(url)` 按扩展名 → image / video / audio / document / null。

## 二、关键发现：两条渲染路径不对称

| 媒体类型 | 消息**正文**里的链接（`appendRichMedia`） | **附件区**（`renderAttachments`） |
| --- | --- | --- |
| 音频 | ✅ `<audio controls>` 可播放 | ✅ `<audio controls>` |
| 图片 | ❌ **只渲染成链接**（richLinkNode + class，不显示图） | ✅ `<img>` 内联预览 |
| 视频 | ❌ **只渲染成链接**（不内联播放） | ✅ `<video controls>` 内联 |
| 文档 | 链接 | 链接 |

**根因**：`appendRichMedia()` 只对 `kind === "audio"` 调 `richAudioNode()`，
image/video 都掉进 `else` 分支只加 `richLinkNode` + CSS class（`is-image`/`is-video`），不生成 `<img>`/`<video>`。
而附件区 `renderAttachments()` 对 image/video/audio **全部**有内联预览（`<img>`/`<video>`/`<audio>`）——逻辑已现成。

## 三、回答用户的问题

**"要求大模型回复发送富文本（音频/视频/图片网络链接），能在聊天室直接显示"——当前满足度：**
- ✅ **音频链接**：能直接显示播放器。
- ❌ **图片链接**：不能内联显示，只是个可点链接。
- ❌ **视频链接**：不能内联播放，只是个可点链接。

→ **部分满足。音频可以，图片/视频不行。**

## 四、修复方案（小而明确，低风险）

让 `appendRichMedia()` 对 image/video 也走内联渲染，与 `renderAttachments()` 同款：
1. 新增 `richImageNode(url, label)`：`<img loading=lazy>` + 失败回退链接（复用 renderAttachments 的 image 分支逻辑）。
2. 新增 `richVideoNode(url, label)`：`<video controls preload=metadata>` + 链接。
3. `appendRichMedia()` 改为：
   ```js
   if (kind === "audio") return appendNode(richAudioNode(...));
   if (kind === "image") return appendNode(richImageNode(...));
   if (kind === "video") return appendNode(richVideoNode(...));
   // 其余仍走 richLinkNode
   ```
4. 安全：仅对 `http/https`（必要时 blob/file）协议的 URL 内联，避免 XSS；图片加 `error` 回退为链接；视频 `preload=metadata` 不自动下载全片。
5. CSS：复用现有 `.rich-media-frame` / `.attachment-media-frame` 样式，限制最大宽高避免撑爆气泡。

### 让大模型"主动发富文本"的配套（可选增强）
- 现状：只要模型输出里包含 markdown 图片/裸媒体 URL，前端就能渲染（修复后图片/视频也行）。
- 增强：在 system prompt 里告诉模型"可用 `![](url)` 嵌图、直接贴音视频直链，前端会内联渲染"，
  引导模型主动用富文本回复（而非只给纯文本 URL）。

## 五、改动面与优先级
- 纯前端（app.js + styles.css），不动后端。改动 ~30 行 + 几条 CSS。低风险。
- 测试：现有有 `web_frontend_*` 断言富文本相关函数存在，加 image/video 内联的断言。
- 优先级 P1（用户明确要的场景，且修复成本低）。

## 六、待确认
- 图片/视频内联的**最大显示尺寸**（避免大图撑爆聊天气泡，建议 max-width 320px / max-height 240px，可点开看大图）。
- 是否允许**自动播放**视频（建议否，仅 controls 手动播）。
- 不可信外链媒体的**隐私/安全**：内联 `<img src=外链>` 会向第三方发请求暴露 IP；是否需要"点击后才加载"的懒加载确认（默认 lazy 已减轻）。
