---
context_id: CLI_001
title: Baseline CLI Setup
project: nexus-cli
created: "2025-01-04"
---

# CLI_001: Baseline CLI Setup

## Desired Outcome

The Nexus CLI provides a setup command for initializing Nexus in projects. This includes extracting embedded `.nexus/` assets and copying commands to profile directories. Global installation/uninstallation of the `opennexus` executable is handled via justfile recipes.

## Next Actions

All tests use `just run` to ensure the local project binary is tested, not a globally installed version.

| Description | Test |
|-------------|------|
| Implement `opennexus setup` command to extract embedded `.nexus/` assets | `setup_extracts_nexus_assets` |
| Prompt user to select profile (Claude Code or OpenCode) interactively | `setup_prompts_for_profile` |
| Support `--profile opencode` flag to skip interactive prompt | `setup_opencode_profile` |
| Support `--profile claude` flag to set up Claude Code profile | `setup_claude_profile` |
| Extract rules and templates to `.nexus/` directory | `setup_extracts_nexus_assets` |
| Copy commands to `.claude/commands/` or `.opencode/command/` | `setup_copies_commands_to_profile` |
| Create `.context/` directory structure | `setup_creates_context_dir` |
| Copy AGENTS.md template to project root if not exists | `setup_creates_agents_md` |
| Skip AGENTS.md if already exists | `setup_skips_existing_agents_md` |
| Write version file to `.context/.version` | `version_file_written` |
| Implement `opennexus --version` to show version | `version_flag` |
| Implement `opennexus --help` to show usage | `help_flag` |
| Create `just install` recipe for global installation (`cargo install --path .`) | `install_recipe_exists` |
| Create `just uninstall` recipe for global uninstallation (`cargo uninstall --package opennexus --bin opennexus`) | `uninstall_recipe_exists` |
| Create `just setup` recipe for local development | `setup_recipe_exists` |
| Invalid command shows error message | `invalid_command_error` |
| include_dir! paths join correctly without double-nesting | `embedded_files_extract_without_nesting` |
| Profile detection checks .opencode/command before .claude/commands | `profile_detection_prefers_opencode` |
| `just run` executes local project binary, not globally installed version | `local_binary_used_not_global` |
