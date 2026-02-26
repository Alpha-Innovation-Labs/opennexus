---
context_id: NEX_002
title: Cargo-Husky Git Hooks Setup
project: nexus
feature: workflow
created: "2026-01-08"

depends_on:
  contexts:
    - id: NEX_001
      why: This dependency outcome is required before this context can proceed.
---

# NEX_002: Cargo-Husky Git Hooks Setup

## Desired Outcome

Running `git commit` and `git push` consistently enforces repository quality gates through cargo-husky hooks. Pre-commit and pre-push validate docs-sync guard, formatting, linting, and tests, and commit messages are validated against conventional commit format via a `commit-msg` hook so invalid messages are rejected before history is updated.

## Next Actions

| Description | Test |
|-------------|------|
| Configure cargo-husky hooks for pre-commit and pre-push workflows | `cargo_husky_hooks_configured` |
| Run docs-sync guard from pre-commit before code quality checks | `pre_commit_runs_docs_sync_guard` |
| Run `cargo fmt --check`, `cargo clippy`, and `cargo test` from pre-commit | `pre_commit_runs_fmt_clippy_test` |
| Run docs-sync guard and docs-sync check from pre-push | `pre_push_runs_docs_sync_guard_and_check` |
| Run `cargo fmt --check`, `cargo clippy`, and `cargo test` from pre-push | `pre_push_runs_fmt_clippy_test` |
| Validate conventional commit message format from a commit-msg hook | `commit_msg_validates_conventional_format` |
| Accept valid conventional commit messages and reject invalid ones | `commit_msg_accepts_and_rejects_correctly` |
| Allow explicit hook bypass only when `--no-verify` is used | `hooks_bypassable_with_no_verify` |
