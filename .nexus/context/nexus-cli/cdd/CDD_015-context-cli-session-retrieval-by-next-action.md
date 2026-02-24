---
context_id: CDD_015
title: Context CLI Session Retrieval by Next Action
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_015: Context CLI Session Retrieval by Next Action

## Desired Outcome

Operators can request session history metadata for a specific `Next Actions` task and receive associated provider, session id, run linkage, and attempt timeline in CLI output.

## Next Actions

| Description | Test |
|-------------|------|
| Add a command to retrieve sessions associated with a given context and task test id | `context_cli_returns_sessions_for_context_task_identifier` |
| Order returned sessions by execution time with attempt and run references | `context_cli_orders_task_sessions_by_execution_time` |
| Include provider id and provider session reference in session retrieval output | `context_cli_includes_provider_and_session_reference_fields` |
| Support provider filter for multi-agent session retrieval | `context_cli_supports_provider_filter_for_task_sessions` |
| Return actionable errors when no sessions exist for requested task | `context_cli_reports_actionable_no_sessions_found` |
