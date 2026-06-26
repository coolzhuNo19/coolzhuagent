# 2026-06-27 Hunyuan3D 剑客攻击动作 blockout 记录

## 背景

用户要求阅读 `C:\Users\zhupu\Desktop\coolzhugame` 下的角色与动作设定文档，分析当前实现一个模型动作 demo 需要准备的素材和实施方案，并基于 `00-角色设定基准\generated\hunyuan3d-swordsman-model` 中已生成的人物基础模型，实现一个角色一个基础攻击动作 demo。

同时，后续 2D 图片转 3D 建模需要按用户截图中的 8 角度素材槽位使用 image-gen 生成图片素材。

## 读取与分析

重点读取了以下内容：

- `C:\Users\zhupu\Desktop\coolzhugame\README.md`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\01-玩家角色基准.md`
- `C:\Users\zhupu\Desktop\coolzhugame\01-玩家-独孤九剑\02-总诀式-轻击连段.md`
- `C:\Users\zhupu\Desktop\coolzhugame\01-玩家-独孤九剑\04-破气式-蓄力重劈.md`
- `C:\Users\zhupu\Desktop\coolzhugame\08-资产清单\README.md`

文档中的推荐流程是：

1. AI 关键帧分镜。
2. Cascadeur / UE5 Control Rig 做动作。
3. 导出 FBX。
4. UE5 中制作 AnimMontage、Notifies 和攻击判定。

本轮选择先实现单段横斩基础攻击 blockout，作为后续真实骨骼动画的节奏和镜头预演。

## 模型检查结果

检查对象：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\c9ad1d96e84a2566499e5a3b1bf14538.glb`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\d0d4646c83e98214b350c027683796ea.fbx`

Blender 检查结果：

- GLB：1 个 mesh，0 个 armature，0 个 action，0 个 vertex group。
- FBX：1 个 mesh，0 个 armature，0 个 action，0 个 vertex group。

结论：当前模型是静态单网格，暂时不能直接制作真正的骨骼攻击动画。本轮 demo 采用“角色整体动作 + 剑光轨迹”的 blockout 方案，明确标记为预演资产，不作为最终游戏动作资产。

## 已生成文件

模型目录：

- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\model_inspection_20260627.json`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\model_inspection_preview_20260627.png`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\model_inspection_scene_20260627.blend`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_20260627.blend`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_20260627.glb`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_preview_20260627.mp4`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_poster_20260627.png`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_contact_sheet_20260627.png`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\swordsman_attack_blockout_manifest_20260627.json`
- `C:\Users\zhupu\Desktop\coolzhugame\00-角色设定基准\generated\hunyuan3d-swordsman-model\ACTION_DEMO_PLAN_20260627.md`

临时脚本：

- `C:\Users\zhupu\Desktop\codex\tmp\inspect_hunyuan_swordsman_model.py`
- `C:\Users\zhupu\Desktop\codex\tmp\extract_video_keyframes.py`
- `C:\Users\zhupu\Desktop\codex\tmp\create_swordsman_attack_blockout.py`
- `C:\Users\zhupu\Desktop\codex\tmp\encode_attack_blockout_preview.py`
- `C:\Users\zhupu\Desktop\codex\tmp\extract_attack_preview_keyframes.py`

日志：

- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-coolzhugame-docs-and-model-scan.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-coolzhugame-relevant-docs-read.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-inspect-hunyuan-swordsman-model-blender.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-extract-video-keyframes.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-create-swordsman-attack-blockout-camera-fix.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-encode-attack-blockout-preview-camera-fix.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\2026-06-27-extract-attack-preview-keyframes-camera-fix.log`

## 动作节奏

| 帧 | 阶段 | 说明 |
| --- | --- | --- |
| 1 | ready | 持剑待机 |
| 20 | windup | 蓄势前摇 |
| 32 | attack active / impact | 横斩有效帧，显示剑光 |
| 42 | recover | 收招 |
| 60 | return idle | 回到待机 |

## 后续素材要求

后续 2D 图片转 3D 建模建议使用 image-gen 生成 8 角度素材，按用户截图槽位准备：

1. 顶图
2. 左 45° 图
3. 正图
4. 右 45° 图
5. 左图
6. 右图
7. 背图
8. 底图

对人形角色而言，正面、背面、左右侧、左右 45° 是最关键的模型一致性约束；顶图和底图用于补齐网站槽位与辅助体积理解。

## 后续实施建议

1. 重新用 image-gen 生成严格 8 角度正交素材，避免从单张设定图裁切导致角度不完整。
2. 重新用 Hunyuan3D / Tripo 生成基础模型并导出 GLB/FBX。
3. 检查是否带 armature；如果仍没有骨骼，进入 AccuRIG / Mixamo / Blender Rigify / UE5 Control Rig 绑定流程。
4. 将剑、剑鞘、披风、肩甲尽量拆分或设置独立挂点，降低自动蒙皮穿模风险。
5. 在 Blender / Cascadeur / UE5 Control Rig 中制作 `Attack_Light_01`。
6. 导入 UE5，制作 AnimMontage、AttackStart/HitWindow/Recover 等 Notifies。
7. 建立最小 demo 场景，验证攻击输入、动画播放、命中判定和镜头。

## 验证

- 已用 Blender 5.1 成功打开模型并导出检查 JSON。
- 已渲染 60 帧动作预览序列。
- 已编码 960x540 MP4 预览。
- 已生成关键帧 contact sheet 并检查完整人物未被镜头裁切。

## 风险与限制

- 当前 demo 不是最终骨骼动画，只能用于动作节奏和视觉方向确认。
- 现有模型没有骨架、权重和动作，后续真实动作必须先绑定。
- 8 角度素材如果不是同一人物一致生成，后续 3D 结果容易出现脸部、肩甲、披风、剑漂移。
