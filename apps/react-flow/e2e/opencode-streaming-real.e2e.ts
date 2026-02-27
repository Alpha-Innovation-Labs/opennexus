import { expect, test } from "@playwright/test";

test.describe("opencode real streaming", () => {
  test("renders assistant text in real time without page reload", async ({ page }) => {
    test.skip(
      process.env.OPENCODE_E2E_REAL !== "1",
      "Set OPENCODE_E2E_REAL=1 to run real OpenCode streaming E2E (no mocks).",
    );

    test.setTimeout(180_000);

    const token = `STREAM_OK_${Date.now()}`;

    await page.goto("/");
    await expect(page.getByTestId("opencode-panel")).toBeVisible();

    await page.getByRole("button", { name: "New" }).click();

    const draft = page.getByTestId("opencode-draft");
    await draft.fill(
      `Reply with exactly this token and nothing else: ${token}`,
    );
    await page.getByTestId("opencode-send").click();

    const assistantContent = page.getByTestId("opencode-message-assistant").last().locator("p").nth(1);
    await expect(assistantContent).toBeVisible();

    await expect
      .poll(async () => ((await assistantContent.textContent()) ?? "").trim(), {
        timeout: 120_000,
        intervals: [300, 600, 1_000, 1_500],
      })
      .not.toBe("");

    const streamedText = ((await assistantContent.textContent()) ?? "").trim();
    expect(streamedText).not.toBe("(No text response)");
    await expect(assistantContent).toContainText(token);
  });
});
