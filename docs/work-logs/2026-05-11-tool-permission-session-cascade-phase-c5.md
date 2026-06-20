# Phase C-5 落地：配置化 Protected 路径（REQ-TOOL-010）

时间：2026-05-11  
方案链接：`docs/tool-calling-permission-plan-2026-05-10.md` §5.3  
前置：Phase A / B / C-1 / C-2 / C-3 / C-4（均 2026-05-10 → 05-11）

关联需求：
- 完成：`REQ-TOOL-010`（从 `—` → 测试中，可配置 Protected 路径已全量生效）
- 不动：`run_model_tool_dispatch`、LLM Tool Loop、前端 app.js

## 1. 本轮范围（Phase C-5）

给 Phase A 的 `runtime::default_protected_rules()` 加上 `coolzhu.toml` 配置通道：

- **新增** `ConfigTool` + `ConfigToolProtectedPaths` + `ConfigProtectedRule`，挂在 `WorkspaceConfig.tool`。
- **新增** `From<ConfigProtectedRule> for runtime::ProtectedRule` 转换器。
- **新增** `effective_protected_rules()`：3 种组合模式（完全替换 / 用户 + 默认 / 额外追加）。
- **替换** 3 处原 `default_protected_rules()` 调用 → `effective_protected_rules()`：
  - `preview_tool_permission`
  - `api_tools_protected_paths`
  - `api_tools_runtime_execute`
- **测试串行化**：新增 `config_test_guard()`，保护全局 `workspace_config` 的临时替换避免并发互扰。

## 2. 实际变更

| 文件 | 动作 |
| --- | --- |
| `web-console/src/main.rs` `WorkspaceConfig` | 新字段 `#[serde(default)] tool: ConfigTool` |
| 同上 `impl Default for WorkspaceConfig` | 新增 `tool: ConfigTool::default()` |
| 同上 紧接 `WorkspaceConfig Default` | 新定义 `ConfigTool`、`ConfigToolProtectedPaths`、`ConfigProtectedRule`、`default_protected_access`、`impl From` 转换、`effective_protected_rules` |
| 3 处 `default_protected_rules()` 调用点 | 换为 `effective_protected_rules()` |
| tests 顶 | 新增 `config_test_guard()` 静态锁 |
| tests | 4 个新 TDD |

### 关键设计点

**`rules` 字段的接管语义**：当用户在 `coolzhu.toml` 配置了 `[tool.protected_paths] rules = [...]` 非空，视为用户完全接管，默认规则就不参与。这与"merge"语义不同：后者让用户错以为"关闭了默认"实际上默认还在生效，容易踩坑。

**`append_defaults` 明示逃生舱**：用户想保留默认同时添加自己的规则，得显式设置 `append_defaults = true`；这是可读的意图声明，不是魔法。

**`extra_rules` 精准追加**：不管 `rules` 如何，`extra_rules` 都会追加到最终列表末尾，适合"只想多加一条、不想动默认列表"的场景。

**同 id 去重**：`append_defaults` / `extra_rules` 合并时，相同 `id` 跳过，以用户最早出现的规则为准。这让用户能"重写"默认规则的 glob（例如 `id=coolzhu-config` 指向别的文件）。

## 3. Tests

| 套件 | Phase C-4 | Phase C-5 新增 | 合计 | 结果 |
| --- | --- | --- | --- | --- |
| `coolzhu-core-runtime` (lib) | 121 | 0 | **121 passed** | 绿 |
| `coolzhu-tool-registry` (lib) | 34 | 0 | **34 passed** | 绿 |
| `coolzhu-web-console` (bin) | 166 | 4 | **170 passed** | 绿（`--test-threads=1` 稳定；多线程出现 `semantic_dispatch_visual_action_includes_grounding_evidence` 历史 flake，单独重跑通过，与本轮变更无关） |
| `module_linkage_smoke` | 4 | 0 | **4 passed** | 绿 |

Phase C-5 新增用例：

1. `effective_protected_rules_falls_back_to_defaults_when_empty` — 空配置 → 3 条默认规则都在
2. `effective_protected_rules_user_rules_replace_defaults` — 用户填 1 条 → 结果只剩 1 条
3. `effective_protected_rules_append_defaults_and_extra` — `rules + append_defaults=true + extra_rules` → 顺序正确 + 去重
4. `effective_protected_rules_preview_uses_user_configured_rule` — 端到端：`*.topsecret` 命中用户 glob → `RequireConfirm + protected_match=custom-secret`

## 4. 备份与回滚

### Post-change 快照

`tmp/backups/phase-c5-protected-config-20260511-post/main.rs`

### 回滚链

| 目的 | 命令 |
| --- | --- |
| 回 Phase C-4 | `Copy-Item tmp\backups\phase-c4-tool-events-20260511-post\main.rs modules\gui-web\packages\web-console\src\main.rs` |
| 回 Phase C-3 | `tmp\backups\phase-c3-runtime-execute-20260511-post\main.rs` |
| 回 Phase C-2 | `tmp\backups\phase-c2-approval-api-20260511-post\main.rs` |
| 回 Phase C-1 | `tmp\backups\phase-c1-readonly-bridge-20260511-post\main.rs` |
| 回 Phase B | `tmp\backups\phase-b-tool-session-20260511-post\main.rs` |
| 回 Phase A | `tmp\backups\phase-a-tool-session-20260510-post\main.rs` |
| 回到修改前 | `tmp\backups\phase-a-tool-session-20260510-pre\*` 覆盖三个目录 |

## 5. 配置示例

```toml
# coolzhu.toml
[tool.protected_paths]
# 完全替换默认规则（默认规则不生效）
rules = [
  { id = "custom-secret", glob = "**/*.topsecret", access = "any" },
  { id = "my-db",         glob = "**/data.db",    access = "any" }
]
# 如果想保留默认规则，把 append_defaults = true
append_defaults = false
# 不管 rules 如何，都额外追加到末尾
extra_rules = [
  { id = "audit-log", glob = "**/audit.log", access = "write" }
]
```

缺省 `coolzhu.toml` 未写 `[tool]` 段时，`effective_protected_rules()` 自动 fallback 到 `runtime::default_protected_rules()`。

## 6. 接口清单

### 内部

| 接口 | 变化 | 影响 |
| --- | --- | --- |
| `WorkspaceConfig.tool` | 新字段 | ✅ 向后兼容（`#[serde(default)]`） |
| `effective_protected_rules()` | 新函数 | 替换既有 3 处 `default_protected_rules()` |
| `ConfigProtectedRule → runtime::ProtectedRule` | `From` 实现 | 配置层 → runtime 层无缝桥接 |

### 对外

无新 HTTP 端点；`GET /api/tools/protected-paths` 的响应现在由 `effective_protected_rules()` 驱动，自动反映当前配置。

## 7. 未落地（Phase C-6 入口）

| 需求 | 动作 |
| --- | --- |
| REQ-TOOL-008 UI | `app.js` 订阅 `/api/tools/events`，`permission-required` 时弹审批面板 |
| REQ-TOOL-007 完成 | `run_model_tool_dispatch` 切到 `runtime_tool_execute` |
| REQ-TOOL-011 超时 | bash/PowerShell 的 `tokio::time::timeout` + `Semaphore` |

## 8. 验证命令

```powershell
cargo test -p coolzhu-web-console --offline --bins -- effective_protected_rules_ preview_tool_permission_ tools_protected_paths runtime_execute_

# 全量回归（--test-threads=1 稳定）
cargo test -p coolzhu-web-console --offline --bins -- --test-threads=1
cargo test -p coolzhu-core-runtime --offline --lib
cargo test -p coolzhu-tool-registry --offline --lib
cargo test --test module_linkage_smoke --offline
```

## 9. 风险评估

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| 用户误配置（规则 glob 语法错误）导致全通过 | 中 | `runtime::match_protected_rule` 内 `glob::Pattern::new` 失败时 `continue`，当前规则不生效——需要后续补诊断（`/api/diagnostics/health` 暴露解析错误） |
| 用户关了默认规则 + 忘记 append_defaults → `coolzhu.toml` 失保护 | 中 | Phase C-6 诊断面板显示"当前生效 N 条规则，默认 3 条中保留 0 条"，引导用户回补 |
| 并发测试互串 | 已修复 | `config_test_guard()` 对所有改 `workspace_config` 的测试强制串行 |
| 多线程模式下的 `semantic_dispatch_visual_action_includes_grounding_evidence` flake | 历史问题 | 未触碰；`--test-threads=1` 稳定；单独重跑通过 |

## 10. 下一步建议（Phase C-6）

1. 前端 `app.js` 订阅 SSE `tool-permission-required`，渲染审批面板。
2. 诊断端点输出 Protected 规则解析报告：哪些 glob 失败、哪些默认被覆盖。
3. `run_model_tool_dispatch` 切到 `runtime_tool_execute`（写类工具走新审批流，旧硬白名单可保留 feature flag）。

每步独立 commit，保持回滚成本 ≤ 1 次 revert。
