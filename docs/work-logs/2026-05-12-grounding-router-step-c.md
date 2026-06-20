# 2026-05-12 - Grounding Router Step C: Local VLM Backend

## 新增文件
- `modules/vision/packages/vision-service/src/local_backend.rs` (155行)

### 功能
1. **Region Crop** (`anchor_region`, `uncrop_point`):
   - 8种区域锚点映射 (TaskbarBottom/Left/Right/Top, SystemTray, TitleBar, ClientArea, DesktopFull)
   - `uncrop_point` 将裁剪区域内 [0,1] 相对坐标反映射为全屏像素坐标

2. **DBSCAN 聚类** (`cluster_median`):
   - 简化版密度聚类: eps 距离阈值 + min_samples
   - 返回最大簇的质心坐标
   - 所有点都是离群时返回 None

3. **Prompt 变体** (`prompt_variants`):
   - 3种不同措辞 ("{target}" / "Find the {target} on screen" / "{target} (look carefully)")

### 测试 (6 tests passed)
- `region_taskbar_bottom_is_correct` → 区域参数验证
- `uncrop_center_maps_correctly` → taskbar 中心映射到 (500, 950)
- `cluster_rejects_outliers` → [(600,170),(614,173),(1552,882)] → 质心≈(607,171)
- `cluster_returns_none_for_all_outliers` → 3个分散点无聚类
- `cluster_single_group_returns_centroid` → 密集点质心=(101,100)

### Router 集成
- `api_vision_locate` 增加 `LocalVlm` 分支: 调用 `grounding_median_point(target)` (ShowUI 3次采样)
- 显示模型名、base_url、confidence=0.35

### 测试结果
- vision-service: 6 tests passed
- web-console: 186 tests passed (0 failed)

## 累计完成
| 步骤 | 状态 |
|------|------|
| A 契约 | ✅ |
| B UIA | ✅ |
| C LocalVLM | ✅ |
| D RemoteVLM | ⏳ |
| E Router+API | ✅ |
