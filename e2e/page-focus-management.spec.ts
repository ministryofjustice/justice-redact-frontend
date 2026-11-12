import { test, expect, type Page } from "@playwright/test";

async function mockAuthenticatedUpload(page: Page): Promise<void> {
    await page.route("**/auth/me", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                authenticated: true,
                email: "tester@justice.gov.uk",
            }),
        });
    });
}


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

test("focuses the entire Upload validation summary and preserves Tab order", async ({
    page,
}) => {
    await mockAuthenticatedUpload(page);
    await page.goto("/upload");

    await page.getByRole("button", {
        name: "Upload and continue",
    }).click();

    const summary = page.locator("main .govuk-error-summary");

    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toHaveAttribute("tabindex", "-1");

    await expect(summary).toHaveCSS(
        "outline-color",
        "rgb(255, 221, 0)",
    );

    // Tab should enter the summary's error link.
    await page.keyboard.press("Tab");

    await expect(
        summary.locator(".govuk-error-summary__link"),
    ).toBeFocused();

    // The next Tab should reach the file input.
    await page.keyboard.press("Tab");

    await expect(
        page.locator("#file-upload-1"),
    ).toBeFocused();
});

test("focuses the entire MOJ technical error alert with yellow styling", async ({
    page,
}) => {
    await mockAuthenticatedUpload(page);
    await page.goto("/upload");

    // An invalid PDF triggers the existing client-side PDF analysis error.
    await page.locator("#file-upload-1").setInputFiles({
        name: "invalid.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("This is not a valid PDF"),
    });

    await page.getByRole("button", {
        name: "Upload and continue",
    }).click();

    const alert = page.locator("main .jr-upload-api-alert");

    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
        "The selected file could not be checked",
    );

    await expect(alert).toBeFocused();
    await expect(alert).toHaveAttribute("tabindex", "-1");

    await expect(alert).toHaveCSS(
        "outline-color",
        "rgb(255, 221, 0)",
    );
});
