# 2026-05-21 配置文件化规范升级与四大核心功能主线

## 背景

用户明确要求：除特殊不可避免原因外，不允许使用环境变量承载业务配置；新增功能一律改为配置文件读取和写入。当前后续开发必须围绕四大核心功能真实落地测试：

1. 会话配置和真实会话链路。
2. 工具真实调用。
3. compute-use 工具化真实调用。
4. 多 agent 协同真实场景以及 Goal 长程任务执行。

## 本轮修改

1. `WebSearch` 配置文件化：
   - `base_url`、`transport`、`force_powershell_fallback` 从 `coolzhu.toml [web_search]` 读取。
   - 新增 `tools::set_project_config_root(...)`，Web Console 在 workspace reload 和 runtime tool execute 前设置当前 workspace config root。
   - PowerShell fallback 不再通过环境变量传 URL，改为 PowerShell `param([string]$SearchUrl)` 命令参数。
2. 开发规范升级：
   - 新增业务配置禁止环境变量、不可避免例外、测试配置隔离三条规范。
   - 明确历史 `COOLZHU_*` / `CLAW_*` 仅作为兼容债务，不得扩散到新代码路径。
3. 需求文档更新：
   - `docs/current-issues-and-unfinished-requirements-2026-05-21.md` 增加四大核心功能验证主线。
   - `docs/requirements-management.md` 增加 2026-05-21 变更记录和优先级仲裁规则。
   - 记录 WebSearch targeted test 被当前 Windows Rust MSVC 环境缺少 `link.exe` 阻断。

## 验证

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| WebSearch 配置文件化 cargo check | PASS | `tmp/logs/tool-registry-check-20260521-222239.status.log` |
| Web Console config root 接入 cargo check | PASS | `tmp/logs/web-console-check-20260521-222239.status.log` |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-222740.status.log` |
| WebSearch 配置 targeted test | PASS | `tmp/logs/websearch-config-test-20260522-002148.status.log`，安装 Visual Studio Build Tools 后 `link.exe` 恢复，回归通过 |
| WebSearch env 残留扫描 | PASS | `rg 'CLAW_WEB_SEARCH|COOLZHU_WEB_SEARCH|WEB_SEARCH_FORCE|WEB_SEARCH_BASE|COOLZHU_WEB_SEARCH_URL|WEB_SEARCH_URL' modules\tooling modules\gui-web` 无命中 |

## 未闭环风险

- 仓内仍存在历史环境变量兼容债务，后续涉及四大核心链路时必须优先迁移为 config-first。
- 2026-05-22 已修复 MSVC linker，并重新构建最新 `coolzhu-web-console.exe`；真实会话、真实工具、真实 LLM 多 tool_use 与 Goal API 最小协同回归已恢复，详见 `docs/work-logs/2026-05-22-core-regression-after-linker.md`。
- 四大核心功能的 imagegen 操作流程图和 Remotion 视频指导尚未生成，等核心交互稳定后补。

## 备份

- `tmp/backups/config-no-env-core-focus-20260521-2258-post`
