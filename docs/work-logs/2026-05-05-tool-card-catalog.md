# 2026-05-05 工具卡片 catalog 第一阶段落地

## 实现范围

- 新增 `GET /api/tools/catalog`，返回工具、插件、SKILL 分类目录。
- 新增 `GET /api/tools/{tool_id}`，返回单个目录项详情。
- 工具卡片前端新增分类列表和 `可用` 展开详情：
  - Core Tools：来自 `coolzhu-tool-registry` 的内置工具 schema。
  - Vision Tools：内视觉截图、描述、目标定位规划项。
  - Computer Use：闭环、靶场、耗时、语义调度规划项。
  - Plugins：扫描当前 codex 和 opencode 插件目录。
  - Skills：扫描当前 codex 和 opencode SKILL 目录。
- opencode 来源项标记为 candidate，只读展示，不自动迁移。
- `dry-run` 与 `execute` 按钮保留但禁用。

## 风险处理

| 风险 | 当前处理 |
| --- | --- |
| 插件脚本真实执行 | catalog 阶段不执行任何 hook、生命周期或工具命令 |
| opencode 路径假设不同 | 只标记 candidate，后续逐项迁移验证 |
| dangerous/full-access 工具误触发 | 前端禁用 execute，后端未新增执行入口 |
| LLM 关键词路由误判 | `REQ-TOOL-001` 保持开发中，后续改为 schema 驱动 |

## 验证

```powershell
node --check modules/gui-web/packages/web-console/src/app.js
cargo check -p coolzhu-web-console
```

## 后续

1. 为 `GET /api/tools/catalog` 补单元测试，覆盖 opencode candidate 扫描。
2. 设计 `POST /api/tools/{tool_id}/dry-run`，先接只读工具和安全预演。
3. 将 `coolzhu-session-manager` 作为迁移试点，只开放 `status_tmp`，`cleanup_tmp` 默认 dry-run。
4. 把 LLM tool calling 的 tool schema 列表从 catalog 生成，替换关键词式 dispatch。
