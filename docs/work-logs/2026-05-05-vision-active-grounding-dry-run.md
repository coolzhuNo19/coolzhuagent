# Vision Active Grounding Dry-Run 落地记录

日期：2026-05-05  
范围：`modules/gui-web/packages/web-console`、`modules/vision/packages/vision-service`

## 已完成

1. `vision.find_target` / `vision.find_region` dry-run 请求新增显式模型调用开关：
   - `use_model`
   - `base_url`
   - `model`
   - `api_key`
   - `timeout_seconds`

2. 默认仍保持安全 dry-run：
   - `use_model=false` 时只采集截图和解析 `raw_response`。
   - 不触发真实鼠标、键盘或文件执行。

3. `use_model=true` 时接入本地 OpenAI-compatible VLM：
   - 默认 `CLAW_LOCAL_VISION_BASE_URL`，缺省为 `http://127.0.0.1:8001/v1`。
   - 默认 `CLAW_LOCAL_VISION_MODEL`，缺省为 `qwen2.5-vl-3b`。
   - 使用 `build_showui_grounding_request` 构造截图 grounding 请求。
   - 返回 `backend` trace：backend、model、base_url、request_id、total_tokens、error。

4. 错误分类：
   - 连接失败归类为 `local vision backend unreachable`。
   - 超时归类为 `local vision backend timeout`。
   - 401/403 归类为鉴权失败。
   - 404 归类为 route/model not found。
   - HTTP/API 失败不会导致 500，而是返回 `grounding-backend-error`。

5. 状态区分：
   - `grounding-parsed`：仅解析 `raw_response` 成功。
   - `grounding-model-parsed`：主动 VLM 返回并解析成功。
   - `grounding-backend-error`：主动 VLM 调用失败但 dry-run 响应保持结构化。
   - `dry-run-capture-ready`：仅完成截图，无 grounding。

## 验证结果

| 检查项 | 结果 |
| --- | --- |
| `node --check modules\gui-web\packages\web-console\src\app.js` | 通过 |
| `cargo check -p coolzhu-web-console` | 通过 |
| `cargo test -p coolzhu-web-console` | 86 passed |
| `cargo build -p coolzhu-web-console` | 通过 |
| Web 服务 | 已重启到 `http://127.0.0.1:8765/` |

## HTTP Smoke

| 接口 | 结果 |
| --- | --- |
| `POST /api/tools/vision.find_target/dry-run` with `use_model=false` | `grounding-parsed`，`executed=false`，返回 point/bbox |
| `POST /api/vision/find-target` with `use_model=true` | 本机未启动 VLM 时返回 `grounding-backend-error` 和 `local vision backend unreachable` |

## 后续

1. 启动真实本地 VLM 后复测 `grounding-model-parsed`。
2. 将 `vision.find_region` 的 bbox 结果串入 `computer.drag_select` / `computer.safe_drag_select` action plan。
3. LLM tool calling 只能读取该 dry-run 结构，不能直接触发真实 execute。
