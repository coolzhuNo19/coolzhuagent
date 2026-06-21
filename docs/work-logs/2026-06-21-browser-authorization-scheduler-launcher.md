# 2026-06-21 浏览器/授权/定时任务/package 启动器修复记录

## 背景

本轮按方案 A 继续推进：外部站点使用顶层 Tauri WebView2 浏览器窗口承载，修复浏览器工具栏错位；任务授权窗口移除“待审批”占位大区，为 Goal 角色、定时任务和授权配置让出空间；定时任务/Goal 推进输出进入系统默认聊天室“定时任务”；package 打包后提供用户可直接运行的 `COOLZHU-AGENT.exe`。

## 变更范围

- 根工程
  - 新增 `packages/app-launcher` Rust 启动器 crate。
  - `Cargo.toml` 纳入 `packages/app-launcher`。
  - `config/package-manifest.json` 增加根级 launcher 产物和 launcher 配置资源。
  - 新增 `config/package-launcher.json`，健康检查指向 packaged web-console 端口 `http://127.0.0.1:8765/api/diagnostics/health`。
  - `package all` 后生成 `package/COOLZHU-AGENT.exe`，并把旧二进制按既有备份规则放入 `package/backup`。
- `modules/gui-web`
  - 浏览器页工具栏调整为：后退 / 前进 / URL 输入 / 打开 / 刷新 / 停止 / 独立窗口。
  - 任务授权页移除“待审批”大区，左栏改为 Goal 角色分配 / Goal 运行配置 / 定时任务常显。
  - 定时任务使用系统聊天室 `room-scheduled-tasks`，名称为“定时任务”，不计入普通聊天室 8 个上限，不允许重命名/删除。
  - 定时任务/Goal 阶段思考、工具调用、回复与状态消息镜像到“定时任务”聊天室，不强制切换用户当前聊天室。
- `modules/gui-desktop`
  - 外部浏览器窗口新增/复用时执行 `show + unminimize + focus`，避免 URL 已导航但窗口未呈现。

## TDD / 验证记录

- package launcher 配置 RED：
  - `tmp/logs/browser-scheduler-launcher/package-launcher-contract-red-8765.out.log`
  - 失败点：`health_url` 仍指向 7860，launcher 自检等待 `8765` 包端口时超时。
- package launcher 配置 GREEN：
  - `tmp/logs/browser-scheduler-launcher/package-launcher-contract-green-8765.out.log`
  - `tmp/logs/browser-scheduler-launcher/package-launcher-contract-final.out.log`
  - 结果：`PACKAGE_LAUNCHER_CONTRACT_OK`。
- app launcher 单元测试：
  - `tmp/logs/browser-scheduler-launcher/app-launcher-tests-after-8765.out.log`
  - 结果：17 个测试通过。
- web-console 静态/后端测试：
  - `web-console-browser-contract-final.out.log`
  - `web-console-auth-contract-final.out.log`
  - `web-console-scheduled-room-final.out.log`
  - `web-console-scheduled-run-due-final.out.log`
  - `web-console-settings-goal-auth-final.out.log`
  - `web-console-auth-aria-red.out.log` / `web-console-auth-aria-green.out.log`
  - 覆盖：浏览器工具栏顺序、授权页结构、系统定时任务聊天室、due task 不切换当前聊天室、旧“待审批”无障碍标签移除。
- tauri-shell 外部浏览器静态测试：
  - `tmp/logs/browser-scheduler-launcher/tauri-browser-lifecycle-static-final.out.log`
  - `tmp/logs/browser-scheduler-launcher/tauri-shell-browser-test-final.out.log`
- 打包与启动：
  - `tmp/logs/browser-scheduler-launcher/package-all-final.out.log`
  - `tmp/logs/browser-scheduler-launcher/package-launcher-exe-run-verify-final.out.log`
  - 结果：`package/COOLZHU-AGENT.exe` 启动成功，web-console 与 tauri-shell 均来自 `package/bin`，健康检查 `ok 10 / warn 1 / error 0`。

## 前端自动化验证

- Computer Use 验证最终 package 运行窗口：
  - 任务授权页不再出现 `待审批` 文本。
  - 可见区域包含 `Goal 角色分配`、`Goal 运行配置`、`定时任务`、`授权配置`、`模块自检`。
  - 浏览器工具栏顺序为 `后退 / 前进 / 搜索或输入 URL / 打开 / 刷新 / 停止 / 独立窗口`。
  - 输入 `https://www.baidu.com` 后打开了顶层 `COOLZHU 浏览器` 窗口，页面内容包含 `百度一下，你就知道`。
- 限制记录：
  - WebView2 子页面内部控件的站内搜索点击在 Computer Use 中会出现焦点/子进程命中限制，不能作为稳定自动化验证证据。本轮已验证外部顶层窗口可以加载百度；站内网页交互建议后续用 WebView2/Playwright CDP 可控通道补更稳定的自动化覆盖。

## GLM5.2 Goal 监督记录

- 监督 session：`session-1781738898772`
- Goal：`goal-1782033076984-c85f526d`
- 设置记录：`tmp/logs/browser-scheduler-launcher/glm-goal-setup.json`
- 已观察问题：
  1. Goal verifier 拒绝 `type: Command`，改为 `CommandSucceeds` 后仍出现 `runtime_tool_execute_required`，未真实执行验证命令。
  2. 定时触发能创建 phase，但没有可靠执行；需要心跳与显式 `/loop/start max_steps=1`。
  3. GLM 角色心跳过期/offline。
  4. Phase1 用满工具调用后标记完成，但缺少承诺的测试日志。
  5. 曾生成不能编译的测试结构体字段。
  6. 曾只定义镜像 helper，未接入真实执行路径。
  7. poll 路径一度只复制 prompt，不复制回复。
  8. 镜像消息 ID 一度被改写，已改为在不同 room 下保留原 message id。
  9. Phase2 启动器任务 840 秒超时，`completed_steps=0`。
  10. launcher 配置残留 7860；本轮由主 agent 用 contract test 修复为 8765。
  11. package 重启存在端口释放竞态；验证脚本增加等待端口释放。
  12. PowerShell 5.1 数组合并问题导致验证脚本报错；已改为显式数组包裹。

## 风险与后续

- `modules/gui-desktop` 仓库存在大量早前桌宠素材/UI改动，本轮提交需只纳入外部浏览器窗口呈现相关 hunk，避免误提交其它 agent 改动。
- health 当前为 `warn` 而非 `ok`，原因是模块自检里存在已知警告项；launcher 自身已以 `ok 10 / warn 1 / error 0` 拉起运行。
- 后续若继续修复站内网页交互，应优先设计 WebView2 专用自动化入口，而不是依赖 Windows 坐标点击。
