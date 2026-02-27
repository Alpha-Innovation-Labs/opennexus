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
| Stream assistant reply text into the active conversation thread in real time without requiring page reload | `graph_streams_opencode_reply_without_reload` |
| Render streamed assistant replies when SSE frames use either LF or CRLF delimiters | `graph_parses_lf_and_crlf_sse_frames_for_opencode_reply` |
| Render assistant tool call entries with OpenCode-aligned state labels (`pending`, `running`, `completed`, `error`) and tool identity | `graph_renders_opencode_tool_calls_with_state_labels` |
| Update assistant tool call entries in place as stream events advance tool state during one reply | `graph_updates_tool_call_state_during_streaming_reply` |
| Load tool call traces when reopening an existing conversation from the selector history | `graph_loads_tool_call_traces_from_conversation_history` |
| Open a new-chat modal with the same conversation UI when the operator presses Ctrl/Cmd+N | `graph_opencode_shortcut_opens_new_chat_modal` |
| Open a parallel dual-chat modal with two side-by-side conversations when the operator presses Ctrl/Cmd+A | `graph_opencode_shortcut_opens_parallel_dual_chat_modal` |
| Send one prompt from the parallel modal composer to both conversations and render replies in each lane | `graph_parallel_modal_broadcasts_prompt_to_both_chats` |
| Recover assistant text from latest conversation history when streaming completes without delta events | `graph_parallel_modal_recovers_reply_when_stream_has_no_deltas` |
| Display server-assigned conversation titles in parallel chat lanes without forcing custom names | `graph_parallel_modal_uses_server_assigned_conversation_titles` |
| Fork the active conversation with Ctrl/Cmd+S and open a forked-lane modal that preserves parent-child lineage metadata | `graph_opencode_shortcut_forks_active_conversation_with_lineage` |
| Render a Fork action button next to Send in the composer so operators can fork when keyboard shortcuts are intercepted | `graph_opencode_panel_renders_fork_button_next_to_send` |
| Allow each forked chat lane to send independent prompts with lane-local composer and send controls | `graph_fork_modal_allows_independent_lane_composers` |
| Fork from a selected user message inside a lane to create a new descendant branch from that message point | `graph_fork_modal_forks_from_selected_user_message` |
| Highlight the fork-origin message in branched lanes with distinct visual treatment for branch readability | `graph_fork_modal_highlights_fork_origin_message` |
| Open a fork graph from the panel header and show a no-forks empty state when no linked branches exist | `graph_opencode_forks_button_opens_fork_graph_with_empty_state` |
| Render a Forks tab that visualizes root-to-fork lineage with conversation nodes and curved branch connections | `graph_renders_forks_tab_with_lineage_nodes_and_edges` |
| Display diff-style fork-origin snippets that highlight source messages and mute skipped context around branch points | `graph_displays_diff_style_fork_origin_snippets` |
| Render visible fork-origin bullets on highlighted root transcript user lines at the node border | `graph_renders_fork_origin_bullets_on_root_transcript_border` |
| Route each fork edge from its matched root bullet without misleading shared-trunk edge artifacts | `graph_routes_fork_edges_from_matched_bullets_without_shared_trunk_artifacts` |
| Order fork nodes by matched root message order so earlier-origin forks appear above later-origin forks | `graph_orders_fork_nodes_by_root_message_origin_sequence` |
| Show only user messages in the Forks root transcript because branch origins are user turns | `graph_forks_transcript_shows_user_messages_only` |
| Allow dragging fork nodes while preserving canvas panning interactions in Forks view | `graph_allows_fork_node_drag_without_disabling_canvas_pan` |
| Surface an actionable forks error when OpenCode backend is unreachable or not serving session APIs | `graph_surfaces_opencode_unreachable_error_for_forks_listing` |
| Open fork conversation history in a chat modal when the operator double-clicks a fork conversation node | `graph_opens_fork_conversation_modal_on_node_double_click` |
| Toggle graph theme from the top-right navbar icon and persist the selected theme mode across refresh | `graph_theme_toggle_persists_across_refresh_from_navbar` |
| Render a non-dark canvas background in light mode for both Context and Forks graph views | `graph_uses_light_canvas_background_in_light_mode` |
| Switch between Context and Forks tabs without remounting graph canvases so view state is preserved | `graph_tabs_switch_without_remounting_react_flow_instances` |
| Render a Testing tab with a two-pane shadcn Resizable layout where graph is left and chat is right | `graph_testing_tab_renders_two_pane_shadcn_resizable_layout` |
| Collapse and expand the testing chat pane without changing non-testing workspace pane behavior | `graph_testing_tab_chat_pane_collapses_independently` |
| Restore persisted testing chat width from storage only at mount-time and avoid resize-state churn during drag | `graph_testing_tab_restores_size_from_mount_only_read` |
| Show a small skeleton card while persisted testing chat width is loading before first panel render | `graph_testing_tab_shows_skeleton_card_while_loading_size_state` |
| Keep the right chat sidebar mounted in a fixed shell position while center content changes between workspace views | `graph_keeps_right_chat_sidebar_persistent_across_view_switches` |
| Restore previously saved chat width from local storage when expanding a collapsed chat sidebar | `graph_restores_chat_width_from_storage_on_expand` |
| Persist workspace chat width during drag without feeding resize events back into reactive size state | `graph_persists_chat_width_during_resize_without_drag_feedback_churn` |
| Validate real OpenCode streaming behavior end-to-end with no request mocking in Playwright | `graph_validates_real_opencode_streaming_e2e` |
| Show actionable panel errors when conversation listing or messaging APIs fail | `graph_surfaces_actionable_opencode_panel_errors` |
| Allow horizontal split resize so the conversation panel can expand to half the viewport width | `graph_allows_horizontal_split_resize_to_half_viewport_for_conversation_panel` |
