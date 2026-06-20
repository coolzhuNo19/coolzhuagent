# 工程目录窗口 · IDE 功能实施方案（搜索 / 跳转 / 行号 / View-Diff 合并多标签）

> 日期：2026-06-12
> 性质：可直接进入开发的实施方案（现状 → 数据 → API → 前端 → 交互规格 → 分阶段验收）。
> 范围：函数搜索、文件搜索、函数跳转（含跨文件）、行号显示、行号跳转、
> View/Diff 合并按键、双视图多文件标签页、diff 右侧路径输入/拖拽换文件。

---

## 1. 现状盘点（实测）

**后端**（main.rs，路由 428-432）：
| 端点 | 功能 |
|---|---|
| `GET /api/project/tree?path=` | 目录树（按层加载） |
| `GET /api/project/file/meta` | 文件元信息 |
| `GET /api/project/file?path=` | 读文件内容 |
| `GET /api/project/diff?path=` | 单文件 git diff |
| `GET /api/project/diff-files?left=&right=` | 双文件对比 |

**前端**（app.js 关键函数，行号随版本漂移、按名定位）：
`loadProjectTree` / `renderProjectApiTree` / `renderProjectTreeNode`（树）、
`onProjectTreeClick` / `onProjectTreeDblClick`（树交互）、
`renderProjectContent` + `updateProjectPreview`（预览渲染）、
`renderProjectDiffView`（diff 渲染）、
`applyProjectSearchHighlight` + `initProjectSearch`（**当前文件内**内容搜索高亮）、
`initProjectSplitter`（树宽拖拽）。

**HTML**（index.html project 窗口）：工具条 = 预览 / Diff / 刷新 三按钮 + `project-search` 输入；
`project-diff-left/right` 双路径输入 + Compare 按钮；单 `pre[data-role="project-file-preview"]` 内容区。

**缺口**：无文件名搜索、无符号（函数）索引/搜索/跳转、无行号、单文件单视图（无标签页）、
预览与 Diff 是两个按钮两套状态。

---

## 2. 数据设计：索引落工程目录内

> 用户约束：「生成文件管理的数据都放在工程目录内」。

```
<workspace>/.coolzhu/ide-index/
├── symbols.json      # 符号索引（函数/方法/类/结构体 → 文件+行号）
├── files.json        # 文件清单缓存（路径+mtime+size，文件搜索用）
└── meta.json         # 索引元信息（构建时间、文件数、各文件 mtime 快照 → 增量重建）
```

- `.coolzhu/` 已被 .gitignore 覆盖（与 web-sessions 同目录），不污染版本库。
- **增量策略**：重建时对比 meta.json 中的 mtime 快照，仅重新解析变更文件；
  全量重建兜底（按钮/首次）。
- **symbols.json 结构**：
```json
{ "built_at": 1781230000000, "file_count": 412, "symbols": [
  { "name": "load_mcp_server_configs", "kind": "fn", "lang": "rust",
    "path": "modules/gui-web/packages/web-console/src/main.rs", "line": 9402,
    "signature": "fn load_mcp_server_configs() -> Vec<McpServerConfig>" }
]}
```

### 符号提取规则（轻量 ctags 式正则，不引编译器）
| 语言（按扩展名） | 匹配（捕获名称） |
|---|---|
| .rs | `^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)`、`^\s*(?:pub\s+)?(?:struct|enum|trait)\s+(\w+)`、`impl\s+(\w+)` |
| .js/.ts | `^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)`、`^\s*(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(`、`^\s*class\s+(\w+)`、对象方法 `^\s{2,}(\w+)\s*\([^)]*\)\s*\{` |
| .py | `^\s*def\s+(\w+)`、`^\s*class\s+(\w+)` |
| .html | `function\s+(\w+)`（内联 script） |
| .toml/.json/.md | 跳过 |

排除目录：`target/ node_modules/ .git/ tmp/ dist/ .coolzhu/`；单文件 >2MB 跳过（main.rs 1.36MB 必须含入，上限取 2MB）。

---

## 3. 后端 API 设计（新增 3 端点）

### 3.1 `POST /api/project/symbol-index`（构建/增量重建索引）
- 请求：`{ "full": false }`（true=全量）
- 行为：walk 工作区（复用 tree 的路径安全校验）→ 按 §2 规则提取 → 写 `.coolzhu/ide-index/*`。
- 响应：`{ "status":"ok", "file_count":412, "symbol_count":5301, "elapsed_ms":840, "incremental":true }`
- 实现注意：放 `tokio::task::spawn_blocking`（同步 IO 重活）；正则用 `once_cell` 静态编译。

### 3.2 `GET /api/project/symbols?query=&limit=50`
- 行为：读 symbols.json（内存缓存 + mtime 失效）→ 名称模糊匹配（子串+首字母序贯，按
  「前缀命中 > 子串 > 序贯」打分排序）。`query` 为空时返回空（避免全量倾倒）。
- 响应：`{ "symbols": [ {name, kind, lang, path, line, signature} ], "total": 87 }`
- 索引不存在时返回 `{ "symbols": [], "needs_index": true }`（前端引导点击建索引）。

### 3.3 `GET /api/project/search-files?query=&limit=50`
- 行为：读 files.json（无则现场 walk 一次并写盘）→ 文件名/相对路径模糊匹配（同上打分）。
- 响应：`{ "files": [ {path, size, mtime} ] }`

> 安全：三端点全部复用现有 project API 的工作区根校验（路径不可越出 workspace）；
> 索引文件写入也仅限 `<workspace>/.coolzhu/ide-index/`。

---

## 4. 前端设计

### 4.1 状态模型（app.js 顶部新增）
```js
const ideState = {
  mode: "view",                 // "view" | "diff"（合并按钮切换）
  tabs: [],                     // [{ id, kind:"view"|"diff", title, path, right?, active }]
  activeTabId: null,
  symbolIndexReady: false,
};
```
- **view tab**：`{ kind:"view", path }`；**diff tab**：`{ kind:"diff", path(left), right }`。
- 同一文件重复打开 = 激活既有 tab（按 kind+path+right 去重）。
- tab 持久：sessionStorage（刷新存活，重启清空即可，不入后端）。

### 4.2 HTML 结构改造（project 窗口内，全部新增 data-role，旧钩子不删）
```html
<div class="ide-toolbar">
  <button data-action="project-mode-toggle">视图</button>   <!-- 合并按钮：替代 预览/Diff 两键 -->
  <button data-action="project-refresh">刷新</button>
  <button data-action="project-build-index" title="构建符号索引">索引</button>
  <input data-role="ide-omni-search" placeholder="搜文件 @函数 :行号" />
</div>
<div class="ide-tabbar" data-role="ide-tabbar"></div>        <!-- 页眉文件标签条 -->
<div class="ide-diff-paths" data-role="ide-diff-paths" hidden>
  <span data-role="ide-diff-left-label"></span>
  <input data-role="ide-diff-right" placeholder="右侧文件路径，回车对比；或从目录树拖文件到右栏" />
</div>
<div class="ide-editor" data-role="ide-editor"></div>        <!-- 行号+内容双栏（替代裸 pre） -->
```
- 旧 `project-preview / project-diff / project-diff-files / project-file-preview` 保留隐藏一个版本周期
  （回退保险），新逻辑全走新 data-role。

### 4.3 统一搜索框（omni-search 语法）
| 输入 | 行为 |
|---|---|
| `foo` | 文件名模糊搜索（/api/project/search-files），下拉结果，回车/点击打开 view tab |
| `@foo` | 函数/符号搜索（/api/project/symbols），结果显示 `name · kind · path:line`，选中 → 打开文件 + 跳行（**跨文件跳转**即此路径） |
| `:123` | 当前激活 tab 内跳到 123 行（高亮该行 1.2s） |
| `foo :45` | 文件搜索打开后跳 45 行 |
- 下拉用一个浮层 `ide-omni-results`（键盘 ↑↓ 选择 + Enter，Esc 关闭）。
- 现有 `project-search`（文件内内容搜索）保留原位不动，职责不重叠。

### 4.4 行号显示与跳转
- `renderProjectContent` 升级为 `renderIdeEditor(content, { highlightLine })`：
```html
<div class="ide-editor"><div class="ide-gutter">1\n2\n…</div><pre class="ide-code">…</pre></div>
```
  gutter 与 code 同步滚动（gutter 定宽 `ch` 按最大行号位数）；行号点击也可触发"复制 path:line"。
- 大文件性能：>200KB 截断展示前 200KB + 顶部提示「大文件已截断，:行号 跳转自动加载该段」
  （跳转目标超出已载段时按行窗口（±400 行）请求 `/api/project/file?path=&start_line=&end_line=`
  ——**后端 file 端点加可选行窗口参数**，无参数行为不变）。
- 跳转高亮：目标行 `<mark class="ide-line-flash">`，1.2s 渐隐动画；scrollIntoView({block:"center"})。

### 4.5 函数跳转（含跨文件）
- 路径一：omni `@symbol` 搜索 → 选中 → `openViewTab(path, {line})`。
- 路径二：编辑器内 **Ctrl+点击标识符** → 取词（`/[A-Za-z_][A-Za-z0-9_]*/` 边界扩展）→
  调 `/api/project/symbols?query=<word>` → 唯一命中直接跳；多命中弹 omni 浮层预填 `@word`。
- 同文件优先：候选排序把「当前文件内命中」置顶，其次同目录，再全局。

### 4.6 View/Diff 合并按钮状态机
```
[view] --点击--> [diff(当前文件 self-diff)] --点击--> [view] …（往复）
```
- 进入 diff：以当前激活 view tab 的文件为左侧，右侧默认同一路径 → 渲染左右同文件对比
  （调 /api/project/diff-files?left=p&right=p；后端同文件=全等，渲染为双栏同内容，
  行级全部 same——即用户要求的"默认当前文件对比"）。
- **右侧换文件（两种方式）**：
  1. `ide-diff-right` 输入路径回车 → 更新当前 diff tab 的 right → 重新 diff-files；
  2. **从目录树拖文件到编辑区右半**：树节点（renderProjectTreeNode）加
     `draggable=true` + `dragstart` 写 `dataTransfer.setData("text/coolzhu-path", entry.path)`；
     编辑区 diff 模式下右半 50% 区域为 dropzone（dragover 高亮右半 + drop 取 path 更新 right）。
- diff 模式下点合并按钮 → 回 view（激活 diff tab 对应左文件的 view tab，无则新建）。
- 按钮文案随态切换：view 态显示「Diff」、diff 态显示「View」（图标同步换），一目了然下一次点击的效果。

### 4.7 多文件标签页（两种视图共用一条 tabbar）
- 渲染：`renderIdeTabbar()` —— view tab 显示 `文件名`，diff tab 显示 `左名 ⇄ 右名`
  （同文件 self-diff 显示 `文件名 ⇄ 自身`）；激活态金色下划线；每 tab 带 × 关闭。
- 行为：点击激活（按 tab.kind 切 mode 并渲染对应视图）；中键/×关闭；关闭激活 tab 后激活右邻。
- 上限 12 个 tab，超出关最旧未激活（提示一次）。
- 树交互衔接：单击树文件 = 在**当前模式**打开（view→新 view tab；diff→替换右侧？否——
  规格定为：diff 模式下单击树文件仍开 view tab 并切回 view，**拖拽才是改右侧**，
  避免误触改变对比对象）。

---

## 5. 交互细节规格（验收口径）

1. 行号：每行对齐无错位（等宽字体 + 同 line-height）；万行文件滚动 60fps（gutter 用单块文本而非逐行 DOM）。
2. `:9402` 回车 → main.rs 视图滚至 9402 行居中 + 金色闪烁渐隐。
3. `@tool_timeout` → 下拉含 `tool_timeout_ms_for · fn · …/main.rs:4119`，回车打开并跳行（跨文件）。
4. Ctrl+点击 `decode_console_output` → 多命中（web-console/tool-registry 各一）弹浮层 → 选择跳转。
5. 合并按钮：view→diff 默认左右均当前文件（双栏同内容）；右输入框换路径回车 → 真实对比；
   树拖 main.rs 到右半 → 对比更新；再点按钮回 view。
6. tabbar：view 开 3 文件 + diff 开 2 组，切换无串台；刷新后 tab 还原（sessionStorage）。
7. 索引：首次 `@` 搜索提示建索引 → 点「索引」按钮 → 构建完成 toast（耗时/符号数）→ 搜索可用；
   改文件后重建为增量（meta.json mtime 比对）。
8. 索引产物仅出现在 `<workspace>/.coolzhu/ide-index/`，git status 不出现新文件。

---

## 6. 分阶段开发路线

| 阶段 | 内容 | 触点 | 验收 |
|---|---|---|---|
| **A（后端索引）** | §2 索引器 + §3 三端点（spawn_blocking + 正则提取 + 打分） | main.rs | curl 三端点 + 产物落 ide-index/ + 增量生效 |
| **B（行号+跳转）** | renderIdeEditor 行号双栏 + `:n` 跳转 + 行窗口参数 | app.js + main.rs(file 端点) + styles.css | 规格 1/2 |
| **C（搜索+函数跳转）** | omni-search（文件/@符号/:行）+ Ctrl+点击取词跳转 | app.js + index.html | 规格 3/4 |
| **D（合并按钮+diff 换源）** | 状态机 + self-diff 默认 + 右路径回车 + 树拖拽 dropzone | app.js + index.html | 规格 5 |
| **E（多标签）** | ideState.tabs + tabbar 渲染/切换/关闭/持久 | app.js + index.html + styles.css | 规格 6 |
| 收尾 | 旧按钮下线、work-log、回归（树/splitter/内容搜索不回归） | — | 全规格 + 现有功能无回归 |

> A 与 B 可并行；C 依赖 A；D/E 依赖 B。预估 A=1d、B=1d、C=1d、D=0.5d、E=1d。

## 7. 通用约束
- 改前备份三件套到 `tmp/backups/web-ui-ide-<date>-pre/`；styles 走追加覆盖层。
- 现有 data-role（project-tree/project-search/project-file-preview…）一律保留；新功能全用新 data-role。
- index.html/styles.css/app.js 为编译期内联 → 每步 `cargo build -p coolzhu-web-console --offline`；
  后端新端点跟 `cargo test -p coolzhu-web-console --offline project` 回归。
- 子进程/文件读取沿用现有编码处理；索引器对非 UTF-8 文件 lossy 读取仅取行号不存内容。
- 动画一次性原则（v1 翻转 BUG 教训）；reduced-motion 降级。
