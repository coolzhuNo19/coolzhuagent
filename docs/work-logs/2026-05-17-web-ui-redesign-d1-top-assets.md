# 2026-05-17 Web GUI 多窗口重构 D1.1 顶部视觉资产填充

## 背景

用户确认先完成上部分区域的新设计图 icon、Logo 和布局组件填充，再继续接入各窗口真实功能。本轮只处理顶部区域视觉资产，不推进窗口功能迁移。

## 备份

- D1 状态备份：`tmp/backups/web-ui-top-assets-20260517-0225-pre/web-console`
- 本轮修改后备份：`tmp/backups/web-ui-top-assets-20260517-0325-post/web-console`

## 资产处理

- 从 imagegen 资产板裁切并复制到 `modules/gui-web/packages/web-console/assets/ui-redesign/`：
  - `ui-redesign-asset-atlas.png`
  - `top-logo-banner-bg.png`
  - `top-agent-card-frame.png`
  - `top-task-card-frame.png`
  - `top-agent-icon.png`
  - `top-task-icon.png`
  - `top-star-icon.png`
- 裁切脚本：`tmp/crop-ui-redesign-top-assets.py`
- 裁切日志：`tmp/logs/crop-ui-redesign-top-assets.log`

## 修改内容

- 顶部 Logo 区域改用 `top-logo-banner-bg.png` 作为背景组件，叠加 `COOLZHU CODE` 文本和 workspace 路径。
- Agent 总览卡片改用 `top-agent-card-frame.png` 和 `top-agent-icon.png`。
- 任务卡片改用 `top-task-card-frame.png` 和 `top-task-icon.png`。
- 调整任务卡指标列宽，避免 `加载失败 404` 换行。
- 扩展 `tmp/ui-redesign-contract-check.ps1`，校验顶部资产存在并被 HTML/CSS 引用。

## 2026-05-17 Logo 微调

- 移除 Logo 下方的工程目录路径，不再在 Logo 背景下方显示 workspace。
- Logo 文本改为绝对居中显示，并放大到填充砖块墙主体。
- 扩展契约脚本：校验 `brand-subline` 已移除，且 Logo 使用大号居中样式。
- 截图：`tmp/ui-redesign-logo-refine-1920x1080.png`。
- 回归：`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed。

## 2026-05-17 Logo 烘焙位图修正

- 用户反馈 CSS/HTML 文本叠加在砖块背景上的视觉质感与 imagegen 像素背景不一致。
- 使用 imagegen 重新生成包含 `COOLZHU CODE` 文本的完整顶部 Logo 位图，原始生成文件保留在 `C:\Users\zhupu\.codex\generated_images\019df8d8-f3ac-72e2-b28b-9d1f67e31f09\ig_071fbc957e6947aa016a090cad95a481918f8c80ea953b0653.png`。
- 新增裁切脚本 `tmp/crop-generated-logo-banner.ps1`，输出项目资源 `modules/gui-web/packages/web-console/assets/ui-redesign/top-logo-banner-complete.png`。
- `index.html` 移除 `.brand-plaque` 文本层；`styles.css` 的 `.brand-banner` 只引用烘焙完成的 `top-logo-banner-complete.png`。
- `tmp/ui-redesign-contract-check.ps1` 改为校验烘焙 Logo 资产存在、被引用，且 `brand-plaque` / `brand-subline` 文本层完全移除。
- `tmp/check-web-ui-assets.ps1` 增加运行态资源检查：`/assets/ui-redesign/top-logo-banner-complete.png` 返回 200。
- 截图：`tmp/ui-redesign-logo-baked-1920x1080.png`。
- 备份：`tmp/backups/web-ui-logo-baked-20260517-0840-pre/web-console`。
- 回归：`node --check modules/gui-web/packages/web-console/src/app.js` PASS；`cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed。

## 2026-05-17 D1.3 顶部总览职责收敛

- 用户确认上部分区域布局可用，并要求左侧 Agent 总览卡不再承担视觉模型配置职责。
- `index.html` 中顶部总览卡移除 `data-role="overview-vision-agent"` 下拉，只显示：
  - `overview.activeAgentCount`
  - `overview.chatRoomCount`
- 设置窗口的“会话与模型”配置区新增 `data-role="settings-vision-agent"` 选择器，用于选择已配置的多模态/视觉 Agent 会话。
- `app.js` 将原视觉 Agent change 事件和 `renderVisionAgentSelect` 查询目标从顶部总览卡迁移到设置窗口，继续复用 `/api/config/vision-agent`，不改后端协议。
- `styles.css` 删除顶部总览卡 select 专用样式，让总览卡成为纯指标卡。
- `tmp/ui-redesign-contract-check.ps1` 新增：
  - `overview card is metrics only`
  - `settings owns vision agent selector`
- 截图：`tmp/ui-redesign-overview-settings-1920x1080.png`。
- 备份：`tmp/backups/web-ui-overview-settings-vision-20260517-0925-pre/web-console`。
- 回归：
  - `tmp/ui-redesign-contract-check.ps1` PASS。
  - `node --check modules/gui-web/packages/web-console/src/app.js` PASS。
  - `tmp/ui-redesign-visual-check.ps1` PASS。
  - `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1` 234 passed。

## 验证

- `tmp/ui-redesign-contract-check.ps1`：PASS。
- `node --check modules/gui-web/packages/web-console/src/app.js`：PASS。
- `tmp/ui-redesign-visual-check.ps1`：PASS。
- 截图：`tmp/ui-redesign-top-assets-1920x1080.png`。
- `cargo fmt -p coolzhu-web-console`：PASS。
- `cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1`：234 passed。

## 下一步

- 进入 D2：接入窗口真实功能前，先按当前顶部视觉确认结果修正细节。
- D2 优先顺序建议：设置窗口真实分区、任务/授权窗口、工程目录 IDE 窗口。
