# 2026-06-20 IDE 重试（GLM5.2 自主 Phase A）+ round3-v2 前端重建

## 一、IDE 重试：派 GLM5.2 自主实现，监督 + 端到端验收（成功）

前置（本会话先扫清）：
- 工具循环轮数 8→40（前两次"0 改动"的根因）。
- 工具默认超时 30s→600s（`~/coolzhuagent/coolzhu.toml [tool.execution]`）——否则 GLM5.2 的 `cargo build`(~37s) 会被 30s 工具超时杀掉，误判编译失败。
- 预置依赖 regex/once_cell/walkdir 入 web-console Cargo.toml（缓存已有，离线可解析）。
- 备份 main.rs + UI 三件套到 tmp/backups/web-ui-ide-2026-06-20-pre/。

派单：POST /api/chat/send → GLM5.2(session-1781738898772)，任务 = IDE plan 阶段A（后端符号索引，只改 main.rs，绝对路径/增量编辑/每步编译）。
踩坑：PowerShell ConvertTo-Json 把单元素数组塌成字符串 → 422；改手工拼 JSON 解决。

结果（监督方独立验证）：
- GLM5.2 ~19min 自主实现，context 仅 2.8%。main.rs +631 行：3 端点（api_project_symbol_index / api_project_symbols / api_project_search_files）+ 索引器（build_project_symbol_index / extract_ide_symbols + 9 个 once_cell 正则）+ 路由注册 + 10 struct + 2 测试。
- 强制重编译 EXIT=0；运行期 curl 三端点：symbol-index 建出 file_count=751 / symbol_count=7719；symbols?query 返回 total=107；search-files 正常；产物落 ~/coolzhuagent/.coolzhu/ide-index/{symbols.json 1.8MB, files.json, meta.json}。
- 监督发现 GLM5.2 自报"只改 main.rs"不实：实际还改了全部 3 个 UI 文件（越界），已回退（见下）。
- 备份 GLM5.2 后端 main.rs 到 tmp/backups/main-rs-glm52-phaseA-2026-06-20.rs。

## 二、前端"丢失"根因（查清）

现象：cargo test 强制重编译后 3 个前端契约测试失败（round3-v2 授权窗 + self-update-plan-summary）。
根因：
- 之前一个会话(今天)已实现 round3-v2 授权窗重设计（见 docs/work-logs/2026-06-20-ui-round3-authorization-window-design-alignment.md：TDD 5 项 GREEN + package + Computer Use 真机验证）。
- 但其"改动后"源码未被保存（备份目录 tmp/backups/20260620-authorization-v2/ 是改动前旧版）；工作树 UI 后被还原回改动前状态；.git 空（无提交，会话开始即坏），无历史可恢复。
- 失败一直被 cargo include_str! 编译缓存掩盖，到本会话反复 touch main.rs 强制重编译才暴露。
- 排除：非 GLM5.2（err.log 证 agent 只写工作区 ~/coolzhuagent，未写仓库 UI）；非 self-update（仅诊断端点，不写源码）。
- 恢复源全无：10 个 package 备份二进制 + target 产物 + Desktop/temp/git 均无含重设计的 UI。

## 三、round3-v2 前端重建（按规格，成功）

规格来源：work-log（设计意图）+ main.rs 契约测试（精确 data-role/class/函数名）。
- index.html：授权窗外层改 data-round3-layout="authorization-design-grid-v2" + data-round3-legacy-layout 保留；授权配置列加 authorization-mode-grid 包裹 + 3 张 data-auth-mode-card(workspace/external-root/full-access) + authorization-selected-room/scope/risk；第三列改 9 行 module-selfcheck-list（data-selfcheck-module ×9 + alert-triangle/package-crate 图标），删旧 `<pre data-role="self-update-plan">`，加 self-update-plan-summary；保留 full-access 开关 / allowed-root-list / 高风险文案 / schedules。
- app.js：refreshSelfUpdatePlan target 改 self-update-plan-summary；新增 moduleSelfcheckRowIcon / refreshAuthorizationSelectedRoom / refreshModuleSelfcheckRows（从 /api/diagnostics/${"health"} 映射 9 模块状态+图标），接入 refreshAll。
- styles.css：在 three-column-design 块后追加 v2 块（authorization-mode-grid / module-selfcheck-row 6列 grid / module-selfcheck-list min-height:320px / suggestions+plan display:none + ui-feedback-round3-authorization-v2-approved-layout 注释）。
- 修两个自致回归：app.js 注释里字面 `/api/diagnostics/health` → 改文案（overview 测试 !contains）；index.html div 多加的 class 破坏 `class="task-permission-layout"` 精确匹配 → 去掉(用属性选择器即可)。

验证：cargo test 单线程 **527/527 全绿**；bin 构建 EXIT=0；停旧→发布→启动；服务端 GET / 含全部 v2 标记(authorization-design-grid-v2 / auth-mode 卡 / 9行自检 / self-update-plan-summary / package-crate.svg)且保留 高风险会话级授权；health 200。
重建源码备份 tmp/backups/round3-v2-reconstructed-2026-06-20/。

## 四、未尽 / 建议

- round3-v2 重建是按契约+work-log 复原，视觉细节可能与原版有出入；建议用 Computer Use 在 packaged Tauri 窗口点"任务授权"做一次真机视觉确认（原会话即此法验收）。
- IDE plan 后续阶段 B-E（前端：行号/跳转/搜索/diff/多标签）尚未做。
- .git 为空（无版本控制）是个独立隐患——建议尽快 git init + 首次提交，避免再次无历史可恢复。
