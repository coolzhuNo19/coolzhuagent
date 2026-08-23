# 2026-08-23：统一未提交 PR 与发布验证

## 背景

上游 `coolzhulike/coolzhuagent/main` 在合并桌面图标与桌宠退出修复后从 `08bf548` 前进到 `d9e8085`。原有 reasoning、音频就绪检查和 computer-use fallback 三个 PR 均出现 merge conflict，不能直接合并。

## 整合结果

- 以最新 `origin/main` `d9e8085` 为基线创建 `codex/release-20260823-unified`。
- 合并原发布分支 `codex/release-20260823-computer-use`，生成整合提交 `2fbdf23`。
- 唯一冲突位于 `modules/gui-web/packages/web-console/src/styles.css` 的隐藏频道规则；保留 `.chat-sidebar-channels[hidden] { display: none; }` 并移除冲突标记。
- 保留三条待合并能力链：模型 reasoning 事件统一、空/非法音频 payload 的后端准确拒绝与状态反馈、无 showUI 本地模型时的 computer-use grounding fallback。

## 本地修复

- 将 stream/non-stream tool-loop 回归测试改成检查稳定的源码契约，避免格式化空白变化造成假失败。
- 将无效 synthetic WebM 测试改为断言明确的 `Invalid data: audio payload is not a valid webm container`，与当前音频校验行为一致。

## 验证

- `cargo test -p coolzhu-web-console --offline -- --test-threads=1`：828 passed。
- `cargo test -p coolzhu-web-console --offline`：828 passed。
- `cargo build -p coolzhu-web-console --offline`：通过（仅已有 unused/dead-code 警告）。
- `cargo test -p coolzhu-vision-service --offline`：36 passed。
- `cargo test -p coolzhu-uia-resolver --offline`：2 passed。
- `cargo check -p coolzhu-tool-registry --offline`：通过。

## 后续发布操作

将从该统一提交重新构建安装包并执行隔离运行时自检，然后把统一历史更新到现有发布 PR 分支，关闭重复的 reasoning/audio PR，确保 GitHub 上只保留一个待合并 PR。
