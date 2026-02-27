---
context_id: CWG_007
title: Shadcn Installation Baseline and Resize Hydration Guardrails
project: cdd-web-ui
feature: graph
created: "2026-02-27"

depends_on:
  contexts:
    - id: CWG_006
      why: Conversation panel and split-layout workflows must exist before hardening setup and hydration guardrails.
---

# CWG_007: Shadcn Installation Baseline and Resize Hydration Guardrails

## Desired Outcome

Graph workspace development starts from an official shadcn CLI installation baseline, and workspace chat-pane resize hydration avoids first-frame width jumps by reading stored size once on mount while showing a temporary loading skeleton until the value is ready.

## Next Actions

| Description | Test |
|-------------|------|
| Initialize the graph app with official shadcn CLI setup before adding UI primitives in new workspaces | `graph_bootstraps_shadcn_with_official_cli_before_component_additions` |
| Add required UI primitives through shadcn CLI commands instead of manual component recreation | `graph_installs_ui_primitives_via_shadcn_cli_add_commands` |
| Read persisted workspace chat width once at mount and apply it as initial panel size before interaction begins | `graph_reads_workspace_chat_width_once_on_mount_for_initial_layout` |
| Persist workspace chat width continuously during resize without coupling drag updates to reactive size-state rerenders | `graph_persists_workspace_chat_width_during_resize_without_state_churn` |
| Render a small skeleton card while workspace chat width is unresolved so users never see temporary fallback split values | `graph_shows_workspace_layout_skeleton_until_size_hydrates` |
