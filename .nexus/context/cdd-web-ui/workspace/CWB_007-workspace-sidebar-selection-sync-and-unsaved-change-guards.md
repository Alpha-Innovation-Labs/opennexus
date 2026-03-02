---
context_id: CWB_007
title: Workspace Sidebar Selection Sync and Unsaved Change Guards
project: cdd-web-ui
feature: workspace
created: "2026-02-24"

depends_on:
  contexts:
    - id: CWB_006
      why: This dependency outcome is required before this context can proceed.
---

# CWB_007: Workspace Sidebar Selection Sync and Unsaved Change Guards

## Desired Outcome

Workspace sidebar state, selected file routing, and unsaved-change guardrails stay synchronized so operators can navigate large context trees confidently without losing in-progress edits or ending in inconsistent view state.

## Reference

| Source | Path |
|--------|------|
| Promsight sidebar module | `/Users/alpha/workspace/alpha-innovation-labs/promsight/apps/web/src/features/context/components/context-sidebar-module.tsx` |
| Promsight workspace state sync behavior | `/Users/alpha/workspace/alpha-innovation-labs/promsight/apps/web/src/features/context/components/context-workspace.tsx` |

## Next Actions

| Description | Test |
|-------------|------|
| Sync selected file path between sidebar selection and route state | `workspace_syncs_selected_file_between_sidebar_and_route` |
| Preserve sidebar runtime indicators for modified, conflict, and read-only file states | `workspace_sidebar_shows_runtime_file_state_indicators` |
| Warn before navigation when unsaved changes are present and user attempts to switch files | `workspace_warns_before_switching_files_with_unsaved_changes` |
| Warn before leaving page when unsaved changes are present | `workspace_warns_before_page_leave_with_unsaved_changes` |
| Restore previous selected file after reload when route path is still valid | `workspace_restores_selected_file_after_reload_when_path_valid` |
| Show chat sessions in the left sidebar for `Chats` view and load the selected session transcript in the center panel | `workspace_chats_sidebar_selection_loads_center_transcript` |
| Keep chat rows within sidebar width and truncate long titles with a single-line ellipsis | `workspace_chats_sidebar_rows_truncate_titles_with_ellipsis` |
| Render long sidebar lists through a shadcn `ScrollArea` without horizontal bleed or clipped rows | `workspace_sidebar_uses_shadcn_scroll_area_for_long_lists` |
| Keep `Chats` sidebar selection on the same route and update center transcript without full page navigation | `workspace_chats_selection_updates_center_without_route_reload` |
| Keep chat session listing stable when selecting sidebar chats so selection does not refetch the session list | `workspace_chats_selection_does_not_refetch_sidebar_session_list` |
| Show pointer cursor affordance on hover for selectable chat rows in the sidebar | `workspace_chats_sidebar_rows_show_pointer_cursor_on_hover` |
| Highlight the right-clicked chat row so context menu actions clearly target the intended conversation | `workspace_chat_row_right_click_focus_state_is_visible` |
| Render chat sidebar row actions with non-nested interactive semantics so hydration-safe click and keyboard behavior is preserved | `workspace_chat_sidebar_rows_avoid_nested_interactive_hydration_errors` |
| Support shift-range multi-select deletion with confirmation while preserving independent single-row hover delete behavior | `workspace_chat_sidebar_supports_shift_range_multiselect_and_confirmed_bulk_delete` |
| Remove the top-navbar activity collapse control while preserving sidebar and chat-selection workflows | `workspace_top_nav_hides_activity_collapse_control_without_breaking_selection_flows` |
