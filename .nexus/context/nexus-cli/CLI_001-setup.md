---
context_id: CLI_001
title: Setup Command
project: nexus-cli
feature: core
created: "2025-01-04"
---

# CLI_001: Setup Command

## Desired Outcome

The `opennexus setup` command extracts embedded Nexus assets into the project `.nexus/` directory, writes harness configuration to `.nexus/config.json`, and creates symbolic links from harness assets (commands, skills, rules) into the appropriate profile directory (`.opencode/` for OpenCode, `.claude/commands` for Claude Code). Stale generated links are pruned before recreation.

## Next Actions

| Description | Test |
|-------------|------|
| Extract embedded setup-managed `.nexus/` assets into project `.nexus/` directory while leaving `.nexus/context/` unseeded | `setup_extracts_nexus_assets` |
| Create `.nexus/context/` as an empty directory without extracting bundled context files | `setup_creates_empty_context_directory` |
| Remove bundled context seed content from `.nexus/context/` while preserving user-managed context files | `setup_prunes_bundled_context_seed_content` |
| Write harness configuration to `.nexus/config.json` with `harness` key | `setup_writes_harness_config` |
| Write version to `.nexus/config.json` under `version` key | `setup_writes_version` |
| Create `.opencode/command` directory if `--harness opencode` | `setup_creates_opencode_command_dir` |
| Symlink command files from `.nexus/ai_harness/commands/` to `.opencode/command/` | `setup_links_opencode_commands` |
| Symlink tool files from `.nexus/tools/` to `.opencode/tools/` | `setup_links_opencode_tools` |
| Symlink skill directories from `.nexus/ai_harness/skills/` to `.opencode/skills/` | `setup_links_opencode_skills` |
| Symlink rule directories from `.nexus/ai_harness/rules/` to `.opencode/rules/` | `setup_links_opencode_rules` |
| Create `.claude/commands` symlinks when `--harness claude` is specified | `setup_links_claude_commands` |
| Prune stale symlinks in `.opencode/` and `.claude/` before recreating | `setup_prunes_stale_links` |
| Remove legacy top-level `.nexus/rules` directory when present | `setup_removes_legacy_rules_dir` |
| Support `--harness opencode` flag to select OpenCode profile | `setup_supports_opencode_flag` |
| Support `--harness claude` flag to select Claude Code profile | `setup_supports_claude_flag` |
| Support `--force` flag to force re-extraction even if assets exist | `setup_supports_force_flag` |
