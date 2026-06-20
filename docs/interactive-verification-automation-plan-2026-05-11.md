# 脚本化需求功能交互验证方案

文档版本：v1.0  
创建日期：2026-05-11  
交付对象：实现 agent（脚本开发）+ 用户（观察 WebUI 确认结果）  
目标：用户敲一条命令，脚本化把 codex/ 当前已完成需求全部"走一遍"，用户只盯 WebUI 看反馈即可判定通过 / 失败。

---

## 0. 设计原则

1. **脚本启动 + UI 验证**：脚本负责拉起服务、埋点数据、下发请求；所有"对不对"的判断由用户眼睛在 WebUI 看。
2. **可中断、可续跑**：每个场景原子独立；`./verify.ps1 -only CU-002` 能单独跑某个场景。
3. **零环境假设**：脚本先做 preflight（端口 / cargo / toml / python /可选的 VLM），缺啥列啥，不默默失败。
4. **安全默认**：真实键鼠点击、远端大模型调用、destructive 操作**默认关闭**，用显式 flag 开启。
5. **产物可追溯**：每次 run 生成 `tmp/verification-runs/<timestamp>/` 目录，存截图、日志、summary.json。

---

## 1. 入口

```powershell
# 全量
.\scripts\verify-all.ps1

# 指定分组
.\scripts\verify-all.ps1 -Group session,chat,tool

# 单场景
.\scripts\verify-all.ps1 -Only TOOL-RUNTIME-READONLY

# 用真实 LLM + 真实点击（需要 key 且用户明确同意）
.\scripts\verify-all.ps1 -EnableRealLlm -EnableRealInput

# 离线模式（只跑不需要外网的场景）
.\scripts\verify-all.ps1 -Offline

# 只做 preflight
.\scripts\verify-all.ps1 -PreflightOnly
```

所有参数对 `-help` 自解释；最终 `Exit 0 / 非 0` 表明 preflight 和各场景的脚本化部分是否通过，**不代表 UI 验收通过**——UI 验收在脚本末尾列出"请用户观察以下 N 项"。

---

## 2. 总体流程

```
┌─────────── verify-all.ps1 ───────────┐
│ 1. preflight                         │   ← 端口/toml/cargo/node/可选 VLM
│ 2. 构建（仅首次或 --Rebuild）         │
│ 3. 启动 web-console（新窗口，日志重定向）│
│ 4. 启动桌宠（可选 --WithPet）          │
│ 5. 等就绪（poll /api/state）          │
│ 6. 打开浏览器到 http://127.0.0.1:PORT │
│ 7. 按 -Group 跑场景：                 │
│    - 每个场景：准备数据 → 触发 → 提示用户看 UI
│ 8. 生成 summary 页面 + summary.json    │
│ 9. 等用户 Enter 后关闭服务            │
└──────────────────────────────────────┘
```

关键点：**脚本不替用户点按钮**。它只把验证对象准备到"用户下一秒能在 UI 看到差异"的状态，然后显眼打印 "请观察 XXX → 确认 YES/NO"。

---

## 3. 场景清单（按已完成的 REQ 组织）

### 3.1 分组

| Group | Prefix | 覆盖 REQ |
| --- | --- | --- |
| `env` | `ENV-` | preflight 环境检查 |
| `session` | `SESSION-` | REQ-WEB-SESSION-001~007、REQ-MEM-003/004/006 |
| `chat` | `CHAT-` | REQ-WEB-CHAT-001/002/003、REQ-WEB-OVERVIEW-001 |
| `media` | `MEDIA-` | REQ-WEB-MEDIA-001~006 |
| `tool` | `TOOL-` | REQ-TOOL-007/008/009/010 |
| `vision` | `VIS-` | REQ-VIS-001/004/006（grounding plan 落地部分） |
| `computer-use` | `CU-` | REQ-CU-002/005、REQ-TOOL-005 |
| `workspace` | `WS-` | REQ-WEB-PROJECT-001/002 |
| `pet` | `PET-` | REQ-DESK-PET-* |
| `audio` | `AUDIO-` | REQ-AUDIO-001/002 |

### 3.2 场景明细（节选，实现 agent 按此表枚举）

#### ENV-（preflight）

| 场景 | 脚本动作 | UI 判定点 |
| --- | --- | --- |
| ENV-01-PORT | 检查 9865 可用 | N/A（纯脚本） |
| ENV-02-CARGO | `cargo --version` 可运行 | N/A |
| ENV-03-NODE | 若存在 `-CheckApp` → `node --check app.js` | N/A |
| ENV-04-CONFIG | 读 `coolzhu.toml`，缺关键段 → `coolzhu.sample.toml`+提示 | N/A |
| ENV-05-VLM | 若 `-WithVlm`，poll `http://127.0.0.1:8000/v1/models` | N/A |
| ENV-06-REAL-LLM | 若 `-EnableRealLlm`，检查 provider 里至少一个有 key | N/A |

#### SESSION-

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| SESSION-01-NEW | POST `/api/sessions` 建 2 个测试 session (`verify-ag-a`, `verify-ag-b`) | 会话卡片列表出现两个新条目 |
| SESSION-02-SWITCH | POST `/activate` 依次激活 | 激活徽章切换 |
| SESSION-03-BEAD-ADD | POST `/beads` 加一条 decision bead | 记忆卡片 bead 数量 +1 |
| SESSION-04-BEAD-DELETE | DELETE bead | 记忆卡片消失 |
| SESSION-05-ROOM-DELETE-IMPACT | GET `/api/chat/rooms/{id}/impact` | 脚本打印 impact summary；UI 可看确认对话框预览 |
| SESSION-06-ROOM-DELETE | DELETE `/api/chat/rooms/{id}` | 聊天室从列表消失；关联衍生 bead 减少（前后 diff） |
| SESSION-07-MSG-DELETE-CASCADE | 发消息 → 沉淀 bead → DELETE message | 消息 + 衍生 bead 一起消失 |
| SESSION-08-CLEANUP | 删除 verify- 前缀的所有测试数据 | 会话列表回到脚本启动前状态 |

#### CHAT-

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| CHAT-01-SEND-FAKE | 不启 `-EnableRealLlm`，发 "你好" | 收到 fallback 本地回复 |
| CHAT-02-SEND-STREAM-REAL | 若 `-EnableRealLlm`，流式发送 | SSE 实时增量文字流；reasoning 卡显示 |
| CHAT-03-ROOM-SWITCH | 建 2 聊天室、互发消息 | 切换房间历史不串 |
| CHAT-04-QUOTE-FORWARD | 选中消息 → 转发到 ag-b | 另一 agent 收到引用 + 衍生 bead |
| CHAT-05-OVERVIEW-COUNTS | 观察总览卡 | `已激活 Agent 数 / 聊天室个数` 数值与实际一致 |

#### TOOL-（核心，Phase C 全系列）

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| TOOL-01-CATALOG | GET `/api/tools/catalog` | 工具卡片显示分类与数量 |
| TOOL-02-PROTECTED-PATHS | GET `/api/tools/protected-paths` | 脚本打印规则表；与 `coolzhu.toml` 对齐 |
| TOOL-03-RUNTIME-READONLY | POST `/api/tools/runtime-execute` `{tool_name:"read_file", path:"README.md"}` | 审计表出现 `route=runtime-executed / caller=web-ui / status=ok` 新行 |
| TOOL-04-RUNTIME-PROTECTED | 发 `write_file` to `coolzhu.toml` | 审批面板弹出：`safety_gate=require-confirm / protected_match=coolzhu-config` |
| TOOL-05-APPROVE-ONCE | 上一步点"拒绝"；再发一次后点"授权本次" | pending 消失；审计表追加 `rejected` 然后 `dry-run-only` 条目 |
| TOOL-06-APPROVE-SESSION | 再次发同样请求 → 点"授权本会话" | 后续 60s 内相同 `(workspace, session, tool)` 无弹窗（需用户自行触发第二次观察） |
| TOOL-07-SSE-EVENTS | 打开 Network 面板订阅 `/api/tools/events` | 前 6 步里 permission-required / approved / rejected 事件实时到达 |
| TOOL-08-AUDIT-JSONL | 执行若干次 runtime-execute | `.coolzhu/tool-audit.jsonl` 文件每步一行；`GET /api/tools/audit` 前端列表一致 |
| TOOL-09-LLM-EXPOSURE | `coolzhu.toml llm_tool_exposure="whitelist"` 启动；发问题 | 模型 diagnostic 显示"可用工具 11 个" |
| TOOL-10-LLM-TOOL-USE-READONLY | 让 LLM `read_file` README | 聊天流出现 tool-summary（`route=runtime-executed`）；模型第二轮用结果回答 |
| TOOL-11-LLM-TOOL-USE-DENIED | 让 LLM 尝试写 `coolzhu.toml` | 审批面板弹；用户拒绝；模型第二轮收到 is_error=true 并纠正 |

#### VIS-（grounding plan 已落地部分）

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| VIS-01-LOCATE-BACKENDS | GET `/api/vision/locate/backends` | 脚本打印 backend 可用性；UI 可选加 diag 卡展示 |
| VIS-02-LOCATE-UIA-START | POST `/api/vision/locate` `{target:{kind:"system",id:"start-button"}}` | 返回 `chosen_backend=uia` + 具体像素坐标；UI 截图标红圈 |
| VIS-03-LOCATE-VERIFY | POST `/api/vision/locate/verify` 同上坐标 | 返回 verdict（若 VLM key 配则 `pass`，否则 `skipped`） |
| VIS-04-DESCRIBE | POST `/api/vision/describe-screen` use_model=false | heuristic 描述返回 |

#### CU-（computer-use）

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| CU-01-SAFE-CLICK-TEST | POST `/api/computer-use/safe-click-test` | marker.hit=true（若 `-EnableRealInput`）；否则仅几何结果展示 |
| CU-02-ACTION-PLAN | POST `/api/computer-use/action-plan` `{intent:"点击桌面中心"}` | 返回 action_plan；execute_allowed=false |
| CU-03-DRY-RUN-MATRIX | POST `/api/tools/dispatch` 覆盖 6 个语义意图 | 每个返回结构化 dispatch_plan；execute_allowed=false |

#### WS-

| 场景 | 动作 | UI 判定点 |
| --- | --- | --- |
| WS-01-CURRENT | GET `/api/workspace` | 工程目录卡显示当前 path |
| WS-02-SWITCH | POST `/api/workspace` to `C:\Users\<u>\coolzhuagent-verify-tmp` | 卡片更新；会话列表变为新 workspace 下的内容（如为空） |
| WS-03-RESTORE | 切回原 workspace | 会话/聊天室恢复 |

#### MEDIA- / PET- / AUDIO-

MEDIA 项：脚本上传文件 + 发消息含 URL/图片粘贴；UI 看缩略图、点击播放。  
PET 项：脚本发消息；UI 看桌宠状态从 idle → thinking → success/warning。  
AUDIO 项：跳过需真实硬件的 `-SkipHardware`。

（完整列表由实现 agent 从 `docs/requirements-management.md` 的「已完成」行自动枚举；本文档仅给结构模板）

---

## 4. 脚本结构

### 4.1 目录

```
scripts/
  verify-all.ps1                # 主入口
  lib/
    env-check.ps1               # preflight
    http.ps1                    # Invoke-RestMethod 包装（超时/重试/UTF-8）
    process.ps1                 # 后台拉起 web-console/桌宠，窗口化日志
    wait.ps1                    # poll-until 辅助
    scene.ps1                   # 场景执行框架
    report.ps1                  # summary 生成
  scenes/
    env/
      01-port.ps1
      02-cargo.ps1
      ...
    session/
      01-new.ps1
      ...
    tool/
      01-catalog.ps1
      03-runtime-readonly.ps1
      04-runtime-protected.ps1
      ...
  templates/
    coolzhu.verify.toml         # 验证专用配置（不覆盖用户配置）
    summary.html.tpl            # 报告模板
```

### 4.2 场景脚本约定

每个 `scenes/<group>/NN-xxx.ps1` export 一个标准对象：

```powershell
@{
    Id           = "TOOL-03-RUNTIME-READONLY"
    Title        = "ReadOnly 工具 runtime 直通"
    Requires     = @("web-console-running")          # 可选 "real-llm" / "real-input" 等
    SkipIf       = { param($ctx) -not $ctx.WebConsole }
    Prepare      = { param($ctx) ... }               # 准备数据
    Trigger      = { param($ctx) ... }               # 发起动作，返回结构化结果
    UiChecklist  = @(                                # 让用户看的点
        "工具卡片 → 工具调用记录 tab → 最新一行 status=ok / route=runtime-executed",
        "前端 tool-audit-body 自动刷新时间戳"
    )
    Cleanup      = { param($ctx) ... }
}
```

`scene.ps1` 框架：
- 执行 `Prepare → Trigger → 询问用户 UiChecklist → Cleanup`
- 用户按 `y` 通过，`n` 失败附加备注，`s` 跳过
- 所有动作写 `tmp/verification-runs/<ts>/<scene-id>.jsonl`

### 4.3 上下文对象 `$ctx`

```powershell
@{
    RunId           = "2026-05-11T12-00-00"
    RunDir          = "C:\...\tmp\verification-runs\$RunId"
    WebConsole      = @{ Pid=123; Port=9865; BaseUrl="http://127.0.0.1:9865" }
    Pet             = $null
    Vlm             = @{ Port=8000 } or $null
    EnableRealLlm   = $false
    EnableRealInput = $false
    Offline         = $true
    LogFile         = "$RunDir\session.log"
    Report          = @{ Pass=0; Fail=0; Skip=0; Items=@() }
}
```

### 4.4 报告

结束时生成：

- `$RunDir/summary.json`：每个场景的 `id/title/status/duration_ms/user_note`
- `$RunDir/summary.html`：上述 JSON 套 `summary.html.tpl`，用户可直接在浏览器打开查看汇总
- 主进程 stdout 打印终端彩色表格

---

## 5. UI 改动配合（建议新增"验证面板"）

为让"用户只看 UI"的体验更顺滑，前端可选增一个独立入口：

| 要素 | 描述 |
| --- | --- |
| 菜单入口 | 工具卡片旁加"验证" tab（`data-role="verification-panel"`） |
| 当前 run | 读 `$RunDir/summary.json` 的实时片段（SSE 推或轮询） |
| 场景卡 | 每条列 `id / title / 期望 / 实际 / [通过] [失败] [跳过]` 按钮 |
| 截图 | 脚本把截图放 `$RunDir/shots/`，前端用 `<img>` 展示 |
| 终止 | "关闭验证并退出"按钮 → 脚本收到 signal 后清理 |

该面板**不阻塞 Phase D 其它开发**，是可选增强。不做也能用纯 PowerShell 彩色终端报告。

---

## 6. 实现分阶段

| Phase | 范围 | 交付 |
| --- | --- | --- |
| **V1** 骨架 | `lib/*`、`scene.ps1`、`preflight`、`ENV-*`、`report` | 能跑 preflight 组 + 生成空 summary |
| **V2** 零依赖组 | SESSION / CHAT（不启 real llm）/ MEDIA / WS | 不用 key / VLM / 真实点击即可全绿 |
| **V3** 工具组 | TOOL-01~08（无 LLM 路径的） | 覆盖 Phase C 工具闸门、审批、审计 UI |
| **V4** LLM 组 | TOOL-09~11 + CHAT-02 | 依赖 `-EnableRealLlm`；需要用户配好 key |
| **V5** 真实点击 | CU 真实执行分支 | 依赖 `-EnableRealInput`；默认关 |
| **V6** 视觉组 | VIS-* + CU-02 真实点击 | 需要 ShowUI 或远端 VLM |
| **V7** 前端验证面板 | `verification-panel` UI | 可选增强，不阻塞 V1-V6 |

每个 Phase 独立 PR；commit message `feat(verify): V<X> <group>`。

---

## 7. 风险与约束

| 风险 | 缓解 |
| --- | --- |
| 脚本修改了用户真实 workspace 数据 | 所有写入只在 `verify-*` 前缀数据 / 专用 workspace；`Cleanup` 必做 |
| `-EnableRealLlm` 产生费用 | 脚本开始时显眼 Warning；要求 `-IAcknowledgeCost` 显式二次确认 |
| `-EnableRealInput` 真实点击影响用户桌面 | 同上，要求 `-IAcknowledgeRealInput`；仅在专用 safe-click 靶场使用 |
| Windows 10 / 11 UI 差异导致 VIS/CU 抖动 | 脚本记录 OS build + 屏幕分辨率；场景按 buildNumber 分支 |
| 中文路径 / 非 ASCII 字符 | 所有 HTTP body 强制 `UTF-8 NoBom`；参考 `docs/work-logs/2026-05-10-dpi-anchor-analysis.md` |
| 场景之间干扰 | `scene.ps1` 强制按 `Id` 顺序；上一场景 `Cleanup` 不完成不进下一个 |

---

## 8. TDD for the scripts themselves（可选）

用 Pester 给每个场景脚本写最小 invariant：

```powershell
Describe "TOOL-03-RUNTIME-READONLY" {
    It "Trigger posts to /api/tools/runtime-execute with tool_name=read_file" {
        $ctx = @{ WebConsole = @{ BaseUrl = "http://127.0.0.1:0" } }
        Mock Invoke-WebRequest { return @{ StatusCode = 200; Content = '{"outcome":{"status":"ok"}}' } }
        $scene = & "$PSScriptRoot\scenes\tool\03-runtime-readonly.ps1"
        & $scene.Trigger $ctx
        Assert-MockCalled Invoke-WebRequest -ParameterFilter { $_.Uri -like "*runtime-execute*" }
    }
}
```

不强制；若实现 agent 时间紧迫，可只对 `scene.ps1` 框架 + `preflight` 写 Pester。

---

## 9. 交付清单

实现 agent 拿到本文档后需交付：

- [ ] `scripts/verify-all.ps1` + `lib/` + `scenes/` + `templates/`
- [ ] 对应每个"已完成"REQ 的场景脚本（从 `requirements-management.md` 枚举，初期可按 §3.2 节选）
- [ ] `tests/manual-visual-confirmation.md` 末尾追加"脚本化验证索引"章节
- [ ] `docs/work-logs/2026-05-1X-verification-automation-V<N>.md` 每阶段落地日志
- [ ] 样例 `summary.html` 截图放 `docs/assets/`

---

## 10. 给下一任 agent 的提醒

1. **场景脚本必须是幂等的**：`Prepare` 里建的测试数据带 `verify-` 前缀；`Cleanup` 必调。
2. **不要在 scene 里直接操作鼠标 / 键盘**：所有与真实 GUI 相关的步骤请用户自行确认。
3. **默认 `-Offline`** 跑完不出网；`-EnableRealLlm` 是显式启用。
4. **报告路径**用 `tmp/verification-runs/$(Get-Date -Format yyyyMMdd-HHmmss)` 便于多次 run 对比，但老报告 30 天后可清理。
5. **彩色输出**：用 PowerShell 7 的 `Write-Host -ForegroundColor`；Windows 10 默认 PowerShell 5.1 也兼容。
6. **外部工具**：脚本允许假设 `curl`/`jq` 不在 PATH；一律用 `Invoke-RestMethod`。
7. **preflight 优先**：当检测到 preflight 失败时，**明确提示用户"要不要先修这个再跑"**，不要跳过。

---

结论：本方案把"按 REQ 验证"变成"按场景脚本 + UI 确认"的流水线，覆盖 Phase A~C 所有已完成需求。实现完成后用户只需一条命令，再按 UI 提示确认若干可视化状态即可完成端到端交付验证。
