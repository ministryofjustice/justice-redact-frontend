import { expect, test, type Page } from "@playwright/test";

const documentId = "document-123";
const runId = "run-123";
const apiBaseUrl = "http://127.0.0.1:8000";

const corsHeaders = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
};

async function mockExportPage(
    page: Page,
    exemptCount: number
) {
    await page.route(
        `${apiBaseUrl}/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: corsHeaders,
                body: JSON.stringify({
                    documentId,
                    status: "redaction_complete",
                    currentRedactionRunId: runId,
                    preferredPage: "export",
                    allowedPages: ["review", "export"],
                }),
            });
        }
    );

    await page.route(
        `${apiBaseUrl}/documents/${documentId}/redaction-runs/${runId}/export`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: corsHeaders,
                body: JSON.stringify({
                    documentId,
                    runId,
                    filename: "test.pdf",
                    status: "redaction_complete",

                    redactedExportUrl: "/redacted-file",
                    vettedExportUrl: "/vetted-file",

                    exemptExportUrl:
                        exemptCount > 0
                            ? "/exempt-file"
                            : null,

                    allFilesExportUrl: "/all-files",

                    pageCounts: {
                        original: 124,
                        exempt: exemptCount,
                        deleted: 0,
                        redacted: 124 - exemptCount,
                    },
                }),
            });
        }
    );

    await page.goto(
        `/export?documentId=${documentId}&runId=${runId}`
    );

    await expect(
        page.getByRole("heading", {
            name: "Redactions applied",
        })
    ).toBeVisible();
}

test("hides Exempted when no exempt PDF exists", async ({
    page,
}) => {
    await mockExportPage(page, 0);

    await expect(
        page.getByRole("rowheader", { name: "Redacted" })
    ).toBeVisible();

    await expect(
        page.getByRole("rowheader", { name: "Vetted" })
    ).toBeVisible();

    await expect(
        page.getByRole("rowheader", { name: "Exempted" })
    ).toHaveCount(0);

    await expect(
        page.getByRole("button", {
            name: "Download all files",
        })
    ).toBeVisible();
});

test("shows Exempted when an exempt PDF exists", async ({
    page,
}) => {
    await mockExportPage(page, 2);

    await expect(
        page.getByRole("rowheader", { name: "Redacted" })
    ).toBeVisible();

    await expect(
        page.getByRole("rowheader", { name: "Vetted" })
    ).toBeVisible();

    await expect(
        page.getByRole("rowheader", { name: "Exempted" })
    ).toBeVisible();
});

test("page counts fit at mobile and tablet widths", async ({
    page,
}) => {
    await mockExportPage(page, 0);

    for (const width of [375, 640, 768, 1024]) {
        await page.setViewportSize({
            width,
            height: 900,
        });

        const summary = page.locator(
            ".jr-export-page-counts"
        );

        await expect(summary).toBeVisible();

        await expect(
            summary.locator(".jr-export-page-counts__item")
        ).toHaveCount(4);

        const geometry = await summary.evaluate((element) => {
            const section = element.closest(
                ".jr-export-page-counts-section"
            );

            if (!section) {
                throw new Error(
                    "Page count section not found"
                );
            }

            return {
                countsRight:
                    element.getBoundingClientRect().right,
                sectionRight:
                    section.getBoundingClientRect().right,
                display:
                    getComputedStyle(element).display,
            };
        });

        expect(
            geometry.countsRight,
            `Page counts overflow at ${width}px`
        ).toBeLessThanOrEqual(
            geometry.sectionRight + 1
        );

        if (width <= 640) {
            expect(geometry.display).toBe("grid");
        }
    }
});
