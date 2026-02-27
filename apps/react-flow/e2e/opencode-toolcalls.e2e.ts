import { expect, test } from "@playwright/test";

const CONVERSATION_ID = "conv-tools-e2e";

test("opencode panel renders tool calls in assistant message", async ({ page }) => {
  await page.addInitScript(
    ({ conversationId }: { conversationId: string }) => {
      const originalFetch = window.fetch.bind(window);
      const encoder = new TextEncoder();

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        const method = request.method.toUpperCase();
        const url = new URL(request.url, window.location.origin);

        if (url.pathname === "/api/opencode/conversations" && method === "GET") {
          return Response.json({
            conversations: [{ id: conversationId, title: "Tool Calls", updatedAt: Date.now() }],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${conversationId}/messages` && method === "GET") {
          return Response.json({ messages: [] });
        }

        if (url.pathname === `/api/opencode/conversations/${conversationId}/messages` && method === "POST") {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool",
                    toolCall: {
                      id: "part-1",
                      callId: "call-1",
                      tool: "WebFetch",
                      status: "running",
                      title: "Fetch temporal.io/about",
                      input: '{"url":"https://temporal.io/about"}',
                    },
                  })}\n\n`,
                ),
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool",
                    toolCall: {
                      id: "part-1",
                      callId: "call-1",
                      tool: "WebFetch",
                      status: "completed",
                      title: "Fetch temporal.io/about",
                      input: '{"url":"https://temporal.io/about"}',
                      output: "Publicly, they state 1,500 customers.",
                    },
                  })}\n\n`,
                ),
              );

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: "1,500 customers" })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
              controller.close();
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
            },
          });
        }

        if (url.pathname === "/api/opencode/conversations" && method === "POST") {
          return Response.json({ id: conversationId, title: "Tool Calls" });
        }

        return originalFetch(input, init);
      };
    },
    { conversationId: CONVERSATION_ID },
  );

  await page.goto("/");
  await expect(page.getByTestId("opencode-panel")).toBeVisible();

  await page.getByTestId("opencode-draft").fill("How many customers?");
  await page.getByTestId("opencode-send").click();

  const assistant = page.getByTestId("opencode-message-assistant").last();
  await expect(assistant.locator("p").nth(1)).toContainText("1,500 customers");

  const toolCall = assistant.getByTestId("opencode-tool-call-item").first();
  await expect(toolCall).toBeVisible();
  await expect(assistant).toContainText("Completed");
  await expect(assistant).toContainText("Fetch temporal.io/about");
  await expect(assistant).toContainText("Publicly, they state 1,500 customers.");
});
