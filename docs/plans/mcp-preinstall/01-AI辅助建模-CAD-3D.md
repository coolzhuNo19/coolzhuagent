# 01 · AI 辅助建模（CAD / 3D 建模）MCP 预装调试方案

> 类别：3D 建模 / 参数化 CAD。配合总纲使用。

## 一、类别概述
让 AI 通过 MCP 直接驱动建模软件：建几何体、布尔/参数化、装配、跑脚本生成模型。
当前生态以 **Blender**（艺术/通用 3D）与 **FreeCAD**（参数化 CAD）的 MCP 最成熟。

## 二、候选 MCP / 软件清单

| 软件 | 代表 MCP 项目 | 传输 | 成熟度 | 安装/依赖 | 许可 |
| --- | --- | --- | --- | --- | --- |
| Blender | `ahujasid/blender-mcp`（BlenderMCP，社区事实标准） | stdio | 高 | Blender + addon；`uvx blender-mcp` | 开源 |
| FreeCAD | `neka-nat/freecad-mcp`、`bonninr/freecad_mcp`、`proximile/FreeCAD-MCP`（支持 Claude/GPT-4o/Gemini、Docker headless、Vision） | stdio | 中 | FreeCAD + RPC addon；Python | 开源 |
| 通用 | CAD 几何脚本（OpenSCAD/CadQuery 类，可自行包 plugin） | stdio | 低-中 | Python | 开源 |

## 三、推荐预装组合
- **首选**：Blender + BlenderMCP（生态最活跃、文档最全、上手快）。
- **CAD 工程向**：FreeCAD + `freecad-mcp`（参数化、可 headless/Docker，适合批量生成）。

## 四、预装方式（在 coolzhu 落地）
1. 安装宿主：Blender（启用 BlenderMCP addon，开启其 socket 服务）/ FreeCAD（装 RPC addon）。
2. 运行时：`uv`/`uvx`（Blender MCP 常用）或 Python venv（FreeCAD）。
3. 注册（路径 B 过渡示例，manifest/`mcp_servers.json`）：
   - `command: uvx`，`args: ["blender-mcp"]`，`transport: stdio`。
   - FreeCAD：`command: python`，`args: ["-m", "freecad_mcp"]`（按所选实现调整）。
4. 自检：`tools/list` 应见 create/modify/scene/run-script 类工具。

## 五、调试与验收用例
- **只读冒烟**：获取场景对象列表 / 当前文档结构（无副作用）。
- **写入用例（授权后）**：创建一个立方体并改尺寸 → 截图比对。
- **参数化**（FreeCAD）：建带参数的零件，改一个参数验证重算。

## 六、风险与注意
- 宿主须**保持运行**且开启 socket/RPC，端口冲突需配置化。
- 写操作直接改 .blend/.FCStd 工程文件 → 先在示例工程验证，写操作走授权。
- Blender/FreeCAD 版本与 addon 版本须匹配，预装时固定版本号。

## 七、参考来源
- BlenderMCP（社区）、FreeCAD MCP：`neka-nat/freecad-mcp`、`bonninr/freecad_mcp`、`proximile/FreeCAD-MCP`、`contextform/freecad-mcp`。

## 接入状态（2026-06-11，已纳入 MCP Host 预装清单）

- **包**：blender-mcp (PyPI blender-mcp@1.6.2, ahujasid 官方, 经 python -m uv tool run)
- **连接自检**：connect 16.9s PASS（22 工具）。调用需 Blender 开启 addon socket，宿主就绪后冒烟 execute_blender_code 建 cube
- **工具数**：22
- **工具样例**：get_scene_info / get_object_info / get_viewport_screenshot / execute_blender_code / search_polyhaven_assets / download_polyhaven_asset / set_texture …
- 用法：`POST /api/mcp/servers/<id>/connect` → `POST /api/mcp/call`。依赖宿主/Key 的条目在 workspace `.coolzhu/mcp_servers.json` 配齐后冒烟。