---
context_id: CWG_002
title: Project Group Nodes and Context File Node Rendering
project: cdd-web-ui
feature: graph
created: "2026-02-26"

depends_on:
  contexts:
    - id: CWG_001
      why: This dependency outcome is required before this context can proceed.
---

# CWG_002: Project Group Nodes and Context File Node Rendering

## Desired Outcome

The graph view renders each project as a visual group container and renders only context files as graph nodes within those groups, matching repository project boundaries.

## Next Actions

| Description | Test |
|-------------|------|
| Render one group container per discovered project in the normalized graph model | `graph_renders_one_group_container_per_discovered_project` |
| Render one project overview subflow card per project in project mode | `graph_project_overview_renders_single_project_subflow_card_per_project` |
| Hide subproject child rows in project mode so only project-level nodes remain visible | `graph_project_overview_hides_subproject_child_rows` |
| Render one subproject row node per discovered feature inside each project shell in project mode | `graph_project_overview_renders_one_subproject_row_per_feature` |
| Display compact per-subproject icon stats for total contexts and adapter-authored contexts in project mode | `graph_project_overview_displays_total_and_adapter_context_counts_per_subproject` |
| Keep subproject row spacing visually balanced so top and bottom padding remain consistent across rows | `graph_project_overview_maintains_balanced_vertical_padding_for_subproject_rows` |
| Render context file nodes as children of the correct project group container | `graph_renders_context_nodes_under_their_project_group` |
| Exclude non-context entities from node rendering in the graph surface | `graph_excludes_non_context_entities_from_node_rendering` |
| Display context id and title in node labels for operator readability | `graph_displays_context_id_and_title_in_node_labels` |
| Render context cards using compact, consistent width constraints for dense graph readability | `graph_renders_context_cards_with_compact_consistent_width` |
| Size context card height from inferred title line count so single-line and two-line labels remain legible | `graph_sizes_context_card_height_from_inferred_title_line_count` |
| Remove non-essential node chips so context id and title remain the primary node label content | `graph_removes_nonessential_node_chips_from_context_card_labels` |
| Render subflow header as one-line project-and-feature label text for quick scanability | `graph_renders_subflow_header_as_single_line_project_feature_label` |
| Preserve deterministic node identity values across rerenders for stable interaction state | `graph_preserves_deterministic_node_identity_across_rerenders` |
