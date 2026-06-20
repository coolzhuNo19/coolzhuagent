# 2026-05-22 MSVC linker 修复与 WebSearch 回归恢复

## 背景

`cargo test -p coolzhu-tool-registry web_search_reads_base_url_and_transport_from_coolzhu_toml` 之前被 Windows MSVC 工具链缺失阻断，错误为 `linker link.exe not found`。该问题阻塞 Rust lib test 链接，也阻塞后续重新构建 Web Console 做四大核心真实回归。

## 根因

诊断脚本 `tmp/diagnose-msvc-linker.ps1` 输出显示：

- Rust host 为 `x86_64-pc-windows-msvc`。
- `where link` / `where cl` 均找不到。
- `vswhere` 初始返回空数组。
- Visual Studio 目录下没有 `VC\Tools\MSVC\...\link.exe`。

结论：不是 PATH 未加载，而是本机缺少 Visual C++ Build Tools。

## 修复

1. 用户手动下载 `https://aka.ms/vs/17/release/vs_BuildTools.exe` 到 `tmp/installers/vs_BuildTools.exe`。
2. 执行 `tmp/install-msvc-build-tools.ps1` 安装 Visual Studio Build Tools 2022。
3. `vswhere` 确认安装路径：
   - `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`
4. `VsDevCmd.bat` 环境中确认：
   - `VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe`
   - `VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\cl.exe`

## 伴随代码修复

linker 修复后，WebSearch 配置文件化 targeted test 暴露出 PowerShell fallback 参数传递问题：URL 被当作命令执行。已将 fallback script 改为 script block 参数形式：

```powershell
& { param([string]$SearchUrl); ... } <url>
```

这样保留“无需业务环境变量”的约束，同时避免 URL 拼接进脚本文本。

## 验证

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| MSVC linker 诊断 | PASS | `tmp/logs/msvc-linker-diagnosis-20260521-233952.log` |
| Build Tools 安装 | PASS | `tmp/logs/msvc-build-tools-install-20260521-235522.status.log` |
| VsDevCmd 下 linker smoke | PASS | `tmp/logs/msvc-linker-verify-20260522-001028.out.log` |
| WebSearch 配置 targeted test | PASS | `tmp/logs/websearch-config-test-20260522-002148.status.log` |
| WebSearch 相关测试组 | PASS | `tmp/logs/websearch-tests-msvc-20260522-001458.out.log`，4 passed |
| `coolzhu-web-console` check | PASS | `tmp/logs/web-console-check-msvc-20260522-001458.err.log` |
| 格式检查 | PASS | `tmp/logs/cargo-fmt-check-msvc-final-20260522-001757.status.log` |

## 备注

普通 PowerShell 中 `where link` 仍可能找不到，这是 MSVC 的常规行为；Rust/cargo 现在可以通过已安装的 Visual Studio Build Tools 自动发现 linker 并完成测试链接。需要显式 shell 工具时可通过 `VsDevCmd.bat` 或 `tmp/run-msvc-cargo-command.ps1` 执行。

## 备份

- `tmp/backups/msvc-linker-repair-20260522-0024-post`
