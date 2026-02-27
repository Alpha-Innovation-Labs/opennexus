---
context_id: CWG_003
title: Dependency Edge Mapping and Cross-Project Linking
project: cdd-web-ui
feature: graph
created: "2026-02-26"

depends_on:
  contexts:
    - id: CWG_002
      why: This dependency outcome is required before this context can proceed.
---

# CWG_003: Dependency Edge Mapping and Cross-Project Linking

## Desired Outcome

The graph visualizes directed dependency edges between context nodes using `depends_on` metadata, including cross-project dependencies, so blocking relationships are visible at a glance.

## Next Actions

| Description | Test |
|-------------|------|
| Resolve `depends_on.contexts` references to canonical source and target context nodes | `graph_resolves_depends_on_context_references_to_node_links` |
| Render directed edges from dependent context node to prerequisite context node | `graph_renders_directed_edges_for_blocking_context_dependencies` |
| Render cross-project dependency edges without collapsing project group boundaries | `graph_renders_cross_project_dependency_edges_across_group_boundaries` |
| Render project-to-project dependency edges in project overview mode from aggregated cross-project context links | `graph_project_overview_renders_project_to_project_dependency_edges` |
| Aggregate project overview links using prerequisite-to-dependent direction from context dependency edges | `graph_project_overview_aggregates_project_edges_from_prerequisite_to_dependent_direction` |
| Render project overview dependency links with one consistent visual edge color across all project pairs | `graph_project_overview_renders_dependency_edges_with_single_consistent_color` |
| Mark unresolved dependency references with explicit warning metadata in graph state | `graph_marks_unresolved_dependency_references_with_warning_metadata` |
| Return actionable errors when dependency parsing or edge construction fails | `graph_reports_actionable_errors_for_dependency_parsing_or_edge_construction_failures` |
