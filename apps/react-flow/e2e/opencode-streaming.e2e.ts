import { expect, test } from "@playwright/test";

const CONVERSATION_ID = "conv-streaming-e2e";

async function installOpencodeStreamingMock(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ conversationId }: { conversationId: string }) => {
      const originalFetch = window.fetch.bind(window);
      const encoder = new TextEncoder();

      const streamingFrames = [
        { type: "delta", text: "Publicly, they state " },
        { type: "delta", text: "\"1,500 customers\"" },
        { type: "delta", text: " on their About page." },
      ];

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        const method = request.method.toUpperCase();
        const url = new URL(request.url, window.location.origin);

        if (url.pathname === "/api/opencode/conversations" && method === "GET") {
          return Response.json({
            conversations: [
              {
                id: conversationId,
                title: "E2E Streaming Conversation",
                updatedAt: Date.now(),
              },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${conversationId}/messages` && method === "GET") {
          return Response.json({ messages: [] });
        }

        if (url.pathname === `/api/opencode/conversations/${conversationId}/messages` && method === "POST") {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              let index = 0;

              const pushFrame = () => {
                if (index >= streamingFrames.length) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\r\n\r\n`));
                  controller.close();
                  return;
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamingFrames[index])}\r\n\r\n`));
                index += 1;
                setTimeout(pushFrame, 280);
              };

              setTimeout(pushFrame, 80);
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        }

        if (url.pathname === "/api/opencode/conversations" && method === "POST") {
          return Response.json({ id: conversationId, title: "E2E Streaming Conversation" });
        }

        return originalFetch(input, init);
      };
    },
    { conversationId: CONVERSATION_ID },
  );
}

test("opencode panel streams assistant text and avoids no-text fallback", async ({ page }) => {
  await installOpencodeStreamingMock(page);

  await page.goto("/");

  await expect(page.getByTestId("opencode-panel")).toBeVisible();

  const draft = page.getByTestId("opencode-draft");
  await draft.fill("Do we know how many customers they have?");
  await page.getByTestId("opencode-send").click();

  const assistantContent = page.getByTestId("opencode-message-assistant").last().locator("p").nth(1);

  await expect.poll(async () => (await assistantContent.textContent())?.trim() ?? "", { timeout: 4_000 }).toBe(
    "Publicly, they state",
  );

  await expect.poll(async () => (await assistantContent.textContent())?.trim() ?? "", { timeout: 6_000 }).toContain(
    "1,500 customers",
  );

  await expect(assistantContent).toContainText("on their About page.");
  await expect(assistantContent).not.toHaveText("(No text response)");
});
