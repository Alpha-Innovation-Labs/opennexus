---
context_id: CLI_003
title: Migrate to Clap CLI Framework
project: nexus-cli
created: "2025-01-04"
---

# CLI_003: Migrate to Clap CLI Framework

## Desired Outcome

The CLI uses clap for argument parsing with derive macros, replacing the manual argument matching. The code is restructured following `.nexus/rules/rs.md` with one item per file and structs using directory structure.

## Next Actions

| Description | Test |
|-------------|------|
| just run with no args launches fuzzy finder| `no_args_launches_fuzzy_finder` |
| just run setup prompts for profile selection| `setup_prompts_for_profile` |
| just run setup --profile opencode sets up without prompt| `setup_with_profile_flag` |
| just run --help shows all commands and options| `help_shows_all_commands` |
| just run --version shows version| `version_flag` |
| just run project --help shows project subcommands| `project_help` |
| invalid command shows error with suggestions| `invalid_command_shows_suggestions` |
| src/cli/cli_struct/ avoids Clippy module inception warning| `module_naming_avoids_inception` |
| #[command(subcommand)] provides nested Project/Context commands with auto-help| `nested_subcommands_derive` |
| Profile enum parses from CLI args via ValueEnum without manual FromStr| `profile_value_enum` |
| Option<Commands> triggers fuzzy-finder when None| `optional_subcommand_default` |
