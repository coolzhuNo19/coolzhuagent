# Windows 安装包与配置隔离设计

## 目标

基于当前 `package.ps1`、`config/package-manifest.json`、WiX `Product.wxs` 和 `scripts/build-msi.ps1`，生成包含当前有效程序与必要资源的 release MSI，同时保证不包含当前模型会话、工作区运行态、数据库、密钥和用户私有配置。

## 构建数据流

```text
源码工作树
  -> release binaries
  -> sanitized package staging
  -> 配置与敏感数据门禁
  -> WiX MSI
  -> MSI 内容审计/行政解包
  -> 未安装 package 启动与 UI 验收
```

正式 MSI 只从净化 staging 构建，不直接对整个仓库或现有 `package/` 做递归 harvest。

## 安装内容

包含：

- `COOLZHU-AGENT.exe` 原生启动器。
- 当前 package manifest 声明的 release 模块二进制。
- Web Console、Tauri UI、Computer Use 和 Vision 所需的小型资源及工具脚本。
- 安全的启动器配置模板、包清单和构建报告。
- 桌面与开始菜单快捷方式。

不包含：

- 大模型、GGUF、embedding、视觉权重和下载缓存。
- 当前用户的 `coolzhu.toml`、环境变量文件、API 密钥和令牌。
- `.coolzhu/web-sessions*`、任何会话 JSON/SQLite、聊天附件和工作区状态。
- `package/backup`、`tmp`、日志、测试输出和源码备份。
- 当前 Codex 模型会话或本次对话产生的配置。

## 配置策略

安装包内只允许经过白名单声明的配置文件。当前安全候选为：

- `config/package-launcher.json`
- 必要的 package manifest 副本

禁止把整个仓库 `config/` 无条件复制到 staging。构建脚本在 WiX 前后执行两次扫描；发现可疑文件名、SQLite 文件、`.env`、含密钥模式的文本或会话目录时立即失败。

用户配置继续存放在安装目录之外。安装和升级不得覆盖已有用户配置；卸载不得删除 workspace、模型或用户数据。

## WiX 设计

- 保持固定 `UpgradeCode` 和 `MajorUpgrade`。
- 以 x64、per-machine MSI 构建。
- 入口快捷方式指向 `COOLZHU-AGENT.exe`。
- 所有收录文件来自 staging 的显式目录树。
- MSI 内不包含 package 备份和构建中间文件。
- 若本机没有代码签名证书，产物标记为“未签名测试版”，报告 SmartScreen 风险，不伪造签名完成状态。

## 验证

### 构建前

- release 二进制成功构建。
- package 自检无 error。
- staging 敏感数据扫描通过。

### 构建后

- MSI 和 WiX 调试符号均生成，记录 SHA-256。
- 通过 WiX 工具或 MSI 行政解包列出实际内容。
- 解包内容再次执行敏感数据扫描。
- 从净化 package 启动应用，验证 Web Console health 和桌面窗口。
- 使用 Computer Use 完成至少一次桌面点击和关键页面切换。

本轮不强制对本机执行管理员级正式安装；若未做安装/卸载，只能把“MSI 构建与内容验证”标记为通过，不能把系统安装生命周期标记为通过。

## 错误处理与回滚

- 修改 installer、package manifest 或打包脚本前，备份对应源码目录、配置和当前可用 package 清单。
- 构建失败不得覆盖上一份通过校验的 MSI。
- staging 和行政解包仅使用任务专用目录，所有删除操作先校验绝对路径仍在该目录内。
- 若应用启动失败，保留 stdout/stderr、自检报告和 MSI 内容清单用于根因分析。

## 验收标准

- 生成 `CoolzhuAgent-0.1.0.msi` release 产物及 SHA-256。
- MSI 包含声明的全部应用组件和必要资源。
- MSI 和行政解包结果均不含模型会话配置、数据库、密钥、备份或日志。
- 未安装 package 能启动，health 返回成功，桌面 UI 能被真实点击。
- 所有未完成的签名、管理员安装、卸载或硬件依赖项明确列在最终报告中。
