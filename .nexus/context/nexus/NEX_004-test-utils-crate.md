---
context_id: NEX_004
title: Shared Test Utilities Crate
project: nexus
created: "2026-01-09"
---

# NEX_004: Shared Test Utilities Crate

## Desired Outcome

A shared `nexus-test-utils` crate provides consistent test environment isolation across all E2E tests in the workspace. Tests call `setup_test_env()` which returns a guard that redirects all file paths to temporary directories, preventing tests from touching real user data (`~/.config/`, `~/.local/`, etc.). The guard automatically cleans up when dropped. This eliminates per-test-directory `test_utils.rs` files and ensures all tests follow the same isolation pattern.

## Reference

```
Environment Variables Redirected:

┌─────────────────────────────────────────────────────────────┐
│ Variable                │ Default Path      │ Test Path     │
├─────────────────────────┼───────────────────┼───────────────┤
│ NEXUS_CONTEXT_DIR       │ .context/         │ /tmp/nexus_*/ │
│ NEXUS_STATE_FILE        │ ~/.local/.../     │ /tmp/nexus_*/ │
│ NEXUS_SETTINGS_FILE     │ ~/.config/.../    │ /tmp/nexus_*/ │
│ NEXUS_RIG_TOKEN_PATH    │ ~/.local/.../     │ /tmp/nexus_*/ │
│ NEXUS_RIG_SESSION_PATH  │ ~/.local/.../     │ /tmp/nexus_*/ │
│ NEXUS_RAG_DB_PATH       │ .rag/lance.db     │ /tmp/nexus_*/ │
└─────────────────────────────────────────────────────────────┘
```

## Next Actions

| Description | Test |
|-------------|------|
| `setup_test_env()` returns `TestEnvGuard` that sets all env vars | `setup_returns_guard` |
| Guard sets `NEXUS_CONTEXT_DIR` to temp directory | `guard_sets_context_dir` |
| Guard sets `NEXUS_STATE_FILE` to temp path | `guard_sets_state_file` |
| Guard sets `NEXUS_SETTINGS_FILE` to temp path | `guard_sets_settings_file` |
| Guard sets `NEXUS_RIG_TOKEN_PATH` to temp path | `guard_sets_token_path` |
| Guard sets `NEXUS_RIG_SESSION_PATH` to temp path | `guard_sets_session_path` |
| Guard restores original env vars on drop | `guard_restores_on_drop` |
| Temp directory is unique per test (no collisions) | `temp_dir_unique` |
| Temp directory is cleaned up when guard drops | `temp_dir_cleaned` |
| Crate is added as dev-dependency to all workspace crates | `dev_dependency_added` |
