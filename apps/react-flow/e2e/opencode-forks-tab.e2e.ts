import { expect, test } from "@playwright/test";

test("forks tab renders root transcript with fork nodes and connecting edges", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const method = request.method.toUpperCase();
      const url = new URL(request.url, window.location.origin);

      if (url.pathname === "/api/opencode/conversations/forks" && method === "GET") {
        return Response.json({
          conversations: [
            {
              id: "ses-root",
              title: "Root Conversation",
              parentId: null,
              createdAt: Date.now() - 60_000,
              updatedAt: Date.now() - 10_000,
            },
            {
              id: "ses-child",
              title: "Fork Child",
              parentId: "ses-root",
              createdAt: Date.now() - 20_000,
              updatedAt: Date.now() - 5_000,
            },
          ],
        });
      }

      if (url.pathname === "/api/opencode/conversations/ses-root/messages" && method === "GET") {
        return Response.json({
          messages: [
            { id: "m1", role: "user", content: "Initial prompt", createdAt: Date.now() - 50_000 },
            { id: "m2", role: "assistant", content: "Assistant answer", createdAt: Date.now() - 49_000 },
            { id: "m3", role: "user", content: "Fork from here", createdAt: Date.now() - 30_000 },
          ],
        });
      }

      if (url.pathname === "/api/opencode/conversations/ses-child/messages" && method === "GET") {
        return Response.json({
          messages: [
            { id: "m1", role: "user", content: "Show me latest status." },
            { id: "m2", role: "assistant", content: "Status is available." },
          ],
        });
      }

      return originalFetch(input, init);
    };
  });

  await page.goto("/");

  await page.getByRole("navigation").getByRole("link", { name: /forks/i }).click();
  await expect(page.getByTestId("fork-graph-canvas")).toBeVisible();

  const forkGraph = page.getByTestId("fork-graph-canvas");
  await expect(forkGraph.getByText("Root Conversation")).toBeVisible();
  await expect(forkGraph.getByText("Fork Child")).toBeVisible();
  await expect(forkGraph.locator(".react-flow__edge")).toHaveCount(1);

  await expect(forkGraph.locator('.react-flow__node:has-text("Root Conversation")')).toBeVisible();

  const forkNode = forkGraph.locator('.react-flow__node:has-text("Fork Child")');
  const before = await forkNode.boundingBox();
  if (!before) {
    throw new Error("Expected fork node bounding box");
  }

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 90, before.y + before.height / 2 + 30);
  await page.mouse.up();

  const after = await forkNode.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeGreaterThan(1);
});
