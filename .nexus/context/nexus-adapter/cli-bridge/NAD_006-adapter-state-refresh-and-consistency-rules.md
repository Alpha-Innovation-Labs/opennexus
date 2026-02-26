---
context_id: NAD_006
title: Adapter State Refresh and Consistency Rules
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: NAD_003
      why: This context requires NAD_003 to be complete before proceeding.
    - id: NAD_004
      why: This context requires NAD_004 to be complete before proceeding.
---

# NAD_006: Adapter State Refresh and Consistency Rules

## Desired Outcome

Adapter query and control flows provide consistent near-real-time execution state so UI panels avoid stale run information during start, stop, and hard restart transitions.

## Next Actions

| Description | Test |
|-------------|------|
| Refresh active and status views immediately after successful control actions | `adapter_refreshes_active_and_status_views_after_control_actions` |
| Apply bounded polling while runs are active and stop polling when runs are terminal | `adapter_applies_bounded_polling_for_active_runs_and_stops_on_terminal_state` |
| Reconcile concurrent query responses to maintain monotonic run state progression in adapter output | `adapter_reconciles_concurrent_query_responses_for_monotonic_state_progression` |
| Ensure run history updates include newly created hard-restart runs without replacing prior entries | `adapter_ensures_history_includes_new_hard_restart_runs_without_overwriting_prior_entries` |
| Return actionable errors when state consistency cannot be guaranteed across query boundaries | `adapter_reports_actionable_errors_when_state_consistency_cannot_be_guaranteed` |
