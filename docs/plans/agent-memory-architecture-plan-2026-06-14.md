# Agent 记忆架构补齐方案（A–H 完整实施计划）

- 日期：2026-06-14
- 需求编号：`CUR-MEM-ARCH-001`
- 状态：方案待评审（未开工）。执行顺序 **#2**（前置：`CUR-DIAG-LOG-001` 补日志；之后：`CUR-SELFCHECK-001` 自检 → `CUR-SOAK-MONKEY-001` → `CUR-LOCAL-LLM-001`）
- 关联：本轮交互（TurboVec / 端侧模型调研）、`docs/current-issues-and-unfinished-requirements-2026-05-21.md`
- 配套文档：`docs/plans/gemma4-12b-local-deployment-plan-2026-06-14.md`（Gemma 4 本地部署，押后）

> 目的：把当前以**关键词检索**为主的 memory beads 系统，升级为具备**语义检索 + 生命周期管理**的完整 agent 记忆架构。
> TurboVec 接入（能力 A）是第一步，但**最终目的是补齐 A–H 全部能力**。本文按 A–H 逐项给出详细实施方案。

---

## 0. 一句话现状与目标

- **现状**：5 层 beads（L0–L4）+ 子串 AND 关键词检索 + 词重叠回退（注释明写"无 embedding"）+ 静态分 prune + 精确签名去重。本质是"会存、会按关键词捞、会按固定分裁剪"的记忆，**缺语义、缺生命周期**。
- **目标**：补齐语义检索（A）、遗忘/强化（B）、冲突消解（C）、巩固晋升（D）、关联图（E）、时效（F）、写入策略（G）、召回评估（H）。

---

## 1. 现状盘点（代码级，作为施工基线）

### 1.1 数据存储（web-console `src/main.rs`）
- 表 `memory_beads`（main.rs:25115）：
  ```sql
  session_id TEXT, id TEXT, kind TEXT, layer TEXT, summary TEXT, source TEXT,
  pinned INTEGER, confidence REAL, created_at INTEGER,
  PRIMARY KEY(session_id, id), FOREIGN KEY(session_id)->sessions ON DELETE CASCADE
  -- idx_memory_beads_session_layer(session_id, layer, created_at)
  ```
- 迁移 v2 已加列：`origin_message_id, origin_table, token_count`（REQ-MEM-006 / REQ-WEB-CTX-001）。
- DTO `MemoryBeadDto`（main.rs:29915）：上述列 + `signature()`，`impl MemoryBeadView`。
- **迁移机制**：`PRAGMA user_version` + `ensure_memory_bead_column(conn, name, type)`，幂等，已有 v2–v6。**新增列遵循此模式即可，低风险。**

### 1.2 检索 / 选择（core-runtime `src/memory.rs`）
- `query_memory_beads`（memory.rs:189）：`memory_bead_matches_query` 子串 AND；**memory.rs:209-237 是 `if selected.is_empty()` 词重叠回退**（语义检索接入点）。
- `select_prompt_memory_beads`（memory.rs:175）：过滤 L4，按 `pinned > layer_rank > confidence > created_at` 排序后截断。
- `prune_memory_beads_to`（memory.rs:242）：同序裁剪到 `max_beads`。
- 去重：`memory_bead_signature`（精确字符串）。

### 1.3 应用接入点（web-console `src/main.rs`）
- `select_context_memory_beads`（main.rs:16161）：构造 `MemoryBeadQueryOptions` → `runtime::query_memory_beads` → 空则 `select_prompt_memory_beads`。**构建 prompt 上下文的主路径。**
- `persist_auto_memory_beads`（main.rs:18079）：会话后自动抽取写入（能力 G 现有实现）。
- `store.add/update/delete_memory_bead`（main.rs:7340/7350/7364）：CRUD。

### 1.4 已有/部分已有的能力（避免重复造）
| 能力 | 已有部分 | 缺口 |
|---|---|---|
| F 来源回链 | `origin_message_id/origin_table` + 级联删 trigger | 时效（event_time / valid_until） |
| G 写入抽取 | `persist_auto_memory_beads` | 写前去重、价值过滤、摘要质量 |
| 上下文预算 | `token_count` 列 + ContextBuilder | 与语义相关性联合排序 |
| 分层 | L0–L4 + `memory_layer_for_kind`（L0 当前未被任何 kind 命中，预留） | 层间晋升流程（D） |

---

## 2. 目标架构

```
                ┌──────────────────────────────────────────────┐
                │              Memory Manager（策略层）           │
                │  G 写入  ·  C 冲突消解  ·  B 遗忘/强化           │
                │  D 巩固晋升  ·  E 关联图  ·  F 时效              │
                └───────────────┬──────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────┐
        ▼                       ▼                            ▼
 ┌──────────────┐      ┌─────────────────────┐      ┌──────────────┐
 │ A 检索层      │      │ Storage（数据层）     │      │ H 评估        │
 │ 关键词+语义   │◄────►│ beads / vectors /    │      │ recall@k/MRR │
 │ 暴力余弦→     │      │ edges / access       │      │ 回归守门      │
 │ TurboVec     │      └─────────────────────┘      └──────────────┘
 └──────────────┘
```

三层：**Storage（数据）/ Retrieval（A）/ Policy（B–G）**，外加 **Eval（H）** 贯穿。
关键认知：**A 是底座（检索），B–G 是正交的策略层，向量库不代劳生命周期管理。**

---

## 3. 统一数据模型演进（一次设计，避免反复迁移）

所有新增列走 `ensure_memory_bead_column`，新增表走单独 `CREATE TABLE IF NOT EXISTS`，统一在一次迁移版本（建议 **v7**）落地，**字段先加齐、按能力分阶段启用**。

### 3.1 `memory_beads` 新增列
| 列 | 类型 | 服务能力 | 说明 |
|---|---|---|---|
| `last_accessed_at` | INTEGER | B | 最近被召回时间 |
| `access_count` | INTEGER DEFAULT 0 | B | 召回命中次数（强化） |
| `entity_key` | TEXT | C | 实体归并键，如 `user.theme` |
| `status` | TEXT DEFAULT 'active' | C/F | `active`/`superseded`/`expired` |
| `superseded_by` | TEXT | C | 取代它的新 bead id |
| `version` | INTEGER DEFAULT 1 | C | 同实体版本号 |
| `derived_from` | TEXT(JSON) | D | 巩固来源 bead id 数组 |
| `consolidated_at` | INTEGER | D | 被巩固/产出时间 |
| `event_time` | INTEGER | F/C | 事实发生时间（默认=created_at） |
| `valid_until` | INTEGER | F | 过期时间（NULL=永久） |

### 3.2 新增表
```sql
-- A：向量索引（payload 仍在 memory_beads，本表只存向量）
CREATE TABLE IF NOT EXISTS memory_vectors (
    session_id TEXT NOT NULL, bead_id TEXT NOT NULL,
    model_id TEXT NOT NULL, dim INTEGER NOT NULL, vec BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, bead_id),
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
-- E：关联图边
CREATE TABLE IF NOT EXISTS memory_edges (
    session_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
    relation TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1.0, created_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, from_id, to_id, relation)
);
-- H：召回日志（可选，用于线上评估）
CREATE TABLE IF NOT EXISTS memory_recall_log (
    session_id TEXT, query TEXT, hit_ids TEXT, strategy TEXT, created_at INTEGER
);
```

### 3.3 迁移与兼容
- 单次 `apply_session_migration_v7`：加 §3.1 列 + §3.2 表，幂等。
- **DTO 兼容**：`MemoryBeadDto` 新增字段全部 `#[serde(default, skip_serializing_if=...)]`，旧 JSON/旧库零破坏（与现有 v2 字段同款写法）。
- `model_id+dim` 入 `memory_vectors`：embedder 变更可检测并触发重建（见 A 风险）。

---

## 4. 依赖关系与路线图

### 4.1 依赖图
```
A 语义检索 ──┬─► C 冲突消解 ──┐
            ├─► D 巩固晋升 ◄─┤（也依赖 B）
            ├─► E 关联图     │
            └─► G 写前去重 ──┘
F 时效（便宜，早做）──► C（event_time 判新旧）
B 遗忘/强化（需 A 检索钩子写 access）
H 评估：贯穿，A 落地即引入
```

### 4.2 阶段
| 阶段 | 内容 | 依赖 | 新依赖风险 |
|---|---|---|---|
| **P1** | **A**（暴力余弦语义召回）+ schema v7（vectors）+ **H-min**（eval 骨架） | — | 零（不引 crate） |
| **P2** | **F**（时效）+ **B**（衰减/强化） | A 检索钩子 | 零 |
| **P3** | **C**（冲突消解）+ **G**（写入策略） | A、F | 零 |
| **P4** | **D**（巩固管线）+ **E**（关联图） | A、B、C | 零 |
| **P5** | **TurboVec 后端切换** + **H-full** | A 稳定 | 需先验证 `turbovec` 离线可得 |

> 顺序贴合你的要求：**TurboVec/A 第一步**；但 P1 先用零依赖的暴力余弦打通，P5 才换 TurboVec 后端——既早见效，又规避离线缓存风险（CLAUDE.md 记过 `serial_test` 不在离线缓存，`turbovec` 同样需先验证）。

---

## 5. A–H 详细实施方案

> 每项统一给出：目标 / 现状缺口 / 设计 / 数据 / 接入点 / 步骤 / 依赖 / 验证 / 风险。

### A. 语义检索（TurboVec）⭐ 第一步
- **目标**：L3/L4 按语义召回，跨语言、抗同义改写。
- **现状缺口**：`memory.rs:209-237` 词重叠回退（无 embedding）。
- **设计**：
  - `Embedder` trait（llm-adapter）：`embed(&[String]) -> Vec<Vec<f32>>` + `dim()` + `model_id()`；实现走 `OpenAiCompatClient` 打 `/v1/embeddings`。
  - `SemanticIndex` trait（core-runtime）：`add/search(qvec,k)/remove/persist/load`；实现 `BruteForceCosine`（P1，零依赖）→ `TurboVecIndex`（P5，feature `semantic-turbovec`）。
  - 仅 L3/L4 走语义；L1/L2 维持关键词 + pinned。
- **数据**：`memory_vectors` 表（§3.2）。
- **接入点**：
  - llm-adapter 新增 `embeddings`（当前 lib.rs 无 embed 导出，需新增）。
  - core-runtime `memory.rs:209-237` 回退分支：词重叠 → `SemanticIndex::search`。
  - web-console `select_context_memory_beads`（16161）注入 embedder + index。
- **步骤**：P1 暴力余弦打通 → 持久化向量 → 既有 bead 批量回填 embedding → P5 换 TurboVec。
- **依赖**：无（基础）。embedder 配置独立于生成模型（见 §6）。
- **验证**：eval recall@k 对比关键词；`cargo build/test -p coolzhu-core-runtime --offline`。
- **风险**：① embedder 一致性——`model_id+dim` 入库，变更即标记重建；② turbovec 离线缓存未验证——P1 零依赖兜底。

### B. 遗忘/衰减 + 使用强化
- **目标**：常被召回的记忆上浮，陈旧无用的下沉/淘汰；pinned 永不衰减。
- **现状缺口**：prune 用静态分（pinned/layer/confidence/recency），无 `last_accessed/access_count`。
- **设计**：
  - 列 `last_accessed_at`、`access_count`。
  - 召回命中时 bump（节流/批量写，避免写放大）。
  - `effective_score = base(pinned,layer,confidence) * decay(now-last_accessed, 半衰期) + α·log1p(access_count)`；pinned 跳过 decay。
- **数据**：§3.1 两列。
- **接入点**：`memory.rs` 的 `compare_memory_beads_for_prompt` / `prune_memory_beads_to` 引入 `effective_score`；web-console 召回路径写回 access。
- **步骤**：加列 → 召回钩子写 access（批量）→ prune/排序改用 effective_score → 单测。
- **依赖**：A（在检索路径挂 access 钩子最自然）。
- **验证**：单测 decay 单调、pinned 不衰减、高 access 上浮。
- **风险**：写放大 → 召回只在内存累计、按周期/会话结束批量落盘。

### C. 更新 / 冲突消解
- **目标**：新事实取代矛盾旧事实，实体级 upsert，不物理丢信息。
- **现状缺口**：仅 `signature` 精确去重；"深色→浅色"类矛盾无处理。
- **设计**：
  - 列 `entity_key/status/superseded_by/version`。
  - 写入时：A 语义找候选（高相似 + 同 kind/entity_key）→ 判定（规则优先：同 entity_key 视为更新；可选 LLM 判矛盾）→ 旧 bead `status=superseded, superseded_by=新id`，新 bead `version+1`。
  - 检索默认 `status='active'`。
- **数据**：§3.1 四列。
- **接入点**：`persist_auto_memory_beads` / `store.add_memory_bead` 前置 upsert 决策；query 增加 `status='active'` 过滤。
- **步骤**：加列 → upsert 决策（先规则版，离线可测）→ query 过滤 status → 用例测试。
- **依赖**：A（找候选）、F（`event_time` 判新旧）。
- **验证**：偏好翻转用例；矛盾判定（规则版）单测。
- **风险**：误判丢信息 → **软删除**（status，不物理删）+ 保留版本链可回溯。

### D. 巩固 / 晋升管线
- **目标**：周期性把 L4 原始对话蒸馏为 L3 知识，再固化为 L1/L2，控制总量并提纯。
- **现状缺口**：L0–L4 有层无晋升流程。
- **设计**：
  - 后台/会话结束触发：A 向量近邻聚类 L4/L3 → 成簇 → LLM 摘要为更高层 bead → `derived_from` 记来源 → 原 bead 降权/归档。
  - 离线无 LLM 时降级为规则合并（拼接 + 去重），不阻塞。
- **数据**：§3.1 `derived_from/consolidated_at`。
- **接入点**：新模块 `core-runtime/memory_consolidation`；调 llm-adapter（摘要）+ `SemanticIndex`（聚类）。
- **步骤**：聚类 → 摘要（LLM/规则）→ 产出高层 bead + derived_from → 原 bead 归档 → 触发器接入。
- **依赖**：A（聚类）、B（挑高频/低价值）、C（合并复用 supersede）。
- **验证**：一簇近义 bead → 1 条 L3 + `derived_from` 正确；可回溯。
- **风险**：蒸馏丢细节 → `derived_from` 全程保留，原始 bead 归档不删。

### E. 关联 / 图
- **目标**：bead 间建立关系，支持一跳/多跳扩展召回。
- **现状缺口**：beads 扁平，无链接。
- **设计**：
  - `memory_edges`（from,to,relation,weight）。
  - 自动建边：相似（A）、`derived_from`（D）、同 `entity_key`（C）、共现（同会话窗口）。
  - 召回：种子 bead → 扩展强权重邻居（每节点 top-k 边、权重阈值，防爆炸）。
- **数据**：§3.2 `memory_edges`。
- **接入点**：召回后 `expand_with_edges`；写入/巩固时建边。
- **步骤**：建表 → 建边规则 → 召回扩展 → 阈值调参。
- **依赖**：A（相似边）、D（derived 边）。
- **验证**：给定种子可扩展出关联 bead；边数受控。
- **风险**：边爆炸 → 阈值 + per-node top-k。

### F. 来源回链 / 时效
- **目标**：回链已具备（保持），补齐"事实时效"。
- **现状缺口**：`origin_message_id/table` 已回链 + 级联删 trigger；缺 `event_time/valid_until`。
- **设计**：
  - 列 `event_time`（默认=created_at）、`valid_until`（NULL=永久）。
  - 检索过滤：`now > valid_until` → `status='expired'` 或排除，不进 prompt。
  - 抽取时对临时事实（如"本周冲刺=X"）赋 `valid_until`。
- **数据**：§3.1 两列。
- **接入点**：schema；query 过滤；`persist_auto_memory_beads` 赋时效。
- **步骤**：加列 → query 过滤过期 → 抽取赋时效 → 测试。
- **依赖**：C（共享 event_time/status）。
- **验证**：过期 bead 不进 prompt；event_time 早于 created_at 的历史事实正确排序。
- **风险**：低。

### G. 写入 / 抽取策略
- **目标**：提升"什么值得记 + 写前去重 + 摘要质量"。
- **现状缺口**：`persist_auto_memory_beads` 存在，但策略粗（未细看价值过滤/去重）。
- **设计**：
  - 写前：A 语义去重（高相似→走 C 的 upsert 而非新增）。
  - 价值过滤：低信息/瞬时/重复 → 不写或入 L4。
  - 摘要质量：抽取 prompt 模板化；kind/layer 复用 `memory_layer_for_kind`。
  - 显式 vs 自动：以 `source`/`confidence` 区分，显式优先。
- **数据**：复用现有列 + C 的 entity_key。
- **接入点**：`persist_auto_memory_beads`（18079）重构；新增抽取 prompt。
- **步骤**：写前去重接 A/C → 价值过滤 → 抽取模板 → 测试。
- **依赖**：A（去重）、C（upsert）。
- **验证**：重复输入不产生重复 bead；噪声不入库；显式记忆不被自动覆盖。
- **风险**：过滤过激丢信息 → 保守阈值 + 可配置开关。

### H. 召回质量评估
- **目标**：可度量、防回归，每次改动有据。
- **现状缺口**：无 eval。
- **设计**：
  - 固定离线样本集：`query → 期望 bead ids`，覆盖关键词命中、同义、跨语言、时效、冲突场景。
  - 指标：recall@k、MRR；对比 关键词 / 暴力余弦 / TurboVec。
  - 形态：`cargo test` 或独立 `bin`，离线可跑。
- **数据**：可选 `memory_recall_log`。
- **接入点**：新增 tests/bin + 样本文件（`tests/fixtures/memory_eval.json`）。
- **步骤**：建样本 → 指标计算 → 接入 P1 即开始度量 → 各阶段守门。
- **依赖**：A（被评估对象）；贯穿全程。
- **验证**：eval 可重复运行；阈值守门（低于基线视为回归）。
- **风险**：样本偏置 → 多场景覆盖，随真实使用补充。

---

## 6. 全局约束（CLAUDE.md 对齐）

- **embedder 与生成模型解耦**：新增 `memory.embedder = {provider, model, dim}` 配置位，独立于 agent 生成模型（生成模型本地/远端均可，互不影响）。embedder 建议本地小模型（离线/免费/隐私/稳定）。
- **离线优先**：P1–P4 不引新 crate；P5 引 `turbovec` 前先验证离线缓存可得，否则停在暴力余弦（接口不变）。
- **测试**：改全局态用 `config_test_guard()`；`cargo test -p <crate> --offline`；保留 `module_linkage_smoke`。**不破坏 `memory.rs` 现有关键词路径与既有测试**（语义仅增强空回退分支）。
- **大文件谨慎**：bead 存储改动落在 web-console `main.rs`（1.36MB）——Read 用 offset/limit 分段，改前确认上下文，先备份（参照 `tmp/backups/` 前例）。
- **中文优先**：注释 / work-log / 回复一律中文。

---

## 7. 里程碑与验收

| 里程碑 | 交付 | 验收 |
|---|---|---|
| M1（P1） | 语义召回（暴力余弦）+ vectors 表 + eval 骨架 | L3/L4 同义 query 召回率显著高于关键词，回归 eval 通过 |
| M2（P2） | 时效 + 衰减/强化 | 过期不进 prompt；高频上浮、pinned 不衰减 |
| M3（P3） | 冲突消解 + 写入策略 | 偏好翻转正确 supersede；重复输入不增 bead |
| M4（P4） | 巩固管线 + 关联图 | 近义簇产出 L3 且可回溯；种子可扩展关联 |
| M5（P5） | TurboVec 后端 + 完整 eval | 大规模召回提速 + 内存压缩，recall 与暴力版对齐 |

---

## 8. 下一步（建议起点）

执行 **P1**：
1. Phase 0 定位 `add/update/delete_memory_bead` 与 `persist_auto_memory_beads` 落盘细节，确认改造面。
2. llm-adapter 加 `embeddings`（`/v1/embeddings`）。
3. core-runtime 加 `Embedder`/`SemanticIndex` trait + `BruteForceCosine`，接 `memory.rs:209-237`。
4. schema v7 加 `memory_vectors` + §3.1 列（一次加齐，分阶段启用）。
5. eval 骨架 + 既有 bead 向量回填。

**全程零新依赖、可编译、带测试；Gemma 4 部署见配套文档，押后。**

---

## 9. 实施进展

### P1-a：SemanticIndex 底座（2026-06-14，已完成）
- 新增 `modules/core-runtime/packages/core-runtime/src/semantic.rs`：`SemanticIndex` trait + `BruteForceCosineIndex`（暴力余弦：入库 L2 归一化、检索即点积；支持 upsert / remove / 维度不一致跳过 / 零向量安全 / top-k 截断）。
- 注册 `lib.rs`：`pub use semantic::{BruteForceCosineIndex, SemanticIndex}`。
- **零外部依赖**（纯 Rust、离线安全）；8 个单测 + `cargo test -p coolzhu-core-runtime --offline` 全量 **140 通过 / 0 失败**。
- 设计：一个索引固定一个 embedder（维度一致、同语义空间）；P5 可换 TurboVec 后端，接口不变。

### P1-b：语义召回打通（offline）+ 真实 embedder（2026-06-14，已完成）
- **hash_embed**（`semantic.rs`）：离线确定性词袋嵌入（ASCII 词 + CJK 单字/二元组，FNV-1a 哈希入桶）+ `cosine_similarity` + `DEFAULT_EMBED_DIM=256`；4 个单测。
- **memory.rs 回退接入**：`if selected.is_empty()` 回退由「词重叠」升级为「词重叠 ∪ hash 嵌入余弦」（`lexical>0.5 || semantic>0.30`）；新增 `semantic_fallback_recalls_partial_overlap` 测试。**离线即可用**。
- **真实 embedder**：llm-adapter 新增 `embed_texts(base_url, api_key, model, texts)`（async `/v1/embeddings`）+ 序列化单测；作为 hash_embed 的「真实语义」swap-in。
- **验证**：core-runtime `--offline` **145 通过 / 0 失败**；llm-adapter `--offline --test-threads=1` 全通过（并行下 1 个既有 mock-server 端口竞争 flaky，与本次无关）。

### P1.5：真实 embedder live 接入（2026-06-14，已完成，门控默认关）
- **向量序列化**：core-runtime `encode_vector`/`decode_vector`（小端 f32 ↔ bytes）+ 测试（为 sqlite 落盘备）。
- **配置开关**：`[model] enable_semantic_memory`（默认 false）+ `semantic_memory_model`（默认 bge-m3）；base_url/api_key 复用 custom provider / env（`COOLZHU_EMBED_BASE_URL`/`OPENAI_BASE_URL`、`CUSTOM_API_KEY`/`OPENAI_API_KEY`）。
- **async live-wiring（web-console）**：`embed_memory_texts`（真实 `/v1/embeddings`，失败回退 `hash_embed`）+ 进程内向量缓存 `SEMANTIC_CACHE` + `compute_semantic_recall`（非 L4 bead，缓存缺失批量嵌入、query 嵌入、`BruteForceCosineIndex` 检索 top-8 > 0.25）；`agent_chat_response` 计算命中并经 `SEMANTIC_IDS` task_local（与 `TURN_TRACE` 同址）注入；`select_context_memory_beads` 命中优先（strategy=semantic）。
- **默认关 = 零行为变化**：未开启时 `semantic_ids` 为空 → 维持 keyword + hash 回退。
- **验证**：`cargo test -p coolzhu-web-console --offline` 编译通过；**479 通过 / 8 失败（全既有：前端内容 / prompt 文案 / tool-def + 音频并行 flaky；无新增回归）**。⚠️ 真实路径运行时行为待**重启 app + 开 `enable_semantic_memory` + 配 embedder 端点**验证。

### P1.5b：sqlite 向量持久化（2026-06-14，已完成）
- schema **v7**：`apply_session_migration_v7` 新增 `memory_vectors(session_id, bead_id, model_id, dim, vec BLOB, created_at)`（FK→sessions 级联；`(session_id, model_id)` 建索引）。
- `load_memory_vectors` / `save_memory_vectors`（用 `runtime::encode_vector`/`decode_vector`）；`compute_semantic_recall` 改为 **sqlite-backed**：按 model 载入已有向量、仅缺失才嵌入并 `INSERT OR REPLACE` 落盘，**跨重启复用**；换 embedder（model 变）自然不命中旧行 → 自动按新 model 重建（替代了之前的进程内缓存）。
- **验证**：`cargo test -p coolzhu-web-console --offline --test-threads=1` 干净串行 **481 通过 / 8 失败**——即基线确定性集（dev_open prompt 文案 + llm_tool_defs + 6 个前端 `const include_str!` 内容漂移；与本次无关）。并行计数抖动属既有全局态/端口竞争 flaky；前端内容测试为编译期常量，与 Rust 改动无关。

### P1.5 余下（可选）
- **旧 model 行清理**：换 embedder 后旧 `memory_vectors` 行不自动删（不影响正确性，仅占空间）。
- **eval（H）**：扩成 query→期望 bead 的 recall@k 固定样本集。

### P2–P4-core：B/C/D/E/F/G 核心逻辑（2026-06-14，全部 TDD 完成）
所有能力的**纯逻辑核心**均经 TDD（红→绿）落地于 core-runtime `memory.rs`（新增全是 trait **默认方法** + 纯函数，现有 `MemoryBeadView` 实现 `MemoryBeadDto`/`TestBead` 零改动、行为不变）：
- **F 时效**：`valid_until()`（默认 None）+ `is_memory_bead_expired` + `filter_unexpired`（3 测试）。
- **B 衰减/强化**：`last_accessed_at()`/`access_count()`（默认）+ `effective_recall_score`（confidence × 指数衰减 + `ln(1+access)`；pinned 不衰减）（5 测试）。
- **C 冲突消解**：`entity_key()`/`status()`（默认）+ `is_memory_bead_active`/`filter_active`/`find_supersede_target`（5 测试）。
- **G 写入策略**：`is_low_value_memory` + `decide_memory_write` → `MemoryWriteDecision{Skip|New|Supersede(idx)}`（价值过滤 + 实体取代 + 精确签名去重）（5 测试）。
- **D 巩固**：`find_near_duplicates`（hash 嵌入余弦近邻；复用于 C 语义候选 / E 相似边）（3 测试）。
- **E 关联图**：`MemoryEdge` + `build_similarity_edges`（相似边，from<to 去重，仅 active）（3 测试）。
- **验证**：core-runtime `--offline` **171 通过 / 0 失败**；web-console `--no-run` 编译通过（trait 默认方法向后兼容）。

### web-console 集成进展
- **G 价值过滤已落地（2026-06-14）**：`persist_auto_memory_beads` 接入 `runtime::is_low_value_memory`（自动抽取跳过噪声；零字段、非破坏）。
- **H eval 已落地（2026-06-14）**：core-runtime `recall_at_k` + `rank_beads_by_query` + 固定样本 `eval_recall_at_k_on_fixed_sample`（TDD；recall@3 基线满分，lexical）。验收基建就位。
- **B 衰减重排 + 访问强化已落地（门控，2026-06-14~15）**：`[model] enable_memory_decay_ordering`（默认关）；开启后 `select_context_memory_beads` 按 `effective_recall_score`（confidence × 7 天半衰期衰减 + `ln(1+access)` 强化；pinned 不衰减）重排，并在召回命中时 bump 进程内访问追踪（`MEMORY_ACCESS_TRACKER` + `TrackedBead` 包装复用核心评分，无 DTO 字段 churn、无 store 锁死锁风险）。验证：web-console `--test-threads=1` **497 通过 / 0 失败**（门控默认关 → 现序不变）。
- **桌宠/web-console 退出联动已修复**：`[pet] pet_exit_closes_console`（默认 true）+ `with_graceful_shutdown` 优雅退出 + 活跃 pid 守卫；守卫测试同步更新。
- **B 访问跨重启持久化已落地（2026-06-15）**：schema v8 `memory_access` 表 + `warm_memory_access`（暖入）+ `record_memory_access`（写穿），跨重启复用访问统计。验证 497/0。
- **🎉 A–H 八项全部落地（2026-06-15）**：core-runtime 178/0、web-console 499/0，零回归。语义检索 A / 衰减强化 B / 冲突消解 C / 巩固晋升 D / 关联图 E / 时效 F / 写入策略 G / 召回评估 H 全闭环。
- **余下（依赖抽取端 / 后台）**：
  - **F 时效已落地（2026-06-15）**：`rule_based_valid_until`（按 kind 规则 TTL，chat/会话/原始类 7 天，其余永久）+ `MemoryBeadDto::valid_until()` + 召回 `filter_unexpired` 过滤过期瞬时记忆（无存储、纯规则、安全）。TDD core 175/0、web 497/0。
  - **C 冲突消解已落地（2026-06-15，安全版）**：schema v9 `memory_meta`（bead_id→entity_key/status）+ `AddMemoryBeadRequest.entity_key`；显式 entity_key 时 `record_entity_supersede`（取代同实体旧 active bead）+ 召回 `load_superseded_bead_ids` 剔除。**仅显式触发，自动抽取不设 entity_key → 零误删**。web 497/0。
  - **E 关联图已落地（2026-06-15，真 bge-m3）**：schema v10 `memory_edges`；`build_session_edges`（载入/补嵌 `memory_vectors` 真向量 → 两两 `runtime::cosine_similarity` ≥ 0.55 → 覆盖式写边）+ API `POST /api/sessions/{id}/memory/build-edges`；召回 `load_edge_neighbors` 一跳扩展（`MEMORY_EDGE_EXPANSION_LIMIT=4`，**仅在已建边时生效 → 天然 opt-in、未建边零变化**）。新增 sqlite 往返测试，web **498/0**。
  - **D 巩固晋升已落地（2026-06-15，安全版）**：core `cluster_by_similarity`（贪心聚簇，仅 size≥2，3 测试）+ web `consolidate_session_memory`（取 active/L1·L2/非 pinned 候选 → 补嵌真 bge-m3 → 聚簇 ≥ 0.62 → 每簇产出 1 条 **L3「经验」bead**，摘要带「巩固自 N 条」可回溯）+ 源 bead `mark_beads_superseded`（复用 C 的 `memory_meta`，**不删除、可回溯**）+ API `POST /api/sessions/{id}/memory/consolidate`。**幂等**（源标 superseded 后下次排除）、**零误删**（只标不删、pinned/L0 不动）。新增 sqlite 幂等测试，web **499/0**。

### ⚠️ 端到端验证发现并修复重大 bug：save() 级联清空记忆侧表（2026-06-15）
真实 provider 起 app 验证记忆链路时发现：**C 显式 entity_key 取代不生效**（新旧偏好都进召回）。逐层定位（serde✓、FK✓、调用点✓、运行新 exe✓），根因是：
- `save_session_state_to_sqlite` 全量重写执行 `DELETE FROM sessions`，而 `memory_vectors/access/meta/edges` **全部 `FK ON DELETE CASCADE` 到 sessions** → **每次 save 级联清空所有记忆侧表**。
- C 的 `record_entity_supersede` 在 `save()` **之前**写 → 被同一次 save 清掉（memory_meta=0）；D 的 `mark_beads_superseded` 在 save **之后**写 → 暂存活但下次 save 又被清。**A 向量 / B 访问 / E 边同样被每次 save 抹掉 → 跨回合/重启持久化实际全部失效**。

**根因修复**（`save_session_state_to_sqlite`）：重写事务前 `PRAGMA foreign_keys = OFF`（sessions 以相同 id 重插后引用仍有效，侧表不被级联删），commit 前对四张侧表做 `WHERE session_id NOT IN (SELECT id FROM sessions)` 孤儿清理（保留原 CASCADE 在「真正删会话」时的语义）。
- **实时验证**：C 取代生效（memory_meta 留 superseded、召回只返新值）；A 向量(3)+E 边(2) 跨后续 save 不变；C/D superseded 跨 save 存活。
- **回归测试**：`save_preserves_memory_side_tables_across_resave`（存活会话侧表保留 + 移除会话孤儿清理）。web **500/0**。

### 链路 smoke（2026-06-15，真实 provider 起 app）
- ✅ **会话链路**：真实回复 + 推理 trace + 上下文用量（92923/200000 tokens），0 错误/警告。
- ✅ **工具调用**：DeepSeek 真实执行 `glob_search`（tool-audit 新增 `status:ok`、返回真实 .toml 列表），非仅声称。
- ✅ **记忆链路**（真 bge-m3）：`build-edges`=3 边、`consolidate`=1 簇 → 1 条 L3「巩固自 3 条」；召回只返 L3、3 个源 superseded 不入；C `entity_key` 取代生效（只返新值）。
- ✅ **goal 功能**：roles=test6（glm-5.1）。`create → POST /plan → run-next/run-all`：单阶段 completed；**implementer→verifier 依赖链**两阶段均 completed、goal completed（真实 LLM 执行）。**注**：phases 由 POST `/api/goals/{id}/plan` 生成（`commander/review` 只审查不生成）；commander/planner 须指派到**可达** provider 的会话。

### 开关验证结论（2026-06-15，真实 provider 起 app）
- ✅ **衰减（B）开关**：开启后 `memory.recall` 走 `effective_recall_score` 重排 + `record_memory_access` 写穿；不依赖嵌入，正常。
- ✅ **语义（A）开关**：开启后日志 `memory.recall.ok` → `strategy="semantic"`（对比开关前 `keyword`），路径激活、嵌入 query+beads、检索贯通；**端到端 trace 实测一回合各事件共享同一 `trace`**。
- ✅ **真语义已验证（2026-06-15，本地 llama.cpp bge-m3）**：嵌入端点配置化（`[model] semantic_embedder_base_url`，默认 `http://127.0.0.1:8081/v1`，优先级 config→env→默认）。起 `llama-server -hf gpustack/bge-m3-GGUF:Q8_0 --embeddings --port 8081` 后，同义词 query「界面明暗配色倾向」**正确召回**「深色主题界面风格」bead、模型据此作答；err.log 无新回退、`strategy="semantic"`、真 bge-m3 1024 维。`enable_semantic_memory=true`（需 llama-server 在跑；停服会优雅回退 hash）。
  - 旧障碍（dashscope 嵌入 `Model.AccessDenied`、智谱余额不足）已绕过——改用**本地 llama.cpp 嵌入，免账号限制/免费/离线**。
- ✅ 基础召回（keyword+hash，P1，默认开）：query「界面 主题」正确召回深色主题 bead。

### 策略：核心逻辑先行，web-console 集成后置合并
`MemoryBeadDto` 有 15+ 处构造字面量；F/B/C 各自的新 bead 字段（`valid_until` / `last_accessed_at` / `access_count` / `status` / `entity_key` …）逐个加会反复 churn。故：**先把 B–G 的核心纯逻辑逐个 TDD 做实**（已 F、B），**再一次性扩 schema + DTO 字段 + 写入/召回接线**（一轮字面量改动 + 一次验证）。F/B 的 web-console 落地（DTO 字段、召回前 `filter_unexpired`、召回时 bump `access_count`、按 `effective_recall_score` 排序、写入端设 `valid_until`）并入该合并步。

> **P1 状态（完成）**：语义召回**全链路打通**——offline（hash 词袋，`memory.rs` 回退，默认生效）+ 真实语义（门控 `/v1/embeddings`，默认关）。真实同义词级语义质量待开启开关 + 配置本地/远端 embedder 后到位。
