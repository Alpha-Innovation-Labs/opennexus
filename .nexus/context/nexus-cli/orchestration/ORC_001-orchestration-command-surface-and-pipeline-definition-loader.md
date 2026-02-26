---
context_id: ORC_001
title: Orchestration Command Surface and Pipeline Definition Loader
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: CDD_007
      why: This dependency outcome is required before this context can proceed.
---

# ORC_001: Orchestration Command Surface and Pipeline Definition Loader

## Desired Outcome

`opennexus orchestration <pipeline-name> --context-file <path>` resolves pipeline definitions from local configuration files, validates required pipeline shape, and starts execution with actionable errors whenever pipeline selection or configuration validity cannot be established.

## Next Actions

| Description | Test |
|-------------|------|
| Resolve a pipeline definition by pipeline name from configured local search paths | `orchestration_resolves_pipeline_definition_by_name` |
| Accept both JSON and YAML pipeline definition formats | `orchestration_accepts_json_and_yaml_pipeline_definitions` |
| Reject malformed pipeline definitions with actionable validation guidance | `orchestration_rejects_malformed_pipeline_definitions_with_guidance` |
| Reject unknown pipeline names and return available pipeline candidates | `orchestration_reports_unknown_pipeline_name_with_candidates` |
| Emit startup summary with context id, pipeline name, and ordered step count | `orchestration_emits_startup_summary_with_context_pipeline_and_steps` |
