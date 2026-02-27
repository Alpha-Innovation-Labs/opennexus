import { expect, test } from "@playwright/test";

const CENTER_CONVERSATION_ID = "ses-center-chat";
const RIGHT_DEFAULT_CONVERSATION_ID = "ses-right-default";
const RIGHT_SECOND_CONVERSATION_ID = "ses-right-second";

test("chats route keeps center transcript independent from right panel conversation", async ({ page }) => {
  await page.addInitScript(
    ({ centerConversationId, rightDefaultConversationId, rightSecondConversationId }) => {
      const originalFetch = window.fetch.bind(window);

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        const method = request.method.toUpperCase();
        const url = new URL(request.url, window.location.origin);

        if (url.pathname === "/api/opencode/conversations" && method === "GET") {
          return Response.json({
            conversations: [
              {
                id: rightDefaultConversationId,
                title: "Right Sidebar Conversation",
                updatedAt: Date.now(),
              },
              {
                id: centerConversationId,
                title: "Center Route Conversation",
                updatedAt: Date.now() - 1_000,
              },
              {
                id: rightSecondConversationId,
                title: "Right Sidebar Secondary",
                updatedAt: Date.now() - 2_000,
              },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${centerConversationId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              {
                id: "center-user-1",
                role: "user",
                content: "Show center transcript",
                toolCalls: [],
              },
              {
                id: "center-assistant-1",
                role: "assistant",
                content: "**Center markdown** reply",
                toolCalls: [
                  {
                    id: "center-tool-1",
                    callId: "center-call-1",
                    tool: "bash",
                    status: "completed",
                    title: "Center tool call",
                    input: '{"command":"pwd"}',
                    output: "/tmp/center",
                  },
                ],
              },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${rightDefaultConversationId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              {
                id: "right-user-1",
                role: "user",
                content: "Show right transcript",
                toolCalls: [],
              },
              {
                id: "right-assistant-1",
                role: "assistant",
                content: "**Right markdown** reply",
                toolCalls: [
                  {
                    id: "right-tool-1",
                    callId: "right-call-1",
                    tool: "read",
                    status: "completed",
                    title: "Right default tool call",
                    input: '{"filePath":"README.md"}',
                    output: "read output",
                  },
                ],
              },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${rightSecondConversationId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              {
                id: "right-second-user-1",
                role: "user",
                content: "Show right second transcript",
                toolCalls: [],
              },
              {
                id: "right-second-assistant-1",
                role: "assistant",
                content: "Right secondary conversation",
                toolCalls: [
                  {
                    id: "right-second-tool-1",
                    callId: "right-second-call-1",
                    tool: "grep",
                    status: "completed",
                    title: "Right secondary tool call",
                    input: '{"pattern":"TODO"}',
                    output: "file.ts:1: TODO",
                  },
                ],
              },
            ],
          });
        }

        return originalFetch(input, init);
      };
    },
    {
      centerConversationId: CENTER_CONVERSATION_ID,
      rightDefaultConversationId: RIGHT_DEFAULT_CONVERSATION_ID,
      rightSecondConversationId: RIGHT_SECOND_CONVERSATION_ID,
    },
  );

  await page.goto(`/chats/${CENTER_CONVERSATION_ID}`);

  await expect(page).toHaveURL(new RegExp(`/chats/${CENTER_CONVERSATION_ID}$`));

  await expect(page.getByText("Center markdown", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Center tool call").first()).toBeVisible();

  const rightPanel = page.getByTestId("opencode-panel");
  await expect(rightPanel).toBeVisible();
  await expect(rightPanel.getByText("Right markdown", { exact: false }).first()).toBeVisible();
  await expect(rightPanel.getByText("Right default tool call").first()).toBeVisible();
  await expect(rightPanel.getByText("Center tool call")).toHaveCount(0);

  const selector = rightPanel.locator("select");
  await selector.selectOption(RIGHT_SECOND_CONVERSATION_ID);

  await expect(page).toHaveURL(new RegExp(`/chats/${CENTER_CONVERSATION_ID}$`));
  await expect(page.getByText("Center tool call").first()).toBeVisible();
  await expect(rightPanel.getByText("Right secondary tool call").first()).toBeVisible();
});
