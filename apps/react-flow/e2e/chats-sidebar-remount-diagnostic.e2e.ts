import { expect, test } from "@playwright/test";

const CHAT_A_ID = "ses-remount-a";
const CHAT_B_ID = "ses-remount-b";

test("diagnostic: detect sidebar/right-panel remount on chat route switch", async ({ page }) => {
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
              { id: chatAId, title: "Remount A", updatedAt: Date.now() },
              { id: chatBId, title: "Remount B", updatedAt: Date.now() - 1000 },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${chatAId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              { id: "a-user", role: "user", content: "A", toolCalls: [] },
              { id: "a-assistant", role: "assistant", content: "A reply", toolCalls: [] },
            ],
          });
        }

        if (url.pathname === `/api/opencode/conversations/${chatBId}/messages` && method === "GET") {
          return Response.json({
            messages: [
              { id: "b-user", role: "user", content: "B", toolCalls: [] },
              { id: "b-assistant", role: "assistant", content: "B reply", toolCalls: [] },
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

  const before = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="workspace-left-sidebar"]') as HTMLElement | null;
    const panel = document.querySelector('[data-testid="opencode-panel"]') as HTMLElement | null;
    if (!sidebar || !panel) return null;
    sidebar.dataset.e2eProbe = "sidebar-probe";
    panel.dataset.e2eProbe = "panel-probe";
    return {
      sidebarProbe: sidebar.dataset.e2eProbe,
      panelProbe: panel.dataset.e2eProbe,
    };
  });

  expect(before).not.toBeNull();
  await page.getByTestId("workspace-left-sidebar").getByTitle("Remount B").first().click();
  await expect(page).toHaveURL(new RegExp(`/chats/${CHAT_B_ID}$`));

  const after = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="workspace-left-sidebar"]') as HTMLElement | null;
    const panel = document.querySelector('[data-testid="opencode-panel"]') as HTMLElement | null;
    return {
      sidebarProbe: sidebar?.dataset.e2eProbe ?? null,
      panelProbe: panel?.dataset.e2eProbe ?? null,
    };
  });

  await expect.soft(after.sidebarProbe).toBe("sidebar-probe");
  await expect.soft(after.panelProbe).toBe("panel-probe");
});
