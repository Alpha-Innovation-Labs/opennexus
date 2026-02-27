import { expect, test } from "@playwright/test";

async function installSidebarTestMocks(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("workspace.sidebar.collapsed");
    window.localStorage.removeItem("workspace.chat.collapsed");
    window.localStorage.removeItem("workspace.chat.size");

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      const method = request.method.toUpperCase();
      const url = new URL(request.url, window.location.origin);

      if (url.pathname === "/api/opencode/conversations" && method === "GET") {
        return Response.json({ conversations: [] });
      }

      if (url.pathname === "/api/opencode/conversations" && method === "POST") {
        return Response.json({ id: `ses-${Date.now()}`, title: "New session" });
      }

      const messagesMatch = url.pathname.match(/^\/api\/opencode\/conversations\/[^/]+\/messages$/);
      if (messagesMatch && method === "GET") {
        return Response.json({ messages: [] });
      }

      return originalFetch(input, init);
    };
  });
}

async function resizeChatPanel(page: import("@playwright/test").Page, deltaX: number) {
  const rightSidebar = page.getByTestId("workspace-right-sidebar");
  await expect(rightSidebar).toBeVisible();
  const box = await rightSidebar.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  const centerX = box.x + 1;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + deltaX, centerY, { steps: 8 });
  await page.mouse.up();
}

test("chat sidebar collapses and disables resize handle", async ({ page }) => {
  await installSidebarTestMocks(page);
  await page.goto("/");

  await expect(page.getByLabel("Collapse chat sidebar")).toBeVisible();
  const expandedWidth = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(expandedWidth).not.toBeNull();
  if (!expandedWidth) {
    return;
  }

  await page.getByLabel("Collapse chat sidebar").click();
  await expect(page.getByLabel("Expand chat sidebar")).toBeVisible();

  const collapsedBeforeDrag = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(collapsedBeforeDrag).not.toBeNull();
  if (!collapsedBeforeDrag) {
    return;
  }

  await resizeChatPanel(page, -120);
  const collapsedAfterDrag = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(collapsedAfterDrag).not.toBeNull();
  if (!collapsedAfterDrag) {
    return;
  }

  expect(Math.abs(collapsedAfterDrag.width - collapsedBeforeDrag.width)).toBeLessThan(2);

  await page.getByLabel("Expand chat sidebar").click();
  await expect(page.getByLabel("Collapse chat sidebar")).toBeVisible();

  const expandedAfterRestore = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(expandedAfterRestore).not.toBeNull();
  if (!expandedAfterRestore) {
    return;
  }

  expect(Math.abs(expandedAfterRestore.width - expandedWidth.width)).toBeLessThan(14);
});

test("collapsed right sidebar width matches collapsed left sidebar", async ({ page }) => {
  await installSidebarTestMocks(page);
  await page.goto("/");

  await page.getByLabel("Collapse sidebar").click();
  await page.getByLabel("Collapse chat sidebar").click();

  const leftBox = await page.getByTestId("workspace-left-sidebar").boundingBox();
  const rightBox = await page.getByTestId("workspace-right-sidebar").boundingBox();

  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  if (!leftBox || !rightBox) {
    return;
  }

  expect(Math.abs(leftBox.width - rightBox.width)).toBeLessThan(3);
});

test("chat sidebar size persists across collapse/expand and reload", async ({ page }) => {
  await installSidebarTestMocks(page);
  await page.goto("/");

  await resizeChatPanel(page, -140);

  const beforeCollapse = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(beforeCollapse).not.toBeNull();
  if (!beforeCollapse) {
    return;
  }

  await page.getByLabel("Collapse chat sidebar").click();
  await page.getByLabel("Expand chat sidebar").click();

  const afterExpand = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(afterExpand).not.toBeNull();
  if (!afterExpand) {
    return;
  }

  expect(Math.abs(beforeCollapse.width - afterExpand.width)).toBeLessThan(14);

  await page.reload();
  await expect(page.getByLabel("Collapse chat sidebar")).toBeVisible();

  const afterReload = await page.getByTestId("workspace-right-sidebar").boundingBox();
  expect(afterReload).not.toBeNull();
  if (!afterReload) {
    return;
  }

  expect(Math.abs(beforeCollapse.width - afterReload.width)).toBeLessThan(18);
});
