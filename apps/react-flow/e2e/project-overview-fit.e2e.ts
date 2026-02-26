import { expect, test } from "@playwright/test";

const FLOW_STORAGE_KEY = "cdd-react-flow-ui/state/v10";

test("project overview refresh restores shell height for projects with subproject rows", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto("/");

  const projectShells = page.locator('.react-flow__node[data-id^="project-shell:"]');
  await expect(projectShells.first()).toBeVisible();

  const shellCount = await projectShells.count();
  let shellId: string | null = null;
  let baselineHeight = 0;

  for (let shellIndex = 0; shellIndex < shellCount; shellIndex += 1) {
    const shell = projectShells.nth(shellIndex);
    const candidateId = await shell.getAttribute("data-id");
    if (!candidateId) {
      continue;
    }

    const projectId = candidateId.replace("project-shell:", "");
    const subprojectRows = page.locator(`.react-flow__node[data-id^="subproject:${projectId}/"]`);
    const subprojectCount = await subprojectRows.count();
    if (subprojectCount < 2) {
      continue;
    }

    const measuredHeight = await page.evaluate((id: string) => {
      const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
      if (!element) {
        return 0;
      }

      const inlineHeight = Number.parseFloat(element.style.height || "");
      return Number.isFinite(inlineHeight) ? inlineHeight : 0;
    }, candidateId);

    if (measuredHeight <= 120) {
      continue;
    }

    shellId = candidateId;
    baselineHeight = measuredHeight;
    break;
  }

  expect(shellId).not.toBeNull();
  expect(baselineHeight).toBeGreaterThan(120);

  await page.evaluate(
    ({ storageKey, id }: { storageKey: string; id: string }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          viewport: null,
          nodeStateById: {
            [id]: {
              x: 0,
              y: 0,
              width: 360,
              height: 64,
            },
          },
        }),
      );
    },
    { storageKey: FLOW_STORAGE_KEY, id: shellId as string },
  );

  await page.reload();
  await expect(projectShells.first()).toBeVisible();

  await page.getByRole("button", { name: /refresh flows/i }).click();
  await page.waitForTimeout(120);

  const renderedHeight = await page.evaluate((id: string) => {
    const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
    if (!element) {
      return null;
    }

    const inlineHeight = Number.parseFloat(element.style.height || "");
    if (Number.isFinite(inlineHeight)) {
      return inlineHeight;
    }

    return null;
  }, shellId as string);

  expect(renderedHeight).not.toBeNull();
  expect(Math.round(renderedHeight!)).toBeGreaterThanOrEqual(Math.round(baselineHeight) - 1);
});
