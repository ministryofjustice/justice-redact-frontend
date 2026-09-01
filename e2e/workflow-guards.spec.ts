import { expect, test } from "@playwright/test";

test("stale Processing URL redirects to the authoritative Review page", async ({
    page,
}) => {
    const documentId = "document-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "ready_for_review",
                    currentRedactionRunId: null,
                    preferredPage: "review",
                    allowedPages: ["review"],
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
                    revision: 0,
                    decisions: [],
                    updatedAt: null,
                }),
            });
        },
    );

    await page.goto(
        `/processing?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Mark for redaction" }),
    ).toBeVisible();
});

test("stale Applying Redactions URL redirects to the current redaction run", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-old";
    const currentRunId = "run-current";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "applying_redactions",
                    currentRedactionRunId: currentRunId,
                    preferredPage: "applying-redactions",
                    allowedPages: ["applying-redactions"],
                }),
            });
        },
    );

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

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(page).toHaveURL(
        `/applying-redactions?documentId=${documentId}&runId=${currentRunId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Applying redactions" }),
    ).toBeVisible();
});

test("workflow 404 shows the Page not found error page", async ({
    page,
}) => {
    const documentId = "missing-document";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 404,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    detail: "Document not found",
                }),
            });
        },
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "Otherwise, if it's been over 30 days since you uploaded your file, the link will have expired.",
            { exact: false },
        ),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );
});

test("temporary workflow service failure shows the service unavailable page", async ({
    page,
}) => {
    const documentId = "document-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    detail: "Service unavailable",
                }),
            });
        },
    );

    await page.goto(
        `/processing?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, the service is unavailable",
        }),
    ).toBeVisible();

    await expect(
        page.getByText("Try again soon."),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/processing?documentId=${documentId}`,
    );
});

test("unexpected workflow failure shows the service problem page", async ({
    page,
}) => {
    const documentId = "document-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    detail: "Internal server error",
                }),
            });
        },
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, there is a problem with the service",
        }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "Try reloading the page. You can do this by pressing F5 on a PC or cmd + R on a mac.",
        ),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );
});

test("workflow access denied shows the access error page", async ({
    page,
}) => {
    const documentId = "document-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 403,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    detail: "Forbidden",
                }),
            });
        },
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "You do not have access to this service",
        }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "Check that your MOJ VPN is on and try again.",
        ),
    ).toBeVisible();

    await expect(
        page.getByText(
            "If that does not work, it means you cannot access Justice Redact.",
        ),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );
});

test("workflow 400 shows the generic request problem page", async ({
    page,
}) => {
    const documentId = "document-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 400,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    detail: "Bad request",
                }),
            });
        },
    );

    await page.goto(`/review?documentId=${documentId}`);

    await expect(
        page.getByRole("heading", {
            name: "Sorry, there is a problem",
        }),
    ).toBeVisible();

    await expect(
        page.getByText("Try again later."),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );
});


test("missing document ID redirects to Upload", async ({
    page,
}) => {
    await page.goto("/review");

    await expect(page).toHaveURL("/upload");
});


test("Export without a run ID is upgraded to the current completed run", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "redaction_complete",
                    currentRedactionRunId: runId,
                    preferredPage: "export",
                    allowedPages: ["review", "export"],
                }),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${runId}/export`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
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
                    pageCount: 1,
                    pageCounts: {
                        original: 1,
                        exempt: 0,
                        deleted: 0,
                        redacted: 1,
                    },
                }),
            });
        },
    );

    await page.goto(
        `/export?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Redaction complete" }),
    ).toBeVisible();
});


test("Export before redaction completion redirects to Applying Redactions", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "applying_redactions",
                    currentRedactionRunId: runId,
                    preferredPage: "applying-redactions",
                    allowedPages: ["applying-redactions"],
                }),
            });
        },
    );

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

    await page.goto(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(page).toHaveURL(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Applying redactions" }),
    ).toBeVisible();
});


test("Applying Redactions URL after cancellation redirects to Review", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-cancelled";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "ready_for_review",
                    currentRedactionRunId: null,
                    preferredPage: "review",
                    allowedPages: ["review"],
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
        `/applying-redactions?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Mark for redaction" }),
    ).toBeVisible();
});


test("Applying Redactions URL after completion redirects to versioned Export", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "redaction_complete",
                    currentRedactionRunId: runId,
                    preferredPage: "export",
                    allowedPages: ["review", "export"],
                }),
            });
        },
    );

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/redaction-runs/${runId}/export`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
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
                    pageCount: 1,
                    pageCounts: {
                        original: 1,
                        exempt: 0,
                        deleted: 0,
                        redacted: 1,
                    },
                }),
            });
        },
    );

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Redaction complete" }),
    ).toBeVisible();
});


test("Review remains accessible after redaction completion", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await page.route(
        `http://127.0.0.1:8000/documents/${documentId}/workflow`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                },
                body: JSON.stringify({
                    documentId,
                    status: "redaction_complete",
                    currentRedactionRunId: runId,
                    preferredPage: "export",
                    allowedPages: ["review", "export"],
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
                    status: "redaction_complete",
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
        `/review?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", { name: "Mark for redaction" }),
    ).toBeVisible();
});