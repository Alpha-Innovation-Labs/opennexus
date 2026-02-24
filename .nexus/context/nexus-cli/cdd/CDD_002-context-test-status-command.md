---
context_id: CDD_002
title: Context Test Status Command
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_002: Context Test Status Command

## Desired Outcome

`opennexus context test-status --context-file <path>` reports which tests derived from the context `Next Actions` table are currently implemented and discoverable, clearly distinguishes missing versus discovered tests, and explicitly warns that discoverability does not guarantee behavioral correctness.

## Next Actions

| Description | Test |
|-------------|------|
| Parse `Next Actions` test identifiers from the supplied context file and list each identifier in command output | `context_test_status_lists_tests_from_next_actions` |
| Report implemented status using test existence and test-discovery checks against repository test tooling | `context_test_status_reports_discoverability_per_test` |
| Print an explicit warning that existence/discovery does not prove correctness | `context_test_status_warns_discovery_not_correctness` |
| Return actionable errors when context file path is missing, unreadable, or structurally invalid | `context_test_status_handles_invalid_context_inputs` |
| Support configurable command naming with a default command id and alias-compatible resolution | `context_test_status_supports_configurable_command_name` |
