---
context_id: ORC_006
title: Context Spec Drift Reconciliation
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_005
      why: This dependency outcome is required before this context can proceed.
---

# ORC_006: Context Spec Drift Reconciliation

## Desired Outcome

When context files change, orchestration detects Next Actions drift against prior executed snapshots and reconciles run state so added, removed, and modified actions are reflected consistently in lifecycle status.

## Next Actions

| Description | Test |
|-------------|------|
| Persist context revision snapshots with normalized Next Actions payloads | `orchestration_persists_context_revision_snapshots_with_normalized_next_actions` |
| Detect drift by comparing current context snapshot hash against latest successful snapshot | `orchestration_detects_context_drift_against_latest_successful_snapshot` |
| Mark previous completion state stale when snapshot changes | `orchestration_marks_previous_completion_state_stale_on_snapshot_change` |
| Reconcile added and removed Next Actions into pending and cancelled task states respectively | `orchestration_reconciles_added_and_removed_next_actions_into_lifecycle_states` |
| Return actionable errors when reconciliation cannot map changed actions deterministically | `orchestration_reports_actionable_reconciliation_mapping_errors` |
