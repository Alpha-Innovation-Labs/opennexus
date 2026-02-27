---
context_id: CWG_001
title: Graph Context Source Discovery and Normalized View Model
project: cdd-web-ui
feature: graph
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_004
      why: This dependency outcome is required before this context can proceed.
---

# CWG_001: Graph Context Source Discovery and Normalized View Model

## Desired Outcome

The graph feature builds a normalized view model from repository context files so project groups, context nodes, and dependency references can be rendered consistently in one graph surface.

## Next Actions

| Description | Test |
|-------------|------|
| Discover valid context files under `.nexus/context/` and exclude non-context markdown | `graph_discovers_valid_context_files_under_context_root` |
| Exclude project and feature `index.md` files from graph node source discovery | `graph_excludes_project_and_feature_index_files_from_graph_nodes` |
| Scope graph discovery to the configured project subset without reading unrelated projects | `graph_scopes_context_discovery_to_configured_project_subset` |
| Parse required frontmatter fields needed for graph identity and grouping | `graph_parses_required_frontmatter_for_identity_and_grouping` |
| Derive subproject display labels from feature `index.md` title metadata with feature-slug fallback when metadata is missing | `graph_derives_subproject_row_labels_from_feature_index_title_metadata` |
| Normalize context identity into stable keys for node and edge references | `graph_normalizes_context_identity_into_stable_node_keys` |
| Derive adapter-authored context metadata from normalized context identifiers and supported frontmatter markers for project overview aggregation | `graph_derives_adapter_authored_context_metadata_for_overview_aggregation` |
| Preserve unique node ids when duplicate context ids exist by deriving deterministic fallback identity | `graph_preserves_unique_node_ids_for_duplicate_context_ids` |
| Build a project-grouped in-memory model containing context node metadata | `graph_builds_project_grouped_view_model_for_context_nodes` |
| Return actionable errors when source context files are unreadable or malformed | `graph_reports_actionable_errors_for_unreadable_or_malformed_context_files` |
