# 2026-05-22 MSVC Linker 修复后四大核心链路回归

## 背景

上一轮 `cargo test` 被 Windows MSVC linker 缺失阻断。用户已完成 Visual Studio Build Tools 下载与安装，本轮先确认工具链恢复，再围绕四大核心功能做真实链路回归：

1. 会话配置和真实会话链路。
2. 工具真实调用。
3. compute-use 工具化真实调用。
4. 多 agent 协同真实场景以及 Goal 长程任务执行。

本轮仍遵循配置文件优先策略：Web Console 通过 `C:\Users\zhupu\coolzhuagent\coolzhu.toml` 的 `[model]`、`[web]`、`[pet]` 配置启动；未新增业务环境变量。

## 修改内容

1. 修复 Goal API 烟测脚本：
   - 重写 `tmp/goal-api-real-smoke.ps1` 中损坏的非 ASCII 字符串，避免 PowerShell 解析失败。
   - 增加 HTTP 失败时的接口、状态码和响应摘要记录，便于定位后端 400。
   - 将 phase verification 从无效的 `artifact` / `file_exists` 测试写法改为当前后端契约支持的 `UserConfirm` / `FilesExist`。

2. 文档同步：
   - 更新 `docs/current-issues-and-unfinished-requirements-2026-05-21.md` 的四大核心链路证据。
   - 更新 `docs/requirements-management.md` 的更新日期、0.7 回归记录、变更记录，以及 `REQ-GOAL-006` / `REQ-GOAL-010` 状态说明。

## 验证结果

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| MSVC linker 恢复后 WebSearch targeted test | PASS | `tmp/logs/websearch-config-test-20260522-002148.status.log` |
| Web Console 最新构建 | PASS | `tmp/logs/web-console-build-msvc-20260522-003223.status.log` |
| 配置文件方式启动 Web Console | PASS | `tmp/logs/web-console-config-20260522-003523.status.log`、`tmp/logs/web-console-config-20260522-062334.status.log` |
| 真实会话链路 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260522-004040/summary.md` |
| 工具真实调用 HTTP 场景 | PASS | `tmp/verification-runs/runtime-tool-api-real-ops-20260522-003902/summary.md` |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260522-004203/summary.md` |
| compute-use / grounding 真实输入预置 | PASS/CHECK | `tmp/verification-runs/precise-click-grounding-20260522-004722/summary.md` |
| Goal API 最小协同回归 | PASS | `tmp/verification-runs/goal-api-real-smoke-20260522-063331/summary.md` |
| WebSearch PowerShell fallback 参数修复 | PASS | `tmp/logs/websearch-tests-msvc-20260522-001458.out.log` |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-msvc-final-20260522-001757.status.log` |

## 结论

- linker 阻断已解除，当前仓库可以重新执行 Rust 构建和 targeted tests。
- 会话真实链路、工具真实调用、真实 LLM 多工具和 Goal API 最小协同已重新闭环。
- compute-use 真实输入链路的接口、权限和动作预置通过；涉及键鼠实际命中效果的用例仍需要用户录屏或截图确认，不能标记为完全自动 PASS。
- Goal 目前是 API 级最小协同回归通过，完整的 `test3` 指挥官、`test1` plan、`test2` 生成 Word/PPT 的真实产物场景仍是下一步重点。

## 后续优先级

1. 继续把 Goal API 级回归升级为真实多 agent 产物场景。
2. 保持每轮修改至少跑一次真实会话链路和真实工具调用回归。
3. compute-use 键鼠命中项需要人工录屏确认后，再更新为完全 PASS。
4. 后续新增配置继续写入配置文件，禁止新增业务环境变量。

## 备份

- `tmp/backups/msvc-linker-repair-20260522-0024-post`
- 本轮文档与脚本更新完成后另建 `tmp/backups/core-regression-after-linker-20260522-0636-post`
- 备份包含 Goal 烟测脚本、相关 work-log、需求管理文档、当前问题表、WebSearch 修复文件和 linker 诊断/安装/验证脚本。
