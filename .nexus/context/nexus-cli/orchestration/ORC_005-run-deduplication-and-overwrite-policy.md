---
context_id: ORC_005
title: Run Deduplication and Overwrite Policy
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_004
      why: This dependency outcome is required before this context can proceed.
---

# ORC_005: Run Deduplication and Overwrite Policy

## Desired Outcome

Orchestration avoids duplicate work by recognizing equivalent already-completed runs for the same pipeline and context snapshot while allowing explicit overwrite requests to create a new superseding run.

## Next Actions

| Description | Test |
|-------------|------|
| Compute stable run fingerprints from pipeline definition, context snapshot, and execution inputs | `orchestration_computes_stable_run_fingerprints_from_pipeline_context_and_inputs` |
| Skip execution when an equivalent successful run already exists | `orchestration_skips_execution_for_equivalent_successful_run` |
| Report prior completed run details when execution is skipped by deduplication | `orchestration_reports_prior_completed_run_details_on_dedup_skip` |
| Start a new run when explicit overwrite is requested | `orchestration_starts_new_run_when_explicit_overwrite_requested` |
| Persist overwrite lineage linking superseded and replacement runs | `orchestration_persists_overwrite_lineage_between_related_runs` |
