# 2026-05-06 被依赖需求梳理与诊断/音频富文本推进

## 时间

- 记录时间：2026-05-06 21:59:26 +08:00
- 范围：被依赖需求梳理、`REQ-DIAG-001`、`REQ-DIAG-002`、`REQ-WEB-MEDIA-006`

## 依赖梳理结论

- 当前被后续需求明显依赖的主线为 `REQ-WEB-PROJECT-001`、`REQ-DIAG-001/002`、`REQ-WEB-CHAT-003 + REQ-MEM-002/004/005`、`REQ-LLM-002/003 + REQ-TOOL-001/002/004`、`REQ-CORE-TOOL-001`、`REQ-CU-005`。
- 本轮优先选择低风险且不需要真实硬件/窗口的项：`REQ-DIAG-001/002` 和 `REQ-WEB-MEDIA-006`。
- 已并行启动 3 个 agent：2 个 explorer 只读梳理需求/代码，1 个 worker 负责 `REQ-DIAG-001` 前端总览卡片展示。

## 修改内容

- `REQ-DIAG-001`：
  - 总览卡片接入 `/api/diagnostics/health`。
  - 展示健康摘要、ok/warn/error 计数、前几个 suggestions/checks。
  - 前端补 loading/error/empty 状态。
- `REQ-DIAG-002`：
  - 健康检查新增 Web bind 地址检查与备用端口建议。
  - 新增 WebView2 Runtime 缺失检测与安装/环境变量建议。
  - 新增 LLM API key、provider/model mismatch、base_url override 定向修复建议。
  - 建议统一并入 `/api/diagnostics/health.suggestions`。
- `REQ-WEB-MEDIA-006`：
  - Markdown 链接和裸 URL 中的音频链接可直接生成 inline `<audio controls>`。
  - 附件音频预览和点击排除消息选中的既有链路保持可用。
- 文档：
  - `docs/requirements-management.md` 状态回写：`REQ-DIAG-001` 与 `REQ-WEB-MEDIA-006` 已完成，`REQ-DIAG-002` 进入测试中。
  - `modules/gui-web/INTERFACE.md` 补充 diagnostics health 修复建议契约。

## TDD 与验证记录

- Red：`tmp/diag_repair_tdd_red.log`，确认缺少 Web bind、WebView2、LLM 修复建议函数。
- Red：`tmp/web_media006_tdd_red.log`，确认音频 rich media control 缺口。
- Green：
  - `tmp/diag_repair_test_1.log`
  - `tmp/web_media006_test_1.log`
- Final：
  - `tmp/dependency_diag_media_fmt.log`
  - `tmp/dependency_diag_media_node_check.log`
  - `tmp/dependency_diag_media_cargo_check.log`
  - `tmp/dependency_diag_media_cargo_test.log`

## 自动验证结果

- `node --check modules\gui-web\packages\web-console\src\app.js`：通过。
- `cargo fmt -p coolzhu-web-console`：通过。
- `cargo check -p coolzhu-web-console --offline`：通过。
- `cargo test -p coolzhu-web-console --offline`：123 passed。

## 风险与后续

- `REQ-DIAG-002` 仍保留为测试中，因为真实“端口占用导致启动失败”的提示需要启动入口或包装脚本联动验证，健康 API 本身只有服务启动后才可访问。
- `REQ-WEB-PROJECT-001` 仍是下一条高价值依赖主线：建议先做 workspace 隔离审计/标记，不直接迁移会话、记忆或附件数据。
- `REQ-WEB-CHAT-003 + REQ-MEM-002/004/005` 适合下一轮做联调验收和缺口收口。
