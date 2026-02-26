---
context_id: RAL_005
title: Ralph Promise and Iteration Control Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"

depends_on:
  contexts:
    - id: RAL_004
      why: This dependency outcome is required before this context can proceed.
---

# RAL_005: Ralph Promise and Iteration Control Parity

## Desired Outcome

`opennexus ralph` enforces completion, abort, task-promise, and iteration gating semantics equivalent to the current Ralph CLI so loop termination remains deterministic, robust against false positives, and compatible with existing prompt contracts.

## Next Actions

| Description | Test |
|-------------|------|
| Detect completion only for exact `<promise>...</promise>` tags matching configured completion text | `ralph_detects_exact_completion_promise_tag` |
| Ignore completion tags that appear in negated statements or quoted explanatory text | `ralph_rejects_negated_or_quoted_completion_mentions` |
| Detect configured abort promise and terminate the loop with non-zero exit and cleanup | `ralph_aborts_immediately_on_abort_promise_detection` |
| Detect task promise in tasks mode and continue to subsequent iteration without final completion | `ralph_advances_on_task_promise_without_full_completion` |
| Enforce `--min-iterations` by continuing even when completion is detected before the minimum threshold | `ralph_enforces_min_iteration_before_completion_exit` |
| Enforce `--max-iterations` by stopping before additional work once the configured limit is reached | `ralph_enforces_max_iteration_limit` |
| Reject invalid min/max combinations when minimum exceeds maximum | `ralph_rejects_invalid_min_max_combination` |
| Validate promise-related option arguments and reject missing values with usage guidance | `ralph_validates_promise_option_arguments` |
