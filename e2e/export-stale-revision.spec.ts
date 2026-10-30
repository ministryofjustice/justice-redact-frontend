
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

    // Start with the old run as the authoritative completed run.
    // Changing this variable simulates the backend selecting a newer run.
    let currentRunId = oldRunId;

    // Mock the authoritative backend workflow endpoint.
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

    // Mock a completed Export response for a specific redaction run.
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

    // STEP 1: Open the original completed Export page.
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

    // The initial download belongs to the old run.
    await expect(downloadAllButton).toHaveAttribute(
        "href",
        new RegExp(
            `/redaction-runs/${oldRunId}/all-files`,
        ),
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    // STEP 2: A newer completed run supersedes the old run.
    currentRunId = newRunId;

    // The Export page checks the workflow when browser visibility
    // changes. Simulate that event without reloading the page.
    await page.evaluate(() => {
        document.dispatchEvent(
            new Event("visibilitychange"),
        );
    });

    // The old Export page must redirect to the dedicated
    // superseded-revision page.
    await expect(page).toHaveURL(
        `/export/superseded?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "There is a newer version of these files",
            exact: true,
        }),
    ).toBeVisible();

    // The superseded run must not offer downloads.
    await expect(
        page.getByRole("button", {
            name: "Download all files",
        }),
    ).toHaveCount(0);

    // The user should be able to navigate to the current revision.
    const latestVersionLink = page.getByRole("link", {
        name: "Go to the latest version",
        exact: true,
    });

    await expect(latestVersionLink).toBeVisible();

    await expect(latestVersionLink).toHaveAttribute(
        "href",
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    // STEP 3: Refresh the superseded page.
    await page.reload();

    // The backend workflow must remain authoritative after reload,
    // not just while the original React state is in memory.
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

    // STEP 4: Open the latest authoritative Export page.
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

    // The latest run must have its own download.
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

    // The latest run must not display the superseded warning.
    await expect(
        page.getByRole("heading", {
            name: "There is a newer version of these files",
        }),
    ).toHaveCount(0);
});
