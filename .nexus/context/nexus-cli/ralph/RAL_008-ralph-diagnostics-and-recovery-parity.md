---
context_id: CLI_016
title: Ralph Diagnostics and Recovery Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# CLI_016: Ralph Diagnostics and Recovery Parity

## Desired Outcome

`opennexus ralph` provides the same operator diagnostics and recovery experience as the current Ralph CLI, including actionable error messages for missing binaries and model configuration failures, guidance for plugin misconfiguration, and resilient continuation behavior after recoverable iteration errors.

## Next Actions

| Description | Test |
|-------------|------|
| Report missing backend binaries with backend-specific and remediation-focused diagnostics | `ralph_reports_missing_agent_binary_with_remediation` |
| Report unknown flags and invalid option payloads with usage guidance | `ralph_reports_invalid_options_with_usage_hints` |
| Detect model resolution failures and print targeted remediation guidance per backend type | `ralph_detects_model_configuration_failures_with_guidance` |
| Detect legacy placeholder plugin output and instruct operators to remove plugin or rerun with plugin filtering | `ralph_detects_placeholder_plugin_error_and_guides_recovery` |
| Continue loop on non-zero agent exit codes while preserving iteration progress and state | `ralph_continues_after_nonzero_agent_exit_code` |
| Continue loop after unexpected iteration exceptions while recording a failed history entry | `ralph_records_and_continues_after_iteration_exception` |
| Preserve `--status` observability after recoverable failures with accurate history and struggle metrics | `ralph_status_reflects_recoverable_failure_history` |
| Exit fatal with active-state cleanup when unrecoverable top-level loop error occurs | `ralph_fatal_loop_error_cleans_state_and_exits_nonzero` |
