---
context_id: CDD_004
title: Context Coder and Validator Iteration Loop
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_003
      why: This dependency outcome is required before this context can proceed.
---

# CDD_004: Context Coder and Validator Iteration Loop

## Desired Outcome

`opennexus context implement --context-file <path>` runs an explicit iterative coding loop where the `coder` stage implements behavior toward generated tests and the `implementation_validator` stage verifies behavior against those tests, repeating until validation succeeds or loop stop conditions are reached.

## Next Actions

| Description | Test |
|-------------|------|
| Execute stages in explicit order with `coder` followed by `implementation_validator` within each iteration | `context_implement_runs_coder_then_validator_each_iteration` |
| Pass generated test targets and selected coding rule constraints into each coder invocation | `context_implement_passes_tests_and_rule_constraints_to_coder_stage` |
| Run validation after coding and continue iteration when validation reports unmet behavior | `context_implement_continues_loop_on_validation_failure` |
| Exit loop successfully when validation confirms all generated tests are satisfied | `context_implement_stops_loop_when_validation_succeeds` |
| Preserve clear stage boundaries so agent roles remain isolated and auditable | `context_implement_maintains_explicit_agent_stage_boundaries` |
