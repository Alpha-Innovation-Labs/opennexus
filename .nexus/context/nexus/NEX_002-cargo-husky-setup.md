---
context_id: NEX_002
title: Cargo-Husky Git Hooks Setup
project: nexus
created: "2026-01-08"
---

<!-- 
SOURCE OF TRUTH: .cdd/rules/context.md

FILE NAMING: PRJ_NNN-brief-description.md
- PRJ = 3-letter project prefix (e.g., KNO for knowledge-harvester)
- NNN = zero-padded sequence number
- Example: KNO_001-project-scaffold.md

CRITICAL RULES:
- NO code at all - code belongs in the codebase
- NO implementation details - describe WHAT, not HOW
- Only E2E tests matter - no unit or integration tests
-->

# NEX_002: Cargo-Husky Git Hooks Setup

## Desired Outcome

Running `git commit` triggers pre-commit hooks that validate code quality via `cargo fmt`, `cargo clippy`, and `cargo test`. The commit-msg hook validates that commit messages follow conventional commit format (type(scope): description). Invalid commit messages are rejected with clear error messages. All hooks are managed by cargo-husky and can be skipped with `--no-verify` when needed.

## Next Actions

| Description | Test |
|-------------|------|
| Install and configure cargo-husky in Cargo.toml | `cargo_husky_configured` |
| Set up pre-commit hook to run cargo fmt | `pre_commit_fmt_hook` |
| Set up pre-commit hook to run cargo clippy | `pre_commit_clippy_hook` |
| Set up pre-commit hook to run cargo test | `pre_commit_test_hook` |
| Implement commit-msg hook to validate conventional commit format | `commit_msg_validates_format` |
| Commit message with valid format succeeds | `valid_commit_accepted` |
| Commit message with invalid format is rejected | `invalid_commit_rejected` |
| Hooks can be bypassed with git commit --no-verify | `hooks_bypassable` |
