# 仓库结构

```text
coolzhu/
  Cargo.toml
  Cargo.lock
  src/
    lib.rs
  docs/
    README.md
    repository-structure.md
    interface-contracts.md
    development-standard.md
    testing-standard.md
    migration-notes.md
  tests/
    README.md
    module_linkage_smoke.rs
    manual-visual-confirmation.md
  modules/
    core-runtime/
      INTERFACE.md
      packages/
        core-runtime/
        agent-server/
        language-service/
    llm-adapter/
      INTERFACE.md
      packages/llm-adapter/
    tooling/
      INTERFACE.md
      packages/
        tool-registry/
        plugin-system/
        command-router/
        compatibility-harness/
    vision/
      INTERFACE.md
      packages/vision-service/
    computer-use/
      INTERFACE.md
      packages/computer-use-core/
    gui-web/
      INTERFACE.md
      packages/web-console/
    gui-desktop/
      INTERFACE.md
      packages/desktop-console/
    cli/
      INTERFACE.md
      packages/command-line/
    diagnostics/
      INTERFACE.md
      packages/diagnostics/
  .coolzhu/
    plugins/                    # Community plugin crates (workspace members)
      coolzhu-tdd-runner/
      coolzhu-git-workflow/
      coolzhu-code-review/
      coolzhu-orchestrator/
      coolzhu-docgen/
      coolzhu-db-tools/
      coolzhu-debug-diag/
      coolzhu-monitor/
      coolzhu-marketplace/
    skills/                     # SKILL.md definitions (Claude Code / OpenCode compatible)
      word-doc/
      excel-sheet/
      ppt-presentation/
      web-page-design/
      remotion-video/
```

命名规则：

- 目录使用 kebab-case。
- package 使用 `coolzhu-*`。
- 对外文档使用 `INTERFACE.md`。
- 根目录只保留集成 workspace 和联调测试。
- 模块内测试保留在模块 package 内，跨模块联调测试放根目录 `tests/`。
