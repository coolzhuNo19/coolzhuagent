# 2026-06-24 大附件上传与本地模型会话链路修复

## 任务范围

- 定位大文件附件上传失败属于远端模型协议还是本地链路。
- 修复本地模型开启后无法完成真实聊天室回复的问题。
- 按用户要求停止本轮 computer-use 视觉确认，改由用户人工确认前端视觉与操作。
- 保持最小 TDD、配置单一事实源、风险备份、package 编译和 Git 留痕。

## 根因

### 大附件上传

错误发生在 `POST /api/attachments/upload` 的 Axum `Multipart` 提取阶段，远端或本地模型尚未被调用。Axum 0.8 默认请求体限制约 2 MiB，导致业务层既有 32 MiB 校验没有机会执行，前端收到：

`HTTP 400 Bad Request: Failed to read attachment bytes: Error parsing multipart/form-data request`

因此这是本地 Web Console 上传层问题，不是远端 OpenAI-compatible 模型协议问题。

### 本地模型会话

llama-server 实际以 `n_ctx=8192` 运行，但目标会话遗留 `context_window=262144`，请求还使用未知模型默认 `max_tokens=16384`。用户提示中的“不可以搜索网络”被简单关键词匹配误判为需要搜索，额外注入约 20 个工具 schema，最终形成 45,682 tokens 请求并被本地服务拒绝：

`request (45682 tokens) exceeds the available context size (8192 tokens)`

端点 `http://127.0.0.1:8082/v1`、空 API Key 和 OpenAI-compatible 协议本身正确。

## 修改内容

### 附件链路

- 新增 `[attachment].max_upload_bytes` typed 配置，默认 32 MiB。
- `/api/attachments/upload` 增加路由级 `DefaultBodyLimit`，采用业务上限加 multipart 封装余量，避免框架默认限制提前截断。
- multipart 解析错误保留 extractor 原始 HTTP 状态。
- 文件业务上限统一返回 `413 Payload Too Large`。
- 桌宠拖放和普通附件上传统一读取同一配置上限。

### 本地模型链路

- `[model]` 新增并统一读取：
  - `local_chat_port`
  - `local_chat_context_window`
  - `local_chat_max_output_tokens`
  - `local_chat_gpu_layers`
  - `local_chat_startup_timeout_ms`
- llama-server 启动参数、endpoint 判定、会话上下文预算和输出预算统一使用上述配置。
- 本地 endpoint 忽略会话中虚高的历史 context override，强制服从真实服务容量。
- 本地小上下文请求不注入工具 schema。
- 在工具意图判断前剥离“不可以搜索、不要搜索、do not search”等否定短语。
- 启动状态由 TCP 监听改为 `/health` ready 检查。
- 本地模型 stdout/stderr 写入 workspace `.coolzhu/logs/local-gemma.log`。
- 模型调用失败时向聊天室透传真实错误原因，不再生成看似成功的占位回执。

## TDD 与验证

### 最小回归测试

- 3 MiB multipart 请求通过真实上传路由并返回 200。
- 超 32 MiB 配置上限返回 413。
- 否定式搜索提示不暴露工具；正向工具意图仍保持原行为。
- 本地 endpoint 使用 8192/2048 实际限制，忽略 262K 旧会话覆盖。

### 自动化结果

- `cargo check -p coolzhu-web-console`：通过。
- `cargo test -p coolzhu-web-console --no-fail-fast -- --test-threads=1`：540 passed，0 failed。
- 并行测试曾在 Windows 测试进程中出现 `STATUS_STACK_BUFFER_OVERRUN`，改为串行后全量通过；未发现功能测试失败。
- `cargo build -p coolzhu-web-console`：通过。
- `package.ps1 all -Configuration debug`：通过。
- 3 MiB 实际 HTTP 上传：通过。
- 本地模型切换到 Gemma，`/health` ready：通过。
- 真实聊天室发送 `Reply only with: LOCAL_CHAIN_OK`：收到 `assistant-reply`，内容为 `LOCAL_CHAIN_OK`，上下文统计为 `1330/8192`，未进入 fallback。

验证日志：

- `tmp/logs/cargo-test-web-console-single-thread.log`
- `tmp/logs/package-all-2026-06-24.log`
- `tmp/logs/runtime-verification.log`
- `tmp/logs/local-session-chain-verification.log`

## Package 与运行状态

package 汇总成功，新 Web Console 二进制已进入 `package/bin`，旧版本备份到：

`package/backup/coolzhu-web-console.exe/coolzhu-web-console.20260624-232235747.exe`

本轮启动 package 应用时，8765 端口存在幽灵监听。`netstat` 显示 PID 17300，但 `tasklist`、`Get-Process`、CIM、`Stop-Process` 和 Node `process.kill` 均报告进程不存在。Web Console 新进程因此报 Windows 10048 `AddrInUse`，启动器健康检查超时。该监听来自当前开发环境的历史调试进程，不是本轮二进制编译错误。

恢复步骤：

1. 关闭并重新打开 Codex 开发会话；若监听仍在，重启 Windows。
2. 确认 `netstat -ano | findstr :8765` 无残留监听。
3. 在工程根目录执行 `.\package\run.ps1 app`。
4. 由用户人工确认大附件上传、本地模型切换和聊天回复的前端视觉与操作。

## 视觉验收说明

用户明确要求本轮不再使用容易中断的 compute-use 视觉确认。自动化功能验证、真实 HTTP 上传和真实本地模型聊天室链路均已完成；前端视觉与交互状态保留为“待用户人工确认”，未宣称视觉验收完成。

## 风险、备份与回滚

修改前备份：

`tmp/backups/2026-06-24-attachment-local-model-chain/`

其中包含 Web Console 源码副本、运行时 `coolzhu.toml.before` 和 `sha256-manifest.txt`。

回滚方式：

1. 停止 Web Console 和 llama-server。
2. 用备份目录中的 Web Console 文件恢复 `modules/gui-web/packages/web-console`。
3. 用 `coolzhu.toml.before` 恢复 `C:\Users\zhupu\coolzhuagent\coolzhu.toml`。
4. 重新执行 `.\package.ps1 all -Configuration debug`。

未修改 `llm-adapter` 的 OpenAI-compatible 协议路由；远端模型会话协议不受本轮修复影响。
