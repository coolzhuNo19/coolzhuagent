# 2026-05-13 需求完成度复盘与优先级重排

记录时间：2026-05-13 00:43-00:55（Asia/Shanghai）

## 范围

- 阅读 `docs/README.md`，确认当前文档入口与主线方案文档。
- 阅读 `docs/requirements-management.md` 的梯队摘要、主需求表、推进闸门、下一步计划、变更记录。
- 抽样阅读并汇总 `docs/work-logs/2026-05-10~2026-05-12`：
  - `tool-permission-session-cascade-phase-a~c13`
  - `grounding-router-step-a-b/c/e/final`
  - `showui-vision-agent-confusion`
  - `precise-click-grounding-audit`
- 对照 `docs/session-memory-workspace-integration-plan-2026-05-10.md`、`docs/tool-calling-permission-plan-2026-05-10.md`、`docs/showui-vision-agent-separation-plan-2026-05-12.md` 做状态修正。

## 发现

1. 需求表存在状态漂移：
   - 变更记录与 work-log 显示 `REQ-TOOL-007` Phase C13 主体已完成，但主表仍是 `待开发`。
   - `REQ-TOOL-008/009/010` 已有代码与测试证据，但主表缺失或仍为待开发。
   - `REQ-LLM-005` 标为已完成，但三合一卡片仍缺自定义 endpoint/base_url 表单，应该回到开发中。
2. 需求表存在重复编号：
   - `REQ-VIS-008` 同时表示"Grounding Backend 与 Vision Understanding Agent 职责分离"和"ShowUI 模型生命周期跟随服务"。
3. 新方案文档中的需求未全部落入主表：
   - `REQ-MEM-006`
   - `REQ-WEB-PROJECT-003`
   - `REQ-WEB-CTX-001`
   - `REQ-TOOL-009/010/011`
4. 当前最大风险已从"卡片没接 API"转为"概念/数据边界漂移"：
   - ShowUI grounding backend 与用户可选 Vision Agent 混用。
   - workspace 切换后 in-memory session/config/attachment/audit scope 可能不同步。
   - 工具调用扩大暴露后，审批 UI 与审计链路必须完成交互验收。

## 文档修改

修改文件：

- `docs/requirements-management.md`

主要修改：

- 新增 `0.2 完成度复盘与优先级重排 - 2026-05-13`。
- 更新梯队执行摘要。
- `REQ-VIS-008` 升为 P0，明确优先拆分 Grounding Backend 与 Vision Understanding Agent。
- `REQ-WEB-SESSION-007` 升为 P0。
- 新增/补入：
  - `REQ-WEB-PROJECT-003`
  - `REQ-WEB-CTX-001`
  - `REQ-MEM-006`
  - `REQ-TOOL-009`
  - `REQ-TOOL-010`
  - `REQ-TOOL-011`
- 修正状态：
  - `REQ-TOOL-007` → `已完成`
  - `REQ-TOOL-008/009/010` → `测试中`
  - `REQ-LLM-005` → `开发中`
  - `REQ-CORE-TOOL-001` → `开发中`
- 重复编号修正：
  - ShowUI 生命周期从 `REQ-VIS-008` 改为 `REQ-VIS-011`
- 更新推进闸门与下一步计划。
- 更新需求统计：95 个唯一需求，状态分布为已完成 57、测试中 5、开发中 3、待开发 29、暂停 1。

## 验证

执行文档自检命令：

```powershell
Select-String -Path docs\requirements-management.md -Pattern '^\| REQ-' -Encoding UTF8
```

自检结果：

- `TOTAL_ROWS=95`
- `UNIQUE_IDS=95`
- `DUPLICATES=none`
- 状态分布：
  - `已完成=57`
  - `测试中=5`
  - `开发中=3`
  - `待开发=29`
  - `暂停=1`
- 优先级分布：
  - `P0=16`
  - `P1=65`
  - `P2=12`
  - `P3=2`

## 备份

- `tmp/backups/requirements-reprioritize-20260513-004339/`

## 下一步建议

1. 先做 `REQ-VIS-008`，因为它是当前视觉链路最容易继续误导实现方向的结构性问题。
2. 并行准备 `REQ-WEB-SESSION-007` 和 `REQ-WEB-PROJECT-003` 的 TDD，数据边界闭环后再推进多 Agent handoff。
3. `REQ-TOOL-008/009` 做真实 Web UI 交互验收；如果失败，按问题修复优先级回开发中。
