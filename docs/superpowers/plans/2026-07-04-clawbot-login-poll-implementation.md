# ClawBot 登录状态轮询 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扫码后无需再次点击按钮，ClawBot 管理页在 2 秒内切换为 Online 并隐藏二维码。

**Architecture:** web-console 增加不递增 generation 的 `/gateway/login/poll` 接口，只在等待扫码状态调用 sidecar 现有登录查询。前端维护单实例、非重入的 2 秒轮询器，登录进入终态后停止并沿用现有渲染逻辑。

**Tech Stack:** Rust、Axum、Tokio、原生 JavaScript、Cargo test、Windows computer-use

---

## 文件结构

- `modules/gui-web/packages/web-console/src/main.rs`：注册登录 poll 路由，实现状态判断和 handler，并承载 Rust 单元测试。
- `modules/gui-web/packages/web-console/src/app.js`：管理登录轮询器生命周期，调用 poll 接口并触发现有 UI 渲染。
- `docs/superpowers/specs/2026-07-04-clawbot-login-poll-design.md`：已确认的行为规格，不再修改。

### Task 1: 后端登录状态 poll 接口

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/main.rs:715-730`
- Modify: `modules/gui-web/packages/web-console/src/main.rs:9947-10097`
- Test: `modules/gui-web/packages/web-console/src/main.rs:59500-59670`

- [ ] **Step 1: 写失败测试**

增加纯状态判断测试与路由/实现约束测试：

```rust
#[test]
fn clawbot_login_poll_only_queries_provider_while_waiting() {
    use clawbot_gateway::ClawbotLoginState::*;
    assert!(clawbot_login_poll_needed(&RefreshRequested));
    assert!(clawbot_login_poll_needed(&AwaitingScan));
    for state in [LoggedOut, Online, Expired, Error] {
        assert!(!clawbot_login_poll_needed(&state));
    }
}

#[test]
fn clawbot_login_poll_route_does_not_request_new_generation() {
    assert!(WEB_MAIN_RS.contains("/api/channels/clawbot/gateway/login/poll"));
    assert!(WEB_MAIN_RS.contains("async fn api_clawbot_gateway_login_poll"));
    assert!(WEB_MAIN_RS.contains("clawbot_login_poll_needed(&snapshot.state)"));
}
```

- [ ] **Step 2: 验证 RED**

Run:

```powershell
cargo test -p coolzhu-web-console --bin coolzhu-web-console clawbot_login_poll --offline
```

Expected: 编译失败，提示 `clawbot_login_poll_needed` 不存在，或静态路由断言失败。

- [ ] **Step 3: 实现最小后端逻辑**

注册路由：

```rust
.route(
    "/api/channels/clawbot/gateway/login/poll",
    post(api_clawbot_gateway_login_poll),
)
```

增加状态判断和 handler：

```rust
fn clawbot_login_poll_needed(state: &clawbot_gateway::ClawbotLoginState) -> bool {
    matches!(
        state,
        clawbot_gateway::ClawbotLoginState::RefreshRequested
            | clawbot_gateway::ClawbotLoginState::AwaitingScan
    )
}

async fn api_clawbot_gateway_login_poll(
) -> ApiResult<Json<clawbot_gateway::ClawbotLoginSnapshot>> {
    let now_ms = uuid_timestamp();
    let snapshot = clawbot_gateway_lock()?
        .load_login_snapshot()
        .map_err(|error| api_error(StatusCode::INTERNAL_SERVER_ERROR, &error))?;
    if !clawbot_login_poll_needed(&snapshot.state) {
        return Ok(Json(snapshot));
    }
    let generation = snapshot.generation;
    let snapshot = match call_clawbot_sidecar_login_refresh(generation, now_ms).await {
        ClawbotSidecarLoginRefreshResult::Report(report) => {
            record_clawbot_login_refresh_report(report, uuid_timestamp())?
        }
        ClawbotSidecarLoginRefreshResult::Error(error) => {
            diag!("[CLAWBOT] login poll transient error: {error}");
            snapshot
        }
    };
    Ok(Json(snapshot))
}
```

- [ ] **Step 4: 验证 GREEN**

Run:

```powershell
cargo test -p coolzhu-web-console --bin coolzhu-web-console clawbot_login_poll --offline
```

Expected: 新增测试全部 PASS。

### Task 2: 前端非重入轮询器

**Files:**
- Modify: `modules/gui-web/packages/web-console/src/app.js:98-106`
- Modify: `modules/gui-web/packages/web-console/src/app.js:2026-2179`
- Test: `modules/gui-web/packages/web-console/src/main.rs:59500-59560`

- [ ] **Step 1: 写失败测试**

在前端内联资源测试中增加：

```rust
#[test]
fn clawbot_frontend_polls_login_until_terminal_state() {
    assert!(WEB_APP_JS.contains("/api/channels/clawbot/gateway/login/poll"));
    assert!(WEB_APP_JS.contains("function startClawbotLoginPolling()"));
    assert!(WEB_APP_JS.contains("function stopClawbotLoginPolling()"));
    assert!(WEB_APP_JS.contains("clawbotLoginPollInFlight"));
    assert!(WEB_APP_JS.contains("2000"));
    assert!(WEB_APP_JS.contains("beforeunload"));
}
```

- [ ] **Step 2: 验证 RED**

Run:

```powershell
cargo test -p coolzhu-web-console --bin coolzhu-web-console clawbot_frontend_polls_login --offline
```

Expected: 静态断言失败，因为轮询器尚不存在。

- [ ] **Step 3: 实现单实例轮询器**

增加模块状态：

```javascript
let clawbotLoginPollTimer = null;
let clawbotLoginPollInFlight = false;
```

增加生命周期函数：

```javascript
function clawbotLoginNeedsPolling(state) {
  return ["refresh_requested", "awaiting_scan"].includes(String(state || "").toLowerCase());
}

function stopClawbotLoginPolling() {
  if (clawbotLoginPollTimer) clearInterval(clawbotLoginPollTimer);
  clawbotLoginPollTimer = null;
}

async function pollClawbotLoginOnce() {
  if (clawbotLoginPollInFlight) return;
  clawbotLoginPollInFlight = true;
  try {
    clawbotChannel.gatewayLogin = await requestJson("/api/channels/clawbot/gateway/login/poll", {
      method: "POST",
      body: JSON.stringify({}),
    });
    renderClawbotGatewayState();
    if (!clawbotLoginNeedsPolling(clawbotChannel.gatewayLogin?.state)) {
      stopClawbotLoginPolling();
      await refreshClawbotWindow({ silent: true });
    }
  } catch (error) {
    console.warn("clawbot login poll failed", error);
  } finally {
    clawbotLoginPollInFlight = false;
  }
}

function startClawbotLoginPolling() {
  if (clawbotLoginPollTimer || !clawbotLoginNeedsPolling(clawbotChannel.gatewayLogin?.state)) return;
  clawbotLoginPollTimer = setInterval(() => void pollClawbotLoginOnce(), 2000);
}
```

在 `refreshClawbotWindow`、`refreshClawbotLogin` 成功渲染后调用 `startClawbotLoginPolling()`；在终态、登出以及 `beforeunload` 时调用 `stopClawbotLoginPolling()`。

- [ ] **Step 4: 验证 GREEN**

Run:

```powershell
cargo test -p coolzhu-web-console --bin coolzhu-web-console clawbot_frontend_polls_login --offline
```

Expected: 新增测试 PASS。

### Task 3: 回归、编译和真实 UI 验收

**Files:**
- Verify: `modules/gui-web/packages/web-console/src/main.rs`
- Verify: `modules/gui-web/packages/web-console/src/app.js`

- [ ] **Step 1: 格式化与全量 ClawBot 测试**

Run:

```powershell
cargo fmt --package coolzhu-web-console
cargo test -p coolzhu-web-console --bin coolzhu-web-console clawbot --offline
cargo test -p coolzhu-clawbot-sidecar --offline
```

Expected: web-console ClawBot 测试和 sidecar 全量测试全部 PASS。

- [ ] **Step 2: 重新编译嵌入式前端**

Run:

```powershell
$ports = 8765,8787
foreach ($port in $ports) {
  Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
cargo build -p coolzhu-web-console -p coolzhu-clawbot-sidecar --offline
```

Expected: build exit code 0；新 `app.js` 已编译进 web-console。

- [ ] **Step 3: 重启服务并验证接口幂等**

Run:

```powershell
$repo = 'C:\Users\zhupu\Desktop\codex'
$runtime = 'C:\Users\zhupu\coolzhuagent'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Start-Process -FilePath "$repo\target\debug\coolzhu-web-console.exe" -WorkingDirectory $runtime -WindowStyle Hidden -RedirectStandardOutput "$repo\tmp\web-console-$stamp.out.log" -RedirectStandardError "$repo\tmp\web-console-$stamp.err.log"
$env:COOLZHU_CLAWBOT_PROVIDER_KIND = 'http'
$env:COOLZHU_CLAWBOT_PROVIDER_URL = 'http://127.0.0.1:8790'
$env:COOLZHU_WEB_CONSOLE_URL = 'http://127.0.0.1:8765'
Start-Process -FilePath "$repo\target\debug\coolzhu-clawbot-sidecar.exe" -WorkingDirectory $runtime -WindowStyle Hidden -RedirectStandardOutput "$repo\tmp\clawbot-sidecar-$stamp.out.log" -RedirectStandardError "$repo\tmp\clawbot-sidecar-$stamp.err.log"
$before = Invoke-RestMethod 'http://127.0.0.1:8765/api/channels/clawbot/gateway/login'
$after = Invoke-RestMethod 'http://127.0.0.1:8765/api/channels/clawbot/gateway/login/poll' -Method Post
if ($before.state -eq 'online' -and ($before.generation -ne $after.generation -or $after.state -ne 'online')) { throw '在线 poll 非幂等' }
```

Expected: provider 进程与登录令牌保持不动；在线 poll 返回 `online` 且 generation 不变。

- [ ] **Step 4: computer-use 真实扫码验收**

在 ClawBot 页点击刷新二维码并扫码，不再点击其他按钮。确认 2 秒内状态变成 Online、二维码隐藏、provider 在线；重新进入 ClawBot 页后仍在线。

- [ ] **Step 5: 微信消息回归**

发送唯一测试文本，确认 `inbox_completed` 与 `outbox_sent` 各增加 1，回复正文不含 `Context usage`、`Remote context usage` 或内部推理。
