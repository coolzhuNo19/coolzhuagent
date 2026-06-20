# MCP 插件 / SKILL 管理窗口 —— 前端布局方案（2026-06-05）

> 目标：参考 Claude Code / Codex 的 MCP/插件/Skill **搜索→安装→管理** 体验，为 coolzhu web-console 重新规划一个独立的 MCP/SKILL 管理窗口布局。

## 一、现状盘点（当前项目）
- 已有 **catalog 展示**：`plugin_catalog_items()` / `skill_catalog_items()`（web-console main.rs:5181-5192），按 `plugins` / `skills` 分类，含权限、风险（`risk_for_plugin_permissions`）、来源路径。
- 已有 MCP 基座：`core-runtime/mcp.rs`、`mcp_client.rs`、`mcp_stdio.rs`。
- **缺口**：只有"本地已装的展示"，**没有 marketplace 搜索、一键安装、MCP server 可视化配置、更新/卸载、context cost 估算**。

## 二、主流参考（Claude Code）
- `/plugin` 打开 **tabbed 界面**：`Discover`（浏览 marketplace）/ `Installed`（已装+状态+skills）/ 等 4 tab，Tab 切换。
- plugin = **versioned bundle**：skills + slash commands + hooks + MCP servers，经 marketplace 分发。
- **安装 scope**：user（全局）/ project（仓库协作者）/ local（本仓自己）。
- **详情面板**：内容清单 + **context cost 估算** + last updated + "**Will install**"（commands/agents/skills/hooks/MCP/LSP）。
- marketplace + 已装 plugin **自动更新**（startup 刷新，提示 `/reload-plugins`）。

## 三、布局方案（三区式管理窗口）

```
┌─ MCP / SKILL 管理 ───────────────────────────────────────────┐
│ [Discover 发现] [Installed 已装] [MCP 服务器] [设置]   🔍搜索… │  ← 顶部 Tab + 全局搜索
├───────────────┬──────────────────────────────────────────────┤
│ 左：来源/筛选  │ 中：卡片列表（网格/列表切换）                  │
│ • 全部 market │ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ • 官方源      │ │ 插件卡    │ │ 插件卡    │ │ skill 卡  │        │
│ • 本地源      │ │ 名/作者   │ │ ⭐ skills:3│ │ ctx:~2k   │        │
│ • 已收藏      │ │ MCP:1 hook│ │ [安装]    │ │ [安装]    │        │
│ 分类:         │ └──────────┘ └──────────┘ └──────────┘        │
│ □ MCP □ Skill │ … 分页 / 无限滚动                             │
│ □ Hook □ Cmd  │                                              │
├───────────────┴──────────────────────────────────────────────┤
│ 右侧抽屉：详情面板（点卡片展开）                                │
│  名称/版本/作者/最后更新                                        │
│  「Will install」: 3 skills · 1 MCP server · 2 commands · 1 hook│
│  权限/风险标记（复用 risk_for_plugin_permissions，红/黄/绿）    │
│  Context 成本估算: ~2.1k tokens                                │
│  Scope: ( )user (•)project ( )local      [安装] [取消]         │
└───────────────────────────────────────────────────────────────┘
```

### 三个 Tab 的职责
1. **Discover（发现/搜索安装）**
   - 顶部搜索框（防抖，按名称/描述/标签）+ 来源下拉（marketplace）。
   - 卡片：名称、作者、一句话描述、**徽章**（skills N / MCP N / hooks N）、风险色点、context 成本、`[安装]`。
   - 点卡 → 右侧详情抽屉：`Will install` 清单 + 权限明细 + scope 选择 + 确认安装。
2. **Installed（已装管理）**
   - 列表：名称、版本、启用/禁用开关、**有更新角标**、来源、`[更新][卸载][查看]`。
   - 顶部"全部更新"按钮（对齐 Claude Code 的 auto-update + reload）。
3. **MCP 服务器（连接配置）**
   - 已配置 server：名称、传输（stdio / SSE / HTTP）、**连接状态点**（绿/红）、暴露的工具数。
   - `[+ 添加 server]` → 表单：name + 传输类型 + command/url + env + `[测试连接]`（复用 mcp_client 探活）。
   - 对齐 Codex/Claude 的 MCP server 手动配置 + 健康探测。

### 关键交互流程（搜索→安装）
```
搜索关键词 → 命中卡片列表 → 点卡片 → 详情(Will install + 权限 + ctx成本)
→ 选 scope → [安装] → 进度条 → 落地到对应 plugin_source_root / skills 目录
→ 成功后切到 Installed tab 高亮新项 + 提示"重载生效"
```

## 四、与现有代码的衔接（落地建议）
| 能力 | 复用 | 新增 |
|---|---|---|
| 已装展示 | `plugin_catalog_items`/`skill_catalog_items` | 改造为 Installed tab 数据源 |
| 风险/权限 | `risk_for_plugin_permissions` | 详情面板风险色点 |
| MCP 连接 | `mcp_client`/`mcp_stdio` | `/api/mcp/servers`(增删查) + `/api/mcp/test`(探活) |
| marketplace 搜索 | — | `/api/marketplace/search?q=`（先支持本地源 + 可配远程源 JSON manifest，对齐 `marketplace.json`） |
| 安装 | `plugin_source_roots`（落地目录） | `/api/plugins/install`（拉取→校验→落地→重载）+ scope 落点 |
| context 成本 | 复用上下文预算估算 | 装前估算 plugin 注入 token |
| 前端窗口 | web-console 现有多窗口系统（diagnostics/vision/memory/task 同款） | 新增 `mcp-skill` 窗口 + 三 Tab 组件 |

## 五、分期建议
- **P0**：Discover 搜索 + Installed 管理（启用/卸载）+ 详情 Will install/权限/scope —— 复用现有 catalog 数据，先支持本地源。
- **P1**：MCP 服务器 tab（添加/探活/状态）+ context 成本估算。
- **P2**：远程 marketplace 源（manifest JSON）+ 自动更新 + 收藏。

## 来源
- [Discover and install prebuilt plugins — Claude Code Docs](https://code.claude.com/docs/en/discover-plugins)
- [anthropics/claude-plugins-official marketplace.json](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)
- [claude-code/plugins/README.md](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
