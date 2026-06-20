# Project Browser Memory Realtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复工程目录树折叠，建立公网网页原生 WebView2 宿主，恢复记忆窗口真实数据链路，并把实时语音 full stream 从易误报状态改为可审计的分阶段能力门控。

**Architecture:** 工程目录树把“选择状态”和“结构渲染”解耦；浏览器通过统一宿主接口在 iframe 预览、Tauri WebView2 和系统浏览器之间路由；记忆窗口复用现有 beads API 并预留独立 knowledge layer DTO；实时语音仍以 guarded 模式为安全基线，仅允许后端签发、带会话和时效的运行证据驱动 gate。当前工作区不是 Git 仓库，因此用 `tmp/backups` 源码快照、SHA-256 清单和完整构建日志替代 worktree/commit 回滚点。

**Tech Stack:** Rust/Axum/Tauri 2/WebView2、原生 JavaScript、SQLite、Cargo tests、Computer Use。

---

### Task 0: 回滚快照和基线

**Files:**
- Create: `tmp/backups/<timestamp>-project-browser-memory-realtime-pre/`
- Create: `tmp/logs/<timestamp>-backup-manifest.log`

- [ ] **Step 1: 验证备份目标**

解析源目录与备份目录绝对路径，确认备份目录位于
`C:\Users\zhupu\Desktop\codex\tmp\backups` 内。

- [ ] **Step 2: 备份受影响源码**

备份：

```text
modules/gui-web/packages/web-console
modules/gui-desktop/packages/tauri-shell
```

排除 `target`、模块内 `tmp` 和既有备份，避免递归复制构建产物。

- [ ] **Step 3: 生成哈希清单**

对源文件和备份文件生成相对路径 + SHA-256 清单，数量和哈希必须一致。

- [ ] **Step 4: 保存基线测试**

运行：

```powershell
cargo test -p coolzhu-web-console -- --test-threads=1
```

预期：527 项基线测试通过；既有 warning 单独记录。

### Task 1: 工程目录树选择与展开状态解耦

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`

- [ ] **Step 1: 写失败回归测试**

在前端静态契约测试中要求：

```rust
assert!(WEB_APP_JS.contains("function syncProjectTreeSelection"));
assert!(WEB_APP_JS.contains("expandedProjectPaths"));
assert!(!open_project_file_body.contains("renderProjectApiTree([projectTreeRoot])"));
```

测试应失败，因为当前 `openProjectFile()` 仍重建整棵树。

- [ ] **Step 2: 验证 RED**

运行：

```powershell
cargo test -p coolzhu-web-console web_frontend_project_tree_preserves_expansion_when_opening_file -- --exact --nocapture
```

预期：因缺少选择同步函数或仍存在全量重渲染而失败。

- [ ] **Step 3: 最小实现**

在 `app.js` 中增加：

```javascript
const expandedProjectPaths = new Set();

function syncProjectTreeSelection(path) {
  document.querySelectorAll("#projectTree [data-project-path].is-active")
    .forEach((node) => node.classList.remove("is-active"));
  document.querySelectorAll("#projectTree [data-project-path]")
    .forEach((node) => {
      if (node.dataset.projectPath === path) node.classList.add("is-active");
    });
}
```

目录展开/折叠时更新 `expandedProjectPaths`；渲染节点时按路径恢复展开状态；工作区切换时清空集合。`openProjectFile()` 只更新 `selectedProjectPath`、选择样式和预览，不再调用 `renderProjectApiTree()`。

- [ ] **Step 4: 验证 GREEN**

运行目标测试和完整 web-console 测试，预期全部通过。

- [ ] **Step 5: 规格与代码质量审查**

审查重点：文件选择不能触发树 API 或 DOM 全量重建；目录双击进入现有行为不能被破坏；工作区切换不能继承旧路径状态。

### Task 2: 可插拔浏览器宿主与 WebView2 公网页面

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-desktop/packages/tauri-shell/src-tauri/src/main.rs`
- Modify: `modules/gui-desktop/packages/tauri-shell/src-tauri/capabilities/default.json` only if console IPC capability is required

- [ ] **Step 1: 写失败测试**

增加 Rust/静态契约测试：

```rust
assert_eq!(classify_browser_target("https://www.baidu.com"), BrowserHostKind::NativeWebview);
assert_eq!(classify_browser_target("http://127.0.0.1:8765/health"), BrowserHostKind::IframePreview);
assert!(WEB_APP_JS.contains("const browserHosts"));
assert!(!WEB_APP_JS.contains("https://www.bing.com/search?q="));
```

Tauri 单元测试要求 `BrowserCommand` 支持 `Navigate/Back/Forward/Reload/Stop/Focus/Close`，公网 URL 不能落到 iframe。

- [ ] **Step 2: 验证 RED**

分别运行 web-console 浏览器契约测试和 tauri-shell browser 测试，预期因宿主分类与命令接口不存在而失败。

- [ ] **Step 3: 实现前端宿主接口**

在前端建立：

```javascript
const browserHosts = {
  iframePreview: { open, navigate, back, reload, focus, close },
  tauriWebview2: { open, navigate, back, forward, reload, stop, focus, close },
  systemBrowser: { open }
};
```

规则：

- `localhost`、`127.0.0.1`、`::1` 和明确白名单页面可用 iframe。
- `http/https` 公网 URL 默认使用 Tauri WebView2。
- Tauri 不可用时降级系统浏览器。
- 无协议关键词使用配置项 `browser.search_engine_url`，默认百度
  `https://www.baidu.com/s?wd={query}`，不再硬编码 Bing。
- iframe 探测失败一律视为不可嵌入，不再乐观放行。

- [ ] **Step 4: 实现 Tauri 浏览器命令**

定义可序列化命令：

```rust
enum BrowserCommand {
    Navigate { url: String },
    Back,
    Forward,
    Reload,
    Stop,
    Focus,
    Close,
}
```

保留 `external-browser` 无 IPC capability 的安全边界；由主 console 通过 Tauri command 控制顶级 WebView2。状态至少返回 `url/title/loading/can_go_back/can_go_forward/last_error`，不放宽 iframe sandbox。

- [ ] **Step 5: 统一代理配置**

浏览器代理读取 `coolzhu.toml` 单一配置源；运行时修改明确返回“需要重建浏览器环境/重启”的状态，不再保存一份前端实际不生效的代理配置。

- [ ] **Step 6: 验证**

运行两 crate 测试并做 Computer Use：

1. 打开浏览器窗口。
2. 输入“百度 人工智能”并回车。
3. 确认打开原生 WebView2，搜索结果可点击。
4. 验证后退、前进、刷新。
5. 打开本地健康页，确认仍可在主面板 iframe 预览。

### Task 3: 恢复真实记忆窗口并预留 knowledge layer

**Files:**
- Modify: `modules/gui-web/packages/web-console/index.html`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/styles.css`

- [ ] **Step 1: 写失败测试**

把原来“不得调用真实接口”的占位测试改为真实数据契约：

```rust
assert!(WEB_APP_JS.contains("/memory/beads"));
assert!(WEB_APP_JS.contains("/memory/summary"));
assert!(WEB_APP_JS.contains("/memory/prompt"));
assert!(WEB_APP_JS.contains("/memory/context"));
assert!(!WEB_APP_JS.contains("createMemoryWindowPlaceholderBeads"));
```

增加 DTO 预留字段的前端契约：

```text
scope_id source_id document_id chunk_id citation status entity_key
```

- [ ] **Step 2: 验证 RED**

运行 memory window 目标测试，预期当前 placeholder 路径导致失败。

- [ ] **Step 3: 恢复 API 链路**

`loadSessionBeads()` 从当前会话真实请求 beads、summary；Prompt/Context Preview 调用现有 API；Pin/Edit/Delete 调用后端后重新拉取。错误必须在窗口内显示，不吞掉异常。

- [ ] **Step 4: 星图与知识工作台预留**

星图优先消费 `{nodes, edges}`；若后端尚无聚合图接口则显示“关系数据尚未建立”，禁止前端按关键词伪造边。布局预留：

```text
左栏：知识空间/来源/集合
中栏：卡片/文档/时间线/星图
右栏：原文片段/引用/版本/召回解释
```

本轮不创建文档分块数据库，不把 document chunk 写入 `memory_beads`。

- [ ] **Step 5: 验证**

运行测试并用 Computer Use 选择真实会话，验证列表、筛选、Pin、Preview 与错误状态。

### Task 4: Full stream 第一阶段——可信 gate 与可达状态机

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs`
- Modify: `modules/gui-web/packages/web-console/src/app.js`
- Modify: `modules/gui-web/packages/web-console/index.html`

- [ ] **Step 1: 写失败状态机测试**

增加行为测试：

```rust
assert_eq!(session.active_mode, "half_duplex_guarded");
record_valid_proof(&mut session, Gate::ProviderAsr, proof_for(&session));
record_valid_proof(&mut session, Gate::FarEndAec, proof_for(&session));
record_valid_proof(&mut session, Gate::ModelCancellation, proof_for(&session));
record_two_played_tts_segments(&mut session);
assert_eq!(recompute_active_mode(&mut session), "full_streaming");
```

同时要求错误 session、过期 proof、仅 provider 名称、仅非空网络 chunk 都不能置 gate ready。

- [ ] **Step 2: 验证 RED**

运行新的 full-stream proof/state 测试，预期当前字符串启发式和单 chunk ready 行为导致失败。

- [ ] **Step 3: 实现运行证据结构**

每项证据必须包含：

```rust
struct RealtimeGateProof {
    session_id: String,
    gate: RealtimeGate,
    probe_id: String,
    source: String,
    observed_at_ms: u64,
    expires_at_ms: u64,
    sequence: Option<u64>,
}
```

后端验证 session、gate、TTL 和单调序列；前端不能通过修改 provider 字符串直接签发 native ASR/AEC/cancellation 证明。

- [ ] **Step 4: 修正 TTS framing gate**

网络 `reqwest::chunk()` 只作为传输字节，不再直接置 ready。前端成功解码并按序播放至少两个完整 segment 后，回传 playback ack；后端收到两个不同序列的有效 ack 才设置 `streaming_tts_ready`。

- [ ] **Step 5: 修正状态机**

会话启动时安全降级为 guarded；每次有效 proof 更新后调用统一 `recompute_active_mode()`。proof 过期、会话停止或来源失效时自动降级，不通过重启清零制造不可达循环。

- [ ] **Step 6: 增加取消审计**

barge-in 先停止本地播放，再调用后端 cancel endpoint；记录 `cancel_requested_at/cancel_ack_at/last_delta_at`。没有服务端取消确认时，模型取消 gate 保持未通过。

- [ ] **Step 7: 验证**

运行 full-stream 目标测试和完整 crate 测试。Computer Use 只验证当前可实现的用户链路：启动实时交互、状态明确显示 guarded 及未通过 gate、播放期间点击/语音打断可停止本地 TTS。provider-native ASR、真实 AEC 和 provider cancellation 未接真实适配器前不得宣称 full stream 已完成。

### Task 5: 打包、前端验收和工作日志

**Files:**
- Create: `docs/work-logs/2026-06-20-project-browser-memory-realtime-hardening.md`
- Update: `docs/development-standard.md` only if本轮发现现有规范缺少已批准规则

- [ ] **Step 1: 完整验证**

运行：

```powershell
cargo test -p coolzhu-web-console -- --test-threads=1
cargo test --manifest-path modules/gui-desktop/packages/tauri-shell/src-tauri/Cargo.toml
```

- [ ] **Step 2: package all**

在 `tmp` 中创建带 30 分钟超时的 PowerShell 包装脚本，输出重定向到
`tmp/logs/2026-06-20-package-all.log`，执行：

```powershell
.\package.ps1 all
```

- [ ] **Step 3: 启动与 Computer Use**

从 `package` 目录启动桌宠和 Web Console，验证：

- 工程树打开文件不折叠。
- 百度搜索和结果点击可用。
- 记忆窗口显示真实会话数据。
- 实时语音状态不会假报 full streaming。

- [ ] **Step 4: 文档**

工作日志记录根因、RED/GREEN 命令、修改文件、回滚路径、构建产物、Computer Use 截图结果、未完成的外部适配器依赖和后续计划。
