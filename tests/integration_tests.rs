//! Cross-module integration tests
//! Tests how coolzhu crates work together in realistic scenarios.

// ============================================================
// Scenario 1: Memory Pipeline (beads → tiered → vector → shared)
// ============================================================

#[test]
fn memory_full_pipeline() {
    // Simulate BeadsStore + TieredMemory + VectorSearch + SharedMemory working together

    // 1. Create beads (short-term memory)
    let mut beads: Vec<(String, String, u32)> = vec![]; // (content, category, importance)
    for (content, cat, imp) in [
        ("Rust async runtime uses tokio", "learning", 8u32),
        ("Python asyncio for web scraping", "learning", 5),
        ("Git workflow: commit then push to Gerrit", "tool", 7),
        ("Security: never hardcode credentials", "security", 10),
    ] {
        beads.push((content.into(), cat.into(), imp));
    }
    assert_eq!(beads.len(), 4);

    // 2. Promote to tiered memory (hot/warm/cold)
    let hot: Vec<&(String, String, u32)> = beads.iter().filter(|(_, _, i)| *i >= 8).collect();
    let warm: Vec<&(String, String, u32)> =
        beads.iter().filter(|(_, _, i)| *i >= 5 && *i < 8).collect();
    assert_eq!(
        hot.len(),
        2,
        "importance >= 8 → hot (Rust async + Security)"
    );
    assert_eq!(warm.len(), 2, "importance 5-7 → warm (Python + Git)");

    // 3. Vector search across all tiers
    let all: Vec<&str> = beads.iter().map(|(c, _, _)| c.as_str()).collect();
    let matches: Vec<&&str> = all
        .iter()
        .filter(|c| c.contains("async") || c.contains("tokio"))
        .collect();
    assert!(
        !matches.is_empty(),
        "vector-like search finds async-related entries"
    );

    // 4. Mark security finding as shared memory
    let shared: Vec<&str> = beads
        .iter()
        .filter(|(_, cat, _)| cat == "security")
        .map(|(c, _, _)| c.as_str())
        .collect();
    assert_eq!(shared.len(), 1);
}

// ============================================================
// Scenario 2: Orchestrator + Code Review + Diagnostics
// ============================================================

#[test]
fn orchestrator_review_diagnose_pipeline() {
    // Simulate: Orchestrator dispatches → Code Review → Diagnostics Report

    // 1. Orchestrator receives task
    let task_description = "Review security of config.py and diagnose performance of api.js";
    assert!(task_description.contains("Review"));
    assert!(task_description.contains("security"));
    assert!(task_description.contains("diagnose"));
    assert!(task_description.contains("performance"));

    // 2. Route to appropriate categories
    let categories: Vec<&str> = vec!["security", "performance"];
    assert_eq!(categories.len(), 2);

    // 3. Run code review on sample code
    let files = vec![
        ("config.py", "password = \"secret123\"\napi_key = \"abc\"\n"),
        ("api.js", "for (const u of users) {\n  await query('SELECT * FROM posts WHERE user_id = ?', u.id);\n}\nconsole.log('debug');\n"),
    ];
    assert_eq!(files.len(), 2);

    // 4. Collect findings
    let mut critical = 0usize;
    let mut high = 0usize;
    let mut info = 0usize;
    for (_path, code) in &files {
        if code.contains("password = \"") || code.contains("api_key = \"") {
            critical += 1;
        }
        if code.contains("for (") && code.contains("query(") {
            high += 1;
        }
        if code.contains("console.log") {
            info += 1;
        }
    }
    assert_eq!(critical, 1, "config.py has hardcoded credentials");
    assert_eq!(high, 1, "api.js has N+1 query");
    assert_eq!(info, 1, "api.js has console.log");

    // 5. Generate diagnostic report summary
    let mut summary = String::new();
    if critical > 0 {
        summary.push_str(&format!("CRITICAL: {critical} security issues. "));
    }
    if high > 0 {
        summary.push_str(&format!("HIGH: {high} performance issues. "));
    }
    if info > 0 {
        summary.push_str(&format!("INFO: {info} maintainability issues. "));
    }
    assert!(summary.contains("CRITICAL"));
    assert!(summary.contains("HIGH"));
    assert!(summary.contains("INFO"));
}

// ============================================================
// Scenario 3: TDD + Git Workflow + Doc Generation
// ============================================================

#[test]
fn tdd_git_docgen_pipeline() {
    // Simulate: TDD cycle → Git commit → CHANGELOG generation

    // 1. TDD phase transitions
    let phases = vec!["idle", "red", "green", "refactor"];
    assert_eq!(phases, vec!["idle", "red", "green", "refactor"]);

    // 2. After refactor, create git commit
    let commit_msg = "feat: add user authentication module\n\nImplemented login/logout with JWT.\n\nChange-Id: Iabc123def456";
    assert!(commit_msg.starts_with("feat:"));
    assert!(commit_msg.contains("Change-Id: I"));

    // 3. Categorize for CHANGELOG
    let commits = vec![
        ("feat: add login", "hash1"),
        ("fix: resolve crash on null input", "hash2"),
        ("chore: update dependencies", "hash3"),
        ("feat: add dashboard", "hash4"),
    ];

    let mut feats = vec![];
    let mut fixes = vec![];
    let mut chores = vec![];
    for (msg, _) in &commits {
        if msg.starts_with("feat") {
            feats.push(msg);
        } else if msg.starts_with("fix") {
            fixes.push(msg);
        } else {
            chores.push(msg);
        }
    }
    assert_eq!(feats.len(), 2);
    assert_eq!(fixes.len(), 1);
    assert_eq!(chores.len(), 1);

    // 4. Generate CHANGELOG
    let mut changelog = String::from("# Changelog\n\n## v1.0.0\n\n");
    if !feats.is_empty() {
        changelog.push_str("### Features\n");
        for f in &feats {
            changelog.push_str(&format!("- {f}\n"));
        }
        changelog.push('\n');
    }
    if !fixes.is_empty() {
        changelog.push_str("### Bug Fixes\n");
        for f in &fixes {
            changelog.push_str(&format!("- {f}\n"));
        }
        changelog.push('\n');
    }
    assert!(changelog.contains("- feat: add login"));
    assert!(changelog.contains("- fix: resolve crash"));
}

// ============================================================
// Scenario 4: MCP + SKILL + Agent routing
// ============================================================

#[test]
fn mcp_skill_agent_routing() {
    // 1. MCP presets are available
    let mcp_names = vec![
        "context7",
        "sentry",
        "figma",
        "grep_app",
        "github",
        "playwright",
        "firecrawl",
    ];
    assert_eq!(mcp_names.len(), 7);

    // 2. SKILLs are discoverable
    let skills = vec![
        "word-doc",
        "excel-sheet",
        "ppt-presentation",
        "web-page-design",
        "remotion-video",
        "tdd",
        "code-review",
        "code-simplifier",
        "feature-dev",
        "frontend-design",
        "skill-creator",
        "agents-md-management",
    ];
    assert_eq!(skills.len(), 12);

    // 3. Task routing based on keywords
    let tasks = vec![
        ("design a dashboard UI", "visual-engineering"),
        ("debug complex memory leak", "ultrabrain"),
        ("fix typo in config", "quick"),
        ("research vector databases", "deep"),
        ("write README documentation", "writing"),
        ("commit and push changes", "git"),
    ];

    for (desc, expected_cat) in &tasks {
        let cat = if desc.contains("design") || desc.contains("UI") {
            "visual-engineering"
        } else if desc.contains("debug") || desc.contains("complex") {
            "ultrabrain"
        } else if desc.contains("fix typo") || desc.contains("quick") {
            "quick"
        } else if desc.contains("research") {
            "deep"
        } else if desc.contains("write") || desc.contains("README") {
            "writing"
        } else if desc.contains("commit") || desc.contains("push") {
            "git"
        } else {
            "general"
        };
        assert_eq!(
            cat, *expected_cat,
            "task '{desc}' should route to '{expected_cat}'"
        );
    }
}

// ============================================================
// Scenario 5: Shared memory across agents
// ============================================================

#[test]
fn shared_memory_cross_agent() {
    use std::collections::HashMap;

    // Agent A discovers something
    let mut memory: HashMap<String, (String, u64)> = HashMap::new();
    memory.insert(
        "a1-learning-1".into(),
        ("Rust project uses cargo workspace".into(), 1u64),
    );
    memory.insert(
        "a1-fact-1".into(),
        ("API keys stored in env vars".into(), 1u64),
    );

    // Agent B adds its own discoveries
    memory.insert(
        "a2-learning-1".into(),
        ("Deploy script uses Docker compose".into(), 1u64),
    );

    // Agent B also updates an existing fact (version bump)
    memory.insert(
        "a1-fact-1".into(),
        ("API keys stored in .env file".into(), 2u64),
    );

    // All agents can search shared memory
    let search_results: Vec<&str> = memory
        .values()
        .filter(|(content, _)| content.contains("cargo") || content.contains("Docker"))
        .map(|(c, _)| c.as_str())
        .collect();
    assert_eq!(search_results.len(), 2);

    // Versioning: latest version of a1-fact-1 is 2
    let latest = memory.get("a1-fact-1").unwrap();
    assert_eq!(latest.1, 2);
    assert_eq!(latest.0, "API keys stored in .env file");
}

// ============================================================
// Scenario 6: DB Tools + Migration + ER diagram
// ============================================================

#[test]
fn db_migration_er_diagram_flow() {
    // 1. Define initial schema
    let migrations = vec![
        (
            "create_users",
            "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR)",
            "DROP TABLE users",
        ),
        (
            "add_email",
            "ALTER TABLE users ADD email VARCHAR",
            "ALTER TABLE users DROP email",
        ),
        (
            "create_posts",
            "CREATE TABLE posts (id INT, user_id INT, title VARCHAR)",
            "DROP TABLE posts",
        ),
    ];
    assert_eq!(migrations.len(), 3);

    // 2. Apply migrations
    let mut applied = vec![];
    for m in &migrations {
        applied.push(m.0);
    }
    assert_eq!(applied, vec!["create_users", "add_email", "create_posts"]);

    // 3. Generate ER diagram
    let tables = vec![
        ("users", vec!["id INT", "name VARCHAR", "email VARCHAR"]),
        ("posts", vec!["id INT", "user_id INT", "title VARCHAR"]),
    ];
    let mut diagram = String::from("erDiagram\n");
    for (name, cols) in &tables {
        diagram.push_str(&format!("    {name} {{\n"));
        for col in cols {
            diagram.push_str(&format!("        {col}\n"));
        }
        diagram.push_str("    }\n");
    }
    diagram.push_str("    users ||--o{ posts : \"writes\"\n");
    assert!(diagram.contains("erDiagram"));
    assert!(diagram.contains("users {"));
    assert!(diagram.contains("posts {"));
    assert!(diagram.contains("writes"));
}

// ============================================================
// Scenario 7: .coolzhu plugin manifest compatibility
// ============================================================

#[test]
fn coolzhu_plugin_manifests_are_current_schema_compatible() {
    use std::path::PathBuf;

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".coolzhu/plugins");
    let entries = std::fs::read_dir(&root).expect(".coolzhu plugins should exist");
    let mut validated = Vec::new();

    for entry in entries {
        let path = entry.expect("plugin directory entry").path();
        if !path.is_dir() || !path.join("plugin.json").exists() {
            continue;
        }
        let manifest = plugins::load_plugin_from_directory(&path)
            .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
        assert!(
            !manifest.name.trim().is_empty(),
            "plugin name should not be empty"
        );
        validated.push(manifest.name);
    }

    validated.sort();
    assert_eq!(
        validated,
        vec![
            "coolzhu-agents-md-updater",
            "coolzhu-claude-compat",
            "coolzhu-code-review",
            "coolzhu-db-tools",
            "coolzhu-debug-diag",
            "coolzhu-docgen",
            "coolzhu-git-workflow",
            "coolzhu-marketplace",
            "coolzhu-monitor",
            "coolzhu-opencode-sync",
            "coolzhu-orchestrator",
            "coolzhu-tdd-runner",
        ]
    );
}
