---
context_id: CWB_004
title: Workspace Context File Tree and Center Markdown View
project: cdd-web-ui
feature: workspace
created: "2026-02-24"
---

# CWB_004: Workspace Context File Tree and Center Markdown View

## Desired Outcome

The workspace presents a collapsible left sidebar with context files organized as a file-tree hierarchy and a center panel that displays the selected markdown context file with reliable loading, empty-state handling, and clear file-selection feedback.

## Reference

| Source | Path |
|--------|------|
| Promsight context workspace shell | `/Users/alpha/workspace/alpha-innovation-labs/promsight/apps/web/src/features/context/components/context-workspace.tsx` |
| Promsight context sidebar module | `/Users/alpha/workspace/alpha-innovation-labs/promsight/apps/web/src/features/context/components/context-sidebar-module.tsx` |
| Promsight context file listing API | `/Users/alpha/workspace/alpha-innovation-labs/promsight/apps/web/src/app/api/context/files/route.ts` |

## Next Actions

| Description | Test |
|-------------|------|
| Show a collapsible left sidebar that can expand and collapse without losing selected file context | `workspace_sidebar_collapses_and_preserves_selected_file` |
| Render context files as a hierarchical file tree grouped by project and feature paths | `workspace_renders_context_files_as_project_feature_tree` |
| Select a file-tree node and load the corresponding markdown file in the center panel | `workspace_selects_tree_node_and_loads_markdown_in_center_panel` |
| Display clear loading and empty states when no file is selected or file content is unavailable | `workspace_shows_loading_and_empty_states_for_center_markdown_panel` |
| Preserve selected file path in route or state so refresh restores the same file view | `workspace_restores_selected_file_view_after_refresh` |
