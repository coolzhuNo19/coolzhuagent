# 2026-08-11/12 安装包与常用能力实测

## 范围

- 发布包：GitHub Release `v0.2.4`（pre-release）
- 源码基线：`9c949ff2f62d1b2d507b9ee63a32ffd7596f5e7f`
- 系统：Windows 11
- 文本模型：GLM-5.2（阿里百炼）
- 视觉模型：agnes（`agnes-2.0-flash`）
- 重点：安装/启动、Code Agent 工程能力、工具与命令行、Computer Use、Browser Use
- 改进 PR：[#37](https://github.com/coolzhulike/coolzhuagent/pull/37)

本文不记录 API Key、Token 或凭据后缀。

## 安装与启动

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Release 资产完整性 | PASS | v0.2.4 共 8 个资产，下载大小与 GitHub API 一致 |
| MSI SHA256 | PASS | `31A7BEFF28AB3486A61EFBD448B588BCC03AD233D78355ED0A90B3B00A89F7A0` |
| MSI 签名 | WARN | 开发自签名证书，不受本机信任；安装时由用户人工确认 UAC |
| MSI 安装 | PASS | `msiexec` exit 0；详细日志：`tmp/install-v0.2.4-msiexec.log` |
| 启动器自检 | PASS | `ok=true` |
| Web 控制台 | PASS | `http://127.0.0.1:8765/` 返回 200，Tauri 主窗口可见 |
| 会话健康 | PASS | GLM-5.2 与 agnes 均为 ready；视觉 Agent 已选 agnes |

## Code Agent 工程能力

### 场景

在活动工作区内创建隔离的嵌套 Git 工程 `e2e-workspace-20260811`：

- `src/normalize-config.js` 含已知缺陷；
- `test/normalize-config.test.js` 共 4 个用例；
- 基线 `npm.cmd test` 为 3 passed / 1 failed；
- 要求 Agent 只改实现，不改测试、不提交 commit，并在完成后运行测试与检查 diff。

### 首轮结果（安装包 v0.2.4，默认 workspace-write 聊天室）

状态：**FAIL**。

- GLM-5.2 正确调用 `glob_search` 与 4 次 `read_file`，能准确指出字符串 trim、空值回退、tags 去空/去重等缺陷。
- 模型可见工具只有 12 个，只读工具为主，不包含 `write_file`、`edit_file`、`PowerShell` 或 `bash`。
- 模型误用 `computer_use_perform` 尝试执行 `node --test`，被运行时以 `computer_use_room_full_access_required` 阻止。
- 回合结束后嵌套工程 `git status` 仍干净，测试仍为 3 passed / 1 failed。

关键日志：

```text
[TOOL-REG] exposed 12 tools (mode=whitelist, dev_open=false): tools_semantic_dispatch,computer_use_perform,chat_handoff,read_file,glob_search,grep_search,WebFetch,WebSearch,Skill,Sleep,SendUserMessage,StructuredOutput
[TOOL-LOOP] computer_use_perform -> blocked
error_code=computer_use_room_full_access_required
```

根因：`whitelist` 固定只保留 `PermissionMode::ReadOnly`，构造模型请求时没有使用已经传入工具执行循环的 `chat_room_id`。因此聊天室显示 `workspace-write`，但模型永远看不到工作区写工具。

关联 issue：[#33](https://github.com/coolzhulike/coolzhuagent/issues/33)。

### 修复版回归（本地源码 binary，workspace-write 聊天室）

状态：**PARTIAL PASS**。

- 模型可见工具从 12 个增加到 17 个，新增 `write_file`、`edit_file`、`TodoWrite`、`NotebookEdit` 与 `Config`；日志明确记录 `room_permission=workspace-write`。
- GLM-5.2 实际读取 README、实现与测试，并通过 `write_file` 只修改 `src/normalize-config.js`。
- 独立复核 `git diff` 只含该实现文件；`npm.cmd test` 从 3 passed / 1 failed 变为 4 passed / 0 failed。
- workspace-write 按权限设计不暴露 `PowerShell` / `bash`，所以模型不能自行运行命令；命令行能力需要 Full Access 回归。

回归提示中的 `Do not use computer_use_perform for shell commands or file editing` 又暴露了否定意图误判：修复前首轮请求日志为 `tool_choice=computer_use_perform`，模型仍尝试把 Computer Use 当作 shell。关联 issue：[#36](https://github.com/coolzhulike/coolzhuagent/issues/36)。修复否定词识别后，同一提示在新聊天室的真实日志为 `tool_choice=auto`，只调用 `read_file`，未强制 Computer Use。

## 命令行

安装包内 `bin/coolzhu-cli.exe` 可启动，但一致性测试失败：

- `--version` 显示 `Claw Code`、版本 `0.2.0`、Build date `2026-03-31`，与 MSI `v0.2.4` 不一致；
- `--help` 显示 `Claw Code CLI v0.2.0`；
- `agents` / `skills` 返回空，未读取 GUI 中已配置的 GLM-5.2、agnes 与技能；
- one-shot prompt 要求 `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY`；
- `/status`、`/version` 只能在交互模式内使用，直接执行会 exit 1。

关联 issue：[#35](https://github.com/coolzhulike/coolzhuagent/issues/35)。

补充环境现象：PowerShell ExecutionPolicy 会拦截 `npm.ps1`，改用 `npm.cmd test` 可正常运行。这是宿主环境差异，不判定为 CoolzhuAgent 缺陷。

## Browser / Browser Bridge

### 内置 Browser

状态：**部分 PASS**。

- 能在主面板 iframe 中打开受控 localhost 页面；
- 点击、下拉选择、复选框与 range 滑块均产生可见状态变化；
- 外部测试控制接口对 iframe 文本 `fill` 出现焦点/剪贴板错误，拖放方法未提供；这两项不作为 CoolzhuAgent 产品能力结论。

### Browser Bridge

状态：**BLOCKED**。

Health 返回：

```json
{
  "connected": false,
  "setup_required": true
}
```

未在没有动作前确认的情况下注册 Native Host 或安装浏览器扩展。

同时发现独立缺陷：诊断面板默认指向 `http://127.0.0.1:8877/tests/fixtures/computer-use-browser.html`，但安装后没有 8877 服务，源码与安装目录也没有该 fixture。关联 issue：[#34](https://github.com/coolzhulike/coolzhuagent/issues/34)。

修复分支新增了自带测试页，并先用临时 localhost 服务验证：

- 页面返回 200；
- DOM 含 `fixture-ready`、文本框、Alpha/Beta 选项、range、`drag-me`、`drop-here`；
- range 可从 20 改到 80；
- Ctrl+A 出现 `key=ctrl+a`；
- Enter 出现 `key=enter choice=alpha`。

随后用修复版产品 binary 复核：`/tests/fixtures/computer-use-browser.html` 由 8765 服务自身返回 200，且诊断面板默认 URL 动态变为 `http://127.0.0.1:8765/tests/fixtures/computer-use-browser.html`。

拖拽和真实 tab lifecycle 仍必须在 Browser Bridge 连接后运行产品自测，不能用外部脚本代替。

## Computer Use / 视觉

- workspace-write 聊天室中的 Computer Use 负向权限门：**PASS**。在无 Full Access 时没有执行真实输入，返回单一明确的 `computer_use_room_full_access_required` 终态。
- 桌面真实输入：**NOT-RUN**。需要用户在目标聊天室中明确开启 Full Access，并在动作前确认受控目标。
- agnes 视觉理解：**NOT-RUN**。需要在发送受控测试图像前确认文件和目标会话。

## 本轮修复

1. 构造聊天模型请求时传递 `chat_room_id`，让 `whitelist` 按聊天室权限档位生成工具清单：
   - 无聊天室：ReadOnly；
   - workspace-write：ReadOnly + WorkspaceWrite；
   - full-access：完整 MVP 工具集。
2. 保留现有运行时权限、路径边界和审批门，不把“模型可见”当作“允许执行”。
3. 强化 `computer_use_perform` 描述，禁止模型把它用于 shell、代码执行或文件编辑。
4. 新增并嵌入 `tests/fixtures/computer-use-browser.html`，由 `window.location.origin` 动态生成诊断 URL。
5. 识别 `do not use`、`不要使用`、`禁止调用` 等对 Computer Use 正式入口的否定式提及，避免强制 `tool_choice`。
6. 增加工具权限档位、否定意图、嵌入静态资源和前端接线回归断言。

## 源码验证

- `cargo fmt -p coolzhu-web-console -- --check`：PASS。
- `cargo build -p coolzhu-web-console --target x86_64-pc-windows-gnu --offline`：PASS；本机没有 Visual Studio Build Tools，无法执行 MSVC 链接验证，改用隔离的官方 Rust GNU toolchain + llvm-mingw。
- 定向回归：工具权限清单、流式上下文复用、嵌入测试页、前端接线、9 个意图门控测试全部 PASS。
- 全量测试（加入最后一项否定意图修复之前）：8 个 library 测试和 1 个 native-host 测试全部 PASS；主 binary 789/804 PASS、15 FAIL。其中 1 个本次源码精确空格断言已修复并单测 PASS，其余 14 个失败均在同提交的干净基线复现（CSS/JS 源码快照和本机音频解码环境）。干净基线总计 795 PASS / 17 FAIL。
- `node --check src/app.js`、`git diff --check`：PASS。
- 修复版真实 GLM-5.2 Code Agent：文件读取/写入 PASS，独立执行测试 4/4 PASS；命令行执行待 Full Access。
- 修复版 Browser Bridge 测试页：产品自身返回 200，诊断 URL 接线 PASS；真实 Bridge 仍未连接。

## 待用户授权验证

- 在目标聊天室人工开启 Full Access 后复跑 `PowerShell` / `bash` 命令工具和桌面 Computer Use。
- 运行 `scripts/setup-browser-bridge.ps1` 注册当前用户 Native Messaging Host，并由用户手工加载浏览器扩展后复跑滑块、拖拽、按键和 tab lifecycle。
- 将不含隐私数据的受控测试页截图发送给 agnes，验证视觉理解。
