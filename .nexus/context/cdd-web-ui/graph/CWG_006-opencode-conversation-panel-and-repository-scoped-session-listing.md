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
| Validate real OpenCode streaming behavior end-to-end with no request mocking in Playwright | `graph_validates_real_opencode_streaming_e2e` |
| Show actionable panel errors when conversation listing or messaging APIs fail | `graph_surfaces_actionable_opencode_panel_errors` |
| Allow horizontal split resize so the conversation panel can expand to half the viewport width | `graph_allows_horizontal_split_resize_to_half_viewport_for_conversation_panel` |
