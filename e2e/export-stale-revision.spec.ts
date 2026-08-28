import { expect, test } from "@playwright/test";

test("an open Export page blocks downloads when a newer revision supersedes it", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-old";
    const newRunId = "run-new";

    let currentRunId = oldRunId;

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
                        ? {
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

    await page.goto(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Redaction complete" }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", { name: "Download" }),
    ).toHaveCount(2);

    currentRunId = newRunId;

    await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
    });

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

    await expect(
        page.getByRole("link", { name: "Download" }),
    ).toHaveCount(0);

    await expect(
        page.getByText("Not available"),
    ).toHaveCount(2);

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${oldRunId}`,
    );
});