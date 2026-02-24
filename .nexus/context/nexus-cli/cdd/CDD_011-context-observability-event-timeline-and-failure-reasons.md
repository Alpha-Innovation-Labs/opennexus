---
context_id: CDD_011
title: Context Observability Event Timeline and Failure Reasons
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_011: Context Observability Event Timeline and Failure Reasons

## Desired Outcome

Workflow execution emits a structured timeline of run, stage, and task events with explicit terminal failure reasons so operators can understand exactly where execution stopped and why.

## Next Actions

| Description | Test |
|-------------|------|
| Record structured stage start and completion events with timestamps and durations | `context_observability_records_stage_timeline_events` |
| Record task-level failure events with retry count and latest error summary | `context_observability_records_task_failure_events_with_retries` |
| Emit explicit terminal reason when run stops by success, timeout, max-iterations, or exhausted tasks | `context_observability_emits_explicit_terminal_reason` |
| Include actionable remediation hints in terminal failure output | `context_observability_includes_actionable_remediation_hints` |
| Return actionable errors when event persistence cannot be completed | `context_observability_reports_actionable_event_persistence_errors` |
