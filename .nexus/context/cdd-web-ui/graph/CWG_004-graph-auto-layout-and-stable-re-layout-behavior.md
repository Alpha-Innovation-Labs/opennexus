---
context_id: CWG_004
title: Graph Auto-Layout and Stable Re-Layout Behavior
project: cdd-web-ui
feature: graph
created: "2026-02-26"

depends_on:
  contexts:
    - id: CWG_003
      why: This dependency outcome is required before this context can proceed.
---

# CWG_004: Graph Auto-Layout and Stable Re-Layout Behavior

## Desired Outcome

The graph self-organizes project groups and context nodes into a readable layout and preserves stable positioning semantics when data refreshes so operators do not lose orientation.

## Next Actions

| Description | Test |
|-------------|------|
| Apply automatic layout to project groups and context nodes on initial graph load | `graph_applies_automatic_layout_on_initial_load` |
| Generate default group and node positions through a dedicated Dagre layout service called by graph composition | `graph_uses_dedicated_dagre_layout_service_for_default_positions` |
| Arrange project overview subflows in top-to-bottom order using Dagre so dependency flow reads vertically | `graph_project_overview_arranges_subflows_vertically_with_dagre` |
| Align project overview subflows that share the same Dagre rank to a common top origin so sibling cards start at the same vertical position | `graph_project_overview_aligns_same_rank_subflows_to_shared_top_origin` |
| Keep sibling context nodes spatially separated to reduce overlap and edge ambiguity | `graph_keeps_sibling_context_nodes_spatially_separated` |
| Allow layout spacing configuration to improve readability without breaking dependency ordering | `graph_supports_layout_spacing_tuning_for_readability` |
| Preserve deterministic layout behavior for unchanged graph inputs across refreshes | `graph_preserves_deterministic_layout_for_unchanged_inputs` |
| Recalculate layout when node or edge set changes after context updates | `graph_recalculates_layout_when_graph_structure_changes` |
| Block project-subflow drag collisions by reverting only the moved node to its last safe position | `graph_blocks_project_subflow_drag_collision_without_moving_siblings` |
| Reset a selected subflow to default dagre node placement and default subflow size while preserving current subflow canvas position | `graph_reset_restores_subflow_default_layout_and_size_without_position_rewind` |
| Trigger reset for the currently focused subflow via keyboard shortcut to speed operator recovery | `graph_triggers_focused_subflow_reset_via_shift_r_shortcut` |
| Persist viewport and edited node geometry in local storage and rehydrate state on reload without data loss | `graph_persists_and_rehydrates_viewport_and_node_geometry_from_local_storage` |
| Self-heal project shell dimensions on rehydrate so persisted undersized geometry cannot hide child nodes | `graph_self_heals_project_shell_size_on_rehydrate_to_preserve_child_visibility` |
| Skip persistence for fixed-layout non-draggable project overview child nodes so computed layout remains authoritative | `graph_skips_persisting_fixed_overview_child_node_geometry` |
| Preserve project overview card visibility and non-overlap after stale local-storage geometry injection | `graph_project_overview_preserves_card_visibility_after_stale_geometry_rehydrate` |
| Return actionable errors when layout generation cannot produce valid positions | `graph_reports_actionable_errors_when_layout_generation_fails` |
