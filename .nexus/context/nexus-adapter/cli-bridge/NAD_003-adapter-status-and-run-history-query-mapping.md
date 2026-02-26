---
context_id: NAD_003
title: Adapter Status and Run History Query Mapping
project: nexus-adapter
feature: cli-bridge
created: "2026-02-26"
depends_on:
  contexts:
    - id: NAD_001
      why: This context requires NAD_001 to be complete before proceeding.
    - id: ORC_007
      why: This context requires ORC_007 to be complete before proceeding.
---

# NAD_003: Adapter Status and Run History Query Mapping

## Desired Outcome

The adapter provides typed query outputs for current status, active runs, run history, and timeline retrieval by mapping orchestration CLI JSON responses into UI-ready contracts.

## Next Actions

| Description | Test |
|-------------|------|
| Map status query to orchestration status command with JSON output mode | `adapter_maps_status_query_to_orchestration_status_json_mode` |
| Map active-run query to orchestration active command and return active run identifiers | `adapter_maps_active_query_to_orchestration_active_with_run_identifiers` |
| Map history query to orchestration runs command and preserve newest-first ordering | `adapter_maps_runs_query_and_preserves_newest_first_ordering` |
| Map timeline query to orchestration timeline command for context-level progression views | `adapter_maps_timeline_query_to_orchestration_timeline_command` |
| Return actionable errors when query payloads are missing required contract fields | `adapter_reports_actionable_errors_for_missing_required_query_fields` |
