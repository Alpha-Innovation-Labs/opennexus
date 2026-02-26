import { expect, test } from "@playwright/test";

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("dragging a project subflow cannot overlap another subflow", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto("/");

  await page.keyboard.press("m");

  const projectNodes = page.locator('.react-flow__node[data-id^="project-shell:"]');
  await expect(projectNodes.first()).toBeVisible();
  await expect.poll(async () => projectNodes.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const sourceNode = projectNodes.first();
  const targetNode = projectNodes.nth(1);

  const sourceBefore = await sourceNode.boundingBox();
  const targetBefore = await targetNode.boundingBox();
  expect(sourceBefore).not.toBeNull();
  expect(targetBefore).not.toBeNull();

  const source = sourceBefore!;
  const target = targetBefore!;

  await page.mouse.move(source.x + source.width / 2, source.y + 28);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 });
  await page.mouse.up();

  await page.waitForTimeout(100);

  const sourceAfter = await sourceNode.boundingBox();
  const targetAfter = await targetNode.boundingBox();
  expect(sourceAfter).not.toBeNull();
  expect(targetAfter).not.toBeNull();

  expect(intersects(sourceAfter!, targetAfter!)).toBe(false);
});
