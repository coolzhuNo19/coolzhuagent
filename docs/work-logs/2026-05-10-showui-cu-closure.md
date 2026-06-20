# 2026-05-10 ShowUI + Computer Use 需求闭环

## 背景
ShowUI 本地模型已拉起 (http://127.0.0.1:8000)，第三梯队 17 个需求处于"测试中"，需实测验收。

## ShowUI 集成修复
- 默认端口: 8001 → 8000 (`DEFAULT_LOCAL_VISION_BASE_URL`)
- 默认模型: qwen2.5-vl-3b → showui-2b (`DEFAULT_LOCAL_VISION_MODEL`)
- grounding 与视觉理解链路分离 (grounding 不读视觉会话配置)

## 实测验证结果

### REQ-VIS-001: ShowUI Grounding
- 端点: `/api/vision/find-target` + `use_model=true`
- 结果: `grounding-model-parsed` + point(597,412) + 截图证据
- err.log: `[VISION-MODEL] url=8000/v1, model=showui-2b → grounding call completed`

### REQ-CU-001: Safe-click 靶场 (几何回退)
- 端点: `/api/computer-use/safe-click-test`
- 结果: 靶场 602/751, `marker.hit=true`, 3张截图证据
- vision.source: geometry-fallback

### REQ-CU-002: 强视觉 Safe-click
- 端点: `/api/computer-use/safe-click-test` + `use_visual_grounding=true`
- 结果: ShowUI 返回 `[0.35, 0.43]` → 像素(597,412), `marker.hit=true`
- vision.source: visual-grounding (非 geometry-fallback)
- 全链路: capture → ShowUI定位 → 像素映射 → 点击 → marker验证 ✅

### REQ-CU-003~008 + TOOL-005/006: 自动化测试
- 15 项 CU/TOOL 自动化测试全部通过
- 覆盖: action_plan, context_menu, drag_select, visual_action, safe_click, semantic_dispatch
- 全量回归: 142 passed, 0 failed

## 新增 TDD 测试
- `vis001_showui_multi_candidate`: 多候选最高置信选择
- `vis001_showui_bad_json_returns_none`: 非法 JSON 安全返回
- `cu002_grounding_in_visual_action_chain`: grounding 证据链路
- `cu002_grounding_result_chain_handles_empty`: grounding 失败时 trace 记录错误

## 需求状态变更
| 数量 | 旧状态 | 新状态 |
|---|---|---|
| 13 | 测试中 | ✅ 已完成 |
| 4 | 测试中 | 保持 (REQ-VIS-003, REQ-TOOL-001/002/004) |

总完成率: 40 → 53 (66%)

## 关联文件
- `modules/vision/packages/vision-service/src/lib.rs`: DEFAULT_LOCAL_VISION_BASE_URL/MODEL 修改
- `modules/gui-web/packages/web-console/src/main.rs`: grounding 日志增强, CU-002 测试
- `docs/requirements-management.md`: 13项状态更新 + 统计
- `tmp/backups/showui-cu-20260510-110503/`: 修改前备份
