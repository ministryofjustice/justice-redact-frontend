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
                        totalPages: 120,
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

    const requestedPageRanges: string[] = [];

    await page.route(
        `**/documents/${documentId}/review/pages**`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            const url = new URL(route.request().url());
            const pageStart = Number(
                url.searchParams.get("pageStart"),
            );
            const pageEnd = Number(
                url.searchParams.get("pageEnd"),
            );

            requestedPageRanges.push(`${pageStart}-${pageEnd}`);

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Credentials": "true",
                },
                body: JSON.stringify({
                    documentId,
                    pages: Array.from(
                        { length: 20 },
                        (_, index) => ({
                            pageNumber: 101 + index,
                            textItems: [],
                            tables: [],
                            images: [],
                        }),
                    ),
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
        `/review?documentId=${documentId}&returnTo=end`,
    );

    expect(cancelledRunId).toBe(runId);

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    // Review must load the final batch, not the first 50 pages.
    await expect(
        page.locator(
            '.jr-review-page[aria-labelledby="review-page-120-heading"]',
        ),
    ).toBeVisible();

    await expect(
        page.locator(".jr-review-page"),
    ).toHaveCount(20);

    await expect(
        page.getByRole("button", {
            name: "Pages 101 to 120",
        }),
    ).toHaveAttribute("aria-current", "page");

    expect(requestedPageRanges.length).toBeGreaterThan(0);
    expect(
        requestedPageRanges.every(
            (range) => range === "101-120",
        ),
    ).toBe(true);

    // The end-of-document actions must be inside the viewport,
    // not merely present somewhere below the visible area.
    const endOfDocument = page.locator(".end-of-page");

    await expect(endOfDocument).toBeVisible();

    await expect.poll(async () =>
        endOfDocument.evaluate((element) => {
            const rect = element.getBoundingClientRect();

            return (
                window.scrollY > 0 &&
                rect.top < window.innerHeight &&
                rect.bottom <= window.innerHeight + 1
            );
        }),
    ).toBe(true);

    await expect(
        endOfDocument.getByRole("button", {
            name: "Apply redactions",
        }),
    ).toBeVisible();
});