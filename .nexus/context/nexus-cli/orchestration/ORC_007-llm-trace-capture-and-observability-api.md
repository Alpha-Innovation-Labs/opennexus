---
context_id: ORC_007
title: LLM Trace Capture and Observability API
project: nexus-cli
feature: orchestration
created: "2026-02-26"
depends_on:
  contexts:
    - ORC_003
---

# ORC_007: LLM Trace Capture and Observability API

## Desired Outcome

LLM-backed steps emit structured prompt and response traces with execution metadata that are persisted and retrievable through stable query interfaces for downstream pipeline steps and UI consumers.

## Next Actions

| Description | Test |
|-------------|------|
| Capture prompt payload, response payload, and model metadata for each LLM-backed step attempt | `orchestration_captures_prompt_response_and_model_metadata_per_llm_step_attempt` |
| Persist token usage, latency, and terminal status metadata with each trace record | `orchestration_persists_token_latency_and_terminal_status_per_trace_record` |
| Link trace records to run, step, and artifact identifiers for drilldown navigation | `orchestration_links_trace_records_to_run_step_and_artifact_identifiers` |
| Expose trace query interface that returns structured records without parsing terminal logs | `orchestration_exposes_structured_trace_query_interface` |
| Return actionable errors when trace persistence or retrieval fails | `orchestration_reports_actionable_trace_persistence_or_retrieval_errors` |
