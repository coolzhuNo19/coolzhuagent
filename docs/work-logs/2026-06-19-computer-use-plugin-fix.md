# 2026-06-19 Computer Use 插件启动失败修复

## 背景

继续前一轮 GUI 功能验证时，Computer Use 插件启动失败，导致无法按规范使用真实前端鼠标/键盘模拟验证用户可见功能。

原始错误：

```text
Package subpath './dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js' is not defined by "exports" in C:\Users\zhupu\AppData\Local\OpenAI\Codex\runtimes\cua_node\a89897d3d9baa117\bin\node_modules\@oai\sky\package.json
```

## 根因

`C:\Users\zhupu\.codex\plugins\cache\openai-bundled\computer-use\26.611.62324\scripts\computer-use-client.mjs`
直接引用了 `@oai/sky` 包内的 Windows Computer Use base client：

```js
@oai/sky/dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js
```

但当前本地运行时包：

```text
C:\Users\zhupu\AppData\Local\OpenAI\Codex\runtimes\cua_node\a89897d3d9baa117\bin\node_modules\@oai\sky
```

的 `package.json` 只导出了 `"."`，未导出上述子路径。Node ESM 在存在 `exports` 字段时会阻止未声明的 package subpath import，因此插件入口在加载阶段即失败，还没进入 Windows helper 连接逻辑。

## 备份

修改前已备份：

- Computer Use 插件目录：
  `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-000000-computer-use-plugin-pre\computer-use-26.611.62324`
- `@oai/sky` 运行时包：
  `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-000001-sky-runtime-pre\sky`

备份摘要日志：

- `C:\Users\zhupu\Desktop\codex\tmp\logs\20260619-computer-use-plugin-backup.log`
- `C:\Users\zhupu\Desktop\codex\tmp\logs\20260619-sky-runtime-backup.log`

## 修改

实际补丁仅修改本地 `@oai/sky` 运行时包的 `package.json`，增加 Computer Use 插件当前需要的精确子路径导出：

```json
"./dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js": "./dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js"
```

保留 Computer Use 插件入口原有 import 形态，没有修改 native pipe 协议、Windows helper 通信、审批 UI 或输入行为。

曾尝试改插件入口为动态解析 `@oai/sky` 公开入口，但该执行环境的 `import.meta.resolve("@oai/sky")` 返回 bare specifier，不适合作为 URL base；已撤回该尝试，最终未保留该不稳定方案。

## TDD / 验证

红线脚本：

- `C:\Users\zhupu\Desktop\codex\tmp\computer_use_import_regression.mjs`

修复前结果：

```text
RED_EXPECTED_FAIL
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js' is not defined by "exports"
```

修复后，在重置 JavaScript 执行内核后同一脚本通过：

```text
GREEN_PASS
{"ok":true,"export":"setupComputerUseRuntime"}
```

最终启动验证脚本：

- `C:\Users\zhupu\Desktop\codex\tmp\computer_use_bootstrap_verify.mjs`

验证输出日志：

- `C:\Users\zhupu\Desktop\codex\tmp\logs\20260619-computer-use-bootstrap-verify.json`

最终结果：

```json
{
  "ok": true,
  "appCount": 40
}
```

说明 Computer Use 插件已能加载入口、连接 Windows helper，并成功执行轻量 `list_apps`。

## 回滚方式

如后续 Codex / Computer Use 官方更新覆盖本地运行时，或需要回滚本次手动补丁：

1. 关闭当前 Codex 相关进程或确保没有正在使用 Computer Use。
2. 用备份恢复 `@oai/sky` 运行时包：
   `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-000001-sky-runtime-pre\sky`
   覆盖：
   `C:\Users\zhupu\AppData\Local\OpenAI\Codex\runtimes\cua_node\a89897d3d9baa117\bin\node_modules\@oai\sky`
3. 如需同时恢复插件缓存目录，用备份：
   `C:\Users\zhupu\Desktop\codex\tmp\backups\20260619-000000-computer-use-plugin-pre\computer-use-26.611.62324`
   覆盖：
   `C:\Users\zhupu\.codex\plugins\cache\openai-bundled\computer-use\26.611.62324`

## 后续注意

- 这是对本地 Codex bundled runtime 的兼容补丁，不是项目源码补丁；Codex 或插件自动升级后可能需要重新验证。
- 下一步可以继续使用 Computer Use 做 GUI 设置按钮、模型切换、工具详情、TTS/STT 等真实前端验收。
