---
context_id: RAL_002
title: Ralph Loop State Lifecycle
project: nexus-cli
feature: ralph
created: "2026-02-23"

depends_on:
  contexts:
    - id: RAL_001
      why: This dependency outcome is required before this context can proceed.
---

# RAL_002: Ralph Loop State Lifecycle

## Desired Outcome

`opennexus ralph` persists and restores loop lifecycle state in `.ralph/` with behavior equivalent to the current Ralph CLI, including active-state resume semantics, graceful interrupt cleanup, and history retention rules across success, abort, and max-iteration termination paths.

## Next Actions

| Description | Test |
|-------------|------|
| Create `.ralph/ralph-loop.state.json` when a new loop starts with iteration metadata and selected runtime settings | `ralph_creates_state_file_on_loop_start` |
| Resume an active loop when no new prompt is provided and continue with the saved prompt and iteration counter | `ralph_resumes_active_loop_without_new_prompt` |
| Preserve and reload previous loop settings such as min/max iterations, promises, tasks mode, and rotation on resume | `ralph_resumes_with_prior_runtime_settings` |
| Clear active state on normal completion while preserving no stale active marker | `ralph_clears_state_after_successful_completion` |
| Clear active state on explicit abort signal and exit non-zero | `ralph_clears_state_on_abort_signal_exit` |
| Clear active state on SIGINT while stopping the active subprocess and exiting cleanly | `ralph_handles_sigint_with_subprocess_cleanup` |
| Stop at max iteration boundary, clear active state, and retain history for post-run inspection | `ralph_max_iteration_stop_keeps_history` |
| Keep context added mid-iteration available until consumed and clear only the context present at iteration start | `ralph_consumes_context_with_iteration_boundary_rules` |
