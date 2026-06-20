# 2026-06-19 UE 5.8 MCP 接入 Codex / Coolzhu

## 背景

- 用户询问 Obsidian 迁移文档位置，并要求为 Codex 和 Coolzhu agent 安装虚幻引擎 5.8 的 MCP 插件。
- 本次修改属于 MCP/配置接入，修改前按高风险配置规范进行了备份。

## 外部依据

- Epic 官方 UE 5.8 Unreal MCP 文档：
  - UE 5.8 的 Unreal MCP 是编辑器进程内置的本地 HTTP MCP Server。
  - 默认地址为 `http://127.0.0.1:8000/mcp`。
  - 插件标识为 `ModelContextProtocol`，友好名为 `Unreal MCP`。
  - 传输限制为 HTTP/SSE，不支持 stdio/WebSocket。
- OpenAI Codex 官方 MCP 文档：
  - Codex 支持 STDIO 和 Streamable HTTP MCP。
  - HTTP MCP 在 `~/.codex/config.toml` 中使用 `[mcp_servers.<name>]` + `url` 配置。

## 本地状态

- Obsidian 迁移库：
  - `C:\Users\zhupu\Desktop\codex\knowledge\obsidian-vault`
  - 当前共 60 个 Markdown 文档。
  - 顶层结构包含：
    - `00-总体架构`
    - `modules`
- UE 5.8 安装位置：
  - `C:\UE5.8\UE_5.8`
- UE 5.8 官方 MCP 插件文件：
  - `C:\UE5.8\UE_5.8\Engine\Plugins\Experimental\ModelContextProtocol\ModelContextProtocol.uplugin`
- 当前工作区未发现用户 `.uproject` 文件，因此本次没有擅自修改引擎模板或自动启用某个 UE 项目的插件。

## 备份

- 备份目录：
  - `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-090758-ue58-mcp-config-pre`
- 备份内容：
  - `C:\Users\zhupu\.codex\config.toml`
  - `C:\Users\zhupu\Desktop\codex\.coolzhu\mcp_servers.json`
- manifest：
  - `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-090758-ue58-mcp-config-pre\manifest.json`

## 修改内容

### Codex

修改：

- `C:\Users\zhupu\.codex\config.toml`

新增：

```toml
[mcp_servers.unreal-mcp]
url = "http://127.0.0.1:8000/mcp"
startup_timeout_sec = 20
tool_timeout_sec = 60
enabled = true
required = false
default_tools_approval_mode = "prompt"
```

### Coolzhu agent

修改：

- `C:\Users\zhupu\Desktop\codex\.coolzhu\mcp_servers.json`

新增：

```json
"unreal-mcp": {
  "type": "http",
  "url": "http://127.0.0.1:8000/mcp",
  "transport": "http",
  "enabled": true,
  "scope": "project",
  "notes": "Unreal Engine 5.8 built-in Experimental ModelContextProtocol/Unreal MCP server. Enable Unreal MCP in UE 5.8 editor and start/auto-start server on 127.0.0.1:8000/mcp."
}
```

## 验证

- 静态配置验证：
  - `C:\Users\zhupu\Desktop\codex\tmp\logs\20260619-ue58-mcp-config-verify.log`
  - Coolzhu JSON：PASS
  - Codex TOML：PASS
  - `codex mcp list`：PASS，已列出 `unreal-mcp` HTTP 条目。
- 后端解析契约测试：
  - 命令：`cargo test -p coolzhu-core-runtime parses_typed_mcp_and_oauth_config --offline`
  - 日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\20260619-ue58-mcp-core-runtime-test.log`
  - 结果：1 passed, 0 failed。
  - 备注：测试期间出现既有 warning：`unused import: MemoryEdge`，与本次 MCP 配置修改无关。

## 仍需用户在 UE 编辑器内完成的步骤

因为 Unreal MCP 是 UE 5.8 编辑器内置插件，不是单独 npx/pip 包，且当前没有用户项目 `.uproject` 可安全修改，所以还需要在目标 UE 项目里执行：

1. 打开目标 UE 5.8 项目。
2. `Edit > Plugins` 搜索 `Unreal MCP`，勾选启用。
3. 重启编辑器。
4. `Edit > Editor Preferences > General > Model Context Protocol` 开启 `Auto Start Server`，或在控制台运行：
   - `ModelContextProtocol.StartServer 8000`
5. 从目标项目根目录启动 Codex/Coolzhu agent，即可连接 `http://127.0.0.1:8000/mcp`。

## 回滚方法

如需回滚：

1. 关闭 Codex/Coolzhu 进程。
2. 从备份目录恢复：
   - `Users_zhupu_.codex_config.toml` → `C:\Users\zhupu\.codex\config.toml`
   - `Users_zhupu_Desktop_codex_.coolzhu_mcp_servers.json` → `C:\Users\zhupu\Desktop\codex\.coolzhu\mcp_servers.json`
3. 重启 Codex/Coolzhu。
