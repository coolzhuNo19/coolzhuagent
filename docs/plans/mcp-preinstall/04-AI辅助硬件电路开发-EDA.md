# 04 · AI 辅助硬件电路开发（EDA）MCP 预装调试方案

> 类别：电路原理图 / PCB 设计 / 仿真。配合总纲使用。

## 一、类别概述
让 AI 通过 MCP 操作 EDA 工具：工程管理、原理图分析、布局布线、DRC 设计规则检查、导出生产文件，
用自然语言替代 GUI/脚本完成 PCB 工作流。生态目前以开源 **KiCad** 的 MCP 最集中。

## 二、候选 MCP / 软件清单

| 项目 | 软件 | 传输 | 成熟度 | 说明 |
| --- | --- | --- | --- | --- |
| `lamaalrajih/kicad-mcp` | KiCad（Mac/Win/Linux） | stdio | 中 | 通用 KiCad MCP，跨平台 |
| `Seeed-Studio/kicad-mcp-server` | KiCad 9.0+ | stdio | 中 | 分析原理图、查 PCB、追连接、校验、生成嵌入式代码 |
| `circuit-synth/mcp-kicad-sch-api` | KiCad 原理图 | stdio | 中 | 暴露 kicad-sch-api，创建/修改/分析 .sch |
| `mixelpixx/KiCAD-MCP-Server` | KiCad | stdio | 中 | 让 Claude 直接做 PCB 设计 |
| `kicad-mcp-pro`（PyPI） | KiCad | stdio | 中 | pip 安装 |
| EDA Tools MCP（PulseMCP） | 多 EDA | stdio | 低-中 | 聚合 EDA 工具 |

> 仿真：纯仿真（SPICE 类）的成熟 MCP 较少，可经 KiCad 集成的 ngspice 或自包 plugin 过渡。

## 三、推荐预装组合
- **首选**：KiCad 9.0+ + `Seeed-Studio/kicad-mcp-server`（功能覆盖广、含校验/追连接）。
- **原理图为主**：`circuit-synth/mcp-kicad-sch-api`（.sch 精细操作）。
- **跨平台通用**：`lamaalrajih/kicad-mcp`。

## 四、预装方式（在 coolzhu 落地）
1. 宿主：安装 KiCad 9.0+（含 Python 脚本环境）。
2. 运行时：Python（`uv`/venv）或对应包管理；部分走 `pip install kicad-mcp-pro`。
3. 注册：`mcp_servers.json` → `command: uvx`/`python`，`args` 按实现，`transport: stdio`。
4. 自检：`tools/list` 见 project/schematic/pcb/DRC/export 类工具。

## 五、调试与验收用例
- **只读**：打开示例工程，列出原理图器件 / 追某网络连接 / 跑 DRC 报告。
- **写入（授权后）**：放置一个电阻并连线 → 重跑 DRC → 导出 Gerber（沙箱工程）。

## 六、风险与注意
- 直接改 .kicad_sch/.kicad_pcb 工程文件 → 用示例工程 + 版本控制，写操作走授权。
- KiCad 主版本 API 变动较大，固定到 9.x 并与所选 MCP 实现匹配。
- 生产文件（Gerber/BOM）导出影响实际打样，导出动作单列高风险确认。

## 七、参考来源
- `lamaalrajih/kicad-mcp`、`Seeed-Studio/kicad-mcp-server`、`circuit-synth/mcp-kicad-sch-api`、`mixelpixx/KiCAD-MCP-Server`、`kicad-mcp-pro`(PyPI)、EDA Tools MCP(PulseMCP)。

## 接入状态（2026-06-11，已纳入 MCP Host 预装清单）

- **包**：kicad-mcp (npm kicad-mcp@0.1.6, python wrapper)
- **连接自检**：首连 45s 超时（python 装依赖）→ 把 initialize 超时提至 180s；依赖缓存后 connect 2.7s PASS（280 工具）。调用需 KiCad 9+
- **工具数**：280
- **工具样例**：kicad_run_erc / kicad_run_drc / kicad_export_bom / kicad_export_gerbers / kicad_parse_erc_report …（280 工具，覆盖 ERC/DRC/BOM/Gerber/原理图/PCB 全流程）
- 用法：`POST /api/mcp/servers/<id>/connect` → `POST /api/mcp/call`。依赖宿主/Key 的条目在 workspace `.coolzhu/mcp_servers.json` 配齐后冒烟。