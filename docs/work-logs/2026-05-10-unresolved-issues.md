# 2026-05-10 - 未解决问题现状记录

## 1. ShowUI 模型 (showui-2b) 定位不准
- **现象**: 3次采样结果 (597,153), (614,173), (614,173) → 中位数 (614,173)
- **期望**: 底部任务栏区域 ≈ (853, 921)
- **根因**: showui-2b 是轻量级 VLM (2B 参数)，对"开始按钮"的视觉理解有限
- **已尝试**: 
  - 英文 prompt "start button" → 结果 (1177,393) 中部
  - 中文 prompt → 编码损坏
  - 区域提示 "bottom left corner" → (1297,882) 右下方
  - 3次采样取中位数 → 仍在上部 ~(600,170)
- **待解决**: 换更大 VLM (Qwen2.5-VL-7B 等) 或采用模板匹配

## 2. 中文 HTTP 传输编码损坏
- **现象**: PowerShell `Invoke-RestMethod -Body '{...中文...}'` → Rust 端变为 `????`
- **根因**: PowerShell 5.1 默认编码为系统 ANSI，非 UTF-8
- **影响**: `target.contains("开始")` 永远 false → 锚点回退检测失效
- **已确认**: 前端 JS 发送正常 (浏览器 UTF-8)，问题仅在脚本测试
- **待解决**: 不影响实际使用（前端发消息是 UTF-8）

## 3. 智谱 API Key 解析
- **现象**: `provider_client_for_agent(verify_agent)` → MissingCredentials
- **根因**: verify_agent.id="verify-temp" 无匹配 session → `session_api_key` 返回 None
- **修复**: 从 `coolzhu.toml` 的 `[vision] api_key` 读取并 set_env("ZAI_API_KEY")
- **状态**: 代码已修改，待测试

## 4. LLM 编译器栈溢出
- **现象**: main.rs 14,968 行 → rustc STATUS_STACK_BUFFER_OVERRUN
- **临时方案**: `RUSTFLAGS="-C opt-level=0"` 降低编译器内存压力
- **长期**: 需拆分 main.rs 为多个模块文件
