# Grounding Router 最终交付验证方案

版本: v1.0 | 日期: 2026-05-12

## 实施完成度

| 步骤 | 内容 | 文件 | 测试 |
|------|------|------|------|
| A 契约 | LocateRequest/Response 等 25 个类型 | `vision-service/src/locate.rs` | 8 pass |
| B UIA | PowerShell .NET UIAutomation 解析器 | `uia-resolver/src/lib.rs` | 1 pass |
| C LocalVLM | 区域裁剪 + DBSCAN 聚类 | `vision-service/src/local_backend.rs` | 6 pass |
| D RemoteVLM | 未实现 | — | — |
| E Router | 3 个 HTTP 端点 + api_tool_execute 集成 | `main.rs` | 186 pass |

## 验证脚本

```batch
tmp\test-grounding-router.bat
```

## 人工验证清单

### 测试 1: UIA StartButton 定位
- [ ] 执行: `POST /api/vision/locate {"target":{"kind":"system","id":"start-button"}}`
- [ ] 期望: `status=ok, chosen_backend=uia, confidence≥0.9`
- [ ] 期望: `point.x≈41, point.y≈1404` (开始按钮中心)
- [ ] 实际: _______

### 测试 2: 未实现控件返回 NotFound
- [ ] 期望: `status=not-found`
- [ ] 实际: _______

### 测试 3: Backends 健康检查
- [ ] 期望: UIA status=ready
- [ ] 实际: _______

### 测试 4: api_tool_execute 带 system_control 走 UIA
- [ ] 期望: 日志出现 `[TOOL-CHAIN] UIA hit=(X,Y)`
- [ ] 期望: 鼠标移动到开始按钮位置
- [ ] 实际: _______

### 测试 5: Natural target 回退 ShowUI
- [ ] 期望: attempts 包含 UIA(Skipped) + LocalVlm 尝试
- [ ] 实际: _______

## err.log 验证命令

```
Get-Content C:\Users\zhupu\coolzhuagent\err.log -Tail 20
```

期望出现:
- `[TOOL-CHAIN] UIA resolver: system_control=StartButton`
- `[TOOL-CHAIN] UIA hit=(41,1404) conf=0.99`

## 验收签字

- [ ] 测试 1-5 全部通过
- [ ] UIA 坐标 (41, 1404) 与实际开始按钮位置误差 < 6px
- [ ] 验收人: _______
- [ ] 日期: _______
