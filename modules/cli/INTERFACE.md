# CLI 对外接口说明

## 模块职责

`cli` 提供命令行入口，用于文本交互、调试、兼容命令和非 GUI 环境运行。

## 对外 package 与命令

- `coolzhu-command-line`
- bin：`coolzhu-cli`

## 接口变更审查点

- CLI 参数变化必须同步 `docs/command-line.md`。
- slash command 行为应从 `tooling/command-router` 获取，CLI 不单独维护一份协议。
- CLI 只作为入口，不直接实现 provider、tools、computer-use 业务。

## 独立验证

```powershell
cargo check -p coolzhu-command-line --offline
cargo run -p coolzhu-command-line -- --help
```
