import { expect, test } from "@playwright/test";

test("Back cancels the exact redaction run and returns to Review", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    let cancelledRunId: string | null = null;

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/status`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    filename: "test.pdf",
                    status: "applying_redactions",
                }),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${runId}/cancel`,
        async (route) => {
            expect(route.request().method()).toBe("POST");

            cancelledRunId = runId;

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    runId,
                    status: "cancelled",
                }),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/review`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    filename: "test.pdf",
                    status: "ready_for_review",
                    pages: [
                        {
                            pageNumber: 1,
                            textItems: [],
                            tables: [],
                            images: [],
                        },
                    ],
                    findings: [],
                    subjectDetails: {
                        subjectName: "Test Subject",
                        subjectPrisonNumber: "A1234BC",
                        otherPhrases: [],
                    },
                    summary: {
                        totalPages: 1,
                        totalFindings: 0,
                    },
                }),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-decisions`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    revision: 4,
                    decisions: [],
                    updatedAt: null,
                }),
            });
        },
    );

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Applying redactions" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();

    await expect(
        page.getByRole("button", { name: "Returning to review..." }),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Mark for redaction" }),
    ).toBeVisible();

    expect(cancelledRunId).toBe(runId);
});