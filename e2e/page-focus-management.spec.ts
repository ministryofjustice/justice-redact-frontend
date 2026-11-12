import { test, expect } from "@playwright/test";

test("focuses the page heading with GOV.UK yellow styling", async ({
    page,
}) => {
    await page.goto("/contact");

    const heading = page.locator("main h1").first();

    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(heading).toHaveAttribute("tabindex", "-1");
    await expect(heading).toHaveCSS(
        "background-color",
        "rgb(255, 221, 0)",
    );
});

test("moves focus to the new heading after client-side navigation", async ({
    page,
}) => {
    await page.goto("/contact");

    await page
        .getByRole("contentinfo")
        .getByRole("link", { name: "Accessibility" })
        .click();

    await expect(page).toHaveURL(/\/accessibility\/?$/);

    const heading = page.locator("main h1").first();

    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
});

test("focuses the heading on a dedicated error page", async ({
    page,
}) => {
    await page.goto("/service-access-denied");

    const heading = page.getByRole("heading", {
        level: 1,
        name: "You do not have access to this service",
    });

    await expect(heading).toBeFocused();
    await expect(heading).toHaveAttribute("tabindex", "-1");
    await expect(heading).toHaveCSS(
        "background-color",
        "rgb(255, 221, 0)",
    );
});
