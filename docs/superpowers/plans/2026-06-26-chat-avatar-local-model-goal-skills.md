# Chat Avatar, Local Model Path, and Goal Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Mario chat fallback, make the local GGUF model path user-configurable, brand local-model output as `coolzhu-model`, and inject three reusable execution skills into every Goal phase.

**Architecture:** Keep UI state in the existing web-console frontend and persist all model paths through the typed `[model]` section of `coolzhu.toml`. Reuse one backend validation path for typed input and the Windows file picker. Resolve Skill files from registered repository roots and append bounded Skill guidance to Goal prompts.

**Tech Stack:** Rust, Axum, Serde/TOML, vanilla JavaScript/CSS, Windows PowerShell OpenFileDialog, Cargo tests.

---

### Task 1: Create rollback evidence

**Files:**
- Backup: `modules/gui-web/packages/web-console`
- Create: `tmp/backups/20260626-local-model-goal-skills-pre/manifest.sha256`
- Create: `tmp/logs/2026-06-26-local-model-goal-skills-backup.log`

- [ ] **Step 1: Copy the complete source directory**

Run:

```powershell
$source = (Resolve-Path "modules/gui-web/packages/web-console").Path
$backup = Join-Path (Resolve-Path "tmp").Path "backups/20260626-local-model-goal-skills-pre"
if (-not $backup.StartsWith((Join-Path (Resolve-Path "tmp").Path "backups"))) { throw "backup escaped tmp/backups" }
Copy-Item -LiteralPath $source -Destination $backup -Recurse -Force
```

- [ ] **Step 2: Generate SHA-256 evidence**

Run:

```powershell
Get-ChildItem -LiteralPath $backup -File -Recurse |
  Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash)  $($_.Path)" } |
  Set-Content -LiteralPath "$backup/manifest.sha256" -Encoding UTF8
```

- [ ] **Step 3: Verify the backup**

Run:

```powershell
$sourceCount = (Get-ChildItem -LiteralPath $source -File -Recurse).Count
$backupCount = (Get-ChildItem -LiteralPath $backup -File -Recurse | Where-Object Name -ne "manifest.sha256").Count
if ($sourceCount -ne $backupCount -or -not (Get-Item "$backup/manifest.sha256").Length) { throw "backup verification failed" }
```

### Task 2: Write failing regression tests

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: Add avatar contract assertions**

Assert that `addMessage()` uses `defaultIconUrlForMessage` and that ordinary user messages no longer return `mario`.

```rust
assert!(WEB_APP_JS.contains("defaultIconUrlForMessage(message)"));
assert!(!WEB_APP_JS.contains(r#"message.kind === "multimedia" ? "image-preview" : "mario""#));
```

- [ ] **Step 2: Add local model configuration tests**

Construct `ConfigModel` with a temporary `.gguf` file, verify path normalization, persistence DTO fields, and that startup path resolution reads config.

```rust
let model_path = temp.path().join("coolzhu-model.gguf");
std::fs::write(&model_path, b"gguf").unwrap();
assert_eq!(validate_local_chat_model_path(model_path.to_str().unwrap()).unwrap(), model_path.canonicalize().unwrap());
```

- [ ] **Step 3: Add branding tests**

Verify a session on the configured local port produces `coolzhu-model` and `coolzhu-model 推理` authors while a remote session keeps its name.

```rust
assert_eq!(visible_agent_author(&local_agent), "coolzhu-model");
assert_eq!(visible_reasoning_author(&local_agent), "coolzhu-model 推理");
assert_eq!(visible_agent_author(&remote_agent), remote_agent.display_name);
```

- [ ] **Step 4: Add Goal Skill prompt tests**

Create temporary Skill roots containing three `SKILL.md` files and assert the phase prompt contains their execution constraints.

```rust
let guidance = load_goal_skill_guidance_from_roots(&required, &[temp.path().to_path_buf()]);
assert!(guidance.contains("SESSION_CHAIN_SENTINEL"));
assert!(guidance.contains("MODEL_REASONING_SENTINEL"));
assert!(guidance.contains("TOOL_EXECUTION_SENTINEL"));
```

- [ ] **Step 5: Run focused tests and confirm failure**

Run the named tests with an explicit timeout wrapper; redirect stdout/stderr to `tmp/logs/2026-06-26-red-tests.log`. Expected result: the new assertions fail before production changes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-web-console-tests.ps1 -Filter "local_model" -TimeoutSeconds 600
```

### Task 3: Implement model path configuration and picker

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [ ] **Step 1: Extend typed config**

Add optional `local_chat_model_path` and `local_chat_mmproj_path` fields to `ConfigModel`.

```rust
#[serde(default)]
local_chat_model_path: Option<String>,
#[serde(default)]
local_chat_mmproj_path: Option<String>,
```

- [ ] **Step 2: Add validation and persistence**

Accept only existing regular `.gguf` files, canonicalize the path, persist through `mutate_workspace_config`, and return a structured status response.

```rust
fn validate_local_chat_model_path(value: &str) -> ApiResult<PathBuf> {
    let path = PathBuf::from(value.trim()).canonicalize().map_err(|_| api_error(StatusCode::BAD_REQUEST, "模型文件不存在"))?;
    if !path.is_file() || !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("gguf")) {
        return Err(api_error(StatusCode::BAD_REQUEST, "请选择 .gguf 模型文件"));
    }
    Ok(path)
}
```

- [ ] **Step 3: Add the native picker endpoint**

Launch a bounded PowerShell `System.Windows.Forms.OpenFileDialog`, parse the selected path, and pass it to the shared validator. Cancellation returns the unchanged status without an error.

```powershell
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Filter = "GGUF model (*.gguf)|*.gguf"
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }
```

- [ ] **Step 4: Use configured paths during startup**

Remove user-directory model path construction from `start_local_gemma()`. Add `--mmproj` only when the optional configured projection file exists.

```rust
let model = configured_local_chat_model_path()?;
cmd.arg("-m").arg(&model);
```

- [ ] **Step 5: Add settings controls**

Render a model path text input plus “选择文件” and “保存路径” controls inside the existing local-model management section. Populate them from `/api/local-models/status`.

```html
<input data-role="local-model-path" type="text" spellcheck="false" placeholder="选择本地 .gguf 模型文件" />
<button data-action="local-model-pick-file" type="button">选择文件</button>
<button data-action="local-model-save-path" type="button">保存路径</button>
```

- [ ] **Step 6: Verify focused tests turn green**

Run the model-path tests and inspect the log.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-web-console-tests.ps1 -Filter "local_chat_model_path" -TimeoutSeconds 600
```

### Task 4: Remove Mario and enforce local branding

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: Unify avatar fallback**

Use `defaultIconUrlForMessage(message)` in both initial and update rendering paths; ordinary user messages map to the wuxia fallback.

```javascript
const fallbackUrl = defaultIconUrlForMessage({ role: kind === "user" ? "user" : "assistant", kind, icon });
```

- [ ] **Step 2: Replace UI wording**

Replace “对话(Gemma)” and “对话 (Gemma)” with “本地文本推理”.

```javascript
{ chat: "本地文本推理", vision: "视觉(UI-DETR/ShowUI)", mixed: "混合", off: "全部关闭" }
```

- [ ] **Step 3: Centralize visible author names**

Add helpers returning `coolzhu-model` and `coolzhu-model 推理` for local sessions and use them in normal chat, relay, streaming, and Goal result paths.

```rust
fn visible_agent_author(agent: &AgentSessionDto) -> String {
    if is_local_model_endpoint(agent.base_url.as_deref(), agent.endpoint.as_deref()) {
        LOCAL_MODEL_BRAND.to_string()
    } else {
        agent.display_name.clone()
    }
}
```

- [ ] **Step 4: Remove model-name leakage from service messages**

Use “本地文本推理” and `coolzhu-model` in status/switch/start messages.

```rust
name: LOCAL_MODEL_BRAND.to_string(),
role: "chat".to_string(),
```

- [ ] **Step 5: Verify avatar and branding tests**

Run focused tests and inspect the log for zero failures.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-web-console-tests.ps1 -Filter "local_model_brand" -TimeoutSeconds 600
```

### Task 5: Create and integrate three Goal Skills

**Files:**
- Create: `skills/coolzhu-goal-session-chain/SKILL.md`
- Create: `skills/coolzhu-goal-session-chain/agents/openai.yaml`
- Create: `skills/coolzhu-goal-model-reasoning/SKILL.md`
- Create: `skills/coolzhu-goal-model-reasoning/agents/openai.yaml`
- Create: `skills/coolzhu-goal-tool-execution/SKILL.md`
- Create: `skills/coolzhu-goal-tool-execution/agents/openai.yaml`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: Initialize and write the session-chain Skill**

Capture room selection, workspace/repository path distinction, context continuity, scheduled-room mirroring, and phase handoff checks.

```yaml
---
name: coolzhu-goal-session-chain
description: Preserve room, workspace, repository, context, and phase handoff correctness while executing COOLZHU Goal tasks.
---
```

- [ ] **Step 2: Validate the session-chain Skill**

Run `quick_validate.py` and a Goal prompt unit test before creating the next Skill.

```powershell
python C:\Users\zhupu\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\coolzhu-goal-session-chain
```

- [ ] **Step 3: Initialize and write the model-reasoning Skill**

Capture strict scope boundaries, evidence over self-report, context/output budgeting, retry limits, and prohibition on editing tests to hide scope violations.

```yaml
---
name: coolzhu-goal-model-reasoning
description: Constrain model reasoning, scope, context budgeting, retries, and evidence quality during COOLZHU Goal execution.
---
```

- [ ] **Step 4: Validate the model-reasoning Skill**

Run `quick_validate.py` and its prompt unit test.

```powershell
python C:\Users\zhupu\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\coolzhu-goal-model-reasoning
```

- [ ] **Step 5: Initialize and write the tool-execution Skill**

Capture exact tool schemas, Windows shell choice, absolute repository paths, artifact verification, command timeouts, log redirection, and `cargo test` rather than build-only evidence.

```yaml
---
name: coolzhu-goal-tool-execution
description: Execute COOLZHU Goal tools with exact schemas, safe Windows commands, timeouts, logs, artifact checks, and independent tests.
---
```

- [ ] **Step 6: Validate the tool-execution Skill**

Run `quick_validate.py` and its prompt unit test.

```powershell
python C:\Users\zhupu\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\coolzhu-goal-tool-execution
```

- [ ] **Step 7: Register and inject Skill content**

Add repository `skills/` to catalog roots, merge the three baseline names with phase `skills_required`, load bounded Skill bodies, and include them in `goal_phase_run_prompt_with_progress`.

```rust
const BASELINE_GOAL_SKILLS: [&str; 3] = [
    "coolzhu-goal-session-chain",
    "coolzhu-goal-model-reasoning",
    "coolzhu-goal-tool-execution",
];
```

### Task 6: Full verification, package, documentation, and commits

**Files:**
- Modify: `docs/development-standard.md`
- Modify: `docs/requirements-management.md`
- Create: `docs/work-logs/2026-06-26-chat-avatar-local-model-goal-skills.md`

- [ ] **Step 1: Update standards**

Document that Goal execution constraints must be represented as loadable Skills and that visible local-model identity must be separated from internal provider identifiers.

```markdown
- Goal 长任务的稳定执行约束必须进入可加载 `SKILL.md`，不得只散落在临时 prompt 或 work-log。
- 本地模型内部标识与用户可见品牌分离；界面、思考和回复统一使用配置的品牌名。
```

- [ ] **Step 2: Run formatting, check, and full tests**

Use timeout wrappers and write all output to `tmp/logs/`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-web-console-verify.ps1 -TimeoutSeconds 1800
```

- [ ] **Step 3: Run package all**

Build through the package architecture and verify `package/package-report.json`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/run-package-all.ps1 -TimeoutSeconds 3600
```

- [ ] **Step 4: Run HTTP smoke checks**

Verify local-model status, model-path save validation, and Skill catalog discovery. Do not perform computer-use visual acceptance.

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/local-models/status
Invoke-RestMethod http://127.0.0.1:8765/api/tools/catalog
```

- [ ] **Step 5: Write the work-log**

Record root causes, backup path, changed APIs/config, test counts, package hashes, rollback steps, and the remaining manual visual checks.

- [ ] **Step 6: Review diffs and commit**

Commit the nested `modules/gui-web` implementation first, then commit root Skill/docs changes without staging unrelated existing files.
