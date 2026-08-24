import { expect, test } from "@playwright/test";

test("Playwright runs successfully", async ({ page }) => {
  await page.setContent("<h1>Justice Redact</h1>");

  await expect(
    page.getByRole("heading", { name: "Justice Redact" })
  ).toBeVisible();
});
