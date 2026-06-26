# 2026-06-26 本地模型生命周期、2D→3D 角色 demo 与任务质量复盘

## 背景

本轮继续用户上一轮任务：

1. Codex 崩溃并重启电脑后，重新检查是否需要拉起 `coolzhu-agent`；
2. 修复/验证本地模型、UI-DETR、ShowUI 在应用关闭时的生命周期问题；
3. 根据 `C:\Users\zhupu\Desktop\coolzhugame` 的角色设定基准和桌宠形象，生成魂系武侠 3D 人物定装图；
4. 调研当前 2D 游戏人物图到 3D 建模的 AI/MCP 技术路线；
5. 委托 GLM5.2 做一次 demo smoke，并记录执行中暴露的问题，为后续 Skill 约束沉淀做准备。

## 重启后状态

已完成重启后体检：

- `coolzhu-web-console.exe`：运行中，监听 `127.0.0.1:8765`；
- `coolzhu-tauri-shell.exe`：运行中；
- UI-DETR：运行中，监听 `127.0.0.1:7860`；
- ShowUI：运行中，监听 `127.0.0.1:8000`；
- 本地文本模型端口 `8082` 未监听，符合用户已关闭本地模型的状态；
- bge 端口 `8081` 未监听。

日志：

- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-post-reboot-state-check.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-route-and-artifact-check.log`

## 本地模型生命周期修复状态

当前 `modules/gui-web/packages/web-console/src/main.rs` 已包含本地服务退出清理修复：

- Web Console 退出后执行 `shutdown_local_model_services_on_exit()`；
- `spawn_detached` 子进程纳入 `windows-process-guard` Job Object；
- ShowUI 启动不再使用 `-Background` 逃逸父进程；
- 退出时清理 `8082/7860/8000/8081` 端口。

已验证：

- TDD 红灯：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-tdd-red-local-model-shutdown-2.log`
- TDD 绿灯：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-tdd-green-local-model-shutdown-2.log`
- 编译：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-cargo-build-web-console-shutdown-fix.log`
- package 复制：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-package-web-console-shutdown-fix.log`
- 关闭清理验证：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-verify-local-model-cleanup-on-web-console-exit.log`

## 角色设定与 Image Gen 产物

读取基准：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\玩家-剑客-角色基准.md`

结合桌宠形象要素：

- 黑色高马尾；
- 白灰武侠长袍；
- 金色龙肩甲；
- 发光赤剑；
- 竹林、冷月、魂系写实质感。

已生成定装图：

- 原始生成图：`C:\Users\zhupu\.codex\generated_images\019edc51-cad2-75b2-a19b-fb97b0877426\ig_037e3d934ca916fd016a3e7a8f854481989da69e13f874c508.png`
- 项目拷贝：`C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\wuxia-swordsman-soulslike-3d-model-sheet-20260626.png`
- 拷贝日志：`C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-copy-character-model-sheet.log`

## 2D→3D 技术调研结论

推荐分层路线：

1. **高质量生成**：Hunyuan3D-2.1 或 Microsoft TRELLIS/TRELLIS.2。
2. **本机 smoke**：TripoSR 类轻量单图到 mesh 路线。
3. **Agent/MCP 后处理**：Blender 官方 MCP Server 或社区 BlenderMCP。
4. **游戏可用化**：Blender 内做清理、材质、重拓扑、骨骼绑定，再导出到 UE5。

可信来源：

- Hunyuan3D-2.1：`https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1`
- Hunyuan3D-2.1 模型：`https://huggingface.co/tencent/Hunyuan3D-2.1`
- Microsoft TRELLIS：`https://github.com/microsoft/TRELLIS`
- TripoSR：`https://github.com/VAST-AI-Research/TripoSR`
- Blender 官方 MCP Server：`https://www.blender.org/lab/mcp-server/`
- BlenderMCP：`https://github.com/ahujasid/blender-mcp`
- MCP 官方文档：`https://modelcontextprotocol.io/`

风险判断：

- 当前机器为 RTX 3070 Ti Laptop 8GB 显存。本机可做 lightweight smoke，不宜直接承诺运行大型高质量生成模型。
- Hunyuan3D/TRELLIS 权重较大，如后续要本地跑，应先确认下载体积和 VRAM 要求；下载慢时由用户手动下载到约定路径。

## GLM5.2 demo 监督结论

GLM5.2 完成：

- 识别本机存在 Blender 5.1；
- 从角色定装图裁剪 `front_view_candidate.png`；
- 在 Blender 中生成占位 GLB；
- 渲染 `smoke_placeholder_render.png`；
- 调用 agnes-text 对渲染截图进行视觉描述。

产物：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\smoketest3d\front_view_candidate.png`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\smoketest3d\smoke_blender_placeholder.py`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\smoketest3d\smoke_placeholder.glb`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\smoketest3d\smoke_placeholder_render.png`

限制：

- 这不是正式 2D→3D 人物建模结果；
- 只是“裁剪图片 → Blender 占位资产 → GLB 导出 → 渲染 → 视觉识别”的 tail-chain smoke；
- 未运行 Hunyuan3D/TRELLIS/TripoSR 等真实生成模型；
- 原因是本机暂未准备对应权重/API，且当时可用显存较低。

## 暴露问题与沉淀位置

已拆分记录到以下问题库：

- 会话管理：`C:\Users\zhupu\Desktop\codex\docs\agent-quality\会话管理问题.md`
- 会话链路：`C:\Users\zhupu\Desktop\codex\docs\agent-quality\会话链路问题.md`
- 任务流转：`C:\Users\zhupu\Desktop\codex\docs\agent-quality\任务流转问题.md`
- 工具调用：`C:\Users\zhupu\Desktop\codex\docs\agent-quality\工具调用问题.md`
- compute use：`C:\Users\zhupu\Desktop\codex\docs\agent-quality\compute-use问题.md`

## 后续建议

1. 将问题库进一步转成可被 Goal prompt 自动加载的 SKILL。
2. 若要继续 2D→3D demo，优先做 TripoSR/BlenderMCP 小模型链路；Hunyuan3D/TRELLIS 放到权重下载和显存评估后。
3. 前端视觉确认继续由用户人工验收，自动化只负责可重复的 API、日志和产物验证。

