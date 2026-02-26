---
context_id: CDD_014
title: Context CLI Observability and Task Drilldown
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_013
      why: This dependency outcome is required before this context can proceed.
---

# CDD_014: Context CLI Observability and Task Drilldown

## Desired Outcome

CLI observability commands provide drilldown views for one context and one task so operators can inspect stage timelines, retries, failures, and current lifecycle state without reading raw storage tables.

## Next Actions

| Description | Test |
|-------------|------|
| Add a command to display context-level run timeline with stage outcomes and durations | `context_cli_shows_context_run_timeline_with_stage_durations` |
| Add a command to display task-level lifecycle state, retries, and latest error details | `context_cli_shows_task_state_retries_and_latest_error` |
| Include links or identifiers to associated run and session records in drilldown output | `context_cli_shows_run_and_session_identifiers_in_drilldown` |
| Support filtering observability output by context id and task test id | `context_cli_supports_context_and_task_filters` |
| Return actionable errors for unknown context ids or task identifiers | `context_cli_reports_actionable_unknown_context_or_task_errors` |
