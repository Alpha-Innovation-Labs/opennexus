---
context_id: CWG_006
title: OpenCode Conversation Panel and Repository-Scoped Session Listing
project: cdd-web-ui
feature: graph
created: "2026-02-27"

depends_on:
  contexts:
    - id: CWG_004
      why: Graph layout and panel container behavior must be stable before adding side-panel conversation workflows.
---

# CWG_006: OpenCode Conversation Panel and Repository-Scoped Session Listing

## Desired Outcome

The graph view includes a right-side OpenCode conversation panel that lists repository-scoped sessions, supports new conversation creation and prompt/reply flow, and remains operator-resizable without breaking graph readability.

## Next Actions

| Description | Test |
|-------------|------|
| Render a right-side OpenCode conversation panel alongside the graph canvas in the flow UI | `graph_renders_right_side_opencode_conversation_panel` |
| List only OpenCode conversations for the current repository directory in the conversation selector | `graph_lists_repository_scoped_opencode_conversations_in_selector` |
| Create a new OpenCode conversation from the panel and surface it in the selector immediately | `graph_creates_new_opencode_conversation_and_updates_selector` |
| Load and display messages for the selected conversation from the selector | `graph_loads_selected_opencode_conversation_messages` |
| Send a prompt from the panel and render the assistant reply in the conversation thread | `graph_sends_prompt_and_renders_opencode_reply` |
| Show actionable panel errors when conversation listing or messaging APIs fail | `graph_surfaces_actionable_opencode_panel_errors` |
| Allow horizontal split resize so the conversation panel can expand to half the viewport width | `graph_allows_horizontal_split_resize_to_half_viewport_for_conversation_panel` |
