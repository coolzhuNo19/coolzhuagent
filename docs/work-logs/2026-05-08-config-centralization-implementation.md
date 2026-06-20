# 2026-05-08 配置集中化与解耦硬编码实现日志

记录时间：2026-05-08

关联需求：
- `REQ-WEB-PROJECT-001`：工程目录路径切换
- `REQ-WEB-API-001`：卡片后端 API 补齐
- 新增 P0：解除环境依赖与硬编码路径

---

## 修改目标

1. 创建统一配置文件 `coolzhu.toml`，集中管理所有路径和运行时配置
2. 去掉所有硬编码路径和环境变量强制依赖
3. workspace 切换时配置自动跟随

## 配置文件结构

`coolzhu.toml` 位于 workspace 根目录，首次运行时自动生成。结构：

```toml
[paths]
data_dir = ".coolzhu"

[workspace]
default_dir = "coolzhuagent"
allowed_roots = []
opencode_master_project = ""

[session]
db_path = ""
json_path = ""
max_room_messages = 2000
max_session_messages = 2000
max_total_messages = 20000
max_beads_per_session = 500
max_estimated_bytes_mb = 256

[attachment]
store_dir = ""

[computer_use]
audit_log_path = ""

[vision]
capture_dir = ""
local_vlm_root = ""
model = ""
base_url = ""

[model]
reasoning = ""

[web]
bind_addr = "127.0.0.1:9865"

[pet]
enabled = true
exe_path = ""
```

## 修改文件清单

### `modules/gui-web/packages/web-console/Cargo.toml`
- 新增 `toml = "0.8"` 依赖

### `modules/gui-web/packages/web-console/src/main.rs`

**新增常量和结构体**（约 300 行）：
- `CONFIG_FILE_NAME = "coolzhu.toml"`
- `DATA_DIR_NAME = ".coolzhu"`  
- `DEFAULT_WORKSPACE_DIR = "coolzhuagent"`
- `WorkspaceConfig` 及其子结构体（`ConfigPaths`, `ConfigWorkspace`, `ConfigSession`, `ConfigAttachment`, `ConfigComputerUse`, `ConfigVision`, `ConfigModel`, `ConfigWeb`, `ConfigPet`）
- 所有子结构体实现 `Default` + `Serialize/Deserialize`

**新增函数**：
- `config_file_path_for()` / `load_workspace_config_at()` / `save_workspace_config_at()` / `workspace_config()` / `reload_workspace_config()` / `read_config()`
- `config_data_dir()` / `config_session_db_path()` / `config_session_json_path()` / `config_attachment_store_dir()` / `config_session_capacity()` / `config_web_bind_addr()` / `config_pet_enabled()` / `config_pet_exe_path()` / `config_vision_model()` / `config_vision_base_url()` / `config_reasoning_model()` / `config_local_vlm_root()`
- `configured_default_workspace_path()` — 从配置读取 workspace 目录名

**替换硬编码**：
| 原代码 | 改为 |
|---|---|
| `"coolzhuagent"` 硬编码 | `DEFAULT_WORKSPACE_DIR` 常量 + `config.workspace.default_dir` |
| `Desktop/deepseek/master-project` 硬编码 | 移除，仅通过 `config.workspace.allowed_roots` 配置 |
| `Desktop/opencode/master-project` 硬编码 | 同上 |
| `C:\Users\zhupu\Desktop\opencode\master-project` 硬编码 | `user_home_dir()/opencode/master-project` 默认值，优先 `config.workspace.opencode_master_project` |
| `.join(".coolzhu")` (workspace 范围) | `.join(&config_data_dir())` |
| `env::var("CLAW_WEB_ADDR")` → bind_addr | `config_web_bind_addr()` |
| `env::var("COOLZHU_ALLOWED_WORKSPACES")` | 保留 env var 兼容，新增 `config.workspace.allowed_roots` 从 TOML 读取 |

**workspace 切换时配置跟随**：
- `api_set_workspace()` 在更新 workspace 后调用 `reload_workspace_config()`
- 新 workspace 若无 `coolzhu.toml`，自动生成默认配置

### `modules/gui-web/packages/web-console/src/app.js`
- 新增 `REASONING_EFFORT_MATRIX`（28个模型映射）
- 新增 `updateReasoningEffortOptions()` — 动态生成思考程度选项
- `updateModelOptions()` — base_url/endpoint 仅自定义 provider 时显示
- `sessionPayloadFromForm()` — 仅自定义时发送 base_url/endpoint
- `setSessionForm()` — 条件显示自定义字段

### `modules/gui-web/packages/web-console/index.html`
- base_url/endpoint 字段加 `session-custom-field` class（默认隐藏）
- 思考程度 `<select>` 选项清空，由 JS 动态生成

### `modules/vision/packages/vision-service/src/lib.rs`
- 新增 `reasoning_effort: None` 到 `MessageRequest` 构造

### `modules/tooling/packages/tool-registry/src/lib.rs`
- 新增 `reasoning_effort: None` 到 `MessageRequest` 构造

### `docs/development-standard.md`
- 新增"配置管理原则"章节：禁止硬编码、禁止环境依赖、统一配置文件、workspace 跟随

### `docs/requirements-management.md`
- 新增 P0 需求：解除环境依赖与硬编码路径

## 验证

- `cargo check -p coolzhu-web-console` ✅
- `cargo fmt -p coolzhu-web-console` ✅
- `cargo test -p coolzhu-web-console --offline` **134 passed, 0 failed** ✅
- `node --check app.js` ✅
- 无循环依赖死锁 ✅

## 备份

- 本次备份路径：`codex\tmp\backups\session-config-coupling-fix-20260508-231316\`

## 后续待完成

以下模块仍有硬编码路径和 `CLAW_*` 环境变量引用，需后续轮次逐步迁移到配置文件：
- `modules/vision/packages/vision-service/src/lib.rs` — `.claw/desktop-capture`, `.claw/local-vlm`
- `modules/computer-use/packages/computer-use-core/src/input.rs` — `.claw/vendor/interception`
- `modules/llm-adapter/packages/llm-adapter/src/config.rs` — `.coolzhu/config.json`
- `modules/tooling/packages/tool-registry/src/lib.rs` — `.claw-todos.json`, `.claw-agents`, `/home/bellman/.codex/skills`
- `modules/core-runtime/packages/core-runtime/src/config.rs` — `.claw.json`, `.claw/settings.json`
- `modules/gui-desktop/packages/desktop-console/` — `.claw/sessions`
