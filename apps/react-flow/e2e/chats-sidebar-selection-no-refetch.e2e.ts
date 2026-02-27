import { expect, test } from "@playwright/test";

test("selecting chats from left sidebar does not refetch conversation list", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("workspace.sidebar.collapsed");
    window.localStorage.removeItem("workspace.sidebar.activity.collapsed");

    const originalFetch = window.fetch.bind(window);

    (window as typeof window & { __chatListGetCount?: number }).__chatListGetCount = 0;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const method = request.method.toUpperCase();
      const url = new URL(request.url, window.location.origin);

      if (url.pathname === "/api/opencode/conversations" && method === "GET") {
        (window as typeof window & { __chatListGetCount?: number }).__chatListGetCount =
          ((window as typeof window & { __chatListGetCount?: number }).__chatListGetCount ?? 0) + 1;

        return Response.json({
          conversations: [
            { id: "ses-alpha", title: "Alpha conversation title that is long enough to truncate", updatedAt: Date.now() },
            { id: "ses-beta", title: "Beta conversation", updatedAt: Date.now() - 1_000 },
            { id: "ses-gamma", title: "Gamma conversation", updatedAt: Date.now() - 2_000 },
          ],
        });
      }

      const match = url.pathname.match(/^\/api\/opencode\/conversations\/([^/]+)\/messages$/);
      if (match && method === "GET") {
        const conversationId = match[1] ?? "unknown";
        return Response.json({
          messages: [
            {
              id: `${conversationId}-user-1`,
              role: "user",
              content: `User prompt for ${conversationId}`,
              toolCalls: [],
            },
            {
              id: `${conversationId}-assistant-1`,
              role: "assistant",
              content: `Assistant response for ${conversationId}`,
              toolCalls: [],
            },
          ],
        });
      }

      return originalFetch(input, init);
    };
  });

  await page.goto("/chats");

  await expect(page.getByTestId("workspace-left-sidebar").getByText("Chats")).toBeVisible();
  await expect(page).toHaveURL(/\/chats$/);

  await expect(page.getByTestId("opencode-center-message-assistant").getByText("Assistant response for ses-alpha")).toBeVisible();

  const initialCount = await page.evaluate(() => (window as typeof window & { __chatListGetCount?: number }).__chatListGetCount ?? 0);

  const sidebarButtons = page.getByTestId("workspace-left-sidebar").locator("button");

  await sidebarButtons.nth(1).click();
  await expect(page).toHaveURL(/\/chats$/);
  await expect(page.getByTestId("opencode-center-message-assistant").getByText("Assistant response for ses-beta")).toBeVisible();

  await sidebarButtons.nth(2).click();
  await expect(page).toHaveURL(/\/chats$/);
  await expect(page.getByTestId("opencode-center-message-assistant").getByText("Assistant response for ses-gamma")).toBeVisible();

  await page.waitForTimeout(150);

  const afterSelectionCount = await page.evaluate(
    () => (window as typeof window & { __chatListGetCount?: number }).__chatListGetCount ?? 0,
  );

  expect(afterSelectionCount).toBe(initialCount);
});
