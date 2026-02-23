---
context_id: CLI_009
title: Ralph Command Surface Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# CLI_009: Ralph Command Surface Parity

## Desired Outcome

`opennexus ralph` exposes the same user-facing command surface as the current Ralph CLI for invocation, option aliases, status/task subcommands, passthrough behavior, help/version output, and invalid-flag handling, so existing workflows can switch to the Rust command without retraining or script changes.

## Next Actions

| Description | Test |
|-------------|------|
| Parse `opennexus ralph --help` with all documented options and commands visible | `ralph_help_lists_supported_flags` |
| Parse `opennexus ralph --version` and return the command version in stable format | `ralph_version_flag_returns_version` |
| Accept inline prompt text as positional input and reject empty prompt when no resumable state exists | `ralph_accepts_prompt_and_rejects_missing_prompt` |
| Accept prompt input from `--prompt-file` and fail on missing or empty files | `ralph_reads_prompt_file_and_validates_file_errors` |
| Accept option aliases including `--file` and `-f` for prompt file, plus `--tasks` and `-t` for tasks mode | `ralph_supports_documented_option_aliases` |
| Support status and task management commands from the primary command surface (`--status`, `--add-context`, `--clear-context`, `--list-tasks`, `--add-task`, `--remove-task`) | `ralph_supports_context_and_task_command_family` |
| Reject unknown options with non-zero exit and actionable usage guidance | `ralph_rejects_unknown_option_with_usage_message` |
| Pass through extra agent flags after `--` without consuming them as Ralph options | `ralph_double_dash_forwards_remaining_flags` |
