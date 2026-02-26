---
context_id: CDD_016
title: Context Retention Export and Maintenance
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_015
      why: This dependency outcome is required before this context can proceed.
---

# CDD_016: Context Retention Export and Maintenance

## Desired Outcome

CDD observability storage remains reliable and operable over time through retention controls, export utilities, and maintenance commands that preserve auditability while limiting storage growth.

## Next Actions

| Description | Test |
|-------------|------|
| Add retention policy controls for stale run events and task attempts beyond configurable thresholds | `context_retention_applies_configurable_cleanup_thresholds` |
| Add export command to emit run and task observability records for one context | `context_export_emits_context_observability_records` |
| Add export command to emit aggregated observability records across all contexts | `context_export_emits_global_observability_records` |
| Preserve referential integrity between runs, tasks, stages, and sessions during cleanup operations | `context_maintenance_preserves_observability_referential_integrity` |
| Return actionable errors when maintenance or export operations fail | `context_maintenance_reports_actionable_export_and_cleanup_errors` |
