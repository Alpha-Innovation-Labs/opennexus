---
context_id: NAD_001
title: Adapter CLI Command Execution Surface
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: ORC_001
      why: This context requires ORC_001 to be complete before proceeding.
---

# NAD_001: Adapter CLI Command Execution Surface

## Desired Outcome

The adapter exposes a stable execution surface that maps UI intents to orchestration CLI invocations with validated arguments, deterministic command construction, and typed action responses.

## Next Actions

| Description | Test |
|-------------|------|
| Map pipeline start intent to orchestration run command with context file targeting | `adapter_maps_start_intent_to_orchestration_run_command` |
| Validate required start inputs before command execution | `adapter_validates_required_start_inputs_before_execution` |
| Support optional command arguments for pipeline file and policy flags | `adapter_supports_optional_pipeline_file_and_policy_flags` |
| Return typed action response containing context, pipeline, and command result metadata | `adapter_returns_typed_action_response_with_command_result_metadata` |
| Return actionable errors when command invocation cannot be started | `adapter_reports_actionable_errors_when_command_invocation_fails` |
