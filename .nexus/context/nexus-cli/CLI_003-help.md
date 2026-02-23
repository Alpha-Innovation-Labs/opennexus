---
context_id: CLI_003
title: Help Command
project: nexus-cli
feature: core
created: "2025-01-04"
---

# CLI_003: Help Command

## Desired Outcome

Running `opennexus` without any subcommand displays help information. Running `opennexus --help` also displays help. The help output shows available commands and usage instructions.

## Next Actions

| Description | Test |
|-------------|------|
| Running `opennexus` without arguments displays help | `no_args_displays_help` |
| Running `opennexus --help` displays help | `help_flag_displays_help` |
| Help output lists available subcommands | `help_lists_subcommands` |
| Help output shows usage syntax | `help_shows_usage` |
| Exit with code 0 on successful help display | `help_exits_zero` |
