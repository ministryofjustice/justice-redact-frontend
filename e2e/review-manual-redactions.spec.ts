
import {
    expect,
    test,
    type Page,
    type Route,
} from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";
const DOCUMENT_ID = "review-manual-selection-e2e";

const DOCUMENT_API =
    `${API_BASE_URL}/documents/${DOCUMENT_ID}`;

const TEXT_SELECTOR =
    '.jr-review-block.redactable[data-item-id="item-1"]';

const CELL_ONE_SELECTOR =
    '[data-table-id="table-1"][data-cell-id="cell-1"]';

const CELL_TWO_SELECTOR =
    '[data-table-id="table-1"][data-cell-id="cell-2"]';

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, Accept, Authorization",
};

type SavedDecision = {
    kind: "text" | "table_cell";
    pageNumber: number;
    itemId?: string;
    tableId?: string;
    cellId?: string;
    start: number;
    end: number;
    text: string;
    action: "redact";
    source: "manual";
    redactionGroupId?: string;
};

type SaveRequest = {
    documentId: string;
    decisions: SavedDecision[];
    expectedRevision: number;
};

type MockState = {
    revision: number;
    decisions: SavedDecision[];
    saves: SaveRequest[];
};

const reviewPage = {
    pageNumber: 1,
    textItems: [
        {
            itemId: "item-1",
            text: "the cat",
            renderText: "the cat",
            bbox: null,
        },
    ],
    tables: [
        {
            tableId: "table-1",
            bbox: null,
            rows: [
                {
                    rowIndex: 0,
                    cells: [
                        {
                            cellId: "cell-1",
                            tableId: "table-1",
                            rowIndex: 0,
                            colIndex: 0,
                            text: "the cat",
                            renderText: "the cat",
                            bbox: null,
                            isHeader: false,
                            isNumeric: false,
                        },
                        {
                            cellId: "cell-2",
                            tableId: "table-1",
                            rowIndex: 0,
                            colIndex: 1,
                            text: "hello world",
                            renderText: "hello world",
                            bbox: null,
                            isHeader: false,
                            isNumeric: false,
                        },
                    ],
                },
            ],
        },
    ],
    images: [],
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
): Promise<MockState> {
    const state: MockState = {
        revision: 4,
        decisions: [],
        saves: [],
    };

    await page.route(
        `${DOCUMENT_API}/workflow`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "ready_for_review",
                currentRedactionRunId: null,
                preferredPage: "review",
                allowedPages: ["review"],
            });
        },
    );

    await page.route(
        `${DOCUMENT_API}/review`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                filename: "manual-redactions.pdf",
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
        `${DOCUMENT_API}/review/pages?pageStart=1&pageEnd=1`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [reviewPage],
            });
        },
    );

    await page.route(
        `${DOCUMENT_API}/review/search`,
        async (route) => {
            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                pages: [reviewPage],
            });
        },
    );

    await page.route(
        `${DOCUMENT_API}/redaction-decisions`,
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
                route.request().postDataJSON() as SaveRequest;

            state.saves.push(request);

            if (request.expectedRevision !== state.revision) {
                await fulfillJson(
                    route,
                    { detail: "Decision revision conflict" },
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

    return state;
}

async function openReview(page: Page): Promise<void> {
    const loaded = page.waitForResponse(
        (response) =>
            response.url() ===
            `${DOCUMENT_API}/redaction-decisions` &&
            response.request().method() === "GET",
    );

    await page.goto(
        `/review?documentId=${DOCUMENT_ID}`,
    );

    await loaded;

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.locator(TEXT_SELECTOR),
    ).toBeVisible();
}

async function selectContent(
    page: Page,
    startSelector: string,
    start: number,
    endSelector: string,
    end: number,
): Promise<void> {
    await page.locator(startSelector).waitFor();
    await page.locator(endSelector).waitFor();

    await page.evaluate(
        ({
            startSelector,
            start,
            endSelector,
            end,
        }) => {
            function getVisibleTextRoot(
                selector: string,
            ): Element {
                const container =
                    document.querySelector(selector);

                if (!container) {
                    throw new Error(
                        `Selection container not found: ${selector}`,
                    );
                }

                const visibleText =
                    container.querySelector('[aria-hidden="true"]');

                if (!visibleText) {
                    throw new Error(
                        `Visible review text not found: ${selector}`,
                    );
                }

                return visibleText;
            }

            function textPoint(
                root: Element,
                characterOffset: number,
            ): {
                node: Node;
                offset: number;
            } {
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT,
                );

                let remaining = characterOffset;
                let node: Node | null;

                while ((node = walker.nextNode())) {
                    const length =
                        node.textContent?.length ?? 0;

                    if (remaining <= length) {
                        return {
                            node,
                            offset: remaining,
                        };
                    }

                    remaining -= length;
                }

                throw new Error(
                    `Character offset ${characterOffset} is outside the rendered text`,
                );
            }

            const startPoint = textPoint(
                getVisibleTextRoot(startSelector),
                start,
            );

            const endPoint = textPoint(
                getVisibleTextRoot(endSelector),
                end,
            );

            const range = document.createRange();

            range.setStart(
                startPoint.node,
                startPoint.offset,
            );

            range.setEnd(
                endPoint.node,
                endPoint.offset,
            );

            const selection = window.getSelection();

            if (!selection) {
                throw new Error("Browser selection unavailable");
            }

            selection.removeAllRanges();
            selection.addRange(range);

            if (selection.isCollapsed) {
                throw new Error("Selection unexpectedly collapsed");
            }

            document.dispatchEvent(
                new MouseEvent("mouseup", {
                    bubbles: true,
                    button: 0,
                }),
            );
        },
        {
            startSelector,
            start,
            endSelector,
            end,
        },
    );
}

test("manual text selections remain separate and never overlap", async ({
    page,
}) => {
    const state = await mockReview(page);

    await openReview(page);

    await selectContent(
        page,
        TEXT_SELECTOR,
        0,
        TEXT_SELECTOR,
        5,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    expect(state.saves[0].expectedRevision).toBe(4);

    expect(state.saves[0].decisions).toEqual([
        expect.objectContaining({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 0,
            end: 5,
            text: "the c",
            action: "redact",
            source: "manual",
        }),
    ]);

    await selectContent(
        page,
        TEXT_SELECTOR,
        2,
        TEXT_SELECTOR,
        7,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(2);

    const secondSave = state.saves[1];

    expect(secondSave.expectedRevision).toBe(5);
    expect(secondSave.decisions).toHaveLength(2);

    expect(secondSave.decisions[0]).toMatchObject({
        kind: "text",
        itemId: "item-1",
        start: 0,
        end: 5,
        text: "the c",
    });

    expect(secondSave.decisions[1]).toMatchObject({
        kind: "text",
        itemId: "item-1",
        start: 5,
        end: 7,
        text: "at",
    });

    expect(
        secondSave.decisions[0].redactionGroupId,
    ).toBeTruthy();

    expect(
        secondSave.decisions[1].redactionGroupId,
    ).toBeTruthy();

    expect(
        secondSave.decisions[0].redactionGroupId,
    ).not.toBe(
        secondSave.decisions[1].redactionGroupId,
    );
});

test("manual table-cell selections do not overlap", async ({
    page,
}) => {
    const state = await mockReview(page);

    await openReview(page);

    await expect(
        page.locator(CELL_ONE_SELECTOR),
    ).toBeVisible();

    await selectContent(
        page,
        CELL_ONE_SELECTOR,
        0,
        CELL_ONE_SELECTOR,
        5,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    expect(state.saves[0].decisions).toEqual([
        expect.objectContaining({
            kind: "table_cell",
            pageNumber: 1,
            tableId: "table-1",
            cellId: "cell-1",
            start: 0,
            end: 5,
            text: "the c",
            action: "redact",
            source: "manual",
        }),
    ]);

    await selectContent(
        page,
        CELL_ONE_SELECTOR,
        2,
        CELL_ONE_SELECTOR,
        7,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(2);

    const secondSave = state.saves[1];

    expect(secondSave.expectedRevision).toBe(5);
    expect(secondSave.decisions).toHaveLength(2);

    expect(secondSave.decisions[0]).toMatchObject({
        kind: "table_cell",
        tableId: "table-1",
        cellId: "cell-1",
        start: 0,
        end: 5,
        text: "the c",
    });

    expect(secondSave.decisions[1]).toMatchObject({
        kind: "table_cell",
        tableId: "table-1",
        cellId: "cell-1",
        start: 5,
        end: 7,
        text: "at",
    });

    expect(
        secondSave.decisions[0].redactionGroupId,
    ).not.toBe(
        secondSave.decisions[1].redactionGroupId,
    );
});

test("selection across table cells preserves each cell's offsets", async ({
    page,
}) => {
    const state = await mockReview(page);

    await openReview(page);

    await expect(
        page.locator(CELL_TWO_SELECTOR),
    ).toBeVisible();

    await selectContent(
        page,
        CELL_ONE_SELECTOR,
        2,
        CELL_TWO_SELECTOR,
        5,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    const save = state.saves[0];

    expect(save.expectedRevision).toBe(4);
    expect(save.decisions).toHaveLength(2);

    expect(save.decisions[0]).toMatchObject({
        kind: "table_cell",
        pageNumber: 1,
        tableId: "table-1",
        cellId: "cell-1",
        start: 2,
        end: 7,
        text: "e cat",
    });

    expect(save.decisions[1]).toMatchObject({
        kind: "table_cell",
        pageNumber: 1,
        tableId: "table-1",
        cellId: "cell-2",
        start: 0,
        end: 5,
        text: "hello",
    });

    expect(
        save.decisions[0].redactionGroupId,
    ).toBeTruthy();

    expect(
        save.decisions[0].redactionGroupId,
    ).toBe(
        save.decisions[1].redactionGroupId,
    );
});

test("Find and Redact replaces an existing partial redaction with one persisted redaction", async ({
    page,
}) => {
    const state = await mockReview(page);

    await openReview(page);

    await selectContent(
        page,
        TEXT_SELECTOR,
        2,
        TEXT_SELECTOR,
        5,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    const initialSave = state.saves[0];

    expect(initialSave.expectedRevision).toBe(4);

    expect(initialSave.decisions).toHaveLength(1);

    expect(initialSave.decisions[0]).toMatchObject({
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 2,
        end: 5,
        text: "e c",
        action: "redact",
        source: "manual",
    });

    const originalGroupId =
        initialSave.decisions[0].redactionGroupId;

    expect(originalGroupId).toBeTruthy();

    await page.getByRole("button", {
        name: "Find",
        exact: true,
    }).click();

    await page.getByRole("menuitem", {
        name: "Find and redact",
        exact: true,
    }).click();

    await page.getByRole("textbox", {
        name: "Enter a word or phrase to search for",
    }).fill("the cat");

    await page.getByRole("button", {
        name: "Search",
        exact: true,
    }).click();

    await expect(
        page.getByRole("heading", {
            name: "Select what you want to redact",
        }),
    ).toBeVisible();

    const resultCheckboxes = page.locator(
        '#find-and-redact-results input[name="searchResults"]',
    );

    await expect(
        resultCheckboxes.first(),
    ).toBeVisible();

    await expect(
        resultCheckboxes.first(),
    ).toBeEnabled();

    await resultCheckboxes.first().check();

    await page.getByRole("button", {
        name: "Redact",
        exact: true,
    }).click();

    await expect(
        page.getByRole("heading", {
            name: "Your redactions have been made",
        }),
    ).toBeVisible();

    await expect.poll(
        () => state.saves.length,
    ).toBe(2);

    const mergedSave = state.saves[1];

    expect(mergedSave.documentId).toBe(DOCUMENT_ID);

    expect(mergedSave.expectedRevision).toBe(5);

    expect(mergedSave.decisions).toHaveLength(1);

    expect(mergedSave.decisions[0]).toMatchObject({
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 0,
        end: 7,
        text: "the cat",
        action: "redact",
        source: "manual",
    });

    const mergedGroupId =
        mergedSave.decisions[0].redactionGroupId;

    expect(mergedGroupId).toBeTruthy();

    expect(mergedGroupId).not.toBe(originalGroupId);

    expect(
        mergedSave.decisions.some(
            (decision) => decision.kind === "table_cell",
        ),
    ).toBe(false);

    await page.getByRole("button", {
        name: "Close window",
        exact: true,
    }).click();

    await page.reload();

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.locator(TEXT_SELECTOR),
    ).toBeVisible();

    expect(state.revision).toBe(6);

    expect(state.decisions).toHaveLength(1);

    expect(state.decisions[0]).toMatchObject({
        kind: "text",
        itemId: "item-1",
        start: 0,
        end: 7,
        text: "the cat",
        redactionGroupId: mergedGroupId,
    });

    await page.getByRole("button", {
        name: "Find",
        exact: true,
    }).click();

    await page.getByRole("menuitem", {
        name: "Find and redact",
        exact: true,
    }).click();

    await page.getByRole("textbox", {
        name: "Enter a word or phrase to search for",
    }).fill("the cat");

    await page.getByRole("button", {
        name: "Search",
        exact: true,
    }).click();

    const restoredCheckboxes = page.locator(
        '#find-and-redact-results input[name="searchResults"]',
    );

    await expect(
        restoredCheckboxes.first(),
    ).toBeChecked();

    await expect(
        restoredCheckboxes.first(),
    ).toBeDisabled();
});

test("Find and redact part merges overlapping manual redactions and restores the merged decision", async ({
    page,
}) => {
    const state = await mockReview(page);
    await openReview(page);

    await selectContent(
        page,
        TEXT_SELECTOR,
        0,
        TEXT_SELECTOR,
        5,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    const initialSave = state.saves[0];

    expect(initialSave.expectedRevision).toBe(4);
    expect(initialSave.decisions).toHaveLength(1);

    expect(initialSave.decisions[0]).toMatchObject({
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 0,
        end: 5,
        text: "the c",
        action: "redact",
        source: "manual",
    });

    const originalGroupId =
        initialSave.decisions[0].redactionGroupId;

    expect(originalGroupId).toBeTruthy();

    async function selectPartialPhrase() {
        await page.locator(
            ".jr-partial-redaction-selection",
        ).evaluate((container) => {
            const visibleText = container.querySelector(
                '[aria-hidden="true"]',
            );

            if (
                !visibleText ||
                visibleText.textContent !== "the cat"
            ) {
                throw new Error(
                    "Could not locate the expected visible search phrase",
                );
            }

            const walker = document.createTreeWalker(
                visibleText,
                NodeFilter.SHOW_TEXT,
            );

            const nodes: Text[] = [];

            while (walker.nextNode()) {
                nodes.push(walker.currentNode as Text);
            }

            function resolveOffset(offset: number) {
                let consumed = 0;

                for (const node of nodes) {
                    const length =
                        node.textContent?.length ?? 0;

                    if (offset <= consumed + length) {
                        return {
                            node,
                            offset: offset - consumed,
                        };
                    }

                    consumed += length;
                }

                throw new Error(
                    `Cannot resolve text offset ${offset}`,
                );
            }

            const start = resolveOffset(2);
            const end = resolveOffset(7);

            const range = document.createRange();

            range.setStart(
                start.node,
                start.offset,
            );

            range.setEnd(
                end.node,
                end.offset,
            );

            const selection = window.getSelection();

            if (!selection) {
                throw new Error(
                    "Browser selection is unavailable",
                );
            }

            selection.removeAllRanges();
            selection.addRange(range);

            container.dispatchEvent(
                new MouseEvent("mouseup", {
                    bubbles: true,
                }),
            );
        });
    }

    async function openPartialFindResults() {
        await page.getByRole("button", {
            name: "Find",
            exact: true,
        }).click();

        await page.getByRole("menuitem", {
            name: "Find and redact part",
            exact: true,
        }).click();

        await page.getByRole("textbox", {
            name: "Enter a word or phrase to search for",
        }).fill("the cat");

        await page.getByRole("button", {
            name: "Search",
            exact: true,
        }).click();

        await expect(
            page.getByRole("heading", {
                name: "Select which part you want to redact",
            }),
        ).toBeVisible();

        await selectPartialPhrase();

        await page.getByRole("button", {
            name: "Continue",
            exact: true,
        }).click();

        await expect(
            page.getByRole("heading", {
                name: "Select what you want to redact",
            }),
        ).toBeVisible();

        return page.getByRole("region", {
            name: "Select what you want to redact",
        }).locator('input[name="searchResults"]');
    }

    const resultCheckboxes =
        await openPartialFindResults();

    await expect(
        resultCheckboxes.first(),
    ).toBeVisible();

    await expect(
        resultCheckboxes.first(),
    ).toBeEnabled();

    await resultCheckboxes.first().check();

    await page.getByRole("button", {
        name: "Redact",
        exact: true,
    }).click();

    await expect(
        page.getByRole("button", {
            name: "Close window",
            exact: true,
        }),
    ).toBeVisible();

    await expect.poll(
        () => state.saves.length,
    ).toBe(2);

    const mergedSave = state.saves[1];

    expect(mergedSave.documentId).toBe(DOCUMENT_ID);
    expect(mergedSave.expectedRevision).toBe(5);
    expect(mergedSave.decisions).toHaveLength(1);

    expect(mergedSave.decisions[0]).toMatchObject({
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 0,
        end: 7,
        text: "the cat",
        action: "redact",
        source: "manual",
    });

    const mergedGroupId =
        mergedSave.decisions[0].redactionGroupId;

    expect(mergedGroupId).toBeTruthy();
    expect(mergedGroupId).not.toBe(originalGroupId);

    expect(
        mergedSave.decisions.some(
            (decision) => decision.kind === "table_cell",
        ),
    ).toBe(false);

    await page.getByRole("button", {
        name: "Close window",
        exact: true,
    }).click();

    await page.reload();

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.locator(TEXT_SELECTOR),
    ).toBeVisible();

    expect(state.revision).toBe(6);
    expect(state.decisions).toHaveLength(1);

    expect(state.decisions[0]).toMatchObject({
        kind: "text",
        itemId: "item-1",
        start: 0,
        end: 7,
        text: "the cat",
        redactionGroupId: mergedGroupId,
    });

    const restoredCheckboxes =
        await openPartialFindResults();

    await expect(
        restoredCheckboxes.first(),
    ).toBeChecked();

    await expect(
        restoredCheckboxes.first(),
    ).toBeDisabled();
});


test("Find and Disclose splits a redaction into independent persisted groups", async ({
    page,
}) => {
    const state = await mockReview(page);
    await openReview(page);

    await selectContent(
        page,
        TEXT_SELECTOR,
        0,
        TEXT_SELECTOR,
        7,
    );

    await expect.poll(
        () => state.saves.length,
    ).toBe(1);

    const initialSave = state.saves[0];

    expect(initialSave.expectedRevision).toBe(4);
    expect(initialSave.decisions).toHaveLength(1);

    expect(initialSave.decisions[0]).toMatchObject({
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 0,
        end: 7,
        text: "the cat",
        action: "redact",
        source: "manual",
    });

    const originalGroupId =
        initialSave.decisions[0].redactionGroupId;

    expect(originalGroupId).toBeTruthy();

    await page.getByRole("button", {
        name: "Find",
        exact: true,
    }).click();

    await page.getByRole("menu")
        .getByRole("menuitem")
        .nth(2)
        .click();

    await expect(
        page.getByRole("heading", {
            name: "Find and remove redactions",
        }),
    ).toBeVisible();

    await page.getByRole("textbox", {
        name: "Enter a word or phrase to search for",
    }).fill("e c");

    await page.getByRole("button", {
        name: "Search",
        exact: true,
    }).click();

    await expect(
        page.getByRole("heading", {
            name: "Select what redactions you want to remove",
        }),
    ).toBeVisible();

    const resultCheckboxes = page.locator(
        '#find-and-redact-results input[name="searchResults"]',
    );

    await expect(resultCheckboxes).toHaveCount(1);
    await resultCheckboxes.first().check();

    await page.getByRole("button", {
        name: "Remove",
        exact: true,
    }).click();

    await expect.poll(
        () => state.saves.length,
    ).toBe(2);

    const disclosureSave = state.saves[1];

    expect(disclosureSave.documentId).toBe(DOCUMENT_ID);
    expect(disclosureSave.expectedRevision).toBe(5);
    expect(disclosureSave.decisions).toHaveLength(2);

    expect(disclosureSave.decisions).toMatchObject([
        {
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 0,
            end: 2,
            text: "th",
            action: "redact",
            source: "manual",
        },
        {
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 5,
            end: 7,
            text: "at",
            action: "redact",
            source: "manual",
        },
    ]);

    const leftGroupId =
        disclosureSave.decisions[0].redactionGroupId;

    const rightGroupId =
        disclosureSave.decisions[1].redactionGroupId;

    expect(leftGroupId).toBeTruthy();
    expect(rightGroupId).toBeTruthy();

    expect(leftGroupId).not.toBe(rightGroupId);

    expect(leftGroupId).not.toBe(originalGroupId);
    expect(rightGroupId).not.toBe(originalGroupId);

    expect(
        disclosureSave.decisions.some(
            (decision) => decision.kind === "table_cell",
        ),
    ).toBe(false);

    await expect.poll(
        () => state.revision,
    ).toBe(6);

    await page.reload();

    await expect(
        page.getByRole("heading", {
            name: "Make redactions",
            exact: true,
        }),
    ).toBeVisible();

    await expect(
        page.locator(TEXT_SELECTOR),
    ).toBeVisible();

    expect(state.decisions).toHaveLength(2);

    expect(state.decisions).toMatchObject([
        {
            kind: "text",
            start: 0,
            end: 2,
            text: "th",
            redactionGroupId: leftGroupId,
        },
        {
            kind: "text",
            start: 5,
            end: 7,
            text: "at",
            redactionGroupId: rightGroupId,
        },
    ]);

    await page.getByRole("button", {
        name: "Find",
        exact: true,
    }).click();

    await page.getByRole("menu")
        .getByRole("menuitem")
        .nth(2)
        .click();

    await page.getByRole("textbox", {
        name: "Enter a word or phrase to search for",
    }).fill("th");

    await page.getByRole("button", {
        name: "Search",
        exact: true,
    }).click();

    const restoredResults = page.locator(
        '#find-and-redact-results input[name="searchResults"]',
    );

    await expect(restoredResults).toHaveCount(1);

    await page.getByRole("button", {
        name: "Go back",
        exact: true,
    }).click();

    await page.getByRole("textbox", {
        name: "Enter a word or phrase to search for",
    }).fill("at");

    await page.getByRole("button", {
        name: "Search",
        exact: true,
    }).click();

    await expect(restoredResults).toHaveCount(1);
});



