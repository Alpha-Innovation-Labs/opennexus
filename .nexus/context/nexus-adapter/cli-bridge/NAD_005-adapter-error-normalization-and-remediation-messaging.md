---
context_id: NAD_005
title: Adapter Error Normalization and Remediation Messaging
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: NAD_002
      why: This context requires NAD_002 to be complete before proceeding.
    - id: NAD_003
      why: This context requires NAD_003 to be complete before proceeding.
---

# NAD_005: Adapter Error Normalization and Remediation Messaging

## Desired Outcome

Adapter failures are normalized into consistent error categories with actionable remediation hints so UI workflows can present operator-friendly guidance without exposing raw command noise.

## Next Actions

| Description | Test |
|-------------|------|
| Normalize command execution failures into stable adapter error categories | `adapter_normalizes_command_execution_failures_into_stable_categories` |
| Preserve source command context and identifiers in normalized error payloads | `adapter_preserves_source_command_context_in_normalized_error_payloads` |
| Attach remediation hints for known failure classes such as missing binary and invalid context path | `adapter_attaches_remediation_hints_for_known_failure_classes` |
| Distinguish transient command failures from contract-shape parsing failures | `adapter_distinguishes_transient_failures_from_contract_parsing_failures` |
| Return actionable fallback errors when failure class cannot be inferred | `adapter_returns_actionable_fallback_errors_when_failure_class_is_unknown` |
