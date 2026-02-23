---
context_id: CLI_012
title: Ralph Context and Tasks Command Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# CLI_012: Ralph Context and Tasks Command Parity

## Desired Outcome

`opennexus ralph` provides the same operator-facing context and markdown task management commands as the current Ralph CLI, including status visibility, context queueing, task file lifecycle behavior, indexed listing, and task removal semantics for nested content.

## Next Actions

| Description | Test |
|-------------|------|
| Show active state summary with iteration, elapsed time, promise configuration, backend details, and prompt preview through `--status` | `ralph_status_reports_active_loop_metadata` |
| Show pending context preview and recent history summary including duration and tool usage through `--status` | `ralph_status_includes_context_and_recent_history` |
| Show task table in status output when `--tasks` is requested or when active state is in tasks mode | `ralph_status_shows_tasks_when_requested_or_enabled` |
| Append timestamped entries to `.ralph/ralph-context.md` with `--add-context` and report whether consumption is next run or next iteration | `ralph_add_context_appends_timestamped_entries` |
| Clear pending context with `--clear-context` and report no-op behavior when no context exists | `ralph_clear_context_handles_present_and_absent_files` |
| List markdown tasks with numeric indices and status icons using `--list-tasks` and return guidance when no tasks file exists | `ralph_list_tasks_outputs_indexed_markdown_tasks` |
| Create `.ralph/ralph-tasks.md` when missing and append top-level tasks from `--add-task` | `ralph_add_task_creates_and_appends_tasks_file` |
| Remove indexed top-level task and all indented nested task content with range validation in `--remove-task` | `ralph_remove_task_deletes_target_with_nested_content` |
