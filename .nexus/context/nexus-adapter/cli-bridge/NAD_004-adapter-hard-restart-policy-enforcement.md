---
context_id: NAD_004
title: Adapter Hard Restart Policy Enforcement
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: NAD_002
      why: This context requires NAD_002 to be complete before proceeding.
    - id: ORC_005
      why: This context requires ORC_005 to be complete before proceeding.
---

# NAD_004: Adapter Hard Restart Policy Enforcement

## Desired Outcome

Restart behavior is enforced as hard restart only so adapter-initiated restarts always terminate active execution first and then launch a fresh overwrite run without resume semantics.

## Next Actions

| Description | Test |
|-------------|------|
| Apply hard restart sequence by stopping active run before issuing restart | `adapter_applies_hard_restart_sequence_by_stopping_before_restart` |
| Ensure restarted execution is launched as fresh run with overwrite semantics | `adapter_ensures_restart_launches_fresh_run_with_overwrite_semantics` |
| Reject resume-checkpoint behaviors for restart actions in current policy mode | `adapter_rejects_resume_checkpoint_behavior_for_restart_actions` |
| Persist restart action metadata indicating hard restart path selection | `adapter_persists_restart_action_metadata_for_hard_restart_path` |
| Return actionable errors when restart cannot satisfy hard restart guarantees | `adapter_reports_actionable_errors_when_hard_restart_guarantees_fail` |
