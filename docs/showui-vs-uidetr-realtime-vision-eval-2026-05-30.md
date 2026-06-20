# ShowUI vs UI-DETR-1 视觉能力评估 + 实时桌面交互方案（2026-05-30）

> 任务14：对比 ShowUI 与 UI-DETR-1 的视觉能力差异，评估 UI-DETR-1 能否替代 ShowUI 并满足
> 实时桌面/游戏窗口内交互（UI-DETR-1 / VLA + 推理大模型 + 实时语音）。

## 一、当前 coolzhu 的视觉现状（代码事实）
- 默认本地视觉模型：`DEFAULT_LOCAL_VISION_MODEL = "showui-2b"`（`vision-service/src/lib.rs:18`）。
- 调用形态：`build_showui_grounding_request` → 本地 OpenAI 兼容端点（LM Studio 风格 `/v1/chat/completions`）→ `parse_grounding_result` 解析出 point/bbox/confidence。
- 用途：把"自然语言目标"→ 屏幕坐标（grounding），供 compute-use 点击。**按需单帧调用**，非高帧率循环。
- 另有 UIA（`uia-resolver`）作为更稳的结构化定位优先级；ShowUI 是 UIA 找不到时的回退（见 compute-use-control skill）。

## 二、ShowUI 与 UI-DETR-1 本质差异

| 维度 | ShowUI-2B（VLM/VLA） | UI-DETR-1（DETR 检测器） |
| --- | --- | --- |
| 模型类型 | 视觉-语言-动作模型（自回归 VLM） | 纯目标检测（DETR，set-prediction，无 NMS/anchor） |
| 输入→输出 | 截图 + 自然语言指令 → 动作/坐标 | 截图 → 一组 bbox + 类别（button/icon/text/menu…） |
| 自然语言 grounding | ✅ 原生支持（"点击设置"→坐标） | ❌ 不懂语言，只给框，需外接语言层做"意图→哪个框" |
| 语义理解/推理 | ✅ 理解 UI 语义、零样本泛化 | ❌ 仅识别"这是个按钮"，不懂它的含义 |
| 推理延迟 | 较高（自回归 token 生成，重） | 低（单次前向出固定框集，适合高帧率） |
| 坐标精度 | 视情况波动 | 框稳定，定位精度通常更高 |
| 实时高 FPS | 不适合每帧跑 | ✅ 适合连续感知层 |

## 三、UI-DETR-1 能否替代 ShowUI？
**结论：不能直接 1:1 替代，但可与之互补/分工。**
- ShowUI 的核心价值是「自然语言 → 坐标」的端到端 grounding；UI-DETR-1 只输出"框 + 类别"，**缺语言桥接**。
- 若用 UI-DETR-1 替代，必须补一个「意图→框」的匹配层（用 OCR 文本匹配 + 推理大模型从候选框里选目标）。
- 但 UI-DETR-1 在**实时连续感知**上显著优于 ShowUI（延迟低、框稳）。

## 四、实时桌面/游戏窗口内交互方案（推荐架构）
用户设想（UI-DETR-1 + 推理大模型 + 实时语音 实现窗口内实时识别 + 语音交互）是可行的，业界主流就是**双环架构**：

```
┌─ 快速感知环（本地，高 FPS 1-4fps）─────────────┐
│  屏幕/窗口采集 → UI-DETR-1 检测框 + OCR 文本   │  ← UI-DETR-1 在这里替代/补强 ShowUI
│  → 维护"当前窗口元素表"(框/类别/文本/坐标)     │
└───────────────────────────────────────────────┘
            │ 关键帧/事件触发（降频）
┌─ 慢速推理环（云端/大模型，1-2s 可接受）────────┐
│  关键帧截图 + 元素表 + 用户语音意图            │
│  → 推理大模型理解场景、决定回应/动作           │
└───────────────────────────────────────────────┘
            │ 流式
┌─ 语音环（实时）────────────────────────────────┐
│  STT 流式听用户（whisper）→ 推理 → TTS 流式回  │  ← 复用现有 audio.rs（见任务15）
└───────────────────────────────────────────────┘
```

要点：
1. **感知与推理分离**：UI-DETR-1（或同类轻量检测器）跑连续感知；VLM/大模型只在关键帧/事件触发时跑，避免每帧跑 VLM 的延迟。
2. **ShowUI 的定位**：保留为"按需精确 grounding"（一次性"点这个"任务），不进高频环。
3. **VLA 备选**：若要"看屏幕→直接执行动作"的闭环，VLA 模型可做，但同样受高 FPS 延迟限制，建议仍用检测器做感知、VLA/大模型做决策。
4. **实时语音**：STT/TTS 必须流式（现有 whisper + piper 是单次合成，实时场景需升级为流式，见任务15）。

## 五、对 coolzhu 的落地建议
- **短期**：保持 ShowUI 作默认 grounding（按需）。视觉接口已是"本地 OpenAI 兼容端点 + 可换 model 名"，**接入 UI-DETR-1 只需新增一个 detection backend**（输出框集），不动现有 grounding 链路。
- **中期**：新增「实时感知服务」（UI-DETR-1 + OCR，独立进程，维护元素表，WebSocket 推给前端/推理层）。在 `vision-service` 加 `DetectionBackend` trait，与现有 `VisionBackend`（grounding）并列。
- **长期**：双环 + 流式语音整合为"实时窗口助手"模式（对应游戏/应用窗口内实时交互）。需评估本地算力（UI-DETR-1 + whisper 流式 + TTS 同时跑的 GPU/CPU 预算）。
- **风险/前置**：UI-DETR-1 的具体权重/许可证/输入输出格式需确认（公开资料中"UI-DETR-1"这一确切命名文档较少，落地前需拿到模型卡与推理接口规格）。

## 六、结论
UI-DETR-1 **不替代** ShowUI 的语言 grounding，但**补齐** ShowUI 不擅长的实时连续感知。最优解是
"UI-DETR-1（感知）+ 推理大模型（决策/对话）+ 流式 STT/TTS（语音）"的双环架构，ShowUI 退为按需精确定位。
现有 `vision-service` 的 backend 抽象足以增量接入，无需推翻。

## 七、落地状态（Codex goal 实施记录）

- `vision-service` 已新增与 `VisionBackend` 并列的 `DetectionBackend` 抽象，以及 `DetectionRequest` / `DetectionFrame` / `DetectionElement` 数据结构。
- 已新增 UI-DETR 风格输出解析函数：支持 `detections/results/items/elements/boxes/candidates` 等候选列表，将 `bbox + label/class + text/ocr + score/confidence` 规范化为当前窗口元素表。
- `VisionToolService` 能力面已扩展：
  - `detect_elements`：available，用于解析检测框并生成元素表。
  - `realtime_perception`：reserved，等待真实 UI-DETR 权重、许可证和推理接口确认后接入循环服务。
- `web-console` 已新增实时感知 API：
  - `GET /api/vision/realtime/status`：返回 ShowUI 按需 grounding、UI-DETR 实时 detection 的角色分工，以及显存互斥切换状态。
  - `GET /api/vision/realtime/elements`：返回当前缓存的元素表。
  - `GET /api/vision/realtime/events`：通过 SSE 推送元素表更新事件，供前端和后续推理层订阅。
  - `POST /api/vision/realtime/start` / `stop`：启动或停止后台实时感知轮询。未配置检测服务时返回 `waiting_for_detection_backend`，不启动错误循环。
  - `POST /api/vision/realtime/frame`：接收真实检测器或调试工具输出的 UI-DETR 风格 JSON，解析并更新元素表。
- 前端“视觉 / Computer Use Lab”已显示 realtime perception 状态、资源切换状态和元素表，不扰动原 ShowUI grounding / locate 链路。
- `R-VIS-SWITCH` 已按“单活本地视觉模型”配置建模：默认 ShowUI 作为按需 grounding 可用，UI-DETR 作为 reserved standby 的 fast perception 后端，后续可由配置切换为 active。
- 已补齐 UI-DETR/RF-DETR 常见输出兼容：
  - 相对坐标 `bbox: [x1,y1,x2,y2]`。
  - Hugging Face / RF-DETR 风格绝对坐标 `box: {xmin,ymin,xmax,ymax}` 或 `{x,y,width,height}`，结合 `image_width/image_height` 自动归一化。
- 已新增 `modules/vision/resources/uidetr/README.md`，记录自托管检测服务 HTTP contract 与 `coolzhu.toml` 配置方式。

待接真实模型资源：

- UI-DETR-1 官方模型页已确认：`racineai/UI-DETR-1`，MIT，RF-DETR-Medium，模型卡推荐阈值约 `0.35`。当前仓库不内置模型权重；需要用户本机或远端启动兼容 `/detect` 服务后，将 `vision.router.detection.base_url` 指向该服务。
