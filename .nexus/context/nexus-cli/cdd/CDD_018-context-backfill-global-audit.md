---
context_id: CDD_018
title: Context Backfill Global Audit
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_018: Context Backfill Global Audit

## Desired Outcome

`opennexus context backfill --all` performs repository-wide reconciliation by scanning contexts, backfilling each context against existing tests, and producing an aggregate audit summary of implemented, failed, and missing task states.

## Next Actions

| Description | Test |
|-------------|------|
| Discover context files under `.nexus/context/` and include only valid context specs in audit scope | `context_backfill_all_scans_and_filters_valid_context_specs` |
| Run backfill checks for each scoped context and persist per-context results | `context_backfill_all_persists_per_context_results` |
| Produce aggregate summary counts for implemented, failed, and missing tasks across all contexts | `context_backfill_all_reports_aggregate_task_state_counts` |
| Return non-success status when any context has failed or missing tasks | `context_backfill_all_returns_non_success_on_incomplete_states` |
| Return actionable errors when one or more contexts cannot be parsed or executed during audit | `context_backfill_all_reports_actionable_partial_audit_errors` |
