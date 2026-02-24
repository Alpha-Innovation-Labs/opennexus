---
context_id: CDD_005
title: Context Stage Logging and Fail-Fast Errors
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_005: Context Stage Logging and Fail-Fast Errors

## Desired Outcome

`opennexus context implement --context-file <path>` emits clear stage-level logs for every loop stage and exits early with actionable diagnostics whenever context parsing, test generation, rule selection, agent execution, or implementation validation fails.

## Next Actions

| Description | Test |
|-------------|------|
| Log stage start and stage result for `context_loader`, `test_generator`, `test_verifier`, `coder`, and `implementation_validator` | `context_implement_logs_each_stage_start_and_result` |
| Include iteration index and selected context path in stage-level orchestration logs | `context_implement_logs_iteration_and_context_metadata` |
| Fail fast when context parse fails and print corrective guidance for malformed files | `context_implement_fails_fast_with_actionable_context_parse_error` |
| Fail fast when rule selection fails and print discovered candidates with next-step guidance | `context_implement_fails_fast_with_actionable_rule_selection_error` |
| Fail fast when agent execution or validation fails and report stage-specific remediation hints | `context_implement_fails_fast_with_actionable_agent_or_validation_error` |
