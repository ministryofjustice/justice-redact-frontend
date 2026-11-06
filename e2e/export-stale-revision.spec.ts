
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

test("Export hides download controls while workflow revalidation is pending", async ({
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

    const exportUrl =
        `/export?documentId=${documentId}&runId=${oldRunId}`;

    const supersededUrl =
        `/export/superseded?documentId=${documentId}&runId=${oldRunId}`;

    let currentRunId = oldRunId;

    let holdNextWorkflowResponse = false;

    let notifyRevalidationStarted = () => { };

    const revalidationStarted = new Promise<void>((resolve) => {
        notifyRevalidationStarted = () => resolve();
    });

    let releaseWorkflowResponse = () => { };

    const workflowResponseGate = new Promise<void>((resolve) => {
        releaseWorkflowResponse = () => resolve();
    });

    await page.route(
        `${apiBaseUrl}/documents/${documentId}/workflow`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            if (holdNextWorkflowResponse) {
                holdNextWorkflowResponse = false;

                notifyRevalidationStarted();

                await workflowResponseGate;
            }

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

    await page.route(
        `${apiBaseUrl}/documents/${documentId}/redaction-runs/${oldRunId}/export`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: corsHeaders,
                body: JSON.stringify({
                    documentId,
                    runId: oldRunId,
                    filename: "test.pdf",
                    status: "redaction_complete",

                    redactedExportUrl:
                        `/documents/${documentId}/redaction-runs/${oldRunId}/redacted-file`,

                    vettedExportUrl:
                        `/documents/${documentId}/redaction-runs/${oldRunId}/vetted-file`,

                    exemptExportUrl: null,

                    allFilesExportUrl:
                        `/documents/${documentId}/redaction-runs/${oldRunId}/all-files`,

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

    // STEP 1: Verify a valid Export page allows downloads.
    await page.goto(exportUrl);

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

    // STEP 2: Trigger revalidation but hold the API response.
    holdNextWorkflowResponse = true;

    await page.evaluate(() => {
        document.dispatchEvent(
            new Event("visibilitychange"),
        );
    });


    await revalidationStarted;

    try {

        // STEP 3: Downloads must disappear BEFORE the response.
        await expect(page).toHaveURL(exportUrl);

        await expect(downloadAllButton).toHaveCount(0);

        await expect(
            page.getByRole("heading", {
                name: "Redactions applied",
                exact: true,
            }),
        ).toHaveCount(0);

        currentRunId = newRunId;
    } finally {
        releaseWorkflowResponse();
    }

    // STEP 4: The old revision must become superseded.

    await expect(page).toHaveURL(supersededUrl);

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

    await expect(latestVersionLink).toHaveAttribute(
        "href",
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );
});
