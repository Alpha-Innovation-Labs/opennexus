---
context_id: CWG_009
title: Reusable LLM Conversation Feature for Panel Modal and Preview
project: cdd-web-ui
feature: graph
created: "2026-02-27"
depends_on:
  contexts:
    - id: CWG_006
      why: Reuses the OpenCode conversation UX contracts and extends them into shared feature architecture.
---

# CWG_009: Reusable LLM Conversation Feature for Panel Modal and Preview

## Desired Outcome

The flow UI provides one reusable `llm-conversation` feature that encapsulates conversation fetch, send, streaming updates, and tool-call state so chat-capable surfaces (panel, modal lanes, and transcript previews) consume the same contract and stay behaviorally consistent.

## Next Actions

| Description | Test |
|-------------|------|
| Load conversation lists through one shared LLM conversation client used by panel and workspace chat selectors | `graph_uses_shared_llm_client_for_conversation_listing` |
| Load conversation message history through one shared LLM conversation feature contract across panel and preview surfaces | `graph_uses_shared_llm_feature_for_message_history_loading` |
| Send prompts and stream assistant deltas/tool updates from one shared LLM conversation feature used by panel and modal lanes | `graph_uses_shared_llm_feature_for_send_and_stream_updates` |
| Keep chat rendering behavior consistent across panel and modal lanes when the same conversation content is replayed | `graph_keeps_panel_and_modal_chat_behavior_consistent_via_shared_feature` |
| Surface actionable errors from shared LLM conversation operations without duplicating transport logic per surface | `graph_surfaces_shared_llm_feature_errors_without_per_surface_transport_duplication` |
| Prevent direct per-component duplication of OpenCode conversation transport helpers outside the shared LLM conversation feature | `graph_avoids_duplicate_transport_helpers_outside_shared_llm_feature` |
| Keep shared conversation hook defaults referentially stable so message-history effects do not trigger repeated reload loops | `graph_shared_llm_hook_uses_stable_defaults_to_prevent_reload_loops` |
| Support non-polling center transcript usage so chat selection updates do not present as reload churn in workspace `Chats` view | `graph_shared_llm_feature_supports_non_polling_center_transcript_mode` |
| Load cached conversation list and message history from session storage through the shared LLM conversation feature before issuing network refreshes | `graph_shared_llm_feature_reads_session_cache_before_network_refresh` |
| Expose shared syncing-latest state so chat surfaces can show refresh indicators while server data is being reconciled | `graph_shared_llm_feature_exposes_syncing_latest_state_for_ui_feedback` |
| Coordinate chat-switch bottom-lock behavior with shared loading/refresh state so transcript lands on the latest item after reconciliation | `graph_shared_llm_feature_coordinates_bottom_lock_with_loading_states` |
| Defer browser-only cache hydration paths until after mount so server/client initial markup remains hydration-safe | `graph_shared_llm_feature_defers_browser_cache_reads_until_after_mount` |
| Expose reusable conversation UI subcomponents (header, thread, tool rows, composer, markdown) so chat surfaces compose from one module without giant monolith files | `graph_shared_llm_feature_exposes_reusable_conversation_ui_subcomponents` |
| Isolate conversation scroll behaviors (bottom-lock, sticky prior-user context, scroll-to-latest visibility) into dedicated hooks consumed by chat surfaces | `graph_shared_llm_feature_isolates_scroll_behaviors_into_dedicated_hooks` |
| Classify code-modification tool calls in shared chat rendering and show patch-style diff views when patch payloads are available | `graph_shared_llm_feature_classifies_code_mod_tools_and_renders_patch_views` |
| Centralize tool rendering policy in shared conversation UI so inline `glob`/`grep`/`read` rows and `apply_patch` diff mode are consistent across chat surfaces | `graph_shared_llm_feature_centralizes_inline_and_diff_tool_rendering_policies` |
| Expose reusable bounded-expansion behavior (max-height plus internal scroll) for long user/tool content in shared conversation components and hooks | `graph_shared_llm_feature_exposes_bounded_expansion_with_scroll_for_long_content` |
| Normalize attachment metadata in shared conversation payloads so chat surfaces can render file/dir chips and image previews consistently | `graph_shared_llm_feature_exposes_attachment_metadata_for_chat_surfaces` |
| Detect OpenCode file-part variants and image MIME metadata in shared normalization paths for consistent attachment rendering behavior | `graph_shared_llm_feature_normalizes_file_directory_and_image_attachment_parts` |
