---
context_id: ORC_004
title: Context Dependency Graph and Blocking Gate
project: nexus-cli
feature: orchestration
created: "2026-02-26"
depends_on:
  contexts:
    - ORC_003
---

# ORC_004: Context Dependency Graph and Blocking Gate

## Desired Outcome

Pipeline execution respects blocking dependencies declared in context frontmatter so runs are gated until required upstream projects or contexts are complete unless an explicit override is requested.

## Next Actions

| Description | Test |
|-------------|------|
| Parse context-level `depends_on` project and context references from frontmatter | `orchestration_parses_context_depends_on_references` |
| Block execution when required dependencies are unresolved or incomplete | `orchestration_blocks_execution_for_unresolved_or_incomplete_dependencies` |
| Report unmet dependency reasons with explicit dependency identifiers | `orchestration_reports_unmet_dependency_reasons_with_identifiers` |
| Allow dependency bypass only when explicit override input is provided | `orchestration_allows_dependency_bypass_only_with_explicit_override` |
| Return actionable errors for invalid or ambiguous dependency references | `orchestration_reports_actionable_invalid_or_ambiguous_dependency_references` |
