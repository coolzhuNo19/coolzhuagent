# 迁移说明

## 迁移来源

源目录：

```text
C:\Users\zhupu\Desktop\rust-claw\claw\rust
```

目标目录：

```text
C:\Users\zhupu\Desktop\codex
```

原目录未改动，新目录作为迁移后的集成仓。

## 命名变化

| 原 crate/package | 新 package | 目录 |
|---|---|---|
| `runtime` | `coolzhu-core-runtime` | `modules/core-runtime/packages/core-runtime` |
| `server` | `coolzhu-agent-server` | `modules/core-runtime/packages/agent-server` |
| `lsp` | `coolzhu-language-service` | `modules/core-runtime/packages/language-service` |
| `api` | `coolzhu-llm-adapter` | `modules/llm-adapter/packages/llm-adapter` |
| `tools` | `coolzhu-tool-registry` | `modules/tooling/packages/tool-registry` |
| `plugins` | `coolzhu-plugin-system` | `modules/tooling/packages/plugin-system` |
| `commands` | `coolzhu-command-router` | `modules/tooling/packages/command-router` |
| `compat-harness` | `coolzhu-compatibility-harness` | `modules/tooling/packages/compatibility-harness` |
| `vision` | `coolzhu-vision-service` | `modules/vision/packages/vision-service` |
| `computer-use` | `coolzhu-computer-use-core` | `modules/computer-use/packages/computer-use-core` |
| `claw-gui-web` | `coolzhu-web-console` | `modules/gui-web/packages/web-console` |
| `claw-gui` | `coolzhu-desktop-console` | `modules/gui-desktop/packages/desktop-console` |
| `claw-cli` | `coolzhu-command-line` | `modules/cli/packages/command-line` |
| `diagnostics` | `coolzhu-diagnostics` | `modules/diagnostics/packages/diagnostics` |

## 兼容策略

迁移初期通过 workspace dependency alias 保留 `runtime`、`api`、`tools`、`vision` 等 Rust import 名，保证最小编译通过。第二阶段再清理旧的 `claw` 类型名、命令文案和内部模块命名。
