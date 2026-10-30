import { expect, test } from "@playwright/test";

test("Back cancels the exact redaction run and returns to Review", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    page.on("request", (request) => {
        if (request.url().includes("/documents/")) {
            console.log("[API REQUEST]", request.method(), request.url());
        }
    });

    page.on("response", (response) => {
        if (response.url().includes("/documents/")) {
            console.log("[API RESPONSE]", response.status(), response.url());
        }
    });

    page.on("requestfailed", (request) => {
        console.log(
            "[REQUEST FAILED]",
            request.url(),
            request.failure()?.errorText,
        );
    });

    page.on("console", (message) => {
        if (message.type() === "error") {
            console.log("[BROWSER ERROR]", message.text());
        }
    });

    let cancelledRunId: string | null = null;

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            const isCancelled = cancelledRunId === runId;

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true",
                },
                body: JSON.stringify(
                    isCancelled
                        ? {
                            documentId,
                            status: "ready_for_review",
                            currentRedactionRunId: null,
                            preferredPage: "review",
                            allowedPages: ["review"],
                        }
                        : {
                            documentId,
                            status: "applying_redactions",
                            currentRedactionRunId: runId,
                            preferredPage: "applying-redactions",
                            allowedPages: ["applying-redactions"],
                        },
                ),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${runId}/status`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true",
                },
                body: JSON.stringify({
                    documentId,
                    runId,
                    status: "processing",
                    processingProgress: 30,
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
                    "Access-Control-Allow-Credentials": "true",
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
                    "Access-Control-Allow-Credentials": "true",
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
                    "Access-Control-Allow-Credentials": "true",
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

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/review/pages?pageStart=1&pageEnd=1`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true",
                },
                body: JSON.stringify({
                    documentId,
                    pages: [
                        {
                            pageNumber: 1,
                            textItems: [],
                            tables: [],
                            images: [],
                        },
                    ],
                }),
            });
        },
    );

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Your redactions are being applied",
        }),
    ).toBeVisible();

    await page.getByRole("link", {
        name: "Back",
        exact: true,
    }).click();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    expect(cancelledRunId).toBe(runId);

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();
});