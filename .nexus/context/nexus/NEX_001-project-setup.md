---
context_id: NEX_001
title: Crate Test Infrastructure Setup
project: nexus
created: "2026-01-08"
---

# NEX_001: Crate Test Infrastructure Setup

## Desired Outcome

Running `just create-tests <crate_name> <context_id>` sets up all necessary infrastructure to enable E2E tests for a context in any workspace crate. After setup, tests in `crates/<crate>/tests/<context_id>/` directories are discoverable and runnable via `cargo test -p <crate_name>`. The command handles entry point creation and ensures tests are discovered by Cargo.

## Reference

Two test locations exist:

1. **Root `tests/`** - Project-level tests (hooks, setup, workspace-wide concerns)
2. **`crates/<crate>/tests/`** - Crate-specific tests

```
tests/                               # Project-level (NEX_* contexts)
├── nex_001_project_setup.rs         # Entry point
├── nex_001_project_setup/
│   └── mod.rs
└── fixtures/

crates/<crate>/tests/                # Crate-level (WKF_*, AGT_*, etc.)
├── <context_id>.rs                  # Entry point (required for Rust to discover)
└── <context_id>/
    ├── mod.rs                       # Declares test modules
    └── test_scenario.rs
```

## Next Actions

| Description | Test |
|-------------|------|
| Root Cargo.toml has [package] section for nexus-workspace | `root_package_exists` |
| Root tests/ exists for project-level tests (NEX_* contexts) | `root_tests_dir_exists` |
| Each crate has its own tests/ directory (e.g., crates/nexus-workflows/tests/) | `crate_has_tests_dir` |
| `just` command exists and `just --list` shows `create-tests` recipe | `create_tests_command_exists` |
| Running `just create-tests <crate> <id>` creates `crates/<crate>/tests/<id>/` directory | `create_tests_creates_directory` |
| Running `just create-tests <crate> <id>` creates `crates/<crate>/tests/<id>/mod.rs` | `create_tests_creates_mod_rs` |
| Running `just create-tests <crate> <id>` creates entry point `crates/<crate>/tests/<id>.rs` | `create_tests_creates_entry_point` |
| Entry point uses #[path] attribute to include mod.rs | `entry_point_uses_path_attr` |
| Created mod.rs includes context file reference comment | `mod_has_context_reference` |
| `cargo test --workspace` discovers all tests (root + crate-level) | `workspace_tests_discoverable` |
| `just test` runs all workspace tests | `just_test_runs_all` |
