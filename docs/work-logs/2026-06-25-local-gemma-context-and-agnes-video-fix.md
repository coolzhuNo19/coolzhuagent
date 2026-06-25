# 本地 Gemma 上下文与 Agnes 图生视频修复工作日志

日期：2026-06-25（最终运行验证跨至北京时间 2026-06-26 凌晨）

## 目标

1. 定位 Gemma 4 12B 会话回复不完整、上下文容量和输出上限问题。
2. 确认模型是否使用 GPU，以及 8 GB 显存机器的合理运行参数。
3. 确认本地模型达到阈值后与远端模型共用自动上下文压缩和记忆回灌。
4. 定位 Agnes Video 图生视频图片格式失败并修复 Provider 协议边界。

## 结论与参数选择

- Gemma 4 12B 架构最大上下文是 **256K / 262,144 tokens**；128K 属于 E2B/E4B 档。
- 256K 是模型能力，不是本机安全运行值。本机为 RTX 3070 Ti Laptop 8 GB、系统内存 16 GB，Q4_K_M 权重约 7.38 GB，并加载多模态 mmproj。
- 旧 8K 配置是保守运行值。旧 `local-gemma.log` 明确记录：
  - prompt 7,845 tokens；
  - completion 347 tokens；
  - 总计正好 8,192；
  - `truncated=1`。
- 方案 A 最终运行档：
  - `local_chat_context_window = 16384`
  - `local_chat_max_output_tokens = 4096`
  - `local_chat_reasoning_budget = 1024`
  - `local_chat_parallel_slots = 1`
  - `local_chat_gpu_layers = 24`
  - prompt 协议/tokenizer 安全余量 1,024 tokens
  - 每张图片保守估算 512 tokens
- 初次直接冒烟请求只给 256 个输出 token，Gemma 将额度全部用于 `reasoning_content`，正文为空且 `finish_reason=length`。因此新增 llama-server `--reasoning-budget 1024`，防止思考字段吃满 4K 输出额度。

## 代码修改

文件：`modules/gui-web/packages/web-console/src/main.rs`

### 本地模型运行参数

- `LocalChatRuntimeConfig` 增加单槽和思考预算。
- llama-server 显式传入：

```text
-c 16384 -np 1 --reasoning-budget 1024
```

- 所有参数由 typed `coolzhu.toml` 配置读取，未增加业务环境变量。

### 上下文硬预算与自动压缩

- `ContextBuildOptions` 增加 `max_prompt_tokens`、`image_token_estimate`。
- 预算统一包含 system、当前用户输入、历史、记忆、图片估算、输出预留与协议安全余量。
- 超预算时先缩减低优先级记忆，再截断极端超长文本；仅在 system prompt 加图片本身仍无法放入时才减少图片，并尽量保留当前第一张附件。历史只装入剩余硬预算。
- 估算组装发生截断时，统一触发既有 context lifecycle：
  - 写入 `context:auto-compact` L2 记忆；
  - 更新 `context_reset_at`；
  - 下一轮从压缩记忆和新的历史 floor 继续。
- 上下文提示与 footer 改为 Provider-neutral 文案，不再误称“远端上下文”。

### Agnes Video

- 根因：聊天附件编码器生成合法 `data:image/png;base64,...`，但 Agnes `/v1/videos` 顶层 `image` 字段要求裸 Base64。
- 新增 `agnes_video_image_base64`，只在 Agnes Provider 边界：
  - 剥离 Data URI header；
  - 校验 `;base64`；
  - 本地解码验证；
  - 仅发送裸 Base64。
- 异步提交或轮询失败时，把 pending 消息更新为 `assistant-video-error`，避免 UI 永久停留在生成中。
- 未执行真实视频生成请求，以避免未经用户确认产生外部计费；需用户人工重试一张图片验证。

## 备份与回滚

- 完整备份：`tmp/backups/20260625-232422-local-context-agnes-pre`
- SHA-256 清单：`tmp/backups/20260625-232422-local-context-agnes-pre/sha256-manifest.txt`
- 备份覆盖完整 Web Console 源码目录与活动配置 `C:\Users\zhupu\coolzhuagent\coolzhu.toml`。
- 回滚步骤：
  1. 停止 packaged Web Console 和本地 llama-server。
  2. 从备份恢复 Web Console 源码及 `coolzhu.toml`。
  3. 重新执行 `package.ps1 all -Configuration debug`。
  4. 使用 `package/run.ps1 web-console` 拉起并检查 8765/8082。

## TDD 与验证证据

- Red：
  - `tmp/logs/20260625-solution-a-red.log`
  - `tmp/logs/20260625-local-reasoning-budget-red.out.log`
- Green/专项：
  - prompt 硬预算含图片与历史；
  - 估算截断触发自动压缩；
  - Agnes Data URI 转裸 Base64；
  - 非法 Base64 本地拒绝；
  - 16K/4K/1K/单槽启动参数；
  - reasoning budget 按实际钳制后的 output 上限约束；
  - 超长文本优先截断且保留当前图片。
- 完整串行测试：
  - `tmp/logs/20260625-solution-a-final-test-serial.out.log`
  - 结果：550 passed，0 failed。
- `cargo fmt --check`、`cargo check`：
  - `tmp/logs/20260625-solution-a-final-fmt.out.log`
  - `tmp/logs/20260625-solution-a-final-check.err.log`
- package：
  - `tmp/logs/20260625-solution-a-final-package.log`
  - `package/package-report.json`
  - 最终源与 package 目标 SHA-256 均为 `DE5AFCF8C995C2FFBADED291D71389DE9088448F6ED4B3C7DD1B50BC84A02507`。
- 运行：
  - `tmp/logs/20260625-solution-a-final-runtime.log`
  - Web Console 自检通过，8765 health 可用。
  - 最终 llama-server PID 7612，`n_ctx=16384`，slots=1。
  - 实际命令行含 `-c 16384 -np 1 --reasoning-budget 1024`。
  - 真实 `/v1/chat/completions` 返回 `finish_reason=stop`、正文 `LOCAL CHAT OK`，不再空正文或 length 截断。
- GPU：
  - `nvidia-smi` 显示 llama-server 为 Compute 进程，最终验证显存约 5996/8192 MiB。
  - 模型确实使用 GPU，但因 Q4_K_M + mmproj 与 8 GB 显存限制，仍属于 GPU/CPU 混合卸载。

## 执行中遇到的问题

1. Windows PowerShell 5.1 不支持 `[System.IO.Path]::GetRelativePath`，备份脚本改用已验证根路径的 substring 计算相对路径。
2. PowerShell 将 Cargo stderr warning 包装成 `NativeCommandError`；后续验证使用独立 stdout/stderr 日志和显式超时。
3. package 目标二进制被运行中的 Web Console 占用；仅在校验可执行文件绝对路径后停止对应 PID，再重新打包。
4. 并行全量测试曾以 Windows `0xc0000409` 结束，但没有断言失败；改用 `--test-threads=1` 后 548 项稳定通过，符合全局配置/Job Object 测试的串行要求。
5. 初次本地聊天脚本由 PowerShell 默认编码导致中文变成问号，并且 256 token 全用于思考。最终脚本改用 UTF-8 请求体，并通过服务器思考预算限制验证最终正文。

## 待人工确认

- 用户按既定安排进行 Web Console 前端视觉/交互确认。
- 使用 Agnes Video 上传一张 PNG/JPEG 进行真实图生视频重试；该步骤可能产生外部费用，本轮未自动调用。

## 官方资料

- [Google Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Google Gemma 4 12B README](https://huggingface.co/google/gemma-4-12B/blob/main/README.md)
