# 2026-06-26 Hunyuan3D / Tripo 武侠人物多角度参考图准备记录

## 背景

用户计划在网站内使用 Hunyuan3D 和 Tripo 生成 3D 模型，需要提前准备武侠人物 3D demo 所需的各角度图片。

本轮不重新生成新角色设定，优先从已确认的魂系武侠人物定装图中裁切，避免 imagegen 重新发挥造成角色漂移。

源图：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\wuxia-swordsman-soulslike-3d-model-sheet-20260626.png`

## 输出目录

素材包目录：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-tripo-reference-20260626`

压缩包：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-tripo-reference-20260626.zip`

辅助说明：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-tripo-reference-20260626\README-上传顺序.md`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-tripo-reference-20260626\manifest.json`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-tripo-reference-20260626\manifest-clean.json`

## 文件分组

### raw-crops

保留原始裁剪比例，用于检查和必要时手动二次处理。

### upload-square-1024

统一 1024x1024 方图，保留较完整人物与装备，适合网站上传。

### upload-clean-1024

针对主视角重新收窄裁切，避开原始拼图中的相邻分镜边缘杂片，推荐优先使用。

## 推荐上传顺序

如果网站只接受单图：

1. `upload-clean-1024\02_front_three_quarter_full_body_clean_square1024.png`

如果网站支持多图/参考图：

1. `upload-clean-1024\01_front_full_body_clean_square1024.png`
2. `upload-clean-1024\02_front_three_quarter_full_body_clean_square1024.png`
3. `upload-clean-1024\03_back_full_body_clean_square1024.png`
4. `upload-clean-1024\04_head_shoulder_reference_clean_square1024.png`

细节参考：

- `upload-square-1024\05_sword_reference_square1024.png`
- `upload-square-1024\06_scabbard_reference_square1024.png`
- `upload-square-1024\07_cloak_dragon_pattern_reference_square1024.png`
- `upload-square-1024\08_dragon_shoulder_armor_reference_square1024.png`
- `upload-square-1024\09_waist_belt_reference_square1024.png`

## 执行记录

临时脚本：

- `C:\Users\zhupu\Desktop\codex\tmp\prepare_3d_reference_images.py`

日志：

- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-prepare-hunyuan3d-tripo-reference-images.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-prepare-hunyuan3d-tripo-reference-images-clean.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-26-zip-hunyuan3d-tripo-reference-images.log`

验证：

- 生成 PNG 数量：24。
- 压缩包大小：约 17.5 MB。
- 已人工抽查主输入图与背面图，确认 clean 版本避开相邻分镜杂片。

## 注意事项

- 当前素材仍来自 2D 定装图裁切，不是最终三维正交 turntable。
- clean 版本为了去除拼图边缘杂片，个别剑尖/披风边缘会比原图略收窄。
- 如果 Hunyuan3D/Tripo 结果出现脸部或龙肩甲漂移，应使用头像/肩甲细节参考图进行二次约束。

