import {
    expect,
    test,
    type Page,
    type Route,
} from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";
const DOCUMENT_ID = "review-persistence-test";
const RUN_ID = "redaction-run-123";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

type PageDecision = {
    kind: "page";
    pageNumber: number;
    action: "delete" | "exempt";
    source: "manual";
};

type DecisionRequest = {
    documentId: string;
    decisions: PageDecision[];
    expectedRevision: number;
};

type MockOptions = {
    initialRevision?: number;
    initialDecisions?: PageDecision[];
    rejectSaveWithConflict?: boolean;
    beforeSave?: (saveNumber: number) => Promise<void>;
};

type MockState = {
    revision: number;
    decisions: PageDecision[];
    saves: DecisionRequest[];
    applies: DecisionRequest[];
    stage: "ready_for_review" | "applying_redactions";
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

async function mockReview(
    page: Page,
    options: MockOptions = {},
): Promise<MockState> {
    const state: MockState = {
        revision: options.initialRevision ?? 4,
        decisions: [...(options.initialDecisions ?? [])],
        saves: [],
        applies: [],
        stage: "ready_for_review",
    };

    const reviewPage = {
        pageNumber: 1,
        textItems: [],
        tables: [],
        images: [],
    };

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/workflow`,
        async (route) => {
            const applying =
                state.stage === "applying_redactions";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: state.stage,
                currentRedactionRunId: applying ? RUN_ID : null,
                preferredPage: applying
                    ? "applying-redactions"
                    : "review",
                allowedPages: applying
                    ? ["applying-redactions"]
                    : ["review"],
            });
        },
    );

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
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/review/pages?pageStart=1&pageEnd=1`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [reviewPage],
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
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/redaction-decisions`,
        async (route) => {
            const method = route.request().method();

            if (method === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            if (method === "GET") {
                await fulfillJson(route, {
                    documentId: DOCUMENT_ID,
                    revision: state.revision,
                    decisions: state.decisions,
                    updatedAt: null,
                });
                return;
            }

            expect(method).toBe("PUT");

            const request =
                route.request().postDataJSON() as DecisionRequest;

            state.saves.push(request);

            if (options.beforeSave) {
                await options.beforeSave(state.saves.length);
            }

            if (
                options.rejectSaveWithConflict ||
                request.expectedRevision !== state.revision
            ) {
                await fulfillJson(
                    route,
                    {
                        detail: "Decision revision conflict",
                    },
                    409,
                );
                return;
            }

            state.revision += 1;
            state.decisions = [...request.decisions];

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "saved",
                revision: state.revision,
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/apply-redactions`,
        async (route) => {
            expect(route.request().method()).toBe("POST");

            const request =
                route.request().postDataJSON() as DecisionRequest;

            state.applies.push(request);

            if (request.expectedRevision !== state.revision) {
                await fulfillJson(
                    route,
                    { detail: "Decision revision conflict" },
                    409,
                );
                return;
            }

            state.stage = "applying_redactions";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                runId: RUN_ID,
                status: "processing",
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/redaction-runs/${RUN_ID}/status`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                runId: RUN_ID,
                status: "processing",
                processingProgress: 30,
            });
        },
    );

    return state;
}

async function openReview(page: Page): Promise<void> {
    const decisionsLoaded = page.waitForResponse(
        (response) =>
            response.url() ===
            `${API_BASE_URL}/documents/${DOCUMENT_ID}/redaction-decisions` &&
            response.request().method() === "GET",
    );

    await page.goto(
        `/review?documentId=${DOCUMENT_ID}`,
    );

    await decisionsLoaded;

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();
}

const deletedPageDecision: PageDecision = {
    kind: "page",
    pageNumber: 1,
    action: "delete",
    source: "manual",
};

// 1. Restore persisted decisions
test("restores persisted page decisions without autosaving them again", async ({
    page,
}) => {
    const state = await mockReview(page, {
        initialRevision: 7,
        initialDecisions: [deletedPageDecision],
    });

    await openReview(page);

    await expect(
        page.getByRole("button", {
            name: "Delete page 1",
            exact: true,
        }),
    ).not.toBeVisible();

    const applyButton = page.getByRole("button", {
        name: "Apply redactions",
        exact: true,
    });

    await expect(applyButton).toBeEnabled();

    expect(state.saves).toHaveLength(0);

    await applyButton.click();

    await expect.poll(
        () => state.applies.length,
    ).toBe(1);

    expect(state.saves).toHaveLength(1);

    expect(state.saves[0]).toEqual({
        documentId: DOCUMENT_ID,
        decisions: [deletedPageDecision],
        expectedRevision: 7,
    });

    expect(state.applies[0]).toEqual({
        documentId: DOCUMENT_ID,
        decisions: [deletedPageDecision],
        expectedRevision: 8,
    });
});

// 2. Autosave a changed page decision
test("autosaves a page deletion with the loaded revision", async ({
    page,
}) => {
    const state = await mockReview(page, {
        initialRevision: 4,
    });

    await openReview(page);

    await page.getByRole("button", {
        name: "Delete page 1",
        exact: true,
    }).click();

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    await expect.poll(
        () => state.revision,
    ).toBe(5);

    expect(state.saves[0]).toEqual({
        documentId: DOCUMENT_ID,
        decisions: [deletedPageDecision],
        expectedRevision: 4,
    });

    expect(state.applies).toHaveLength(0);
});

// 3. Apply uses revision from previous successful autosave
test("increments revisions across autosave and final pre-Apply save", async ({
    page,
}) => {
    const state = await mockReview(page, {
        initialRevision: 4,
    });

    await openReview(page);

    await page.getByRole("button", {
        name: "Delete page 1",
        exact: true,
    }).click();

    await expect.poll(
        () => state.revision,
    ).toBe(5);

    await page.getByRole("button", {
        name: "Apply redactions",
        exact: true,
    }).click();

    await expect.poll(
        () => state.applies.length,
    ).toBe(1);

    expect(
        state.saves.map((save) => save.expectedRevision),
    ).toEqual([4, 5]);

    expect(state.applies[0].expectedRevision).toBe(6);

    expect(state.applies[0].decisions).toEqual([
        deletedPageDecision,
    ]);
});

// 4. A conflict must block application
test("409 revision conflict prevents applying stale decisions", async ({
    page,
}) => {
    const state = await mockReview(page, {
        initialRevision: 4,
        rejectSaveWithConflict: true,
    });

    await openReview(page);

    await page.getByRole("button", {
        name: "Delete page 1",
        exact: true,
    }).click();

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    await expect(
        page.getByText(
            "This document has been changed in another tab.",
            { exact: false },
        ),
    ).toBeVisible();

    await page.getByRole("button", {
        name: "Apply redactions",
        exact: true,
    }).click();

    await expect(
        page
            .getByRole("region", {
                name: "You've reached the end of the document",
            })
            .getByRole("alert"),
    ).toContainText(
        "Refresh the page to load the latest saved decisions before applying redactions.",
    );

    expect(state.applies).toHaveLength(0);
    expect(state.revision).toBe(4);
});

// 5. Apply must wait for an in-flight autosave
test("waits for an in-flight autosave before sending the final Apply request", async ({
    page,
}) => {
    let notifySaveStarted = () => { };

    const firstSaveStarted = new Promise<void>((resolve) => {
        notifySaveStarted = resolve;
    });

    let releaseFirstSave = () => { };

    const firstSaveGate = new Promise<void>((resolve) => {
        releaseFirstSave = resolve;
    });

    const state = await mockReview(page, {
        initialRevision: 4,
        beforeSave: async (saveNumber) => {
            if (saveNumber !== 1) {
                return;
            }

            notifySaveStarted();
            await firstSaveGate;
        },
    });

    await openReview(page);

    await page.getByRole("button", {
        name: "Delete page 1",
        exact: true,
    }).click();

    await firstSaveStarted;

    try {
        await page.getByRole("button", {
            name: "Apply redactions",
            exact: true,
        }).click();

        await expect(
            page.getByRole("button", {
                name: "Applying redactions…",
                exact: true,
            }),
        ).toBeVisible();

        expect(state.applies).toHaveLength(0);
        expect(state.revision).toBe(4);

        releaseFirstSave();

        await expect.poll(
            () => state.applies.length,
        ).toBe(1);

        expect(
            state.saves.map((save) => save.expectedRevision),
        ).toEqual([4, 5]);

        expect(state.applies[0]).toEqual({
            documentId: DOCUMENT_ID,
            decisions: [deletedPageDecision],
            expectedRevision: 6,
        });
    } finally {
        releaseFirstSave();
    }
});
