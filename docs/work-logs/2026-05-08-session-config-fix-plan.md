# 2026-05-08 工程目录卡与配置/会话/Agent 卡片修改方案

记录时间：2026-05-08

关联需求：
- `REQ-WEB-PROJECT-001`：工程目录路径切换
- `REQ-WEB-API-001`：卡片后端 API 补齐
- 新增：自定义模型端点 + 思考程度

---

## 当前备份

```
codex\tmp\backups\session-config-coupling-fix-20260508-231316\
  modules\gui-web\packages\web-console\
    src\app.js
    src\main.rs
    src\styles.css
    index.html
```

参照备份：`codex\tmp\backups\dependent-diag-media-20260506-220005\`（修改前稳定版本）

---

## 问题一：工程目录卡片路径修改方案

### 目标

使 workspace 切换后以下子系统跟随切换：
1. 会话存储（SQLite + JSON）
2. 文件附件存储
3. API Key 相对路径解析

### 修改范围

#### 1.1 `default_session_sqlite_path()` — 行 8086-8097

**现状**：
```rust
fn default_session_sqlite_path() -> PathBuf {
    if let Ok(path) = env::var("COOLZHU_WEB_SESSION_DB") { ... }
    env::current_dir().unwrap_or_else(|| PathBuf::from("."))
        .join(".coolzhu").join("web-sessions.sqlite3")
}
```

**修改为**：
```rust
fn default_session_sqlite_path() -> PathBuf {
    if let Ok(path) = env::var("COOLZHU_WEB_SESSION_DB") { ... }
    active_workspace_path().join(".coolzhu").join("web-sessions.sqlite3")
}
```

**风险**：
- workspace 切换后旧会话数据不可见（需确认：是否需要在切换时迁移数据？还是每个 workspace 独立数据库？）
- workspace 路径可能没有 `.coolzhu` 目录，首次需要创建
- **确认点 1**：用户期望的是 workspace-scoped 独立会话管理，还是全局会话 + 路径联动？

#### 1.2 `default_session_store_path()` — 行 8073-8083

同上改为基于 `active_workspace_path()`。

#### 1.3 `attachment_store_dir()` — 行 5214-5230

**现状**：从 session DB 路径父目录推导：
```rust
fn attachment_store_dir() -> Option<PathBuf> {
    let db = default_session_sqlite_path();
    db.parent().map(|p| p.join(".coolzhu").join("attachments"))
}
```

**修改为**：直接基于 `active_workspace_path()`，与上述改动后自动跟随。

#### 1.4 `resolve_api_key_ref()` — 行 6413-6443

**现状**：`env::current_dir()` 作为 Key 文件搜索根：
```rust
fn resolve_api_key_ref(ref_value: &str) -> Option<String> {
    // ...
    let search_paths = [
        PathBuf::from(ref_value),
        env::current_dir().ok()?.join(ref_value),  // ← 这里
        PathBuf::from(".coolzhu").join(ref_value),
    ];
}
```

**修改为**：增加到 `active_workspace_path()` 的搜索：
```rust
let workspace = active_workspace_path();
let search_paths = [
    PathBuf::from(ref_value),
    workspace.join(ref_value),                    // workspace 优先
    env::current_dir().ok()?.join(ref_value),     // 进程 CWD 兜底
    workspace.join(".coolzhu").join(ref_value),
];
```

#### 1.5 明确不修改的子系统

| 子系统 | 原因 |
|---|---|
| `plugin_source_roots()` / `skill_source_roots()` | plugins/skills 绑定到 codex 仓库安装目录，非用户项目 workspace |
| `build_diagnostics_health()` | 诊断应反映 codex 安装环境，非用户项目 |
| `computer_use_audit_log_path()` | audit log 用于安全审计，应跟随 codex 安装目录 |
| `codex_project_root()` | 始终指向 codex 仓库根，与 workspace 概念正交 |
| `opencode_master_project_root()` | 硬编码路径，应改为仅依赖 `COOLZHU_OPENCODE_MASTER_PROJECT` 环境变量 |

### 建议的 workspace 隔离策略

```
workspace 切换时：
  1. 更新 WorkspaceState.current（已实现）
  2. 不自动迁移历史会话数据（避免意外数据泄露）
  3. 每个 workspace 有独立的 .coolzhu/ 子目录
  4. 切换后 /api/state 和 /api/sessions 自动指向新 workspace 的数据
```

### 测试场景

1. TDD 红灯：新增单测 `workspace_switch_changes_session_store_path`
2. 验证：修改 workspace → 新会话创建在正确路径 → 旧 workspace 的会话可见性
3. 附件上传后切换 workspace → 附件路径跟随

---

## 问题二：配置/会话/Agent 卡片重新实现方案

### 需求再确认

1. **自定义模型作为 Provider 同级选项**：在 Provider 下拉中新增"自定义模型 API"选项
2. **Base URL 和 Endpoint 条件显示**：仅当 Provider 选择"自定义模型 API"时才显示和启用这两个输入框
3. **思考程度按模型动态选项**：不是所有模型都支持 4 级 reasoning_effort，根据模型实际能力提供不同选项

### 实施策略

**步骤 1：回退前端代码到备份版本**
- 将 `index.html` 和 `app.js` 恢复为 `dependent-diag-media-20260506-220005` 版本
- 保留当前 `main.rs` 的后端能力（已支持 base_url/endpoint/reasoning_effort 持久化）

**步骤 2：在干净基线上重新实现功能**

#### 2.1 index.html 修改

在 Provider 下拉中新增"自定义模型 API"选项：
```html
<select data-role="session-provider">
  <!-- 现有 11 个 provider 不变 -->
  <option>OpenAI-compatible (自定义)</option>
</select>
```

Base URL 和 Endpoint 字段默认隐藏，通过 CSS class 控制：
```html
<!-- 两个字段放在 session-agent-grid 内，默认隐藏 -->
<label class="config-field custom-model-field" style="display:none">
  <span>Base URL</span>
  <input data-role="session-base-url" placeholder="http://127.0.0.1:8000/v1" autocomplete="off" />
</label>
<label class="config-field custom-model-field" style="display:none">
  <span>Endpoint</span>
  <input data-role="session-endpoint" placeholder="chat/completions" autocomplete="off" />
</label>
```

思考程度下拉：
```html
<label class="config-field">
  <span>思考程度</span>
  <select data-role="session-reasoning-effort"></select>
  <!-- 选项由 JS 根据模型动态生成 -->
</label>
```

#### 2.2 app.js 修改

**2.2.1 PROVIDER_MODELS 扩展**：
```js
const PROVIDER_MODELS = {
  // 现有 11 个 provider 保持不变
  "OpenAI-compatible (自定义)": ["custom-model"],  // 允许用户自由输入
};
```

**2.2.2 REASONING_EFFORT_MATRIX（新增）**：
```js
const REASONING_EFFORT_MATRIX = {
  // 默认仅支持 medium（保守策略）
  "default": ["medium"],
  // DeepSeek 系列
  "deepseek-v4-pro": ["low", "medium", "high"],
  "deepseek-v4-flash": ["low", "medium"],
  "deepseek-reasoner": ["medium", "high"],
  // 智谱 GLM 系列
  "glm-4.7": ["low", "medium", "high"],
  "glm-4.6": ["low", "medium"],
  "glm-free": ["medium"],
  // OpenAI 系列
  "gpt-4.1": ["low", "medium", "high", "xhigh"],
  "gpt-4o-mini": ["low", "medium", "high"],
  // Anthropic 系列
  "claude-sonnet-4-6": ["low", "medium", "high"],
  "claude-opus-4-6": ["low", "medium", "high"],
  // 通用兼容模式
  "custom-model": ["medium"],  // 自定义端点保守策略
};
```

**2.2.3 `updateModelOptions()` 增强**：
```js
function updateModelOptions() {
  const provider = document.querySelector('[data-role="session-provider"]')?.value;
  const modelSelect = document.querySelector('[data-role="session-model"]');
  const baseUrlField = document.querySelector('[data-role="session-base-url"]')?.closest('.config-field');
  const endpointField = document.querySelector('[data-role="session-endpoint"]')?.closest('.config-field');
  
  // 条件显示 Base URL / Endpoint
  const isCustom = provider === "OpenAI-compatible (自定义)";
  if (baseUrlField) baseUrlField.style.display = isCustom ? "" : "none";
  if (endpointField) endpointField.style.display = isCustom ? "" : "none";
  
  // 动态填充思考程度选项
  updateReasoningEffortOptions();
  
  // 填充模型列表（同现有逻辑）
  // ...
}
```

**2.2.4 `updateReasoningEffortOptions()`（新增）**：
```js
function updateReasoningEffortOptions() {
  const model = document.querySelector('[data-role="session-model"]')?.value?.trim();
  const select = document.querySelector('[data-role="session-reasoning-effort"]');
  if (!select) return;
  
  const levels = REASONING_EFFORT_MATRIX[model] || REASONING_EFFORT_MATRIX["default"];
  const current = select.value || "medium";
  
  select.replaceChildren();
  const labels = { low: "低", medium: "中", high: "高", xhigh: "超高" };
  levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = labels[level] || level;
    option.selected = level === current;
    select.append(option);
  });
}
```

**2.2.5 `sessionPayloadFromForm()` 扩展**：
```js
function sessionPayloadFromForm() {
  const provider = document.querySelector('[data-role="session-provider"]')?.value;
  const isCustom = provider === "OpenAI-compatible (自定义)";
  return {
    name: ...,
    provider: provider ?? "DeepSeek",
    model: ...,
    base_url: isCustom ? (document.querySelector('[data-role="session-base-url"]')?.value?.trim() ?? "") : "",
    endpoint: isCustom ? (document.querySelector('[data-role="session-endpoint"]')?.value?.trim() ?? "") : "",
    reasoning_effort: ...,
    api_key_ref: ...,
  };
}
```

**2.2.6 `setSessionForm()` 扩展**：
```js
function setSessionForm(session) {
  // ... 现有设置 provider/model/name ...
  
  const provider = session.provider;
  const isCustom = provider === "OpenAI-compatible (自定义)";
  if (baseUrlField) baseUrlField.style.display = isCustom ? "" : "none";
  if (endpointField) endpointField.style.display = isCustom ? "" : "none";
  if (isCustom) {
    baseUrl.value = session.base_url || "";
    endpoint.value = session.endpoint || "";
  }
  
  // 思考程度
  updateReasoningEffortOptions();
  reasoningEffort.value = session.reasoning_effort || "medium";
}
```

### 后端对齐（main.rs 最小修改）

当前后端已支持 base_url/endpoint/reasoning_effort 的 CRUD + SQLite 持久化，无需大改。唯一对齐点：

**`normalize_provider()` 确保"OpenAI-compatible (自定义)"被识别**：
确认 `provider_kind_from_name()` 已包含映射（行 270-293 已包含 `"OpenAI-compatible (自定义)"` → `ProviderKind::Custom`）。

### 测试场景

1. 选择 DeepSeek → base_url/endpoint 隐藏 → 思考程度仅显示 low/medium/high
2. 选择"自定义模型 API" → base_url/endpoint 显示 → 思考程度仅显示 medium（custom-model 保守）
3. 切换模型（如 deepseek-reasoner）→ 思考程度选项变为 medium/high
4. 保存会话 → 刷新页面 → 字段值正确恢复
5. 切换 workspace → 新的自定义会话正确保存到新 workspace 的 SQLite

---

## 实施步骤

### Phase 1：备份与回退（TDD 红灯阶段）

1. 备份当前代码（已完成 → `session-config-coupling-fix-20260508-231316`）
2. 复制备份版 `index.html` 和 `app.js` 覆盖当前文件
3. 运行 `cargo check -p coolzhu-web-console --offline` 确认编译通过
4. 运行 `cargo test -p coolzhu-web-console --offline` 确认测试通过（预期失败 → 新增测试的红灯）

### Phase 2：问题二修改（前端 UI 重构）

1. 新增单测：`web_session_custom_model_fields_conditional_visibility`
2. 修改 `index.html`：添加条件字段 + 思考程度下拉
3. 修改 `app.js`：实现 conditional display + dynamic reasoning options
4. 运行 `node --check` + `cargo check` + `cargo test`

### Phase 3：问题一修改（workspace 路径联动）

1. 新增单测：`workspace_switch_changes_session_store_path`
2. 修改 `default_session_sqlite_path()` 等 3 个函数
3. 运行 `cargo test -p coolzhu-web-console --offline`

### Phase 4：整体验证

1. `cargo check -p coolzhu-web-console --offline`
2. `cargo test -p coolzhu-web-console --offline`
3. `node --check modules/gui-web/packages/web-console/src/app.js`
