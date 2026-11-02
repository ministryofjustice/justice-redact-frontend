
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
