---
context_id: CLI_001
title: Baseline CLI Setup
project: nexus-cli
feature: core
created: "2025-01-04"
---

# CLI_001: Baseline CLI Setup

## Desired Outcome

The `opennexus` CLI initializes and maintains local Nexus assets through `opennexus setup`. Setup extracts embedded `.nexus/` assets, writes selected harness configuration in `.nexus/config.json`, and links harness assets into `.opencode/` (or `.claude/commands` for Claude harness) so local command and skill behavior stays aligned with the embedded release.

## Next Actions

| Description | Test |
|-------------|------|
| Extract embedded Nexus assets into project `.nexus/` and update `.nexus/.version` | `setup_extracts_nexus_assets` |
| Persist selected harness in `.nexus/config.json` during setup | `setup_writes_harness_config` |
| Link command files into `.opencode/command` for `--harness opencode` | `setup_links_opencode_commands` |
| Link tool files into `.opencode/tools` for `--harness opencode` | `setup_links_opencode_tools` |
| Link skill and rule directories into `.opencode/skills` and `.opencode/rules` for `--harness opencode` | `setup_links_opencode_skills_and_rules` |
| Link command files into `.claude/commands` for `--harness claude` | `setup_links_claude_commands` |
| Prune stale generated harness links before recreating current ones | `setup_prunes_stale_harness_links` |
| Remove legacy top-level `.nexus/rules` directory when present | `setup_removes_legacy_rules_dir` |
| Parse `opennexus --version` and `opennexus --help` successfully | `version_and_help_flags_work` |
