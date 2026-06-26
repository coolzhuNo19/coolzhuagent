# 2026-06-26 聊天头像、本地模型路径与 Goal Skills 修复记录

## 背景

本轮根据用户反馈实施三项修复：

1. 聊天消息中仍残留马里奥头像，需要统一替换为当前武侠桌宠风格头像。
2. 本地模型设置需要支持选择启动模型文件路径；前端文案从“对话 Gemma”改为“本地文本推理”；本地模型的回复和推理卡片对用户只显示 `coolzhu-model`。
3. 复盘 GLM5.2 执行 Goal 长任务时遇到的问题，将约束拆分成可复用 Skill：会话链路、模型推理、工具执行，并让 Goal prompt 默认加载这些 Skill 正文。

用户已明确本轮前端视觉确认由用户人工执行，自动化侧只做功能、契约、编译和后端链路验证。

## 风险管理与备份

本轮涉及 Web Console 源码、配置读取、进程启动和 Goal prompt 注入，属于高风险修改。修改前已完整备份受影响源码目录：

- 源目录：`C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console`
- 备份目录：`C:\Users\zhupu\Desktop\codex\tmp\backups\20260626-local-model-goal-skills-pre`
- 文件计数：`3455 / 3455`
- SHA-256 清单：`C:\Users\zhupu\Desktop\codex\tmp\backups\20260626-local-model-goal-skills-pre\manifest.sha256`
- 备份日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-local-model-goal-skills-backup.log`

恢复方式：停止 Web Console/package 进程后，将备份目录中的 `web-console` 内容复制回 `modules/gui-web/packages/web-console`，再重新执行 package 编译。

同时，为避免移除硬编码模型路径后当前 workspace 的本地模型无法启动，已在修改前备份活动配置：

- 配置文件：`C:\Users\zhupu\coolzhuagent\coolzhu.toml`
- 备份目录：`C:\Users\zhupu\Desktop\codex\tmp\backups\20260626-active-coolzhu-config-pre`
- 备份日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-active-config-backup.log`
- 已写入：
  - `local_chat_model_path = "C:\\Users\\zhupu\\llama.cpp\\gemma-4-12B-it-Q4_K_M.gguf"`
  - `local_chat_mmproj_path = "C:\\Users\\zhupu\\llama.cpp\\mmproj-gemma-4-12B-it-bf16.gguf"`
- 校验结果：两个路径均存在。

## 修改内容

### 1. 聊天头像去马里奥

修改文件：

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\src\app.js`
- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\src\main.rs`

要点：

- 新增 `defaultIconUrlForIcon(icon)`，将历史 `mario` 和普通用户消息默认 icon `robot-message` 统一映射到武侠默认头像。
- 普通用户消息默认 icon 从 `mario` 改为 `robot-message`。
- `addMessage()` 初始渲染路径改用同一默认头像映射，避免新消息首帧仍显示马里奥。
- 增加前端嵌入契约测试，防止 `message.kind === "multimedia" ? "image-preview" : "mario"` 回归。

### 2. 本地模型路径配置与可见品牌收口

修改文件：

- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\src\main.rs`
- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\src\app.js`
- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\src\styles.css`
- `C:\Users\zhupu\Desktop\codex\modules\gui-web\packages\web-console\index.html`

后端：

- `ConfigModel` 新增：
  - `local_chat_model_path`
  - `local_chat_mmproj_path`
- 新增 API：
  - `POST /api/local-models/model-path`
  - `POST /api/local-models/pick-model-file`
- 模型路径校验要求：
  - 非空；
  - 可 canonicalize；
  - 必须是文件；
  - 后缀必须为 `.gguf`。
- 本地文本推理启动链路改读 `coolzhu.toml [model].local_chat_model_path`，移除硬编码 `C:\Users\...\llama.cpp\gemma-4-12B-it-Q4_K_M.gguf`。
- Windows 文件选择器通过 `OpenFileDialog` 选择 `.gguf` 后写回配置。
- 状态服务名从 `coolzhu-model (Gemma)` 改为 `coolzhu-model`。

前端：

- 设置窗口工具行文本从 `视觉（UI-DETR/ShowUI）・对话（Gemma）` 改为 `视觉（UI-DETR/ShowUI）・本地文本推理`。
- 本地模型管理面板新增模型路径输入框、`选择文件` 和 `保存路径` 按钮。
- 若配置路径存在但文件不可用，输入框显示缺失态。

可见品牌：

- 本地模型会话回复 author 统一显示 `coolzhu-model`。
- 本地模型推理卡片 author 统一显示 `coolzhu-model 推理`。
- 系统提示加入本地模型身份约束：只以 `coolzhu-model` 自称，不暴露原模型标识、GGUF 文件名或模型家族。
- 回复、推理和 Goal 执行消息在持久化/显示前进行可见文本脱敏，替换原模型名和配置模型文件名。

### 3. Goal 长任务 baseline Skills

新增目录：

- `C:\Users\zhupu\Desktop\codex\skills\coolzhu-goal-session-chain`
- `C:\Users\zhupu\Desktop\codex\skills\coolzhu-goal-model-reasoning`
- `C:\Users\zhupu\Desktop\codex\skills\coolzhu-goal-tool-execution`

三个 Skill 分工：

- `coolzhu-goal-session-chain`：约束 workspace、聊天室、发送对象、上下文边界、handoff 和状态恢复，避免任务跑错会话或复用过期状态。
- `coolzhu-goal-model-reasoning`：约束模型推理预算、证据优先、拒绝假完成、上下文压缩和失败复盘。
- `coolzhu-goal-tool-execution`：约束工具 schema、Windows 路径、临时脚本、日志、超时、cargo test 验证和 diff 审计。

后端 Goal prompt 改动：

- `skill_source_roots()` 增加项目内置 `skills/`。
- 新增 baseline skill 列表：
  - `coolzhu-goal-session-chain`
  - `coolzhu-goal-model-reasoning`
  - `coolzhu-goal-tool-execution`
- `goal_phase_run_prompt_with_progress()` 将 baseline skills 与 phase 自带 skills 合并，并加载对应 `SKILL.md` 正文注入 prompt。
- 若 skill 缺失，prompt 会明确写出 missing 提示，避免只列名不加载约束。

## TDD 与验证

### 红灯

- 聊天头像红灯：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-avatar-red.log`
  - 预期失败点：缺少 `defaultIconUrlForIcon` 与普通用户消息默认头像映射。
- 本地模型红灯：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-local-model-red.log`
  - 预期失败点：缺少本地模型路径校验和可见身份隐藏函数。
- Goal Skills 红灯：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-goal-skills-red.log`
  - 预期失败点：Goal prompt 未加载 baseline skill 正文。

### 绿灯

- 聊天头像回归：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-avatar-green-2.log`
- 本地模型路径与品牌回归：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-local-model-green-2.log`
- 本地模型 UI 契约：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-local-model-ui-green.log`
- Goal Skills 加载回归：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-goal-skills-green.log`
- Goal prompt 契约：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-goal-prompt-green.log`
- Skill 校验：
  - `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-skill-validate-session-chain.log`
  - `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-skill-validate-model-reasoning.log`
  - `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-skill-validate-tool-execution.log`

### 待本轮收口验证

收口阶段已完成：

- `cargo fmt`：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-cargo-fmt-local-model-goal-skills.log`，exit 0。
- `cargo check -p coolzhu-web-console --offline --target-dir modules/gui-web/target`：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-cargo-check-local-model-goal-skills-2.log`，exit 0；仅既有 dead_code warning。
- `node --check modules/gui-web/packages/web-console/src/app.js`：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-node-check-app-local-model-goal-skills.log`，exit 0。
- Web Console 串行全量测试：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-web-console-full-tests-local-model-goal-skills.log`，`553 passed; 0 failed`。
- package all：
  - 首次 `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-package-all-local-model-goal-skills.log` 编译完成但复制 package exe 时被旧 `coolzhu-web-console.exe` 占用。
  - 已定位并停止占用进程 PID `16328`，日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-stop-package-web-console-before-package.log`。
  - 重跑 `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-package-all-local-model-goal-skills-2.log`，exit 0。
  - 输出 exe：`C:\Users\zhupu\Desktop\codex\package\bin\coolzhu-web-console.exe`，大小 `37112320` bytes，修改时间 `2026-06-26 08:51:36`。
- package 启动：
  - `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-package-run-app-local-model-goal-skills.log` 启动了 `COOLZHU-AGENT`，runner 因 120s 保护显示 timeout，但脚本已输出 self-check ok。
  - 后续 HTTP 检查 `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-package-run-health-local-model-goal-skills.log` 返回 `status=200`。
  - 运行进程：`coolzhu-web-console.exe` PID `15344`，`coolzhu-tauri-shell.exe` PID `19868`。

## 人工确认项

本轮按用户要求不使用 compute-use 做视觉确认，以下留给用户在重启/启动后人工确认：

- 聊天消息是否不再出现马里奥头像。
- 设置窗口本地模型管理面板是否显示“本地文本推理”和 `.gguf` 文件路径控件。
- 本地模型回复和推理卡片是否只显示 `coolzhu-model`。
- 选择模型文件后能否启动本地模型并正常会话。

## 后续建议

- 在用户确认现有 `.gguf` 路径后，通过设置窗口保存到当前 workspace `coolzhu.toml`，避免直接手工写配置造成路径误差。
- 后续 GLM5.2/本地模型执行 Goal 时，应把新增失败案例优先追加到对应 Skill，再更新需求表和 work-log。
