import { expect, test } from "@playwright/test";

interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

async function readProjectShellPositions(page: import("@playwright/test").Page): Promise<PositionedNode[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id^="project-shell:"]'));

    return nodes
      .map((node) => {
        const id = node.getAttribute("data-id");
        if (!id) {
          return null;
        }

        const rect = node.getBoundingClientRect();
        return {
          id,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
        };
      })
      .filter((node): node is PositionedNode => node !== null)
      .sort((left, right) => left.id.localeCompare(right.id));
  });
}

async function readProjectDependencyDirectionViolations(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const centerById = new Map<string, { y: number }>();
    const projectNodes = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id^="project-shell:"]'));
    for (const node of projectNodes) {
      const id = node.getAttribute("data-id");
      if (!id) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      centerById.set(id, { y: rect.y + rect.height / 2 });
    }

    const violations: string[] = [];
    const edges = Array.from(document.querySelectorAll<SVGGElement>('.react-flow__edge[data-id^="xy-edge__project-dep:"]'));
    for (const edge of edges) {
      const edgeId = edge.getAttribute("data-id");
      if (!edgeId) {
        continue;
      }

      const relation = edgeId.replace("xy-edge__project-dep:", "");
      const [sourceProject, targetProject] = relation.split("->");
      if (!sourceProject || !targetProject) {
        continue;
      }

      const source = centerById.get(`project-shell:${sourceProject}`);
      const target = centerById.get(`project-shell:${targetProject}`);
      if (!source || !target) {
        continue;
      }

      if (source.y >= target.y - 6) {
        violations.push(relation);
      }
    }

    return violations.sort((left, right) => left.localeCompare(right));
  });
}

test("refresh flows restores dagre project overview layout", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto("/");

  const projectShells = page.locator('.react-flow__node[data-id^="project-shell:"]');
  await expect(projectShells.first()).toBeVisible();
  await expect.poll(async () => projectShells.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  const initial = await readProjectShellPositions(page);
  expect(initial.length).toBeGreaterThanOrEqual(2);

  const initialXs = initial.map((node) => node.x);
  const initialYs = initial.map((node) => node.y);
  const initialXSpread = Math.max(...initialXs) - Math.min(...initialXs);
  const initialYSpread = Math.max(...initialYs) - Math.min(...initialYs);
  expect(initialYSpread).toBeGreaterThan(initialXSpread);
  expect(await readProjectDependencyDirectionViolations(page)).toEqual([]);

  await page.getByRole("button", { name: /move/i }).click();

  const draggableShell = projectShells.first();
  const dragBox = await draggableShell.boundingBox();
  expect(dragBox).not.toBeNull();

  const startX = dragBox!.x + dragBox!.width / 2;
  const startY = dragBox!.y + 26;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 260, startY + 110, { steps: 18 });
  await page.mouse.up();

  const moved = await readProjectShellPositions(page);
  const movedNode = moved.find((node) => node.id === initial[0]!.id);
  expect(movedNode).toBeDefined();
  expect(Math.abs(movedNode!.x - initial[0]!.x) + Math.abs(movedNode!.y - initial[0]!.y)).toBeGreaterThan(2);

  await page.getByRole("button", { name: /refresh flows/i }).click();
  await page.waitForTimeout(120);

  const refreshed = await readProjectShellPositions(page);
  expect(refreshed.length).toBe(initial.length);
  expect(await readProjectDependencyDirectionViolations(page)).toEqual([]);

  for (const initialNode of initial) {
    const refreshedNode = refreshed.find((node) => node.id === initialNode.id);
    expect(refreshedNode).toBeDefined();
    expect(Math.abs(refreshedNode!.x - initialNode.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(refreshedNode!.y - initialNode.y)).toBeLessThanOrEqual(4);
  }
});
