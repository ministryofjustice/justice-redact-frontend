
import { expect, test, type Page } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
};

type WorkflowState = {
    status: string;
    currentRedactionRunId: string | null;
    preferredPage: string;
    allowedPages: string[];
};

// Mock the backend-authoritative document workflow.
async function mockWorkflow(
    page: Page,
    documentId: string,
    response: WorkflowState | { detail: string },
    httpStatus = 200,
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${documentId}/workflow`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: httpStatus,
                contentType: "application/json",
                headers: CORS_HEADERS,
                body: JSON.stringify(
                    httpStatus === 200
                        ? { documentId, ...response }
                        : response,
                ),
            });
        },
    );
}

// Mock the APIs required to render the current Review page.
async function mockReview(
    page: Page,
    documentId: string,
    status: string,
    revision = 4,
): Promise<void> {
    const reviewPage = {
        pageNumber: 1,
        textItems: [],
        tables: [],
        images: [],
    };

    await page.route(
        `${API_BASE_URL}/documents/${documentId}/review`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    documentId,
                    filename: "test.pdf",
                    status,
                    pages: [reviewPage],
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
        `${API_BASE_URL}/documents/${documentId}/review/pages?pageStart=1&pageEnd=1`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    documentId,
                    pages: [reviewPage],
                }),
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${documentId}/redaction-decisions`,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    documentId,
                    revision,
                    decisions: [],
                    updatedAt: null,
                }),
            });
        },
    );
}

// Mock the current versioned redaction-run status endpoint.
async function mockRedactionStatus(
    page: Page,
    documentId: string,
    runId: string,
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${documentId}/redaction-runs/${runId}/status`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    documentId,
                    runId,
                    status: "processing",
                    processingProgress: 30,
                }),
            });
        },
    );
}

// Mock the Export response for a completed redaction run.
async function mockExport(
    page: Page,
    documentId: string,
    runId: string,
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${documentId}/redaction-runs/${runId}/export`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: CORS_HEADERS,
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
}

// 1. Stale Processing URL redirects to Review
test("stale Processing URL redirects to the authoritative Review page", async ({
    page,
}) => {
    const documentId = "document-123";

    await mockWorkflow(page, documentId, {
        status: "ready_for_review",
        currentRedactionRunId: null,
        preferredPage: "review",
        allowedPages: ["review"],
    });

    await mockReview(
        page,
        documentId,
        "ready_for_review",
        0,
    );

    await page.goto(
        `/processing?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();
});

// 2. Stale Applying Redactions URL redirects to current run
test("stale Applying Redactions URL redirects to the current redaction run", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-old";
    const currentRunId = "run-current";

    await mockWorkflow(page, documentId, {
        status: "applying_redactions",
        currentRedactionRunId: currentRunId,
        preferredPage: "applying-redactions",
        allowedPages: ["applying-redactions"],
    });

    await mockRedactionStatus(
        page,
        documentId,
        currentRunId,
    );

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(page).toHaveURL(
        `/applying-redactions?documentId=${documentId}&runId=${currentRunId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Your redactions are being applied",
            exact: true,
        }),
    ).toBeVisible();
});

// 3. Missing document returns 404
test("workflow 404 shows the Page not found error page", async ({
    page,
}) => {
    const documentId = "missing-document";

    await mockWorkflow(
        page,
        documentId,
        {
            detail: "Document not found",
        },
        404,
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Page not found",
            exact: true,
        }),
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

// 4. Temporary workflow service failure returns 503
test("temporary workflow service failure shows the service unavailable page", async ({
    page,
}) => {
    const documentId = "document-123";

    await mockWorkflow(
        page,
        documentId,
        {
            detail: "Service unavailable",
        },
        503,
    );

    await page.goto(
        `/processing?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, the service is unavailable",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByText("Try again soon."),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/processing?documentId=${documentId}`,
    );
});

// 5. Unexpected workflow failure returns 500
test("unexpected workflow failure shows the service problem page", async ({
    page,
}) => {
    const documentId = "document-123";

    await mockWorkflow(
        page,
        documentId,
        {
            detail: "Internal server error",
        },
        500,
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, there is a problem with the service",
            exact: true,
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

// 6. Forbidden workflow access returns 403
test("workflow access denied shows the access error page", async ({
    page,
}) => {
    const documentId = "document-123";

    await mockWorkflow(
        page,
        documentId,
        {
            detail: "Forbidden",
        },
        403,
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "You do not have access to this service",
            exact: true,
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

// 7. Invalid workflow request returns 400
test("workflow 400 shows the generic request problem page", async ({
    page,
}) => {
    const documentId = "document-123";

    await mockWorkflow(
        page,
        documentId,
        {
            detail: "Bad request",
        },
        400,
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, there is a problem",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByText("Try again later."),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );
});

// 8. Missing document ID redirects to Upload
test("missing document ID redirects to Upload", async ({
    page,
}) => {
    await page.goto("/review");

    await expect(page).toHaveURL("/upload");
});

// 9. Missing Export run ID is upgraded to current run
test("Export without a run ID is upgraded to the current completed run", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await mockWorkflow(page, documentId, {
        status: "redaction_complete",
        currentRedactionRunId: runId,
        preferredPage: "export",
        allowedPages: ["review", "export"],
    });

    await mockExport(page, documentId, runId);

    await page.goto(
        `/export?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redactions applied",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("button", {
            name: "Download all files",
        }),
    ).toBeVisible();
});

// 10. Export before completion redirects to Applying Redactions
test("Export before redaction completion redirects to Applying Redactions", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await mockWorkflow(page, documentId, {
        status: "applying_redactions",
        currentRedactionRunId: runId,
        preferredPage: "applying-redactions",
        allowedPages: ["applying-redactions"],
    });

    await mockRedactionStatus(
        page,
        documentId,
        runId,
    );

    await page.goto(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(page).toHaveURL(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Your redactions are being applied",
            exact: true,
        }),
    ).toBeVisible();
});

// 11. Cancelled Applying Redactions URL redirects to Review
test("Applying Redactions URL after cancellation redirects to Review", async ({
    page,
}) => {
    const documentId = "document-123";
    const oldRunId = "run-cancelled";

    await mockWorkflow(page, documentId, {
        status: "ready_for_review",
        currentRedactionRunId: null,
        preferredPage: "review",
        allowedPages: ["review"],
    });

    await mockReview(
        page,
        documentId,
        "ready_for_review",
    );

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${oldRunId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();
});

// 12. Completed Applying Redactions URL redirects to Export
test("Applying Redactions URL after completion redirects to versioned Export", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await mockWorkflow(page, documentId, {
        status: "redaction_complete",
        currentRedactionRunId: runId,
        preferredPage: "export",
        allowedPages: ["review", "export"],
    });

    await mockExport(page, documentId, runId);

    await page.goto(
        `/applying-redactions?documentId=${documentId}&runId=${runId}`,
    );

    await expect(page).toHaveURL(
        `/export?documentId=${documentId}&runId=${runId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Redactions applied",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("button", {
            name: "Download all files",
        }),
    ).toBeVisible();
});

// 13. Review remains accessible after redaction completion
test("Review remains accessible after redaction completion", async ({
    page,
}) => {
    const documentId = "document-123";
    const runId = "run-123";

    await mockWorkflow(page, documentId, {
        status: "redaction_complete",
        currentRedactionRunId: runId,
        preferredPage: "export",
        allowedPages: ["review", "export"],
    });

    await mockReview(
        page,
        documentId,
        "redaction_complete",
    );

    await page.goto(
        `/review?documentId=${documentId}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${documentId}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();
});
