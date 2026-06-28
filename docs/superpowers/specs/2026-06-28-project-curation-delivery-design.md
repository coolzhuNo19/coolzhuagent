# 项目整理、Obsidian 迁移与源码交付设计

## 目标

在不删除原始 `docs/`、不覆盖当前工作树修改的前提下，重新梳理 COOLZHU AGENT 的项目结构，把仍有效的知识文档整理为 Obsidian 知识库，并从当前工作树生成不含备份、缓存、运行态数据和模型会话配置的源码交付包。

最终交付根目录固定为：

```text
C:\Users\zhupu\Desktop\coolzhu-agent-project\
  obsidian-vault\
  source\
  installer\
  reports\
```

## 当前约束

- 根仓库与 `modules/*` 下多个模块是相互独立的 Git 仓库。
- 多个模块存在尚未提交但可能有效的源码和资源，不能只依赖根仓库 `git ls-files`。
- `docs/` 同时包含规范、需求、设计、实施计划、测试记录和大量历史 work-log，不能原样复制后冒充已整理知识库。
- 原始 `docs/` 被代码协作约定和文档内部链接引用，迁移不得删除或改名原文件。

## Obsidian 知识库结构

```text
obsidian-vault\
  00-首页\
    项目总览.md
    阅读路径.md
    当前状态.md
  10-架构\
  20-需求与规范\
  30-子系统\
    Realtime语音与视觉\
    Computer-Use\
    GUI-Web与桌面壳\
    LLM与会话\
    Tooling与插件\
    打包与部署\
  40-测试与质量\
  50-运维与故障处理\
  60-设计决策\
  90-历史证据\
  _meta\
    source-map.json
    excluded-docs.md
```

每份迁移文档增加 YAML frontmatter，至少记录原始路径、原始修改日期、主题、状态和迁移日期。正文保持技术内容不失真；只修复知识库内链接和明显重复标题，不改写历史结论。

## 文档筛选规则

纳入：

- 当前开发规范、测试规范、需求管理表、接口契约和仓库结构说明。
- 当前仍使用的架构设计、已实现功能的验证记录、仍有效的故障处理结论。
- Full Stream、Computer Use、打包部署及主要子系统的最新设计与实施证据。
- 能解释当前代码行为、风险或回滚方式的历史 work-log。

排除：

- 被较新方案完全取代、且不再提供独立证据的重复计划。
- 仅记录一次性素材生成、临时尝试或已废弃分支状态的日志。
- 内容为空、只有占位语句、包含明显损坏文本或与当前项目无关的文档。

排除不等于删除。所有未迁移文件都保留在原 `docs/`，并在 `_meta/excluded-docs.md` 记录路径和排除原因。

## 源码交付包

源码包基于当前工作树而不是某个提交生成。收集规则采用显式白名单：

- 根级 Rust/Node/PowerShell 构建入口、配置模板和开发协作说明。
- `src/`、`packages/`、`modules/*/packages/` 中的源码、测试、Cargo 清单及必要前端资源。
- `.coolzhu/plugins/` 中的插件源码和清单，但不包含运行态数据。
- `skills/`、`scripts/`、`installer/` 中的有效源码和构建脚本。
- 运行所需的小型静态资源；不包含模型权重或可重新生成的中间图。

任何路径命中以下规则都排除：

```text
.git, target, node_modules, tmp, dist, package, output, test-results,
backup, backups, backup-*, *-backup-*, *.bak, *.old, *.orig, *.rej,
models, logs, sessions, web-sessions, *.sqlite, *.sqlite3, *.db,
.env, coolzhu.toml, credentials, secrets, token caches
```

对名称可疑但可能有效的资源，必须通过代码引用或现有清单证明其用途；无法证明时不进入源码包，并记录到排除报告。

## 产物和可追溯性

`source/` 至少包含：

- `coolzhu-agent-source-20260628.zip`
- `SOURCE-MANIFEST.json`：相对路径、字节数、SHA-256、来源仓库和工作树状态。
- `SOURCE-EXCLUSIONS.md`：排除规则、可疑文件和处理理由。
- `SHA256SUMS.txt`

`reports/` 至少包含项目结构说明、文档迁移报告、源码包审计报告以及其他子项目的验收报告。

## 错误处理与回滚

- 不删除原 `docs/`，不清理当前工作树，不执行 reset/checkout。
- 构建临时 staging 只位于 `tmp/` 或目标交付目录内部。
- 若文件哈希、排除扫描或 ZIP 回读校验失败，删除失败的临时产物后重建；不覆盖已经通过校验的交付版本。
- 所有同步操作先生成到带时间戳的 staging，验证后再原子替换交付目录中的同名产物。

## 验收标准

- Obsidian 首页可以导航到所有主题分区，内部链接不存在明显断链。
- `source-map.json` 可追溯每一份迁移文档的原始路径。
- 源码 ZIP 能完整解压，清单中的每个文件哈希匹配。
- 源码 ZIP 不包含备份目录、构建缓存、运行日志、数据库、模型权重或当前会话配置。
- 项目结构报告明确说明根仓库与模块仓库边界及当前未提交修改的处理方式。
