# 2026-05-09 记忆系统需求 TDD 闭环

## 背景
第二梯队 4 个记忆需求 (REQ-MEM-002~005) 均处于"测试中"状态，代码已实现但缺少 TDD 验收测试。按 TDD 流程补测试并标记完成。

## 修改内容

### 新增 TDD 测试 (main.rs tests 模块)

#### REQ-MEM-002: beads 持久化服务
- `mem002_bead_crud_and_signature`: 验证 bead 添加/更新/删除 + 签名去重
- 覆盖: CRUD 全生命周期、`memory_bead_signature` 一致性

#### REQ-MEM-003: 自动记忆沉淀
- `mem003_auto_bead_deduplication`: 验证签名生成非空
- 覆盖: 所有 bead 类型 (chat/decision/preference/tool) 签名

#### REQ-MEM-004: 检索增强 prompt
- `mem004_prompt_beads_filter_l4_and_limit`: 验证 L4 层过滤 + limit 参数
- 覆盖: `query_prompt_memory_beads` L4 排除、`PromptMemoryQuery.to_runtime_options`

#### REQ-MEM-005: 记忆治理
- `mem005_pin_survives_prune_and_summary_counts`: 验证 pin 保留 + 容量裁剪 + 摘要统计
- 覆盖: `prune_memory_beads_to` 保留 pinned、`memory_beads_summary` 统计

### 需求状态更新
| ID | 旧状态 | 新状态 |
|---|---|---|
| REQ-MEM-002 | 测试中 | ✅ 已完成 |
| REQ-MEM-003 | 测试中 | ✅ 已完成 |
| REQ-MEM-004 | 测试中 | ✅ 已完成 |
| REQ-MEM-005 | 测试中 | ✅ 已完成 |

### 关联文件
- `modules/gui-web/packages/web-console/src/main.rs`: 新增 4 个 TDD 测试函数
- `docs/requirements-management.md`: 需求状态更新 + 统计 (36→40 已完成)
- `tmp/backups/memory-tdd-20260510-045715/main.rs`: 修改前备份

## 测试结果
- 记忆专项: 10 passed, 0 failed
- 全量回归: 138 passed, 0 failed
