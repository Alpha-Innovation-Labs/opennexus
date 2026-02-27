---
context_id: ORC_009
title: UI Run Timeline and Artifact Query Views
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_008
      why: This dependency outcome is required before this context can proceed.
---

# ORC_009: UI Run Timeline and Artifact Query Views

## Desired Outcome

Operators can inspect orchestration progress and outcomes in a UI through queryable run timelines, step attempts, traces, and artifact lineage without requiring direct database inspection.

## Next Actions

| Description | Test |
|-------------|------|
| Expose run timeline query returning ordered step attempts with start, end, and terminal reason fields | `orchestration_ui_query_exposes_ordered_run_timeline_with_terminal_reasons` |
| Expose step artifact query returning artifact identifiers, kinds, and source step references | `orchestration_ui_query_exposes_step_artifact_lineage` |
| Expose filtering by context id, pipeline name, and run id for timeline retrieval | `orchestration_ui_query_supports_context_pipeline_and_run_filters` |
| Expose associated LLM trace references for steps that generated traces | `orchestration_ui_query_exposes_associated_llm_trace_references` |
| Return actionable errors for unknown run ids or unsupported filter combinations | `orchestration_ui_query_reports_actionable_unknown_run_or_filter_errors` |
| Expose output readiness state for workflow invocations so clients can distinguish pending output from terminal failure | `orchestration_ui_query_exposes_output_readiness_for_running_workflows` |
| Expose per-step output payloads for one invocation so clients can render readable step result views | `orchestration_ui_query_exposes_human_readable_step_outputs_for_invocations` |
