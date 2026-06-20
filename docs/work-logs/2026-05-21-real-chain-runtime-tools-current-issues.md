# 2026-05-21 真实模型链路、Runtime 工具回归与当前问题表

## 背景

用户要求每轮修改必须验证真实会话模型链路，工具调用要覆盖文件读写、脚本执行和浏览器/搜索等常用 Agent 操作，并新建一份只记录当前未完成问题和未完成需求的管理文档。

## 修改内容

1. 修复 OpenAI-compatible 历史消息序列化：
   - assistant 历史消息不再发送空 `tool_calls: []`。
   - DeepSeek thinking 模式二轮工具回灌时保留 `reasoning_content`。
2. 修复 Web runtime 工具执行：
   - `/api/tools/runtime-execute` 改为 blocking worker + runtime timeout，避免 `WebSearch` 在 async handler 中触发 Tokio runtime drop panic。
   - runtime registry executor 在权限闸门允许后可执行全部内置工具，不再只允许只读工具。
3. 修复 Windows workspace 权限误判：
   - `\\?\C:\...` extended-length workspace 与普通 `C:\...` 目标路径统一归一化，避免 workspace 内写入被误判为 workspace 外。
4. 修正真实多工具验收脚本：
   - `tmp/tool011-real-llm-multi-tool-check.ps1` 不再把 fallback 或 prompt 回显误判为 PASS。
   - 只接受真实 `assistant-reply`、真实 `tool-summary` 和新增审计记录。
5. 新增当前未闭环问题文档：
   - `docs/current-issues-and-unfinished-requirements-2026-05-21.md`
   - `docs/requirements-management.md` 增加 0.6 入口和 2026-05-21 更新日期。

## 验证

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 真实流式模型回复 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260521-012639/summary.md` |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260521-012720/summary.md` |
| LLM adapter assistant 序列化 | PASS | `tmp/logs/llm-adapter-assistant-tests-20260521-065811.status.log` |
| WebSearch runtime panic 回归 | PASS | `tmp/logs/websearch-runtime-test-20260521-065708.status.log` |
| Windows extended path 权限归一化 | PASS | `tmp/logs/permission-path-prefix-test-20260521-065710.status.log` |
| runtime 写文件/授权 PowerShell 单测 | PASS | `tmp/logs/runtime-tool-real-ops-tests-20260521-065710.status.log` |
| HTTP API 读/写/脚本/WebSearch 回归 | PARTIAL | `tmp/verification-runs/runtime-tool-api-real-ops-20260521-064815/summary.md`：读、写、脚本 PASS；WebSearch FAIL |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-065637.status.log` |

## 追加进展 - 2026-05-21 07:15

1. WebSearch 增加 Windows PowerShell fallback：
   - `reqwest` 主请求失败时，Windows 下自动用 PowerShell `Invoke-WebRequest` 拉取 HTML，再复用现有搜索结果解析。
   - 早期实现曾使用 `CLAW_WEB_SEARCH_FORCE_POWERSHELL_FALLBACK=1` 做可控回归；该方案已在 22:55 追加进展中迁移为 `coolzhu.toml [web_search]` 配置，不再作为新代码规范保留。
2. HTTP API 真实工具回归重新执行：
   - `write_file`、`read_file`、授权后 `PowerShell`、`WebSearch` 全部 PASS。
3. 当前问题表已更新：
   - `CUR-TOOL-REAL-001` 从未完成 P0 中移除。
   - 浏览器窗口备注更新为 WebSearch 工具链路已补 fallback，真实浏览器自动化仍未接。

追加验证：

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| WebSearch PowerShell fallback 单测 | PASS | `tmp/logs/websearch-fallback-test-20260521-071332.status.log` |
| HTTP API 读/写/脚本/WebSearch 回归 | PASS | `tmp/verification-runs/runtime-tool-api-real-ops-20260521-071454/summary.md` |
| 真实流式模型回复 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260521-071533/summary.md` |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260521-071534/summary.md` |

## 追加进展 - 2026-05-21 07:23

1. 修复 WebSearch 单元测试并发污染：
   - 早期测试曾通过 `env_lock` 串行化 `CLAW_WEB_SEARCH_BASE_URL` / `CLAW_WEB_SEARCH_FORCE_POWERSHELL_FALLBACK`；后续已改为临时 `coolzhu.toml` + 显式 config root，不再修改业务环境变量。
   - WebSearch 三个用例在当时环境下并发回归已通过。
2. 重新执行真实使用场景回归：
   - HTTP API 读文件、写文件、授权 PowerShell、WebSearch 全部 PASS。
   - `test3` DeepSeek 真实流式回复 PASS。
   - REQ-TOOL-011 真实 LLM 多工具调用 PASS，包含 `read_file` 与 `glob_search` 的真实 tool message 和 audit 记录。

追加验证：

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| WebSearch fallback / 并发单测 | PASS | `tmp/logs/tool-registry-websearch-tests-20260521-072154.status.log` |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-072155.status.log` |
| HTTP API 读/写/脚本/WebSearch 回归 | PASS | `tmp/verification-runs/runtime-tool-api-real-ops-20260521-072227/summary.md` |
| 真实流式模型回复 | PASS | `tmp/verification-runs/chat-stream-real-chain-20260521-072227/summary.md` |
| 真实 LLM 多工具调用 | PASS | `tmp/verification-runs/tool011-real-llm-20260521-072227/summary.md` |

## 追加进展 - 2026-05-21 22:55

1. 按最新规范清理 WebSearch 业务环境变量：
   - `WebSearch` 的 `base_url`、`transport`、`force_powershell_fallback` 改为读取 workspace 根目录 `coolzhu.toml [web_search]`。
   - 新增 `tools::set_project_config_root(...)`，Web Console 在 workspace reload 和 runtime tool execute 前设置当前 workspace，让工具层读取正确配置文件。
   - PowerShell fallback 不再通过环境变量传递 URL，改为 `param([string]$SearchUrl)` 命令参数，避免引入新的业务 env 协议。
2. 将“禁止环境变量配置”升级为开发规范：
   - 新增业务配置禁止 env、不可避免例外、测试配置隔离三条规则。
   - 历史 `COOLZHU_*` / `CLAW_*` 只作为兼容债务，后续四大核心链路改动优先迁移为 config-first。
3. 四大核心功能主线写入当前问题表：
   - 会话配置和真实会话链路。
   - 工具真实调用。
   - compute-use 工具化真实调用。
   - 多 agent 协同与 Goal 长程任务。

追加验证：

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| WebSearch 配置文件化 cargo check | PASS | `tmp/logs/tool-registry-check-20260521-222239.status.log` |
| Web Console 设置 tooling config root cargo check | PASS | `tmp/logs/web-console-check-20260521-222239.status.log` |
| Rust 格式检查 | PASS | `tmp/logs/cargo-fmt-check-20260521-222740.status.log` |
| WebSearch 配置文件化 targeted test | PASS | `tmp/logs/websearch-config-test-20260522-002148.status.log`：安装 Visual Studio Build Tools 后 `link.exe` 恢复，回归通过 |

## 未闭环问题

- `WebSearch` 默认 DuckDuckGo 请求在 Rust reqwest/rustls 链路失败；同 URL 通过 PowerShell `Invoke-WebRequest` 可访问，说明网络本身可达。本轮已补 `coolzhu.toml [web_search]` 可配置搜索服务与 PowerShell fallback，后续仍需在真实 API 回归中持续验证。
- Windows Rust MSVC 测试环境曾缺少 `link.exe`，已在 2026-05-22 安装 Visual Studio Build Tools 修复；后续 `cargo test` 可直接链接运行。
- 聊天区仍会显示 `tool-summary` 工具细节和旧 `dry-run` 说明，下一步应按当前问题表 `CUR-TOOL-CHAT-001` 收敛到工具窗口状态灯。
- 前端仍有英文按钮和手工“任务链/转交”入口，下一步按 `CUR-UI-I18N-001`、`CUR-CHAT-AUTO-001` 处理。
- Goal 最小真实回归（test3 指挥官、test1 plan、test2 执行生成 Word/PPT）尚未实现。

## 备份

- 修改前备份：`tmp/backups/real-chain-current-issues-20260521-003454-pre`
- 修改后备份：`tmp/backups/current-real-chain-tools-20260521-065230-post`
- WebSearch fallback 回归修复后备份：`tmp/backups/websearch-fallback-real-regression-20260521-072501-post`
- WebSearch 配置文件化与核心主线文档更新后备份：`tmp/backups/config-no-env-core-focus-20260521-2258-post`
