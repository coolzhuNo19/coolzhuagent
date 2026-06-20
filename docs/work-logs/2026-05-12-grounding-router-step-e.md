# 2026-05-12 - Grounding Router 实施 Step E

## Step E: Router + API 集成

### 修改文件
- `Cargo.toml` (workspace): +1行 (`uia_resolver` 工作空间依赖)
- `modules/gui-web/packages/web-console/Cargo.toml`: +1行 (`uia_resolver.workspace = true`)
- `modules/gui-web/packages/web-console/src/main.rs`:
  - 路由: 新增 `POST /api/vision/locate`、`GET /api/vision/locate/backends`、`POST /api/vision/locate/verify`
  - 处理函数: `api_vision_locate` (60行)、`api_vision_locate_backends` (15行)、`api_vision_locate_verify` (20行)
  - 辅助函数: `extract_system_control`

### 实现逻辑

**`POST /api/vision/locate`**:
1. 按 `pipeline` 顺序尝试 backend (Uia → LocalVlm → RemoteVlm)
2. UIA backend: 从 `LocateTarget::System{id}` 提取 `SystemControlId`，调用 `uia_resolver::resolve_system_control(id)`
3. 返回 `BackendAttempt` 含 point (bbox中心)、confidence=0.99、elapsed_ms
4. 一旦任一 backend 返回 `confidence >= min_confidence` 即返回
5. `cross_verify=true` 时继续尝试下一层做一致性校验

**`GET /api/vision/locate/backends`**:
- 返回可用 backend 列表与健康状态
- UIA: ready; LocalVlm: ready; RemoteVlm: not-implemented

**`POST /api/vision/locate/verify`**:
- 接收 `point` + `target`，调用已有 `verify_cursor_on_target` 做 LLM 裁决
- 返回 `verdict: pass/fail`

### 测试结果
- web-console: 173 tests passed (0 failed)
- uia-resolver: 1 test passed

### 当前覆盖
- ✅ UIA 解析 `StartButton` → (0, 1368, 83, 72) 中心 (41, 1404)
- ✅ `POST /api/vision/locate` 端点
- ✅ 路由注册完成
- ⏳ LocalVlm backend 集成 (待 Step C)
- ⏳ RemoteVlm backend 集成 (待 Step D)
- ⏳ `api_tool_execute` 改造为调用 router (待后续)
