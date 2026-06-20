# 集成测试目录

本目录只放跨模块联调测试。模块内部单元测试仍保留在各模块 package 内。

## 当前测试

| 测试文件 | 涉及模块 | 目的 |
|---|---|---|
| `module_linkage_smoke.rs` | `computer-use`、`vision`、`server`、`runtime` | 验证迁移后核心模块能通过根 workspace 联通 |
| `manual-visual-confirmation.md` | `gui-web`、`computer-use`、`vision` | 说明需要人工确认的视觉/真实输入测试 |

## 运行

```powershell
cargo test --test module_linkage_smoke --offline
```
