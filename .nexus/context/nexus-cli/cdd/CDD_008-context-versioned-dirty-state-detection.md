---
context_id: CDD_008
title: Context Versioned Dirty State Detection
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_007
      why: This dependency outcome is required before this context can proceed.
---

# CDD_008: Context Versioned Dirty State Detection

## Desired Outcome

`opennexus context` detects when an implementation is stale by comparing the current context file version fingerprint against the version executed in previous runs, and marks status as dirty when the context changes after implementation.

## Next Actions

| Description | Test |
|-------------|------|
| Capture context file fingerprint and execution timestamp at run start | `context_run_captures_context_fingerprint_and_execution_timestamp` |
| Compare current context fingerprint against latest successful execution fingerprint | `context_run_detects_changed_context_against_latest_success` |
| Mark context implementation state as dirty when fingerprints differ | `context_run_marks_implementation_dirty_on_context_change` |
| Report clean state when context fingerprint matches latest successful run | `context_run_reports_clean_state_when_context_unchanged` |
| Return actionable errors when fingerprint generation cannot read context file | `context_run_reports_actionable_fingerprint_generation_errors` |
