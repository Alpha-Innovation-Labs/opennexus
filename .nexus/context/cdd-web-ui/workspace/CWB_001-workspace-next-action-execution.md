---
context_id: CWB_001
title: Workspace Next Action Execution
project: cdd-web-ui
feature: workspace
created: "2026-02-23"
---

# CWB_001: Workspace Next Action Execution

## Desired Outcome

The web workspace lets an operator select one `Next Actions` row from a context file and start backend workflow execution that generates the required test and drives implementation for that selected line only.

## Next Actions

| Description | Test |
|-------------|------|
| List selectable `Next Actions` rows for a chosen context file in the workspace | `workspace_lists_next_action_rows_for_selected_context` |
| Trigger backend execution for exactly one selected row without starting other rows | `workspace_triggers_execution_for_single_selected_row` |
| Start execution through CDD backend command path with selected row identity preserved | `workspace_starts_backend_execution_with_selected_row_identity` |
| Show actionable failure when selected row cannot be executed | `workspace_shows_actionable_error_when_row_execution_fails` |
| Prevent duplicate start for an already-running selected row | `workspace_prevents_duplicate_start_for_running_row` |
