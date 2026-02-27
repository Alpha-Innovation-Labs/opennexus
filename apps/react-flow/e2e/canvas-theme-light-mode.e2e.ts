import { expect, test } from "@playwright/test";

test("context canvas background switches when toggling to light mode", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("workspace.theme", "dark");
  });

  await page.goto("/?view=context");

  const canvas = page.getByTestId("context-graph-canvas");
  await expect(canvas).toBeVisible();

  const darkBg = await canvas.evaluate((node) => window.getComputedStyle(node as HTMLElement).backgroundColor);
  expect(darkBg).toBe("rgb(17, 19, 21)");

  const themeToggle = page.getByRole("button", { name: "Switch to light theme" });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();

  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  await expect
    .poll(async () => canvas.evaluate((node) => window.getComputedStyle(node as HTMLElement).backgroundColor), {
      timeout: 5_000,
    })
    .not.toBe("rgb(17, 19, 21)");

  const lightBg = await canvas.evaluate((node) => window.getComputedStyle(node as HTMLElement).backgroundColor);
  expect(lightBg).toBe("rgb(238, 242, 247)");

  const htmlClassName = await page.evaluate(() => document.documentElement.className);
  expect(htmlClassName.includes("dark")).toBe(false);

  expect(lightBg).not.toBe(darkBg);

  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  const reloadedBg = await page
    .getByTestId("context-graph-canvas")
    .evaluate((node) => window.getComputedStyle(node as HTMLElement).backgroundColor);
  expect(reloadedBg).toBe("rgb(238, 242, 247)");
});
