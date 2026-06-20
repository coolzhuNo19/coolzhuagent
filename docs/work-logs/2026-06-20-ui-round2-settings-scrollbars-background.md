# 2026-06-20 UI round2：设置/授权迁移、滚动条、总览卡片与背景

## 需求来源

本轮按截图批注继续迁移新 UI：

1. 滚动条替换为竹林武侠设计风格控件，去掉浏览器原生白色滚动条。
2. 设置窗口继续对齐批注：Goal 设置迁移到任务授权窗口的待审批区域，调试/运行类按钮不再堆在设置页。
3. 总览卡片与设计图视觉保持一致。
4. 使用 ImageGen 重新生成 UI 未覆盖区域背景，保持当前竹林武侠风格。

## 风险管理

- 修改前备份：
  - `tmp/backups/ui-round2-20260620-080922`
  - 日志：`tmp/logs/backup-ui-round2.log`
- 本轮只调整前端 HTML/CSS、前端契约测试和 package 资源清单；未修改会话协议、模型调用后端和权限执行逻辑。
- 由于当前 workspace 根目录的 `.git` 目录不是可识别 Git 仓库，`git status` 无法作为差异来源，本记录按文件路径和测试日志追踪。

## 主要修改

### 1. 设置页 Goal 配置迁移

- 文件：`modules/gui-web/packages/web-console/index.html`
- 从设置窗口移除：
  - `data-role="goal-role-consult"`
  - `data-role="goal-role-config"`
- 移入任务授权窗口左侧待审批区域：
  - Goal 角色分配保留在待审批区下方。
  - Goal 运行配置默认折叠，避免挤占授权页高度；展开后仍可配置角色、心跳、任务超时等参数。

### 2. 设置页精简

- 文件：`modules/gui-web/packages/web-console/src/styles.css`
- 设置窗口 TTS/STT 区保留状态与音色采集/设置相关显示。
- 隐藏实时开始/停止、模型流探活、断词评估等调试/运行类控件，后续统一迁到视觉实验或运行/授权类窗口。

### 3. 竹林风格滚动条

- 文件：`modules/gui-web/packages/web-console/src/styles.css`
- 新增标记：`ui-feedback-bamboo-scrollbars`
- 覆盖 `scrollbar-color` 与 `::-webkit-scrollbar` 系列选择器：
  - 深色半透明轨道。
  - 绿色竹影 thumb。
  - 去除原生上下按钮造成的白色块。
  - hover 时增加浅绿色辉光。

### 4. 总览卡片视觉

- 文件：
  - `modules/gui-web/packages/web-console/index.html`
  - `modules/gui-web/packages/web-console/src/styles.css`
- 新增标记：`ui-feedback-overview-card-jade-vortex`
- 总览卡片头像切换为新生成的绿色竹叶旋纹图：
  - `modules/gui-web/packages/web-console/assets/ui-redesign/overview-jade-vortex.png`
- 隐藏总览卡片中的 ShowUI 服务控制按钮，保持设计图里的紧凑信息卡风格。

### 5. 外层背景图

- 文件：
  - `modules/gui-web/packages/web-console/src/styles.css`
  - `modules/gui-web/packages/web-console/assets/ui-redesign/bamboo-wuxia-stage-bg-v1.png`
- 将全局 stage 背景替换为竹林月夜武侠图，填充窗口外侧未覆盖区域。
- `config/package-manifest.json` 增加 `gui-web.assets` 资源复制，确保 UI 资产进入 package 目录。

## ImageGen 资产

- 背景图：
  - 源：`C:\Users\zhupu\.codex\generated_images\019edc51-cad2-75b2-a19b-fb97b0877426\ig_06e39916298a4d93016a35db82b1548199b97c90ad02f298d6.png`
  - 目标：`modules/gui-web/packages/web-console/assets/ui-redesign/bamboo-wuxia-stage-bg-v1.png`
- 总览图标：
  - 源：`C:\Users\zhupu\.codex\generated_images\019edc51-cad2-75b2-a19b-fb97b0877426\ig_06e39916298a4d93016a35dbcc5fa081998faa47394062e836.png`
  - 目标：`modules/gui-web/packages/web-console/assets/ui-redesign/overview-jade-vortex.png`
- 备注：总览图标资产本身为绿色竹叶旋纹；在小尺寸卡片里会偏暗，后续如果需要可以单独再生成高亮、小尺寸可读性更强的版本。

## TDD 记录

### Red

- 日志：`tmp/logs/ui-round2-red-tests.log`
- 新增前端契约测试后，预期失败项覆盖：
  - Goal 仍在设置页。
  - 滚动条缺少竹林样式契约。
  - 总览卡片未使用新旋纹资产。
  - 全局背景仍为旧资源。

### Green

- 格式化：
  - 命令：`cargo fmt --manifest-path modules/gui-web/packages/web-console/Cargo.toml`
  - 日志：`tmp/logs/ui-round2-cargo-fmt.log`
- 前端契约测试：
  - 命令：`cargo test --manifest-path modules/gui-web/packages/web-console/Cargo.toml web_frontend_ --offline`
  - 日志：
    - `tmp/logs/ui-round2-green-web-frontend.log`
    - `tmp/logs/ui-round2-web-frontend-folded-goal-config.log`
  - 结果：`113 passed; 0 failed`
- package manifest JSON 校验：
  - 日志：`tmp/logs/ui-round2-package-manifest-json.log`

## Package 与运行验证

- 完整 package all：
  - 日志：`tmp/logs/ui-round2-package-all.log`
  - 结果：package 目录二进制与资源同步完成。
- 折叠 Goal 配置后的资源刷新：
  - 日志：`tmp/logs/ui-round2-package-resources-refresh-folded.log`
  - 结果：`gui-web.assets` 已复制到 `package\modules\gui-web\packages\web-console\assets`
- 运行态检查：
  - 日志：`tmp/logs/ui-round2-final-runtime-check.log`
  - 结果：
    - `coolzhu-web-console.exe` 来自 `package\bin`
    - `coolzhu-tauri-shell.exe` 来自 `package\bin`
    - `127.0.0.1:8765` 健康检查返回 200
    - health summary：`ok=10, warn=1, error=0`

## Computer Use 前端验证

使用 Computer Use 对 `COOLZHU AGENT 控制台` package 版窗口进行真实点击验证：

1. `Ctrl+F5` 强刷新页面。
2. 总览区域：
   - 外层未覆盖区域显示新竹林月夜背景。
   - 总览卡片使用新旋纹资产。
3. 设置页：
   - Goal 角色分配和 Goal 运行配置不再显示在设置页。
   - TTS/STT 调试运行控件已隐藏，仅保留状态/音色配置类信息。
   - 中间工具区滚动条为绿色竹影风格，不再是原生白色滚动条。
4. 任务授权页：
   - Goal 角色分配已进入左侧待审批区域。
   - Goal 运行配置默认折叠，避免覆盖或挤压待审批区域。
   - 右侧模块自检区域保留。
5. 逐窗口巡检：
   - 点击巡检项目、浏览器、终端、记忆知识、视觉实验。
   - 主导航不再出现“多媒体”和“诊断日志”入口。
   - 可访问文本中未发现旧的“页面标题 / 折叠控制栏 / 通信舱”等重复说明栏残留。
   - 视觉实验页保留 Capture / Describe / Locate / Action / Profile 等 compute use 功能控件；这些控件不再放在设置页。

## 后续建议

1. 如果需要更贴合截图中纯绿色旋纹小卡片效果，可以再生成一个更高亮、更简化的 `overview-jade-vortex` 小尺寸专用版本。
2. 下一轮逐个窗口继续检查布局迁移：
   - 项目窗口：文件树/预览/Diff 仍需完全对齐新版左侧菜单与右侧只读内容区。
   - 浏览器/终端/视觉实验：继续去除冗余调试信息。
   - 记忆知识：后端可暂缓，前端继续按 wise.ai 风格预留。
