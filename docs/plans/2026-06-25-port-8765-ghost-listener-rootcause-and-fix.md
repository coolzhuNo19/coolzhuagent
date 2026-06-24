# 8765 幽灵监听：根因与修复方案

> 状态：已修复并完成真实崩溃回收验证。
> 关联分支：`codex/browser-scheduler-launcher-fix`（launcher 侧已有未提交改动）。
> 实证日期：2026-06-25。

## 1. 现象

- `package` 启动（`COOLZHU-AGENT.exe` launcher）受阻：launcher 先启隐藏 web-console → poll health，
  但 8765 被占导致 web-console `bind` 失败、health 永不 ready → launcher 超时报错。
- `netstat -ano | findstr 8765` 显示 8765 处于 `LISTENING` + 多个 `CLOSE_WAIT`，
  且 `OwningProcess` 指向一个 **`tasklist` 查不到的 PID**（本次为 17300）。

## 2. 根因（已实证）

web-console 运行期会通过 `start_local_gemma()` 拉起本地 `llama-server.exe` 子进程；
spawn 时**子进程继承了 web-console 的 8765 监听套接字 handle**：

1. 8765 监听套接字由 `tokio::net::TcpListener::bind`（`main.rs:395`）创建，交 `axum::serve`（`main.rs:435`）。
2. `spawn_detached_logged`（`main.rs:2463`）用 `std::process::Command` 启动 llama-server，
   把 stdout/stderr 重定向到日志文件后 `.spawn()`。**函数名带 "detached" 但并未设 `DETACHED_PROCESS`**，
   也未做任何 handle 继承控制。
3. Windows 上 `std::process` 为了把重定向的 stdout/stderr handle 传给子进程，会以 **`bInheritHandles=TRUE`**
   调用 `CreateProcess`。此时**所有标记为 inheritable 的 handle 都会被子进程继承**——包括 8765 监听套接字
   （tokio/mio 若未把该 socket 设为 no-inherit，它就是 inheritable）。
4. web-console 主进程一旦**异常退出**（崩溃 / 被 `taskkill /F` 强杀 / 未优雅 `close` listener），
   其子进程（`llama-server` + 启动时附带的 `conhost`）仍存活、继续持有 8765 的 socket handle。
5. 内核因 handle 引用计数 > 0 而**不回收 8765**，端口被“幽灵”锁住；新实例 `bind` 失败 → launcher 阻塞。
   表现为 `OwningProcess` 仍记为已死的创建者 PID（17300），但真正持有 handle 的是活着的子进程。

### 2.1 实证链（2026-06-25）

| 事实 | 数据 |
|---|---|
| 8765 owner | PID **17300**（web-console），但 `tasklist`/`Get-Process`/`Win32_Process` 均查无 → 已死 |
| 仍存活的 17300 子进程 | `conhost`(4448, parent=17300)、`llama-server`(16812, parent=17300) |
| 16812 命令行 | `llama-server.exe -m gemma-4-12B-it-Q4_K_M.gguf --mmproj ... --port 8082 -ngl 24 -c 8192 --jinja`（即 web-console 拉起 gemma 的参数） |
| 关键验证 | **结束 4448 + 16812 后，8765 与 8082 立即释放** → 证实是子进程继承 handle 锁端口 |
| 复现父子关系 | 停新 web-console(8188) 进程树时，gemma(19088) 作为其子进程被 `taskkill /T` 连带终止 |

> 结论：这不是 TCP 超时问题（`CLOSE_WAIT` 只是表象），而是**子进程继承监听套接字 + 主进程崩溃后子进程孤儿化**的 handle 泄漏。

## 3. 修复方案（建议 方案1 + 方案3 为主，2/4 为辅）

### 方案 1：把 8765 监听套接字设为 non-inheritable（堵住继承源头，最根本）

`bind` 成功后立即清除该 socket 的继承标志，使任何 `bInheritHandles=TRUE` 的 spawn 都不再传递它：

```rust
// main.rs:395 listener = tokio::net::TcpListener::bind(address).await? 之后
#[cfg(windows)]
{
    use std::os::windows::io::AsRawSocket;
    // windows-sys：Win32::Foundation::SetHandleInformation / HANDLE_FLAG_INHERIT
    let raw = listener.as_raw_socket();
    unsafe {
        windows_sys::Win32::Foundation::SetHandleInformation(
            raw as _,
            windows_sys::Win32::Foundation::HANDLE_FLAG_INHERIT,
            0, // 清除 inherit 位
        );
    }
}
```

> 备注：Rust `std::net::TcpListener` 在 Windows 默认会清 inherit 位；本处用的是 **`tokio::net::TcpListener`**，
> 需核实其底层 mio socket 的 inheritability（旧版 mio 可能仍 inheritable）。先用 `handle.exe`/Process Explorer
> 确认 llama 进程持有的 8765 handle 来源后再下手最稳。

### 方案 3：用 Job Object 把子进程绑定到主进程生命周期（防孤儿，强烈建议）

`spawn_detached_logged` 启动 llama-server 后，将其加入一个设了 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`
的 Job Object，并由 web-console 持有 job handle。web-console 进程一旦退出（**含崩溃**），
内核自动终止 job 内所有进程 → gemma 不会孤儿化，它持有的端口随之释放。

- `CreateJobObjectW` + `SetInformationJobObject(JobObjectExtendedLimitInformation, KILL_ON_JOB_CLOSE)`
  + `AssignProcessToJobObject(job, child)`。
- 双保险：在 web-console 正常退出路径（`Drop` / Ctrl-C / 信号处理）显式 kill 记录的 llama child PID。

### 方案 2（辅助）：收敛 spawn 的 handle 继承

`spawn_detached_logged`（`main.rs:2463`）中，确认只有日志 stdout/stderr handle 需要被继承；
可考虑给 llama 进程加 `creation_flags(CREATE_NO_WINDOW)`，并把 `OpenOptions` 打开的 log `File`
也设为 non-inheritable（再以显式方式传递），减少多余 inheritable handle。但治本仍是方案 1。

### 方案 4（辅助，launcher 侧兜底，分支已在做）

launcher 启动前探测 8765：若被占且 `OwningProcess` 已死、或持有者是 `llama-server`，
则清理（结束持有 handle 的子进程）后再 bind。属防御性兜底，不替代方案 1/3 的治本。

## 4. 代码锚点（`modules/gui-web/packages/web-console/src/main.rs`）

| 位置 | 行 | 说明 |
|---|---|---|
| 8765 `bind` | 395 | `tokio::net::TcpListener::bind(address)` —— 方案1 在此后插入 |
| `axum::serve` | 435 | 服务主循环 |
| `spawn_detached_logged` | 2463 | spawn llama 的实际函数，`bInheritHandles=TRUE` 来源 —— 方案2/3 在此 |
| `start_local_gemma` | 2492 | 组装 llama 命令并调用 spawn |
| `switch_local_models` | 2663 | `/api/local-models/switch` 入口，`chat` 模式调 `start_local_gemma` |
| `config_web_bind_addr` | 5030 | 读 `[web] bind_addr` |

launcher 侧：`packages/app-launcher/src/{lib,main}.rs`（已有未提交改动，方案4）。

## 5. 验证

1. 启动 web-console → 切到 chat 拉起 gemma → 用 `handle.exe`/Get-NetTCPConnection 确认
   llama 进程**不再**持有 8765 handle。
2. `taskkill /F /PID <web-console>`（**只杀主进程、不带 `/T`**，模拟崩溃）→ 随后 8765 应被释放
   （方案3 下 gemma 被 job 连带终止；方案1 下即便 gemma 残留也不持有 8765）。
3. 立即重启 web-console，应能成功 `bind` 8765，无 “address already in use / 拒绝访问”。
4. 回归：launcher（`COOLZHU-AGENT.exe`）在上一实例崩溃后仍能正常启动。

## 6. 实施结果（2026-06-25）

已按方案 1 + 3 治本、方案 2 + 4 兜底完成：

- 新增 Windows 进程守卫 crate，将 8765 监听 socket 明确标记为 non-inheritable。
- 本地模型子进程加入 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` Job Object；Web Console 崩溃或被强杀时，由 Windows 内核回收 `llama-server.exe`。
- 本地模型进程使用 `CREATE_NO_WINDOW`，减少控制台窗口和无关句柄继承。
- launcher 启动前根据配置中的 health URL 探测实际端口：
  - 死亡 owner 仅清理其遗留的 `llama-server.exe` / `conhost.exe`；
  - 已知本地模型 holder 可安全清理；
  - 活跃 Web Console 或未知进程占用时快速失败，绝不误杀。
- launcher 的 Web Console 与 Tauri stdout/stderr 分离写入用户级日志目录，避免启动调用方继承输出句柄后无法退出。

真实验证：

- Web Console PID `10020` 启动 Gemma 后产生 `llama-server.exe` PID `8796`，父 PID 为 `10020`。
- 仅强制结束 Web Console 主进程后，PID `8796` 自动退出，8765 监听同步释放。
- 随后由 `package/COOLZHU-AGENT.exe` 重新拉起，`/api/diagnostics/health` 返回 HTTP 200，新 Web Console PID 为 `19476`。
- 重复启动会被 launcher 快速阻止，现有 Web Console 保持健康，不发生误杀。

详细证据见 `docs/work-logs/2026-06-25-port-8765-ghost-listener-fix.md`。
