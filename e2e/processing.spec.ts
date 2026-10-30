
import {
    expect,
    test,
    type Page,
    type Route,
} from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";
const DOCUMENT_ID = "document-123";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

type WorkflowStage = "processing" | "ready_for_review";

type DocumentStatus = {
    status: string;
    processingProgress: number;
};

async function fulfillJson(
    route: Route,
    body: unknown,
    status = 200,
): Promise<void> {
    if (route.request().method() === "OPTIONS") {
        await route.fulfill({
            status: 204,
            headers: CORS_HEADERS,
        });
        return;
    }

    await route.fulfill({
        status,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify(body),
    });
}

async function mockWorkflow(
    page: Page,
    stage: { value: WorkflowStage },
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/workflow`,
        async (route) => {
            const ready =
                stage.value === "ready_for_review";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: stage.value,
                currentRedactionRunId: null,
                preferredPage: ready
                    ? "review"
                    : "processing",
                allowedPages: ready
                    ? ["review"]
                    : ["processing"],
            });
        },
    );
}

async function mockStatus(
    page: Page,
    getStatus: () => DocumentStatus,
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/status`,
        async (route) => {
            expect(route.request().method()).toBe("GET");

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                filename: "test.pdf",
                ...getStatus(),
            });
        },
    );
}

async function mockReview(page: Page): Promise<void> {
    const reviewPage = {
        pageNumber: 1,
        textItems: [],
        tables: [],
        images: [],
    };

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                filename: "test.pdf",
                status: "ready_for_review",
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
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/search`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [reviewPage],
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/pages?pageStart=1&pageEnd=1`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [reviewPage],
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/redaction-decisions`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                revision: 0,
                decisions: [],
                updatedAt: null,
            });
        },
    );
}

async function mockAuthenticatedUpload(
    page: Page,
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/auth/me`,
        async (route) => {
            await fulfillJson(route, {
                authenticated: true,
                email: "tester@justice.gov.uk",
            });
        },
    );
}

// 1. Processing displays backend progress
test("Processing displays progress returned by the backend", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);

    await mockStatus(page, () => ({
        status: "processing",
        processingProgress: 35,
    }));

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Your file is being processed",
            exact: true,
        }),
    ).toBeVisible();

    const progress = page.getByRole("progressbar", {
        name: "File processing progress",
    });

    await expect(progress).toBeVisible();

    await expect(progress).toHaveAttribute(
        "aria-valuenow",
        "35",
    );
});

// 2. Progress must never move backwards
test("Processing progress does not decrease when the backend reports a lower value", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);

    let statusRequests = 0;

    await mockStatus(page, () => {
        statusRequests += 1;

        return {
            status: "processing",
            processingProgress:
                statusRequests === 1 ? 70 : 25,
        };
    });

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    const progress = page.getByRole("progressbar", {
        name: "File processing progress",
    });

    await expect(progress).toHaveAttribute(
        "aria-valuenow",
        "70",
    );

    await expect.poll(
        () => statusRequests,
    ).toBeGreaterThanOrEqual(2);

    await expect(progress).toHaveAttribute(
        "aria-valuenow",
        "70",
    );
});

// 3. Completed processing navigates to Review
test("completed processing prefetches Review data and navigates to Review", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockReview(page);

    const prefetchedUrls: string[] = [];

    page.on("request", (request) => {
        if (
            request.url() ===
            `${API_BASE_URL}/documents/${DOCUMENT_ID}/review` ||
            request.url() ===
            `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/search`
        ) {
            prefetchedUrls.push(request.url());
        }
    });

    await mockStatus(page, () => {
        stage.value = "ready_for_review";

        return {
            status: "ready_for_review",
            processingProgress: 100,
        };
    });

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await expect(page).toHaveURL(
        `/review?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    expect(prefetchedUrls).toContain(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review`,
    );

    expect(prefetchedUrls).toContain(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/search`,
    );
});

// 4. Failed document processing displays an error
test("failed document processing displays the service problem page", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);

    await mockStatus(page, () => ({
        status: "failed",
        processingProgress: 30,
    }));

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Sorry, there is a problem",
            exact: true,
        }),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/processing?documentId=${DOCUMENT_ID}`,
    );
});

// 5. Back abandons processing and returns to Upload
test("Back abandons document processing before returning to Upload", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockAuthenticatedUpload(page);

    await mockStatus(page, () => ({
        status: "processing",
        processingProgress: 40,
    }));

    let abandonRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/abandon`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");

            abandonRequests += 1;

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "abandoned",
            });
        },
    );

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Your file is being processed",
            exact: true,
        }),
    ).toBeVisible();

    await page.getByRole("link", {
        name: "Back",
        exact: true,
    }).click();

    await expect(page).toHaveURL("/upload");

    expect(abandonRequests).toBe(1);
});

// 6. Abandonment during Review prefetch
test("abandoning during Review prefetch returns to Upload instead of Review", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockReview(page);
    await mockAuthenticatedUpload(page);

    let notifyPrefetchStarted = () => { };

    const prefetchStarted = new Promise<void>((resolve) => {
        notifyPrefetchStarted = resolve;
    });

    let releasePrefetch = () => { };

    const prefetchGate = new Promise<void>((resolve) => {
        releasePrefetch = resolve;
    });

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/search`,
        async (route) => {
            notifyPrefetchStarted();

            await prefetchGate;

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [],
            });
        },
    );

    await mockStatus(page, () => {
        stage.value = "ready_for_review";

        return {
            status: "ready_for_review",
            processingProgress: 100,
        };
    });

    let abandonRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/abandon`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            abandonRequests += 1;

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "abandoned",
            });
        },
    );

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await prefetchStarted;

    try {
        await expect(
            page.getByRole("heading", {
                name: "Your file is being processed",
                exact: true,
            }),
        ).toBeVisible();

        await page.getByRole("link", {
            name: "Back",
            exact: true,
        }).click();

        await expect(page).toHaveURL("/upload");

        expect(abandonRequests).toBe(1);
    } finally {
        releasePrefetch();
    }

    await expect(page).toHaveURL("/upload");
});
