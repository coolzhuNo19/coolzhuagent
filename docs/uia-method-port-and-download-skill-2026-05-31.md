# 把验证过的 UIA/迅雷方法落到 coolzhu agent + 下载 skill 方案（2026-05-31）

> 用户要求：迅雷测试用的是「我（Claude Code）自己写的独立 PowerShell UIA 脚本」，不是 coolzhu 内置 UIA。
> 要把这套方法落到 coolzhu agent 的 UIA 上，并把下载操作固化为 skill（以后"下载某资源"默认走它）。
> **本轮只规划，不改代码。**

## 一、澄清：迅雷测试用的是谁的 UIA

- **用的是我手写的独立 PowerShell 脚本**（`tmp/thunder-download.ps1` + 临时 UIA 枚举/截图/SetCursorPos 点击），
  **不是** coolzhu 的 `modules/vision/packages/uia-resolver`。
- 这套方法已验证有效：thunder:// 协议拉起迅雷 → UIA 确认"新建任务面板"弹出 → 截图视觉确认 main.zip/22.27MB →
  真实点击"立即下载" → 面板关闭=下载开始。

## 二、coolzhu 现有 UIA 能力现状（排查事实）

- `uia-resolver::resolve_system_control(id: SystemControlId) -> Result<UiaHit, UiaError>`：
  - 只接受**预定义枚举** `SystemControlId`（仅 `StartButton`、`TaskbarSearchBox`）。
  - **只有 `StartButton` 真正实现**（`resolve_via_script` 内嵌 PowerShell + UIAutomationClient 脚本），
    其余返回 `not yet implemented`。
- 即：coolzhu UIA **无法定位任意 APP 窗口 + 任意控件**，更没有"按窗口标题找控件/树状菜单"能力。
- 机制上与我的迅雷脚本**同款**（都是 PowerShell + UIAutomation），所以移植路径顺畅。
- 已有 `.coolzhu/skills/compute-use-control/SKILL.md`（我之前建的通用 UIA 脚本生成指南），但**无 download/thunder skill**。

## 三、移植方案（两层）

### 层一：把"通用 UIA 定位"沉淀进 uia-resolver（能力层）

现状 `resolve_system_control` 只认枚举，扩展为支持**自由目标**：

1. 新增 `pub fn resolve_window_control(spec: UiaTargetSpec) -> Result<UiaHit, UiaError>`：
   ```rust
   struct UiaTargetSpec {
       window_title_contains: String,   // 按窗口标题关键字匹配顶层窗口
       control_type: Option<String>,    // Button/Edit/Group/MenuItem... (可选)
       name_contains: Option<String>,   // 控件 Name 关键字
       automation_id: Option<String>,   // 可选 AutomationId
       nth: Option<usize>,              // 多命中时取第 n 个
   }
   ```
   内部复用现有 `resolve_via_script` 的 PowerShell + UIAutomation 模式，脚本按 spec 动态生成
   （RootElement→Children 找窗口→Descendants 按 ControlType/Name 找控件→返回 BoundingRectangle）。
2. **沿用我迅雷脚本验证过的要点**（写进脚本模板）：
   - Electron/CEF 窗口(Chrome_WidgetWin) UIA 拿不到内部控件 → 自动回退**截图+视觉 grounding**（接现有 ShowUI/locate 链路）。
   - 树状关系（菜单点击后下拉是独立顶层窗口）→ spec 支持"点击后重新枚举"两段式。
3. 把 `UiaHit.bounding_rect` 接入现有 compute-use 点击链路（`execute_mouse_action` 用其 center 坐标）。

> 注意：现有 compute-use HTTP 层 `run_action_plan` 对 computer.* 硬禁 execute=true（之前审计 H7 记录），
> 任意坐标真实注入未经 HTTP 开放。落地真实点击需走"受控真实输入"入口（见 R-CU 系列需求）或脚本旁路。

### 层二：把"下载操作"固化为 skill（操作层，用户本轮核心诉求）

新建 `.coolzhu/skills/thunder-download/SKILL.md`，让模型遇到"下载 X 资源/把这个链接下载下来"意图时默认走它：

**skill 核心逻辑**（沉淀我验证过的 thunder:// 方法）：
1. 提取目标 URL。
2. 编码为 thunder:// 协议：`thunder://` + Base64("AA" + URL + "ZZ")。
3. 找迅雷主程序（注册表 `HKCR\thunder\shell\open\command` 优先，回退
   `C:\Program Files (x86)\Thunder Network\Thunder\Program\Thunder.exe`）。
4. `Start-Process Thunder.exe <thunderUrl> -StartType:thunder` 拉起并交任务。
5. 验证：UIA 枚举确认"新建任务面板"弹出（class=Chrome_WidgetWin_0，name=新建任务面板）；
   CEF 内部按钮 UIA 拿不到 → 截图视觉确认文件名/大小 → 真实点击"立即下载"（坐标=面板原点+按钮相对位置）。
6. 报告：下载是否开始（面板关闭=已开始）。

**skill 已就绪的实证脚本**：`tmp/thunder-download.ps1`（已验证可拉起迅雷并解析资源），
固化时把它移到 skill 目录并补"点击立即下载 + 验证"段。

**通用化**：skill 描述里说明——若装的是其它下载器（IDM/qBittorrent/浏览器），
回退到对应协议或"打开下载器→UIA/视觉定位新建任务→粘贴URL→开始"的通用流程（复用 compute-use-control skill）。

### 落地优先级
- **P1（用户核心）**：建 `thunder-download` skill（把已验证脚本固化）——以后"下载"意图默认走它。改动小、即时可用。
- **P2**：uia-resolver 扩展 `resolve_window_control`（通用 UIA 定位能力），让 coolzhu 内置 UIA 不再只会 StartButton。
- **P3**：受控真实输入 HTTP 入口（解除 run_action_plan 的 execute 闸门，带权限+审计+截图证据），
  让 compute-use 真实点击走产品链路而非脚本旁路。

## 四、与现有 skill 的关系
- `compute-use-control`（已有）：通用"定位任意APP+控件"的 UIA 脚本生成指南（方法论）。
- `thunder-download`（待建）：具体"用迅雷下载URL"的可执行 skill（实例，引用前者的方法）。
- 两者互补：前者是"怎么定位"，后者是"下载这件事怎么做"。

## 五、验证方式（落地后）
- skill 验证：给 coolzhu 会话发"下载 https://...zip" → 触发 thunder-download skill →
  迅雷弹新建任务面板 → 视觉确认资源 → 点立即下载 → 面板关闭。截图存证。
- uia-resolver 验证：单测 `resolve_window_control` 对已知窗口（如迅雷/记事本）返回正确 bbox。
