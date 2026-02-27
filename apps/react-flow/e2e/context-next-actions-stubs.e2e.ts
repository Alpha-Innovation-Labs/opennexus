import { test } from "@playwright/test";

test.describe("context next action stubs", () => {
  test.skip("graph_opencode_shortcut_opens_new_chat_modal", async () => {
    // TODO(cwg_006): add E2E coverage for Ctrl/Cmd+N modal open.
  });

  test.skip("graph_opencode_shortcut_opens_parallel_dual_chat_modal", async () => {
    // TODO(cwg_006): add E2E coverage for Ctrl/Cmd+A dual-chat modal open.
  });

  test.skip("graph_parallel_modal_broadcasts_prompt_to_both_chats", async () => {
    // TODO(cwg_006): add E2E coverage for shared composer fan-out to both lanes.
  });

  test.skip("graph_parallel_modal_recovers_reply_when_stream_has_no_deltas", async () => {
    // TODO(cwg_006): add E2E coverage for no-delta recovery from persisted messages.
  });

  test.skip("graph_parallel_modal_uses_server_assigned_conversation_titles", async () => {
    // TODO(cwg_006): add E2E coverage for server-assigned lane conversation titles.
  });

  test.skip("graph_renders_scope_breadcrumb_for_project_and_subscope_focus", async () => {
    // TODO(cwg_002): add E2E coverage for breadcrumb states across overview/detail/focus.
  });
});
