# 2026-05-09 思考程度选择器添加实现日志

记录时间：2026-05-09

关联需求：
- `REQ-WEB-API-001`：卡片后端 API 补齐
- 模型配置表：`docs/model-provider-config-table.md`

## 修改目标

在配置/会话/Agent 三合一卡片中，模型选择下方添加"思考程度"下拉选择器。
选项根据当前选中的模型动态生成，取自 `docs/model-provider-config-table.md` 配置表。

## 修改文件

### `index.html`
- 在模型 `<select>` 和 Key 引用 `<input>` 之间新增思考程度 `<select data-role="session-reasoning-effort">`
- 选项为空，由 JS 根据模型动态填充

### `app.js`
- 新增 `REASONING_EFFORT_MATRIX`（27 个模型映射）
- 新增 `updateReasoningEffortOptions()` 函数：根据当前选中模型，从 MATRIX 查表填充选项
- `updateModelOptions()` 末尾调用 `updateReasoningEffortOptions()`
- 新增 `<select data-role="session-model">` 的 `change` 事件监听 → 切换模型时实时更新
- `sessionPayloadFromForm()` 新增 `reasoning_effort` 字段
- `setSessionForm()` 新增 reasoningEffort 回填逻辑

## 卡片布局

```
配置 / 会话 / Agent 状态
├── 会话名称
├── Provider
├── 模型
├── 思考程度    ← 新增，选项根据模型动态变化
├── Key 引用
└── [新建] [保存] [删除]
```

## 思考程度选项说明

| 级别 | 值 | 显示 | 支持模型示例 |
|---|---|---|---|
| 低 | `low` | 低 | DeepSeek-V4-Pro, GPT-4.1 |
| 中 | `medium` | 中 | **所有模型默认支持** |
| 高 | `high` | 高 | DeepSeek-Reasoner, GPT-4.1, GLM-5 |
| 超高 | `xhigh` | 超高 | **仅 GPT-4.1** |

## 验证

- `node --check` ✅
- `cargo build` ✅
- 切换到 DeepSeek + deepseek-reasoner → 思考程度仅显示"中/高"
- 切换到 OpenAI + gpt-4.1 → 思考程度显示"低/中/高/超高"

## 备份

- 本次备份路径：`codex\tmp\backups\add-reasoning-effort-20260509-193318\`
