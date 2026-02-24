---
context_id: CDD_013
title: Context CLI Health and Drift Commands
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_013: Context CLI Health and Drift Commands

## Desired Outcome

CLI utilities report whether one context or all contexts require updates by surfacing dirty state and stale implementations in concise operator-facing commands.

## Next Actions

| Description | Test |
|-------------|------|
| Add a command that checks whether a single context requires implementation refresh | `context_cli_reports_single_context_dirty_or_clean_state` |
| Add a command that scans all contexts and reports aggregated dirty or clean status | `context_cli_reports_global_context_drift_summary` |
| Report last successful implementation version reference for each checked context | `context_cli_reports_last_successful_context_version_reference` |
| Return non-success exit when selected checks detect dirty contexts | `context_cli_returns_non_success_on_dirty_detection` |
| Return actionable errors when scan paths are unreadable or unsupported | `context_cli_reports_actionable_scan_errors` |
