# 视觉Agent会话选择与模型类型标记 设计文档

日期：2026-05-09

## 概述

将总览卡片的"视觉Agent"从硬编码改为从已保存会话中选择，同时在会话配置中增加模型类型标记，打通视觉API调用链路。

## 设计决策

| 决策点 | 选择 |
|---|---|
| 视觉Agent选择方式 | 总览卡片加下拉框，列出标记为视觉类型/多模态的已保存会话 |
| 模型能力判定 | 扩展 model-provider-config-table.md，每个模型增加 model_type 列 |
| 模型类型范围 | text / vision / audio / video / embedding / multimodal |
| 会话与类型关系 | 一个会话一个主模型类型 |
| 视觉API调用配置 | 使用总览卡片选中的视觉会话的 provider/model/base_url/api_key |

## 架构

```
配置表 → 前端 MODEL_TYPE_MAP → 自动填充会话"模型类型"
                                 ↓
                    总览卡片视觉Agent下拉 ← 过滤 model_type ∈ {vision, multimodal}
                                 ↓
                    视觉API调用使用选中会话的完整配置
```

## 修改清单

### 1. 配置表 `docs/model-provider-config-table.md`
- 每个模型新增 `model_type` 列

### 2. 前端 `app.js`
- 新增 `MODEL_TYPE_MAP`: 模型 → 类型映射
- `updateModelOptions()`: 切换模型时自动显示对应类型
- `refreshState()`: 填充总览视觉Agent下拉
- `overviewVisionSelect()`: 总览下拉 change 事件 → 更新当前视觉会话ID

### 3. 前端 `index.html`
- 三合一卡片：新增"模型类型"只读显示字段
- 总览卡片：视觉Agent text 改为 `<select>` 下拉

### 4. 后端 `main.rs`
- `PersistedSession` 新增 `model_type: String`
- SQLite schema 新增 `model_type` 列 + 迁移
- `UpsertSessionRequest` 新增 `model_type`
- `build_overview_metrics()`: 改为从 session_store 查询 model_type=vision/multimodal 的会话
- `GET /api/vision/active-config`: 新增接口，返回当前选中的视觉会话配置
- 视觉API调用从该接口读取配置

### 5. 不修改
- Provider 下拉列表
- 思考程度逻辑
- base_url/endpoint 显示（后续单独处理）
- external-vision 能力接口（仍为预留）
