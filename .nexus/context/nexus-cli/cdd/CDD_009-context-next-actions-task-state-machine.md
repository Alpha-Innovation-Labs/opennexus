---
context_id: CDD_009
title: Context Next Actions Task State Machine
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_009: Context Next Actions Task State Machine

## Desired Outcome

Each `Next Actions` row is tracked as a first-class task with explicit lifecycle states and retry accounting so operators can see whether each task is pending, in progress, implemented, failed, or exhausted.

## Next Actions

| Description | Test |
|-------------|------|
| Create task records from extracted `Next Actions` test identifiers at run initialization | `context_tasks_created_from_next_actions_identifiers` |
| Track task lifecycle transitions across pending, in_progress, implemented, failed, and exhausted states | `context_tasks_track_lifecycle_state_transitions` |
| Increment and persist retry counters per task after failed validation attempts | `context_tasks_increment_retry_counters_per_failed_attempt` |
| Mark tasks as exhausted when retry limits are reached | `context_tasks_mark_exhausted_when_retry_limit_reached` |
| Return actionable errors when invalid state transitions are requested | `context_tasks_reject_invalid_state_transitions_with_guidance` |
