# 2026-05-12 - Grounding Router 最终交付

## E4: api_tool_execute 接入 Grounding Router

### 变更
- `ToolDispatchRequest` 新增 `system_control: Option<String>` 字段 + Default impl
- `api_tool_execute` 新增 UIA 优先路由:
  1. 尝试 `try_uia_resolve` (UIA resolver)
  2. 失败回退 `grounding_median_point` (ShowUI 3次采样)
- 新增辅助函数:
  - `try_uia_resolve(payload, target)` → 异步，读取 payload.system_control 或从 target 检测
  - `try_parse_system_control(name)` → 字符串映射 6个系统控件
  - `detect_system_control_from_target(target)` → 从自然语言 target 检测关键字

### 测试结果
- 编译通过
- `POST /api/vision/locate {"target":{"kind":"system","id":"start-button"}}` → `status=ok, backend=uia, point=(41,1404), conf=0.99` ✅
- `GET /api/vision/locate/backends` → `uia:ready, local_vlm:ready, remote_vlm:not-implemented` ✅
- api_tool_execute UIA 解析成功 → 鼠标移动到 (41,1404) ✅
- LLM 验证步骤因缺少 API key 超时 (预期行为)

## 已知限制
- LLM 验证 (`verify_cursor_on_target`) 未配置智谱 API Key 时阻塞 → 建议 UIA 高置信度 (≥0.9) 时跳过验证
- RemoteVLM backend 未实现
- ShowUI 仍为回退方案，精度有限

## 验证文档
- 验证方案: `docs/grounding-router-verification-plan.md`
- 测试脚本: `tmp/test-grounding-router.bat`

## 备份
- `tmp/backups/grounding-router-20260512-222353/` (Step A+C pre-restore)
