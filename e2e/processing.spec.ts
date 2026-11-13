
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

type WorkflowStage = "processing" | "ready_for_review" | "uploaded";

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
                    : stage.value === "uploaded"
                      ? "subject-details"
                      : "processing",
                allowedPages: ready
                    ? ["review"]
                    : stage.value === "uploaded"
                      ? ["subject-details"]
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
                subjectName: "Test Subject",
                subjectPrisonNumber: "A1234BC",
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

// 5. Back preserves the uploaded document and restores Subject details
test("Back returns to Subject details without abandoning the document", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockAuthenticatedUpload(page);

    await mockStatus(page, () => ({
        status: stage.value,
        processingProgress: 40,
    }));

    let returnRequests = 0;
    let abandonRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/abandon`,
        async (route) => {
            abandonRequests += 1;
            await fulfillJson(route, {
                detail: "Unexpected abandonment",
            }, 500);
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/return-to-subject-details`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");
            returnRequests += 1;

            stage.value = "uploaded";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "uploaded",
                preferredPage: "subject-details",
                allowedPages: ["subject-details"],
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

    await expect(page).toHaveURL(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.locator("#subject-name"),
    ).toHaveValue("Test Subject");

    expect(returnRequests).toBe(1);
    expect(abandonRequests).toBe(0);
});


// 6. Processing completes while Back is pending

test("waits for Back response before navigating to completed Review", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockReview(page);
    await mockAuthenticatedUpload(page);

    const reviewNavigations: string[] = [];

    page.on("framenavigated", (frame) => {
        if (
            frame === page.mainFrame() &&
            new URL(frame.url()).pathname === "/review"
        ) {
            reviewNavigations.push(frame.url());
        }
    });

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

    let notifyReturnStarted = () => { };

    const returnStarted = new Promise<void>((resolve) => {
        notifyReturnStarted = resolve;
    });

    let releaseReturn = () => { };

    const returnGate = new Promise<void>((resolve) => {
        releaseReturn = resolve;
    });

    let returnRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/return-to-subject-details`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");

            returnRequests += 1;
            notifyReturnStarted();

            await returnGate;

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "ready_for_review",
                    preferredPage: "review",
                    allowedPages: ["review"],
            });
        },
    );

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    await prefetchStarted;

    try {
        await page.getByRole("link", {
            name: "Back",
            exact: true,
        }).click({
            noWaitAfter: true,
        });

        await returnStarted;

        await expect(
            page.getByRole("link", {
                name: "Returning to subject details...",
            }),
        ).toBeVisible();

        const searchResponse = page.waitForResponse(
            (response) =>
                response.url() ===
                `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/search` &&
                response.status() === 200,
        );

        releasePrefetch();

        await searchResponse;

        await page.waitForTimeout(350);

        await expect(page).toHaveURL(
            `/processing?documentId=${DOCUMENT_ID}`,
        );

        expect(reviewNavigations).toEqual([]);
    } finally {
        releasePrefetch();
        releaseReturn();
    }

    await expect(page).toHaveURL(`/review?documentId=${DOCUMENT_ID}`);

    expect(returnRequests).toBe(1);
});


test("failed Back request resumes processing and allows retry", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "processing",
    };

    await mockWorkflow(page, stage);
    await mockAuthenticatedUpload(page);

    let statusRequests = 0;

    await mockStatus(page, () => {
        statusRequests += 1;

        return {
            status: stage.value,
            processingProgress: 40,
        };
    });

    let returnAttempts = 0;
    let abandonRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/abandon`,
        async (route) => {
            abandonRequests += 1;
            await fulfillJson(
                route,
                { detail: "Unexpected abandonment" },
                500,
            );
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/return-to-subject-details`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");

            returnAttempts += 1;

            if (returnAttempts === 1) {
                await fulfillJson(
                    route,
                    {
                        detail: "Unable to return to subject details",
                    },
                    503,
                );
                return;
            }

            stage.value = "uploaded";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "uploaded",
                preferredPage: "subject-details",
                allowedPages: ["subject-details"],
            });
        },
    );

    await page.goto(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    const progress = page.getByRole("progressbar", {
        name: "File processing progress",
    });

    await expect(progress).toHaveAttribute(
        "aria-valuenow",
        "40",
    );

    const backLink = page.getByRole("link", {
        name: "Back",
        exact: true,
    });

    // First attempt fails.
    await backLink.click();

    await expect.poll(
        () => returnAttempts,
    ).toBe(1);

    // Error is recoverable: the processing page remains visible.
    await expect(
        page.locator("p.govuk-error-message[role='alert']"),
    ).toHaveText("Unable to return to subject details");

    await expect(backLink).toBeVisible();

    await expect(page).toHaveURL(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    // Processing polling must resume after the failure.
    await expect.poll(
        () => statusRequests,
    ).toBeGreaterThanOrEqual(2);

    // Second attempt succeeds.
    await backLink.click();

    await expect(page).toHaveURL(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.locator("#subject-name"),
    ).toHaveValue("Test Subject");

    expect(returnAttempts).toBe(2);
    expect(abandonRequests).toBe(0);
});

