import { expect, test } from "@playwright/test";

const CHAT_A_ID = "ses-nav-a";
const CHAT_B_ID = "ses-nav-b";

test("sidebar chat selection updates route without full document reload", async ({ page }) => {
  await page.addInitScript(() => {
    const key = "__e2e_document_load_count";
    const current = Number.parseInt(window.sessionStorage.getItem(key) ?? "0", 10) || 0;
    window.sessionStorage.setItem(key, String(current + 1));
  });

  await page.addInitScript(
    ({ chatAId, chatBId }) => {
      const originalFetch = window.fetch.bind(window);

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        const method = request.method.toUpperCase();
        const url = new URL(request.url, window.location.origin);

        if (url.pathname === "/api/opencode/conversations" && method === "GET") {
          return Response.json({
            conversations: [
              { id: chatAId, title: "Navigation Chat A", updatedAt: Date.now() },
              { id: chatBId, title: "Navigation Chat B", updatedAt: Date.now() - 1000 },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${chatAId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              { id: "a-user", role: "user", content: "Chat A user", toolCalls: [] },
              { id: "a-assistant", role: "assistant", content: "Chat A assistant", toolCalls: [] },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${chatBId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              { id: "b-user", role: "user", content: "Chat B user", toolCalls: [] },
              { id: "b-assistant", role: "assistant", content: "Chat B assistant", toolCalls: [] },
            ],
          });
        }

        return originalFetch(input, init);
      };
    },
    { chatAId: CHAT_A_ID, chatBId: CHAT_B_ID },
  );

  await page.goto(`/chats/${CHAT_A_ID}`);
  await expect(page).toHaveURL(new RegExp(`/chats/${CHAT_A_ID}$`));

  const before = await page.evaluate(() => Number.parseInt(window.sessionStorage.getItem("__e2e_document_load_count") ?? "0", 10));
  await expect(page.getByTitle("Navigation Chat B")).toBeVisible();
  await page.getByTitle("Navigation Chat B").click();

  await expect(page).toHaveURL(new RegExp(`/chats/${CHAT_B_ID}$`));
  const after = await page.evaluate(() => Number.parseInt(window.sessionStorage.getItem("__e2e_document_load_count") ?? "0", 10));

  expect(after).toBe(before);
});
