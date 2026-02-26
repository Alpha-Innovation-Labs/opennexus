---
context_id: CWG_005
title: Context Node Detail Modal and Content Preview
project: cdd-web-ui
feature: graph
created: "2026-02-26"

depends_on:
  contexts:
    - id: CWG_004
      why: This dependency outcome is required before this context can proceed.
---

# CWG_005: Context Node Detail Modal and Content Preview

## Desired Outcome

Selecting a context node opens a modal that displays the selected context content and metadata so operators can inspect context details without leaving the graph.

## Next Actions

| Description | Test |
|-------------|------|
| Open a context detail modal when an operator clicks a context node | `graph_opens_context_detail_modal_on_context_node_click` |
| Open a context detail modal when an operator double-clicks a selected context node | `graph_opens_context_detail_modal_on_context_node_double_click` |
| Open a context detail modal when Enter is pressed in Select mode for the focused context node | `graph_opens_context_detail_modal_on_enter_in_select_mode` |
| Keep Enter from opening context details while Move or Resize mode is active | `graph_does_not_open_context_detail_modal_on_enter_in_edit_modes` |
| Reset interaction mode to Select and clear active node selection when Escape is pressed | `graph_escape_resets_mode_and_clears_active_node_selection` |
| Load and render selected context markdown content in the modal body | `graph_loads_and_renders_selected_context_markdown_content_in_modal` |
| Display key context metadata including context id, project, and feature in the modal header | `graph_displays_context_metadata_in_modal_header` |
| Render context detail modal at wide viewport proportions while preserving tall reading height | `graph_renders_context_detail_modal_with_wide_and_tall_viewport_proportions` |
| Close modal and clear selected node state through explicit close actions | `graph_closes_modal_and_clears_selected_node_state` |
| Return actionable errors when selected context content cannot be read | `graph_reports_actionable_errors_when_selected_context_content_is_unreadable` |
