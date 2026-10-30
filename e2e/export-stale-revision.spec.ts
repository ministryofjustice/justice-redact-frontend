
import { expect, test } from "@playwright/test";

test("an open Export page blocks downloads when a newer revision supersedes it", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-old";
    const newRunId = "run-new";

    const apiBaseUrl = "http://127.0.0.1:8000";

    const corsHeaders = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
    };

    let currentRunId = oldRunId;

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
                    currentRedactionRunId: currentRunId,
                    preferredPage: "export",
                    allowedPages: ["review", "export"],
                }),
            });
        },
    );

    async function mockExport(runId: string) {
        await page.route(
            `${apiBaseUrl}/documents/${documentId}/redaction-runs/${runId}/export`,
            async (route) => {
                expect(route.request().method()).toBe("GET");

                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    headers: corsHeaders,
                    body: JSON.stringify({
                        documentId,
                        runId,
                        filename: "test.pdf",
                        status: "redaction_complete",

                        redactedExportUrl:
                            `/documents/${documentId}/redaction-runs/${runId}/redacted-file`,

                        vettedExportUrl:
                            `/documents/${documentId}/redaction-runs/${runId}/vetted-file`,

                        exemptExportUrl: null,

                        allFilesExportUrl:
                            `/documents/${documentId}/redaction-runs/${runId}/all-files`,

                        pageCount: 10,

                        pageCounts: {
                            original: 10,
                            exempt: 0,
                            deleted: 0,
                            redacted: 10,
                        },
                    }),
                });
            },
        );
    }

    await mockExport(oldRunId);
    await mockExport(newRunId);

    await page.goto(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redactions applied",
            exact: true,
        }),
    ).toBeVisible();

    const downloadAllButton = page.getByRole("button", {
        name: "Download all files",
    });

    await expect(downloadAllButton).toBeVisible();

    await expect(downloadAllButton).toHaveAttribute(
        "href",
        new RegExp(
            `/redaction-runs/${oldRunId}/all-files`,
        ),
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    currentRunId = newRunId;

    await page.evaluate(() => {
        document.dispatchEvent(
            new Event("visibilitychange"),
        );
    });

    await expect(page).toHaveURL(
        `/export/superseded?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "There is a newer version of these files",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("button", {
            name: "Download all files",
        }),
    ).toHaveCount(0);

    const latestVersionLink = page.getByRole("link", {
        name: "Go to the latest version",
        exact: true,
    });

    await expect(latestVersionLink).toBeVisible();

    await expect(latestVersionLink).toHaveAttribute(
        "href",
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    await page.reload();

    await expect(page).toHaveURL(
        `/export/superseded?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "There is a newer version of these files",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("button", {
            name: "Download all files",
        }),
    ).toHaveCount(0);

    const refreshedLatestVersionLink = page.getByRole("link", {
        name: "Go to the latest version",
        exact: true,
    });

    await expect(
        refreshedLatestVersionLink,
    ).toHaveAttribute(
        "href",
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    await refreshedLatestVersionLink.click();

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redactions applied",
            exact: true,
        }),
    ).toBeVisible();

    const latestDownloadButton = page.getByRole("button", {
        name: "Download all files",
    });

    await expect(latestDownloadButton).toBeVisible();

    await expect(latestDownloadButton).toHaveAttribute(
        "href",
        new RegExp(
            `/redaction-runs/${newRunId}/all-files`,
        ),
    );

    await expect(
        page.getByRole("heading", {
            name: "There is a newer version of these files",
        }),
    ).toHaveCount(0);
});
