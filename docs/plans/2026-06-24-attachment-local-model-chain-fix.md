# 2026-06-24 大附件与本地模型会话链路修复

## 范围

- `REQ-WEB-MEDIA-003/005`：修复配置上限内的大附件被 Axum 默认 2 MiB multipart 限制提前拒绝。
- `REQ-WEB-LOCAL-MODEL-001`、`REQ-LLM-005/006`：修复本地 Gemma 会话上下文、输出上限、工具暴露与 llama-server 实际参数不一致。
- 本轮不使用 Compute Use；编译、HTTP/API 与模型最小请求自动验证完成后，由用户人工确认前端视觉与交互。

## 已确认根因

1. 附件在调用远端/本地模型之前，先由 `/api/attachments/upload` 处理；Axum 0.8 `Multipart` 默认限制 2 MiB，业务层 32 MiB 校验无法执行，因此错误属于本地上传层。
2. 本地会话配置声明 `context_window=262144`，llama-server 实际以 `-c 8192` 启动；请求同时携带 20 个工具、`max_tokens=16384`，最终服务返回 `request (45682 tokens) exceeds ... (8192 tokens)`。
3. “不可以搜索网络”被简单子串规则识别为搜索工具意图，进一步放大请求。
4. 本地模型状态仅检查 TCP 端口，启动 stdout/stderr 被丢弃，无法区分占端口、启动中、ready 与崩溃。

## 实施

1. 备份 `modules/gui-web/packages/web-console` 并生成 SHA-256 清单。
2. 先补最小回归：
   - multipart 路由接受 3 MiB；
   - 超配置上限返回 413；
   - 否定式搜索不暴露工具，肯定式仍暴露；
   - 本地 endpoint 强制使用 config 中的实际 context/output，忽略会话虚高覆盖；
   - 本地小上下文请求不携带工具且 `max_tokens` 受限。
3. 将附件上限、本地 context/output/GPU layers/启动等待写入 `[attachment]`、`[model]` 配置项。
4. 本地服务以 `/health` 判定 ready，启动输出写入模块日志；模型调用失败在会话中显示真实原因。
5. 编译与接口验证；如本机 llama-server 可启动，再执行无 Key、无工具的最小 Chat Completions 请求。

## 风险与回滚

- 风险集中于 `web-console/src/main.rs` 的路由、配置反序列化及请求预算。
- 不修改 `llm-adapter` 协议路由，避免影响已验证的 Custom OpenAI-compatible 链路。
- 回滚使用 `tmp/backups/2026-06-24-attachment-local-model-chain/` 中的源码副本和哈希清单。
