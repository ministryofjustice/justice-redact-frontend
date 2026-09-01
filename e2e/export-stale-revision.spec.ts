import { expect, test } from "@playwright/test";

test("an open Export page blocks downloads when a newer revision supersedes it", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-old";
    const newRunId = "run-new";

    let currentRunId = oldRunId;
    let newRunComplete = false;

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            const hasNewerRun = currentRunId === newRunId;

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify(
                    hasNewerRun
                        ? newRunComplete
                            ? {
                                documentId,
                                status: "redaction_complete",
                                currentRedactionRunId: newRunId,
                                preferredPage: "export",
                                allowedPages: ["review", "export"],
                            }
                            : {
                                documentId,
                                status: "applying_redactions",
                                currentRedactionRunId: newRunId,
                                preferredPage: "applying-redactions",
                                allowedPages: ["applying-redactions"],
                            }
                        : {
                            documentId,
                            status: "redaction_complete",
                            currentRedactionRunId: oldRunId,
                            preferredPage: "export",
                            allowedPages: ["review", "export"],
                        },
                ),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${oldRunId}/export`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
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

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${newRunId}/export`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    runId: newRunId,
                    filename: "test.pdf",
                    status: "redaction_complete",
                    redactedExportUrl:
                        `/documents/${documentId}/redaction-runs/${newRunId}/redacted-file`,
                    vettedExportUrl:
                        `/documents/${documentId}/redaction-runs/${newRunId}/vetted-file`,
                    exemptExportUrl: null,
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

    // Load the first completed Export revision.
    await page.goto(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redaction complete",
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", {
            name: "Download",
        }),
    ).toHaveCount(2);

    // A newer Apply Redactions run starts.
    currentRunId = newRunId;

    await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });

    // The old Export page stays open but is clearly marked as stale.
    await expect(
        page.getByRole("heading", {
            name: "A newer version of this document exists",
        }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "You can no longer download files from this version.",
        ),
    ).toBeVisible();

    // The newer revision is still processing, so there is not yet a latest
    // completed Export page to link to.
    await expect(
        page.getByRole("link", {
            name: "Go to the latest version",
        }),
    ).toHaveCount(0);

    // Downloads from the superseded revision are disabled.
    await expect(
        page.getByRole("link", {
            name: "Download",
        }),
    ).toHaveCount(0);

    await expect(
        page.getByText("Not available"),
    ).toHaveCount(2);

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    // Simulate the stale tab being refreshed or restored after the browser
    // has discarded its in-memory React state.
    await page.reload();

    await expect(
        page.getByRole("heading", {
            name: "A newer version of this document exists",
        }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "You can no longer download files from this version.",
        ),
    ).toBeVisible();

    // Historical metadata should be reconstructed after refresh.
    await expect(
        page.getByRole("table", {
            name: "Exported documents",
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", {
            name: "Download",
        }),
    ).toHaveCount(0);

    await expect(
        page.getByText("Not available"),
    ).toHaveCount(2);

    await expect(
        page.getByText("Loading export details..."),
    ).toHaveCount(0);

    await expect(
        page.getByRole("link", {
            name: "Go to the latest version",
        }),
    ).toHaveCount(0);

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    // The newer revision now finishes successfully.
    newRunComplete = true;

    await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });

    // The stale page now provides a route to the current completed revision.
    const latestVersionLink = page.getByRole("link", {
        name: "Go to the latest version",
    });

    await expect(latestVersionLink).toBeVisible();

    await expect(latestVersionLink).toHaveAttribute(
        "href",
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    await latestVersionLink.click();

    // The latest version is authoritative and downloadable.
    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${newRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redaction complete",
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("heading", {
            name: "A newer version of this document exists",
        }),
    ).toHaveCount(0);

    await expect(
        page.getByRole("link", {
            name: "Download",
        }),
    ).toHaveCount(2);
});