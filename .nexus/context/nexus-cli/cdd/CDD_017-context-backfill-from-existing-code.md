---
context_id: CDD_017
title: Context Backfill from Existing Code
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_017: Context Backfill from Existing Code

## Desired Outcome

`opennexus context backfill --context-file <path>` reconstructs context task state in SQLite from already-implemented code by verifying required tests exist, executing them, and persisting per-task status without running coding-agent loops.

## Next Actions

| Description | Test |
|-------------|------|
| Parse `Next Actions` test identifiers from the provided context file and create backfill task targets | `context_backfill_extracts_task_targets_from_next_actions` |
| Verify required tests are discoverable before execution and mark missing tests explicitly | `context_backfill_marks_missing_tests_when_not_discoverable` |
| Execute discoverable tests and classify each task as implemented or failed from test outcomes | `context_backfill_classifies_task_state_from_test_results` |
| Persist backfill results into SQLite using a distinct run mode for auditability | `context_backfill_persists_results_with_backfill_run_mode` |
| Return actionable errors when discovery or execution cannot be completed | `context_backfill_reports_actionable_discovery_or_execution_errors` |
