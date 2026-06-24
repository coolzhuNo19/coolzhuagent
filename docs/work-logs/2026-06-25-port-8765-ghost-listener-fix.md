# 2026-06-25 端口 8765 幽灵监听修复记录

## 目标

按照 `docs/plans/2026-06-25-port-8765-ghost-listener-rootcause-and-fix.md` 修复 Web Console 异常退出后，本地模型子进程继承并持续占用 8765 的问题；完成 package 构建并拉起 Web Console 验证。

## 风险控制

- 修改前备份：`tmp/backups/20260625-040036-port-8765-ghost-listener-pre`
- 备份清单与执行日志：`tmp/logs/port-8765-backup.log`
- 未覆盖或清理工作区内其他 agent 的未提交改动。
- 临时验证脚本全部放在 `tmp/`，执行输出写入 `tmp/logs/`，并设置超时。

## 根因

`tokio::net::TcpListener` 创建的 8765 listener 可被本地模型启动过程继承。Web Console 强制退出后，存活的 `llama-server.exe` / `conhost.exe` 仍持有 socket handle，内核无法回收端口。launcher 随后无法重新 bind 8765。

此外，launcher 启动的 Tauri 进程曾继承调用方输出句柄，导致自动验证包装器在应用正常常驻时不能自然结束；这与 8765 本身无关，但会干扰启动验证。

## 修改内容

### Web Console

- 新增 `modules/gui-web/packages/windows-process-guard`：
  - `make_socket_non_inheritable`：清除 listener 的 `HANDLE_FLAG_INHERIT`。
  - `ChildProcessJob`：创建启用 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 的 Job Object，并绑定本地模型子进程。
- 8765 bind 成功后立即设置 socket 为不可继承，失败则记录 `listener_inherit_guard_failed` 并停止启动。
- `spawn_detached_logged`：
  - Windows 下启用 `CREATE_NO_WINDOW`。
  - 子进程启动后加入全局本地模型 Job Object。
  - 绑定失败时立即结束并回收刚启动的子进程。
- 新增 Windows 回归测试：
  - listener 可以被设为 non-inheritable。
  - Job Object 关闭后，已分配子进程会被内核终止。

### Package launcher

- 从 `health_url` 解析端口，不硬编码 8765。
- 启动前查询监听 owner：
  - owner 已死亡：只清理该父 PID 遗留的 `llama-server.exe` / `conhost.exe`。
  - live owner 为已知本地模型 holder：允许安全回收。
  - live owner 为 Web Console 或其他进程：快速失败并输出 PID/进程名，不误杀。
- 默认配置路径相对 `COOLZHU-AGENT.exe` 解析，支持用户从任意当前目录双击启动。
- package 日志移到 `%LOCALAPPDATA%\CoolzhuAgent\logs\package-launcher`。
- Web Console 与 Tauri 的 stdout/stderr 分离到独立日志，避免常驻 GUI 继承启动器调用方输出句柄。

## TDD 与自动验证

| 项目 | 结果 | 日志 |
|---|---|---|
| listener guard RED | 未引入 guard crate 时按预期编译失败 | `tmp/logs/port-8765-listener-red.log` |
| listener guard GREEN | 测试通过 | `tmp/logs/port-8765-listener-green.log` |
| Job Object GREEN | 子进程生命周期测试通过 | `tmp/logs/port-8765-job-green.log` |
| launcher recovery RED/GREEN | owner 分类测试先失败后通过 | `tmp/logs/port-8765-launcher-red.log`、`tmp/logs/port-8765-launcher-green.log` |
| Tauri 输出句柄 RED/GREEN | 日志参数契约先失败后通过 | `tmp/logs/port-8765-tauri-log-red.log`、`tmp/logs/port-8765-tauri-log-green.log` |
| Web Console 全量测试 | 543 passed，0 failed | `tmp/logs/port-8765-web-console-full-test.log` |
| launcher 最终测试 | lib 20 passed；main 2 passed | `tmp/logs/port-8765-launcher-final-tests.log` |
| package all | 通过，更新 package 二进制并按既有策略备份旧文件 | `tmp/logs/port-8765-package-all-final.log` |

提交前再次执行完整门禁：

- `tmp/logs/port-8765-final-app-launcher-tests.log`：20 个 lib 测试、2 个 main 测试全部通过。
- `tmp/logs/port-8765-final-web-console-tests.log`：543 passed，0 failed。
- `tmp/logs/port-8765-final-format-diff-check.log`：`cargo fmt --all -- --check` 与根仓库 `git diff --check` 通过。
- `tmp/logs/port-8765-final-nested-diff-check.log`：gui-web 子仓库 `git diff --check` 通过。

## 真实运行验证

### 1. 主进程崩溃时回收本地模型

日志：`tmp/logs/port-8765-local-model-crash-recovery.log`

- Web Console PID：`10020`
- 切换 chat 后 Gemma `llama-server.exe` PID：`8796`
- `llama-server.exe` 父 PID：`10020`
- 仅执行 `Stop-Process -Id 10020 -Force`，不结束进程树
- 结果：
  - `llama_alive_after_web_kill=False`
  - `port_8765_listening_after_web_kill=False`
  - `result=PASS`

这同时证明 Job Object 在真实本地模型进程上生效，并且 8765 不再形成幽灵监听。

### 2. 重启与重复启动保护

- `tmp/logs/port-8765-runtime-verification-final3.log`：
  - 首次 launcher 启动成功，health HTTP 200。
  - 第二次 launcher 快速报告端口由 live `coolzhu-web-console.exe` 持有。
  - 首实例 health 仍为 HTTP 200，未被误杀。
- 该验证包装器最后显示 120 秒超时，是因为测试故意保留 Web Console/Tauri 常驻，PowerShell Job 等待后代输出句柄；JSON 断言在超时前已全部完成。launcher 随后增加 Tauri 独立 stdout/stderr 日志，消除产品启动链路的输出句柄继承。

### 3. 最终拉起

日志：`tmp/logs/port-8765-final-relaunch.log`

- `package/COOLZHU-AGENT.exe` 启动成功。
- `/api/diagnostics/health` 返回 HTTP 200。
- 最终 Web Console PID：`19476`。

## 人工确认

根据用户要求，本轮已拉起 Web Console。界面视觉与交互由用户人工确认；自动化只验证端口、进程生命周期、health 和重复启动保护。
