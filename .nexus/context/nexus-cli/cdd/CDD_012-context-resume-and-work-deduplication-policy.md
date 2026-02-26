---
context_id: CDD_012
title: Context Resume and Work Deduplication Policy
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_011
      why: This dependency outcome is required before this context can proceed.
---

# CDD_012: Context Resume and Work Deduplication Policy

## Desired Outcome

`opennexus context implement` resumes deterministically from persisted state and avoids redoing unchanged work by recognizing equivalent inputs and previously completed or exhausted task outcomes.

## Next Actions

| Description | Test |
|-------------|------|
| Resume interrupted runs from persisted iteration and task state without restarting completed work | `context_resume_continues_from_persisted_progress` |
| Compute task work signatures from context fingerprint, selected rule, and relevant execution inputs | `context_resume_computes_stable_task_work_signatures` |
| Skip re-execution when task signature is unchanged and prior terminal state exists | `context_resume_skips_unchanged_terminal_tasks` |
| Re-queue tasks when signature changes after context or rule updates | `context_resume_requeues_tasks_when_signature_changes` |
| Return actionable errors when resume state is invalid or incompatible | `context_resume_reports_actionable_state_compatibility_errors` |
