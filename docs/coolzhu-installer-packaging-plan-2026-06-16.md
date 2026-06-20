# coolzhu agent 打包成可安装文件 实施方案（2026-06-16）

目标：把 coolzhu agent 打成 **Windows 安装包**（`.exe` NSIS / `.msi`），用户双击即装、桌面图标启动，自动拉起后端与本地模型。

---

## 1. 现有架构盘点（决定怎么打包）

| 组件 | 位置 | 体积 | 打包策略 |
|---|---|---|---|
| Tauri 外壳 | `modules/gui-desktop/.../tauri-shell`（`CoolzhuAgent` / `com.coolzhu.agent`，bundle targets "all"） | 小 | **装包内**（产出安装器） |
| Web 控制台后端+前端 | `coolzhu-web-console.exe`（UI 经 `include_str!` 内联，服务 + API 在 8765） | ~十几 MB | **装包内**（Tauri sidecar） |
| 桌面入口/桌宠 | `gui-desktop/desktop-console` | 小 | 装包内 |
| llama.cpp 运行时 | `C:\Users\zhupu\llama.cpp\...cuda-12.4` | ~数百 MB | **首启下载**（或「完整版」装包内） |
| 模型 | `coolzhu-model`(Q4_K_M 7.4G) + `mmproj`(168M) + `bge-m3`(0.6G) | **~8 GB** | **首启下载**（装包绝不内置） |
| 视觉子服务 | UI-DETR(`model.pth`) / ShowUI / local-vlm（Python） | 大 + 需 Python | 首启下载，或按[微调方案 §5](coolzhu-model-finetune-plan-2026-06-16.md)**融进模型后免 Python** |
| 配置/工作区 | `coolzhu.toml`、`~/coolzhuagent/.coolzhu/` | 小 | 首启**种子化**（不覆盖已存在） |

**核心决策**：安装包只装「应用骨架」（Tauri + web-console + 桌面入口，~几十 MB），**llama.cpp/模型/视觉权重一律首次启动时下载**（GB 级不能塞进安装器）。可选再出一个「完整版/离线版」把 llama.cpp + 模型一起打进 `resources/`。

---

## 2. 打包架构

```
CoolzhuAgent.exe (Tauri 壳)
 ├─ 启动时 spawn sidecar: coolzhu-web-console.exe   (8765, 后端+UI)
 ├─ 窗口加载 http://127.0.0.1:8765                  (健康检查通过后)
 ├─ 按需 spawn: llama-server.exe -m coolzhu-model   (8082, 本地模型)
 ├─ 托盘 + 桌宠 + single-instance
 └─ 退出：优雅关闭 sidecar（复用 pet_exit_closes_console / web_console_shutdown_signal）
```

> 现 `tauri.conf.json` 用 `devUrl: 8765` + `frontendDist: ../ui`。生产应让窗口在 sidecar 健康后导航到 `http://127.0.0.1:8765`（web-console 自带 UI+API）；`../ui` 仅放一个「正在启动…」加载页。

---

## 3. 实施步骤

### 3.1 web-console 作为 Tauri sidecar
1. 编译 `cargo build -p coolzhu-web-console --release` → 拷到 `tauri-shell/src-tauri/binaries/coolzhu-web-console-x86_64-pc-windows-msvc.exe`（Tauri sidecar 命名规范带 target triple）。
2. `tauri.conf.json` 增 `bundle.externalBin: ["binaries/coolzhu-web-console"]`。
3. `capabilities/default.json` 加 `shell:allow-execute`/sidecar 权限（已有 8765 url 权限）。
4. Tauri `setup` 钩子里 `app.shell().sidecar("coolzhu-web-console").spawn()`，轮询 `GET /api/sessions` 200 后再 `WebviewWindow` 导航 8765。

### 3.2 首启 setup 向导（关键）
web-console 加一个 `/setup` 流程（或 Tauri 原生向导），首次运行检测并引导：
1. **环境自检**：`nvidia-smi` 在否、显存大小、CUDA 驱动版本 → 选 cuda-12.4/13.3 构建（实测 596 驱动用 12.4）。
2. **下载组件**（ModelScope 国内源，断点续传，校验 sha256）：
   - llama.cpp cuda-12.4 zip → 解压到 `%LOCALAPPDATA%\CoolzhuAgent\llama.cpp\`
   - `coolzhu-model-Q4_K_M.gguf` + `mmproj`、`bge-m3`（可选视觉权重）→ `models\`
3. **种子配置**：写 `~/coolzhuagent/coolzhu.toml`（若不存在），含 `[model] enable_real_llm`、本地端点 `8082/8081`、`-ngl 33` 等已验证参数。
4. **拉起服务**：起 llama-server（模型 8082、bge-m3 8081）；健康检查通过 → 进主界面。
> 下载因「本机外网 ~12KB/s」会很慢——向导支持**手动放置**（检测到 `models\*.gguf` 已存在即跳过下载），并给 ModelScope 地址。

### 3.3 服务生命周期
- 复用已落地的 `pet_exit_closes_console`(默认 true) + `web_console_shutdown_signal` + `with_graceful_shutdown`：Tauri/桌宠退出 → 优雅关 web-console + llama-server。
- 端口占用检测：启动前探 8765/8082/8081，已占用则复用或提示。

### 3.4 出安装包
```powershell
# 前端加载页（../ui）放占位 index.html；sidecar exe 就位后：
cargo tauri build   # 读 tauri.conf.json，bundle targets "all"
# 产物：src-tauri/target/release/bundle/nsis/CoolzhuAgent_0.1.0_x64-setup.exe
#       src-tauri/target/release/bundle/msi/CoolzhuAgent_0.1.0_x64_en-US.msi
```
- 安装器自带 Tauri + web-console sidecar + 桌面/开始菜单快捷方式 + 卸载器。
- 体积：骨架版 ~30–60MB；完整版（含 llama.cpp+模型）~8GB（仅离线分发用）。

---

## 4. Python 视觉依赖的处理（三选一）

UI-DETR/ShowUI/local-vlm 是 Python 服务，最棘手：
1. **推荐（治本）**：按[微调 §5](coolzhu-model-finetune-plan-2026-06-16.md)把检测+grounding **融进 coolzhu-model**，安装包**完全免 Python**，只需 llama.cpp。
2. 过渡：打包 **嵌入式 Python（WinPython/embeddable）+ 预装 wheel**到 `resources\pyvision\`，首启 `pip install --no-index` 本地装；或 PyInstaller 把视觉服务各打成独立 exe。
3. 最简：视觉为可选功能，向导里单独「安装视觉增强（需 Python）」按钮，不阻塞主流程。

---

## 5. 版本更新 / 签名 / 分发

- **自更新**：接 `tauri-plugin-updater`，更新源放对象存储/自建；与现有 `[self_update] rollback_enabled` 对齐。仅更应用骨架，模型不随版本走。
- **代码签名**：`tauri.conf.json bundle.windows.certificateThumbprint` 填证书指纹（无签名会触发 SmartScreen 警告；个人可先跳过 + 文档提示「更多信息→仍要运行」）。
- **分发**：骨架版安装器（小，走普通下载）+ 模型走 ModelScope；或离线完整版（U盘/网盘）。

---

## 6. 里程碑

| 阶段 | 产出 |
|---|---|
| P1 sidecar 化 | web-console 作 Tauri sidecar，`cargo tauri build` 出能跑的骨架安装器（手动放模型可用） |
| P2 首启向导 | 环境自检 + 组件下载/手动放置 + 配置种子 + 服务自启 |
| P3 生命周期 | 退出联动、端口探测、错误恢复（下载失败重试/换源） |
| P4 视觉收敛 | 视觉融进模型免 Python（或嵌入式 Python 方案） |
| P5 更新+签名 | updater + 代码签名 + 完整版/骨架版双产物 |

## 7. 风险

- **8GB 模型不可内置 + 本机外网极慢** → 首启下载体验差，必须支持**手动放置 + 国内源 + 断点续传 + 校验**。
- Python 视觉依赖重 → 优先用「融进模型」根除。
- 无签名 → SmartScreen 拦截，需引导或购证书。
- 8GB 显存 → 安装后向导应提示「模型 + 视觉不可同时常驻」，默认单活跃模型。
- 首启需联网拉 GB 级组件，离线环境必须走完整版安装包。
