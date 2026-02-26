---
context_id: NAD_002
title: Adapter Active Run Control Stop and Restart
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: NAD_001
      why: This context requires NAD_001 to be complete before proceeding.
    - id: ORC_004
      why: This context requires ORC_004 to be complete before proceeding.
---

# NAD_002: Adapter Active Run Control Stop and Restart

## Desired Outcome

The adapter can control active orchestration execution for one context by exposing stop and restart actions that align with the documented orchestration command surface.

## Next Actions

| Description | Test |
|-------------|------|
| Map stop action to orchestration stop command scoped by context file | `adapter_maps_stop_action_to_orchestration_stop_command_by_context` |
| Support optional pipeline filter for stop action targeting | `adapter_supports_optional_pipeline_filter_for_stop_action` |
| Map restart action to orchestration restart command for selected pipeline and context | `adapter_maps_restart_action_to_orchestration_restart_command` |
| Return explicit action payload for stop and restart outcomes | `adapter_returns_explicit_action_payload_for_stop_and_restart_outcomes` |
| Return actionable errors when stop or restart cannot be applied to current context state | `adapter_reports_actionable_errors_for_invalid_stop_or_restart_state` |
