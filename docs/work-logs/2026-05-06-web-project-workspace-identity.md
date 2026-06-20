# 2026-05-06 工程目录 workspace_id 隔离底座

记录时间：2026-05-06 07:35:55 +08:00

## 关联需求

- `REQ-WEB-PROJECT-001`：工程目录路径切换。

## 目标

为 workspace 切换后的会话、记忆、附件和工具权限隔离提供稳定边界键，避免后续隔离实现只能依赖易变的显示路径字符串。

## TDD 过程

红灯：

- 新增 `workspace_identity_is_stable_and_path_scoped` 单测。
- 要求同一路径生成相同 `workspace_id`，不同路径生成不同 `workspace_id`，并要求 `/api/workspace` 响应结构包含该字段。
- 初始失败日志：`tmp/workspace_identity_tdd_red.log`，失败点为缺少 `workspace_identity` 与 `workspace_id` 字段。

绿灯：

- 新增 `workspace_identity(&Path) -> String`，将 canonical workspace 路径归一化为小写 `/` 分隔路径后生成 `ws-<16位hex>`。
- `/api/state` 和 `/api/workspace` 响应均新增 `workspace_id`。
- 接口契约同步说明 `workspace_id` 的用途。

## 修改文件

- `modules/gui-web/packages/web-console/src/main.rs`
- `modules/gui-web/INTERFACE.md`
- `docs/requirements-management.md`

## 验证

- `cargo fmt -p coolzhu-web-console`
- `cargo check -p coolzhu-web-console --offline`
- `cargo test -p coolzhu-web-console --offline`

结果：

- `cargo check` 通过，日志：`tmp/workspace_identity_check.log`。
- `cargo test` 通过，113 项测试全部成功，日志：`tmp/workspace_identity_test.log`。

## 后续

- 会话库、beads、附件索引和工具执行权限应继续下沉 `workspace_id`，避免不同 workspace 的数据串用。
- 真实工具执行仍保持独立安全闸门，不因为 workspace 位于允许根目录就自动放开。

## 备份

- 本次备份路径：`tmp/backups/web-project-workspace-identity-20260506-073636`。
