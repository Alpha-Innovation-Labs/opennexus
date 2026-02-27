---
context_id: CWG_007
title: Workflow Invocation Sidebar and Step Detail Observability
project: cdd-web-ui
feature: graph
created: "2026-02-27"

depends_on:
  contexts:
    - id: ORC_009
      why: Workflow timeline and step output queries must exist before graph UI observability can render invocation details.
    - id: CWG_006
      why: Graph shell navigation and panel layout behavior must be stable before adding workflows observability view.
---

# CWG_007: Workflow Invocation Sidebar and Step Detail Observability

## Desired Outcome

The flow UI provides a Workflows view where operators can select one invocation from the left sidebar and inspect readable workflow status, step-by-step outputs, and invocation details in the main panel without relying on raw JSON dumps.

## Next Actions

| Description | Test |
|-------------|------|
| Render workflow invocation entries in the left sidebar when Workflows view is active | `graph_workflows_view_renders_invocations_in_left_sidebar` |
| Select the first available invocation by default and keep sidebar selection highlighted | `graph_workflows_view_selects_and_highlights_default_invocation` |
| Update main panel details when operator selects a different invocation in the sidebar | `graph_workflows_view_updates_main_details_on_sidebar_selection` |
| Render top-level invocation status and workflow metadata in human-readable cards | `graph_workflows_view_renders_human_readable_invocation_metadata` |
| Render each workflow step output in labeled sections instead of raw JSON-only output | `graph_workflows_view_renders_labeled_step_outputs` |
| Show loading skeletons while invocation list and details are being fetched | `graph_workflows_view_shows_skeletons_during_invocation_loading` |
| Show actionable empty and error states when invocation data is unavailable | `graph_workflows_view_shows_actionable_empty_and_error_states` |
