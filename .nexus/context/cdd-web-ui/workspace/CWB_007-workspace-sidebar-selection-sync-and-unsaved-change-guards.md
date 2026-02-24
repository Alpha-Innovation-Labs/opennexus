---
context_id: CWB_007
title: Workspace Sidebar Selection Sync and Unsaved Change Guards
project: cdd-web-ui
feature: workspace
created: "2026-02-24"
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
