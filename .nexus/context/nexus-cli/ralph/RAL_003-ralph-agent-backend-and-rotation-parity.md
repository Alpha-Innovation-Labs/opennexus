---
context_id: RAL_003
title: Ralph Agent Backend and Rotation Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# RAL_003: Ralph Agent Backend and Rotation Parity

## Desired Outcome

`opennexus ralph` supports the same backend matrix and per-iteration rotation behavior as the current Ralph CLI, with compatible argument mapping, binary override handling, plugin filtering behavior, and deterministic rotation advancement across resumed runs.

## Next Actions

| Description | Test |
|-------------|------|
| Validate backend availability for `opencode`, `claude-code`, `codex`, and `copilot` with clear error output when missing | `ralph_validates_supported_agent_binaries` |
| Build backend-specific invocation arguments for prompt, model, permission mode, streaming mode, and forwarded flags | `ralph_maps_shared_flags_to_backend_specific_args` |
| Apply backend environment overrides for binary path selection through `RALPH_*_BINARY` variables | `ralph_honors_agent_binary_environment_overrides` |
| Generate filtered OpenCode config when `--no-plugins` is enabled and keep only auth-related plugins | `ralph_filters_opencode_plugins_when_requested` |
| Parse `--rotation` as comma-separated `agent:model` entries and reject malformed values with actionable diagnostics | `ralph_parses_rotation_entries_and_rejects_invalid_shapes` |
| Ignore static `--agent` and `--model` selection when rotation is active and run the correct rotation entry each iteration | `ralph_rotation_overrides_static_agent_selection` |
| Advance and persist rotation index after every iteration, including error iterations, and continue correctly after resume | `ralph_persists_rotation_position_across_resume` |
| Warn when plugin-related flags are used with backends where the behavior does not apply | `ralph_warns_for_non_applicable_plugin_flags` |
