# coolzhu model 微调实施方案（2026-06-16）

基座：本地已部署的 **Gemma 4 12B-it**（多模态，对外品牌 "coolzhu-model"，llama-server@8082，cuda-12.4，-ngl 33）。
目标：强化 **① 工具调用 ② 视觉理解（含融入 UI-DETR/ShowUI）③ 逻辑推理**；产 LoRA → 合并 → 转 GGUF → 仍走 llama.cpp 本地部署，名字不变。

---

## 1. 租赁显卡配置要求

本机 RTX 3070 Ti **8GB 仅够推理，训不动 12B**（QLoRA 12B 需 ~18–24GB；全量微调需 8×A100）。**只在本机做数据准备 + 最终部署**，训练上云。

| 档位 | 卡 | 适用 | 备注 |
|---|---|---|---|
| 最低 | 1× RTX 4090 24G | QLoRA 纯文本(①③) | batch 小、序列≤4k；视觉微调勉强 |
| **推荐** | 1× A100 40G | QLoRA 文本+视觉(①②③) | 一卡跑通三轨道 |
| 充裕 | 1× A100/H100 80G | QLoRA 大 batch / 解冻视觉塔 | 最快、可上更长上下文 |

- **显存估算（QLoRA 4-bit, 12B）**：权重 ~7GB + 优化器/LoRA/激活 ~8–14GB（随 batch×seq）→ 24G 够纯文本，视觉(+CLIP+图像激活)建议 40G。
- **系统盘/数据盘**：≥100GB（基座 HF 权重 ~24GB BF16 + 数据集 + checkpoint + 转换中间件）。
- **环境**：CUDA 12.1+/PyTorch 2.4+、Python 3.10/3.11（**不要 3.14**，生态轮子不全）、`unsloth`、`trl`、`transformers`、`peft`、`bitsandbytes`、`datasets`。
- **国内服务商**（避免 HF 出境慢）：AutoDL / 恒源云 / 阿里云 PAI-DSW / 魔搭 NoteBook。镜像选「PyTorch 2.4 + CUDA 12.x」。基座从 **ModelScope** 拉（`google/gemma-4-12B-it` 或 unsloth 镜像）。
- **成本参考**：4090 约 ¥2–3/h、A100-40G 约 ¥6–10/h；单轨道 QLoRA 1–3 epoch 数小时级 → 单次实验几十元量级。

---

## 2. 数据（本机已有资产 → 直接构建）

| 来源 | 路径 | 轨道 |
|---|---|---|
| 工具审计 | `coolzhuagent\.coolzhu\tool-audit.jsonl`（650+） | ① 工具调用真实序列 |
| 会话/记忆 | `.coolzhu\web-sessions.sqlite3`（session_messages / memory_beads） | ①③ 任务链路、CoT |
| Goal 轨迹 | sqlite `goal_*` 表（commander/planner/implementer/verifier） | ①③ 多阶段推理 + 验证闭环 |
| 视觉捕获 | `.coolzhu\attachments\*.png`、`.coolzhu\vision\...\closed-loop\*-before/after.png` | ② 截图 + 操作前后 |
| UI-DETR | `models/uidetr/UI-DETR-1`（model.pth）推理出的元素框 | ② 元素检测监督 |
| ShowUI | `showui_grounding_on_demand` 的「指令→坐标」记录 | ② grounding 监督 |

**铁律（借鉴 coder-fable5 蒸馏）**：只留**执行验证通过**的样本（工具真跑成功、verifier 通过、点击命中坐标）；失败样本仅作「错误→纠正」对。脱敏（API key/绝对路径）必做。

### 2.1 数据抽取脚本（本机跑，产 SFT jsonl）
`tmp/ft/extract_tool_traces.py`：
```python
import sqlite3, json, re, pathlib
DB = r"C:\Users\zhupu\coolzhuagent\.coolzhu\web-sessions.sqlite3"
OUT = pathlib.Path(r"C:\Users\zhupu\Desktop\codex\tmp\ft\tool_sft.jsonl"); OUT.parent.mkdir(parents=True, exist_ok=True)
def redact(s):
    s = re.sub(r'(sk-|key-)[A-Za-z0-9]+', r'\1***', s or '')
    return s.replace(str(pathlib.Path.home()), '~')
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
rows = con.execute("SELECT session_id,role,content,kind,created_at FROM session_messages ORDER BY session_id,created_at")
# 按 session 聚合成多轮，挑含 tool 调用且最终成功的链
buf={}
for r in rows: buf.setdefault(r["session_id"], []).append(dict(r))
n=0
with OUT.open("w",encoding="utf-8") as f:
    for sid, msgs in buf.items():
        if not any(m["kind"]=="tool" for m in msgs): continue
        conv=[{"role":("assistant" if m["role"]=="assistant" else "user" if m["role"]=="user" else "tool"),
               "content":redact(m["content"])[:4000]} for m in msgs if (m["content"] or "").strip()]
        if len(conv)>=2:
            f.write(json.dumps({"messages":conv},ensure_ascii=False)+"\n"); n+=1
print("wrote",n,"tool conversations ->",OUT)
```
> 同法写 `extract_goal_cot.py`（读 goal_* 表，留 verifier=pass 的阶段轨迹）与 `extract_vision_pairs.py`（截图 + UI-DETR 框/ShowUI 坐标 → VQA 对）。tool-audit.jsonl 用于补「工具名+参数+status:ok」结构样本。

---

## 3. 三个能力轨道

### ① 工具调用
- 样本：`system(工具schema + AGENT.md 准则) → user → assistant(tool_call) → tool(result) → assistant(总结)` 多轮。
- 重点：强制 **AGENT.md 格式**（顶层 JSON、禁 `raw`、缺字段重试）+ Working Approach（并行/最小改动/验证闭环）。
- 负例：历史「声称工具不可用 / raw 包装 / 缺字段」→「错误→正确」对。量级 1–3k 优质多轮。

### ② 视觉理解（融入 UI-DETR / ShowUI，见 §5）
- 基座带 mmproj（CLIP 视觉塔）。**先冻结视觉塔**，训投影层 + LLM 的图文对（稳、省）。
- 任务：截图 →{元素清单+边界框 / "点击X在哪→坐标" / before-after 动作结果判断}。

### ③ 逻辑推理
- 样本：goal 成功阶段 CoT + 可验证编码/数学题（执行验证）；保留 Gemma **thinking 通道**（`enable_thinking=true`）。
- 重点：planner 分解、verifier 自检、受阻回退（对应 `CUR-GOAL-LOOP-001`）。蒸馏式：强教师产 CoT → 验证后入库。

---

## 4. 训练 → 转换 → 部署（云端步骤 + 脚本）

```bash
# 0. 云机环境
pip install "unsloth[cu121] @ git+https://github.com/unslothai/unsloth.git" trl peft bitsandbytes datasets
# 1. 拉基座（ModelScope，国内快）
pip install modelscope && modelscope download --model google/gemma-4-12B-it --local_dir ./gemma4-12b
```
`train_qlora.py`（Unsloth QLoRA）：
```python
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
model, tok = FastLanguageModel.from_pretrained("./gemma4-12b", max_seq_length=4096, load_in_4bit=True)
model = FastLanguageModel.get_peft_model(model, r=32, lora_alpha=32,
        target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"])
ds = load_dataset("json", data_files={"train":"tool_sft.jsonl"})["train"]
def fmt(ex): return {"text": tok.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False)}
ds = ds.map(fmt)
SFTTrainer(model=model, tokenizer=tok, train_dataset=ds,
    args=SFTConfig(per_device_train_batch_size=2, gradient_accumulation_steps=8,
        warmup_ratio=0.03, num_train_epochs=2, learning_rate=2e-4, bf16=True,
        logging_steps=10, output_dir="out", save_steps=200)).train()
model.save_pretrained_merged("merged-coolzhu", tok, save_method="merged_16bit")
```
转 GGUF（云端或本机 llama.cpp）：
```bash
python llama.cpp/convert_hf_to_gguf.py merged-coolzhu --outfile coolzhu-model-f16.gguf
llama.cpp/llama-quantize coolzhu-model-f16.gguf coolzhu-model-Q4_K_M.gguf Q4_K_M
```
部署：把 `coolzhu-model-Q4_K_M.gguf` 放回 `C:\Users\zhupu\llama.cpp\`，按 [部署文档](gemma4-12b-local-deploy-2026-06-15.md) 启动（-ngl 33），会话仍显示 "coolzhu-model"。

---

## 5. 把 UI-DETR / ShowUI 融入模型（可行性：高）

**现状**：视觉走 3 个独立模型——Gemma(理解) + **UI-DETR-1**(元素检测/框) + **ShowUI-2B**(指令→坐标 grounding)，靠 `resource_switch=single_active_model` 轮换（8GB 装不下并存）。

**目标**：把检测 + grounding 蒸馏进 Gemma 视觉，**一个模型干三件事**。

- **为何可行**：ShowUI 本身就是 VLM(Qwen2-VL)为 UI grounding 做的微调；Gemma 4 12B 多模态基座同样能学。任务形态 = 图+指令→结构化输出（框/坐标），标准 VLM SFT。
- **数据**（自动生成，零人工）：批量截图 → 用现有 UI-DETR 推理出元素框、用 ShowUI 推理出「指令→坐标」→ 作为**教师标签**蒸馏；闭环 before/after 截图作「动作是否生效」判断。格式：
  - 检测：`<image>列出可交互元素及边界框` → `[{label, bbox:[x,y,w,h]}...]`
  - grounding：`<image>点击"提交按钮"的坐标` → `{x, y}`（归一化 0–1，稳）
- **收益**：① 释放显存（不再同时挂 UI-DETR+ShowUI，8GB 上 Gemma 单模型即可做 computer-use）；② 看图+定位+推理同一上下文，少跨进程往返；③ 维护从 3 套降到 1 套。
- **风险/对策**：12B grounding 比 2B ShowUI 慢 → 坐标任务可走小输出+低温(temp 0)；精度依赖数据量（先 ≥5k grounding 对）；视觉塔默认冻结，精度不够再解冻（需 40–80G 卡 + 更多数据）；**保留 UI-DETR 作为可选快速检测兜底**，灰度对比后再决定是否下线。
- **验收**：grounding 点击命中率 ≥ 现 ShowUI 的 90%、检测 mAP 不低于 UI-DETR 基线的 80% 即可合并主链。

---

## 6. 里程碑与评测

| 阶段 | 产出 | 评测（用 coolzhu 自带能力） |
|---|---|---|
| M1 数据 | 抽取+脱敏脚本，三轨道各 ≥1k 验证样本 | 样本质检通过率 |
| M2 工具版 | ① QLoRA → GGUF → A/B | 工具格式正确率 + goal 通过率（真跑） |
| M3 视觉版 | ② 融 UI-DETR/ShowUI | grounding 命中率 / 检测 mAP vs 基线 |
| M4 三合一 | ①②③ 混合 LoRA | H 模块 recall@k + 编码题通过 + 全链路回归 |

**风险总表**：8GB 不能本地训（依赖云卡）；视觉塔微调数据需求大（默认冻结）；过拟合 coolzhu 风格（混通用数据 + 留 thinking）；数据脱敏务必到位。
