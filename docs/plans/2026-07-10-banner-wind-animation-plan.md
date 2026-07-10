# Logo 区「满林风动」全元素风吹动画方案（2026-07-10）

> 目标：brand-banner 从"静态图 + 飘叶粒子"升级为**整幅画面被风吹动**——竹树枝叶摆动、
> 云朵飘移、"COOLZHU CODE" 竹叶字风拂动效；移除现有月晕呼吸。
> 开发模式：codex（image gen 生成分层素材）+ Claude/codex 联合实现前端动效。

## 一、现状与删除项

- 现状：`brand-banner` 为单张静态图 `assets/ui-redesign/bamboo-leaf-banner-v1.png`（770×116：
  夜空/月亮/远山/竹林/竹叶拼字/持剑少女），上面叠 `assets/bamboo-leaves.js` canvas 粒子飘叶（Phase 6）。
- **删除项（用户点名）**：`bamboo-leaves.js` 中 `drawMoonHalo()`（276 行起，正弦 pulse 月晕呼吸）
  及其调用（227 行）——新方案中月亮只保留静态画面，不再叠加呼吸光晕。

## 二、总体架构：静态分层 + 程序化风场（零帧间漂移）

**不采用"生成动画帧序列"**（帧间人物/元素尺寸位置漂移风险高——桌宠 blink 帧翻车教训）。
改为：**每个视觉元素一张静态透明层，全部运动由代码（CSS transform/canvas）驱动**——
运动参数是确定性函数，天然零漂移。

### 分层结构（从后到前）

| 层 | 内容 | 动效 |
| --- | --- | --- |
| L0 | 夜空+月亮+远山（不透明底） | 静止 |
| L1 | 云朵 ×2（独立小层） | translateX 循环平移（远云 90s/近云 55s 一轮）+ 移出右缘回绕；轻微 opacity 波动 |
| L2 | 远景竹林剪影带 | transform-origin: bottom；skewX 在 ±0.6° 正弦摆，周期 5.2s |
| L3 | 近景竹枝簇 ×2（左、右） | rotate ±1.4° 摆（origin 在枝根侧），周期 3.6s/4.4s 错频 |
| L4 | **COOLZHU CODE 竹叶字（重点）** | 三重叠加：a) 整体 skewX ±0.5°（origin: bottom center，周期 4.8s）；b) 「风拂高光」——斜向亮带用 CSS mask 周期扫过字面（叶面反光感，阵风时触发）；c) 字缘 4~6 片「颤动小叶」精灵（复用现有 leaf PNG，原地小幅 rotate 颤动） |
| L5 | 持剑少女 | 第一版静止（拆层保真优先）；二期可拆发带/衣带小层做 1° 摆 |
| L6 | 现有 canvas 飘叶粒子 | 保留，接入统一风场（去掉月晕呼吸） |

### 统一风场（联动的关键）

新增 `assets/bamboo-banner-wind.js`（吸收现 bamboo-leaves.js）：
- 每帧计算全局风相位 `wind(t) = base + gustEnvelope(t)`，写入 CSS 变量
  `--wind-sway`（-1..1）与 `--wind-gust`（0..1）到 `.brand-banner`；
- L1~L4 的 CSS 动画幅度全部乘以这两个变量（`calc()`）→ **一阵风起，云加速、
  竹林齐弯、logo 字高光扫过、粒子爆发**，同一相位源保证画面联动而非各自为政；
- 阵风事件沿用现有 8~15s 随机节奏；
- `prefers-reduced-motion: reduce` → 全部动画停用，仅显示静态分层（视觉等同旧 banner）；
  `document.hidden` 暂停 RAF。性能只用 transform/opacity（GPU 合成层 ~8 个，代价可控）。

## 三、素材生成（codex image gen）——防像素漂移规范（硬性）

1. **统一画布**：所有层一律 **1540×232**（原图 770×116 的 2 倍，同一坐标系）。
   每层只绘制自己的元素，其余区域全透明——层间对齐靠共享画布坐标，**不允许裁剪到内容**。
2. **以现 banner 为构图基准**：以 `bamboo-leaf-banner-v1.png` 作 image-to-image 参考逐层重绘，
   元素位置/比例/画风（夜色水墨动漫、冷调、月光银边）与原图一致；生成提示中明确
   "keep exact composition and position of ..."。
3. **交付自动校验**（Python PIL 脚本随任务提供，不合格重生成）：
   - 每层画布必须恰为 1540×232；
   - L2/L3/L4/L5 的 alpha bbox 中心与原图对应区域中心偏差 ≤4px；
   - L4 若生成微变体帧（可选增强）：两帧 alpha bbox 中心偏差 ≤2px 且面积差 ≤3%，
     **超差即弃用变体，只用单帧+程序动效**（宁缺毋滥）；
   - 透明通道无白边杂点（Phase 0 的洋红 chroma-key 流程可复用）。
4. **素材清单**（8 张，存 `assets/ui-redesign/banner-layers/`）：
   `layer0-sky-moon-mountains.png`（不透明）、`layer1-cloud-a.png`、`layer1-cloud-b.png`、
   `layer2-bamboo-far.png`、`layer3-bamboo-near-left.png`、`layer3-bamboo-near-right.png`、
   `layer4-logo-leaftext.png`、`layer5-figure.png`；可选 `layer4-logo-leaftext-alt.png`（须过校验）。

## 四、前端实现

- `index.html`：`.brand-banner` 内改为分层 `<img class="banner-layer" data-layer="...">` 堆叠
  （absolute inset-0，object-fit 同现 banner），canvas 粒子层置顶；保留 `brand-banner-image`
  的 data-role 兼容或平滑移除并同步契约测试。
- `styles.css`：各层 keyframes + `calc(var(--wind-sway) * 幅度)` 组合；风拂高光 mask 动画。
- `assets/bamboo-banner-wind.js`：风场驱动 + 粒子（迁移现逻辑，删 drawMoonHalo）。
- 契约测试：更新 banner 相关断言（分层结构正向断言 + `drawMoonHalo` 反向断言）。

## 五、阶段划分（与 codex 分工）

- **Phase A（codex image gen）**：按第三节生成 8 张分层素材 + 跑校验脚本自检入库。
- **Phase B（前端）**：分层 DOM/CSS + 风场驱动 JS + 粒子迁移（删月晕呼吸）。
- **Phase C（联调）**：幅度/频率手感微调（幅度参数集中在 JS 顶部常量，便于调），
  浏览器实测（帧率、reduced-motion、后台暂停），契约测试更新，cargo build/test 全绿后提交。

## 六、验收

1. 静止观感与旧 banner 等同（reduced-motion 下即旧图效果）；
2. 常态下竹林/竹枝/logo 字/云朵均有低幅连续风动，阵风时全画面联动增强；
3. 月晕呼吸不复存在；
4. 无 console 报错；CPU/GPU 占用与现 Phase 6 粒子方案同量级；
5. 全部层通过防漂移校验脚本。
