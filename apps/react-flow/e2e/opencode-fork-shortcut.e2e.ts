import { expect, test } from "@playwright/test";

const BASE_CONVERSATION_ID = "conv-base-001";

async function installOpencodeForkMock(page: import("@playwright/test").Page) {
  await page.addInitScript(({ baseConversationId }: { baseConversationId: string }) => {
    const originalFetch = window.fetch.bind(window);
    const encoder = new TextEncoder();

    type MockMessage = {
      id: string;
      role: "user" | "assistant";
      content: string;
      toolCalls: unknown[];
    };

    const baseMessages: MockMessage[] = [
      {
        id: "msg-user-1",
        role: "user",
        content: "What is this codebase about?",
        toolCalls: [],
      },
      {
        id: "msg-assistant-1",
        role: "assistant",
        content: "It is a context-driven development workspace.",
        toolCalls: [],
      },
    ];

    const messagesByConversation: Record<string, MockMessage[]> = {
      [baseConversationId]: [...baseMessages],
    };

    let forkCount = 0;
    const conversations = [{ id: baseConversationId, title: "Base Conversation", updatedAt: Date.now() }];

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const method = request.method.toUpperCase();
      const url = new URL(request.url, window.location.origin);

      if (url.pathname === "/api/opencode/conversations" && method === "GET") {
        return Response.json({ conversations });
      }

      if (url.pathname === "/api/opencode/conversations" && method === "POST") {
        const id = `conv-created-${Date.now()}`;
        const title = `Conversation ${id.slice(0, 8)}`;
        conversations.unshift({ id, title, updatedAt: Date.now() });
        messagesByConversation[id] = [];
        return Response.json({ id, title });
      }

      const forkMatch = url.pathname.match(/^\/api\/opencode\/conversations\/([^/]+)\/fork$/);
      if (forkMatch && method === "POST") {
        const sourceConversationId = forkMatch[1] ?? "";
        forkCount += 1;
        const id = `conv-fork-${forkCount}`;
        const title = `Fork ${forkCount}`;
        const sourceMessages = messagesByConversation[sourceConversationId] ?? [];
        messagesByConversation[id] = sourceMessages.map((entry) => ({ ...entry }));
        conversations.unshift({ id, title, updatedAt: Date.now() });
        return Response.json({ id, title });
      }

      const messagesGetMatch = url.pathname.match(/^\/api\/opencode\/conversations\/([^/]+)\/messages$/);
      if (messagesGetMatch && method === "GET") {
        const conversationId = messagesGetMatch[1] ?? "";
        return Response.json({ messages: messagesByConversation[conversationId] ?? [] });
      }

      const messagesPostMatch = url.pathname.match(/^\/api\/opencode\/conversations\/([^/]+)\/messages$/);
      if (messagesPostMatch && method === "POST") {
        const conversationId = messagesPostMatch[1] ?? "";
        const requestBody = (await request.json().catch(() => ({}))) as { message?: string };
        const userPrompt = typeof requestBody.message === "string" ? requestBody.message : "";

        const userMessage = {
          id: `user-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          role: "user" as const,
          content: userPrompt,
          toolCalls: [],
        };
        const assistantMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          role: "assistant" as const,
          content: `reply-${conversationId}`,
          toolCalls: [],
        };
        const current = messagesByConversation[conversationId] ?? [];
        messagesByConversation[conversationId] = [...current, userMessage, assistantMessage];

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: assistantMessage.content })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            controller.close();
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

      return originalFetch(input, init);
    };
  }, { baseConversationId: BASE_CONVERSATION_ID });
}

async function triggerForkShortcut(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  });
}

test("ctrl+s forks current chat into two-lane modal", async ({ page }) => {
  await installOpencodeForkMock(page);
  await page.goto("/");

  await expect(page.getByTestId("opencode-panel")).toBeVisible();
  await expect(page.getByText("What is this codebase about?")).toBeVisible();

  await triggerForkShortcut(page);

  await expect(page.getByTestId("opencode-dual-chat-modal")).toBeVisible();
  const leftLane = page.getByTestId("opencode-dual-lane-left");
  const rightLane = page.getByTestId("opencode-dual-lane-right");

  await expect(leftLane).toContainText("What is this codebase about?");
  await expect(rightLane).toContainText("What is this codebase about?");
  await expect(rightLane).toContainText(/Fork \d+/);
});

test("fork modal lets each lane send independent prompts", async ({ page }) => {
  await installOpencodeForkMock(page);
  await page.goto("/");

  await expect(page.getByTestId("opencode-panel")).toBeVisible();
  await expect(page.getByText("What is this codebase about?")).toBeVisible();

  await triggerForkShortcut(page);
  await expect(page.getByTestId("opencode-dual-chat-modal")).toBeVisible();
  await expect(page.getByTestId("opencode-dual-lane-right")).toContainText(/Fork \d+/);

  await page.getByTestId("opencode-lane-draft-left").fill("Left branch prompt");
  await page.getByTestId("opencode-lane-draft-left").press("Enter");

  await page.getByTestId("opencode-lane-draft-right").fill("Right branch prompt");
  await page.getByTestId("opencode-lane-draft-right").press("Enter");

  await expect(page.getByTestId("opencode-dual-lane-left")).toContainText("reply-conv-base-001");
  await expect(page.getByTestId("opencode-dual-lane-right")).toContainText(/reply-conv-fork-\d+/);
});

test("fork modal can fork from a user message to create more branches", async ({ page }) => {
  await installOpencodeForkMock(page);
  await page.goto("/");

  await expect(page.getByTestId("opencode-panel")).toBeVisible();
  await page.locator("select").selectOption(BASE_CONVERSATION_ID);
  await expect(page.getByText("What is this codebase about?")).toBeVisible();

  await triggerForkShortcut(page);
  const firstRightLane = page.getByTestId("opencode-dual-lane-right");
  await expect(firstRightLane).toContainText(/Fork \d+/);
  const firstForkText = (await firstRightLane.textContent()) ?? "";
  const firstForkMatch = firstForkText.match(/Fork\s+(\d+)/);
  expect(firstForkMatch).not.toBeNull();
  const firstForkNumber = Number.parseInt(firstForkMatch?.[1] ?? "0", 10);

  await page.getByTestId("opencode-dual-lane-right").getByRole("button", { name: "Fork from here" }).first().click();
  const allLanes = page.locator('[data-testid^="opencode-dual-lane-"]');
  await expect(allLanes).toHaveCount(3);

  const newestLane = allLanes.nth(2);
  const secondForkText = (await newestLane.textContent()) ?? "";
  const secondForkMatch = secondForkText.match(/Fork\s+(\d+)/);
  expect(secondForkMatch).not.toBeNull();
  const secondForkNumber = Number.parseInt(secondForkMatch?.[1] ?? "0", 10);
  expect(secondForkNumber).toBeGreaterThan(firstForkNumber);
});
