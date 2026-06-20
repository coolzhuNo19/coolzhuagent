# 2026-06-19 模块独立编译、package 汇总、Obsidian MCP 与错误日志改造

## 1. 目标

本次架构动作完成以下工作：

1. 将可执行模块的 Cargo 输出隔离到各模块自己的 `target` 目录。
2. 增加统一 `package all` 构建、复制、哈希比较、旧二进制备份和运行入口。
3. 为 Codex 与 coolzhu agent 配置 Obsidian MCP，并按项目层级迁移仍有效的开发文档。
4. 统一 diagnostics 错误事件，并为 Web Console 与 Tauri 启动链路补齐 P0 错误日志。
5. 修复独立编译暴露的桌面控制台和 CLI 编译契约问题。
6. 使用 Computer Use 对 package 内桌面二进制执行真实前端输入验收。

## 2. 风险控制与回滚

### 2.1 修改前备份

- 完整备份：`tmp/backups/20260619-architecture-package-mcp-pre`
- SHA-256 清单：`tmp/backups/20260619-architecture-package-mcp-pre/sha256-manifest.jsonl`
- 备份日志：`tmp/logs/20260619-architecture-backup.log`
- 共备份 2423 个源码、文档和配置文件；排除构建缓存、`node_modules`、`tmp`、`package` 和迁移后知识库。
- Codex 用户配置独立备份：
  `C:\Users\zhupu\.codex\config.toml.20260619-044501.obsidian-mcp.bak`

### 2.2 回滚方法

1. 退出正在运行的 coolzhu 进程。
2. 按 `sha256-manifest.jsonl` 将备份目录中的文件恢复到对应源码路径。
3. 如只回滚 Codex MCP，使用独立备份覆盖
   `C:\Users\zhupu\.codex\config.toml`。
4. 如只回滚某个交付二进制，从
   `package/backup/<二进制名>/` 选择时间戳版本覆盖
   `package/bin/<二进制名>`。
5. 恢复后重新执行模块检查与 `package all`。

## 3. package 架构

### 3.1 新增或修改的入口

- `config/package-manifest.json`
  - 声明 7 个可执行产物和资源复制规则。
  - 每个模块使用独立 `--target-dir`。
- `scripts/package-all.ps1`
  - 逐项编译。
  - 比较源文件修改时间和 SHA-256。
  - 内容变化前备份旧二进制。
  - 每个同名二进制仅保留最近 10 次备份。
  - 生成 `package/package-report.json`。
  - 正确处理“编译器向 stderr 输出进度但退出码为 0”的情况。
- `package.ps1`
  - 支持 `.\package.ps1 all -Configuration debug`。
- `package.json`
  - 增加 `package:all` 命令。
- `package/run.ps1`
  - 提供 `app`、`web-console`、`tauri-shell`、`desktop-console`、
    `cli`、`computer-use-check`、`vision-smoke` 和
    `latest-desktop-vision` 运行入口。
- `package/README.md`
  - 记录构建、目录、备份和运行方式。

### 3.2 最终交付产物

`package/bin` 中共有 7 个二进制：

| 模块 | 二进制 |
| --- | --- |
| gui-web | `coolzhu-web-console.exe` |
| gui-desktop | `coolzhu-desktop-console.exe` |
| gui-desktop/Tauri | `coolzhu-tauri-shell.exe` |
| cli | `coolzhu-cli.exe` |
| computer-use | `coolzhu-computer-use-check.exe` |
| vision | `coolzhu-vision-smoke.exe` |
| vision | `coolzhu-latest-desktop-vision.exe` |

最终报告时间为 `2026-06-18T22:16:26.8420680Z`
（北京时间 2026-06-19 06:16:26），产物数 7。

本轮格式化后 Web Console 内容变化，旧二进制已备份到：

- `package/backup/coolzhu-web-console.exe/`

Tauri 旧二进制已备份到：

- `package/backup/coolzhu-tauri-shell.exe/`

当前同名备份最大数量为 2，未超过保留上限 10。

## 4. 运行时兼容与独立编译修复

### 4.1 Web Console

修改 `modules/gui-web/packages/web-console/src/main.rs`：

- 桌宠启动器候选路径增加当前 package 二进制同级目录，
  支持从 `package/bin/coolzhu-web-console.exe` 找到
  `package/bin/coolzhu-tauri-shell.exe`。
- 对 diagnostics 初始化、绑定地址解析、监听器绑定、本地地址读取和
  Axum server 运行失败补充结构化 `error_event`。
- 新增基本回归测试
  `desktop_pet_candidates_include_package_bin_neighbor`。

### 4.2 Desktop Console

修改 `modules/gui-desktop/packages/desktop-console/src/service.rs`：

- 构造 `MessageRequest` 时补充 `reasoning_effort: None`，修复脱离旧共享产物后
  的独立编译失败。

### 4.3 CLI

修改 `modules/cli/packages/command-line/src/main.rs`：

- 为 `RuntimeToolContext` 补充 profile 映射。
- `DangerFullAccess` 映射为 `FullAccess`，其他模式映射为
  `WorkspaceAuto`，修复独立编译契约缺失。

## 5. diagnostics 与 P0 错误日志

### 5.1 共享 diagnostics

修改：

- `modules/diagnostics/packages/diagnostics/src/lib.rs`
- `modules/diagnostics/packages/diagnostics/src/output.rs`

新增：

- `error_event_fields`
- `error_event`
- logger 尚未初始化时的 stderr JSON fallback
- context 合并和 error 字段回归测试

### 5.2 Tauri

修改：

- `modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.lock`
- `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`

结果：

- 使用本地 path dependency `coolzhu-diagnostics`。
- 在其他启动工作前初始化 diagnostics。
- diagnostics 初始化、tray/console/pet setup、运行时窗口创建和
  Tauri run 失败统一调用 `diagnostics::error_event`。
- 删除 Tauri 内重复的手写 JSON 错误格式化逻辑。
- 共有 8 个错误事件调用点。

## 6. Obsidian MCP 与文档迁移

### 6.1 配置

- 项目级：`.coolzhu/mcp_servers.json`
- Codex 用户级：`C:\Users\zhupu\.codex\config.toml`
- MCP 命令：
  `cmd /c npx -y mcp-obsidian C:\Users\zhupu\Desktop\codex\knowledge\obsidian-vault`
- 启动超时：120 秒。

### 6.2 Vault

Vault 路径：

`knowledge/obsidian-vault`

层级包括：

- 根目录
- `00-总体架构`
- `modules`
- `modules/gui-web`
- `modules/gui-desktop`
- `modules/computer-use`
- `modules/vision`
- `modules/llm-adapter`
- `modules/tooling`
- `modules/core-runtime`
- `modules/diagnostics`
- `modules/cli`

每级均包含：

- `原理流程图.md`
- `开发规范.md`
- `API接口.md`
- `work-log.md`
- `需求管理表.md`

最终共 12 组目录、60 个 Markdown 文件。原 `docs` 文档保留，没有删除。

### 6.3 MCP 冒烟测试

`mcp-obsidian` 1.0.0 stdio 握手成功：

- protocol：`2024-11-05`
- server：`mcp-obsidian` 1.0.0
- tools：`read_notes`、`search_notes`
- vault 指向本项目知识库

证据：

`tmp/logs/20260619-obsidian-mcp-final-smoke.log`

当前 Codex 线程在 MCP 配置写入前已经启动，因此当前线程暴露的旧工具 schema
没有热刷新参数。新建或重载 Codex 线程后会按新配置重新加载；服务器本身的
stdio 握手和工具清单已验证成功。

## 7. TDD 与自动验证

遵循最小 TDD，只覆盖本次根因：

1. package 更新、备份与只保留 10 次。
2. 构建向 stderr 输出但退出码为 0。
3. manifest 中每个模块使用独立 target。
4. Web Console 从 package 邻接目录发现 Tauri。
5. diagnostics context/error 合并。
6. Tauri 必须使用共享 diagnostics。

最终回归：

| 验证 | 结果 | 日志 |
| --- | --- | --- |
| package 更新/备份/裁剪 | 通过 | `tmp/logs/20260619-verify-package-all-behavior.log` |
| stderr 成功构建 | 通过 | `tmp/logs/20260619-verify-package-build-stderr.log` |
| 模块 target 隔离 | 通过 | `tmp/logs/20260619-verify-package-manifest-isolation.log` |
| diagnostics tests | 20 passed | `tmp/logs/20260619-verify-diagnostics-tests.log` |
| Tauri tests | 39 passed | `tmp/logs/20260619-verify-tauri-shell-tests.log` |
| Web package 路径测试 | 1 passed | `tmp/logs/20260619-verify-web-console-package-path-test.log` |
| Web Console cargo check | 通过 | `tmp/logs/20260619-verify-web-console-check.log` |
| Rust 格式化 | 通过 | `tmp/logs/20260619-rustfmt-root.log`、`tmp/logs/20260619-rustfmt-tauri.log` |
| 最终 package all | 通过 | `tmp/logs/20260619-package-all-final.log` |
| package Computer Use 后端预检 | `ready: true` | `tmp/logs/20260619-package-computer-use-preflight.log` |
| Obsidian MCP 握手 | 通过 | `tmp/logs/20260619-obsidian-mcp-final-smoke.log` |
| 最终交付一致性审计 | 通过 | `tmp/logs/20260619-final-architecture-audit.log` |

全量验证脚本：

`tmp/run-architecture-verification.ps1`

脚本为每个子命令设置超时，日志写入 `tmp/logs`。

## 8. Computer Use 真实前端验收

验收对象：

`package/bin/coolzhu-desktop-console.exe`

步骤与证据：

1. 使用 Computer Use 从 package 二进制路径启动应用。
2. 成功识别窗口 `COOLZHU AGENT控制台`。
3. 可访问性树识别到：
   - 元素 7：编辑框
   - 元素 8：发送按钮
   - 会话、工具调用和配置区域
4. 点击元素 7，模拟用户输入
   `package-ui-smoke-20260619`。
5. 截图中输入可见，`document_text` 同时返回相同文本。
6. 使用 `Ctrl+A`、`Backspace` 清空文本；确认
   `document_text` 为空。
7. 未点击发送，没有创建外部请求或写入测试会话。
8. 关闭窗口后重新枚举，剩余窗口数为 0。

结论：package 产物能够独立启动，Windows 窗口和基本前端输入链路可用。

## 9. Sub agent 执行与审查

- 文档/MCP 子任务：完成 12 组目录、60 个文档及项目级 MCP 配置。
- diagnostics/Tauri 子任务：完成共享 diagnostics 接入。
- 独立审查结论：
  - 本地 path dependency 正确。
  - diagnostics 初始化顺序正确。
  - 8 个错误事件调用点完整。
  - 重复 JSON formatter 已删除。
  - diagnostics 20 项、Tauri 39 项测试通过。
  - 未新增无关业务环境变量或硬编码路径闸口。

两名可见 sub agent 最终状态均为 `completed`，已在主任务收口时关闭。

## 10. 开发规范更新

`docs/development-standard.md` 新增“模块独立编译与 package 规范”：

- 模块独立 target。
- manifest 单一来源。
- package 统一运行入口。
- SHA-256 与修改时间比较。
- 最近 10 次同名备份。
- package report。
- 脚本超时和日志要求。

原有 Computer Use 验收、最小 TDD、禁止业务硬编码和高风险备份规范继续有效。

## 11. 已知问题与后续项

1. Web Console 仍有历史 dead-code 编译警告，本次没有扩大清理范围。
2. 纯 library 模块不会为了形式要求额外制造空二进制；只有可运行模块进入
   `package/bin`。
3. 当前线程需要重载或新建线程，Codex 才会重新读取新增的 Obsidian MCP
   工具 schema。
4. 后续模块新增二进制时必须先更新 package manifest 和相应基本回归测试。
