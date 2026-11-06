
import { describe, expect, it } from "vitest";
import {
    applyFindRedactionReplacements,
    prepareFindRedactionReplacements,
} from "../features/documents/review/findRedactionOperations";
import type { ContentRange } from "../app/review/contentRangeUtils";
import type { FindInDocumentResult } from "../app/review/findInDocument";
import type {
    ManualDecision,
    ReviewPageData,
} from "../app/review/types";

const DOCUMENT_ID = "test-document";

const pages: ReviewPageData[] = [
    {
        pageNumber: 1,
        textItems: [
            {
                itemId: "item-1",
                text: "the cat",
                renderText: "the cat",
                bbox: null,
            },
            {
                itemId: "item-2",
                text: "hello",
                renderText: "hello",
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
                                text: "hello",
                                renderText: "hello",
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
    },
];

function createIds() {
    let next = 0;
    return () => `generated-${++next}`;
}

function textRange(
    start: number,
    end: number,
    itemId = "item-1",
): ContentRange {
    return {
        kind: "text",
        pageNumber: 1,
        itemId,
        tableId: null,
        cellId: null,
        start,
        end,
    };
}

function tableRange(
    start: number,
    end: number,
    cellId = "cell-1",
): ContentRange {
    return {
        kind: "table_cell",
        pageNumber: 1,
        itemId: null,
        tableId: "table-1",
        cellId,
        start,
        end,
    };
}

function findResult(
    id: string,
    ranges: ContentRange[],
): FindInDocumentResult {
    const first = ranges[0];

    if (!first) {
        throw new Error("Find result requires a range");
    }

    return {
        id,
        kind: first.kind,
        pageNumber: first.pageNumber,
        itemId: first.itemId,
        tableId: first.tableId,
        cellId: first.cellId,
        display: {
            text: "",
            matchStart: 0,
            matchEnd: 0,
            hasLeadingEllipsis: false,
            hasTrailingEllipsis: false,
        },
        segments: ranges,
        displaySegments: [],
    };
}

function prepare(
    results: FindInDocumentResult[],
) {
    return prepareFindRedactionReplacements(
        results,
        pages,
        DOCUMENT_ID,
        createIds(),
    );
}

const existingText: ManualDecision = {
    id: "existing-text",
    documentId: DOCUMENT_ID,
    kind: "text",
    pageNumber: 1,
    itemId: "item-1",
    start: 0,
    end: 7,
    text: "the cat",
    redactionGroupId: "original-group",
};

describe("Find and Redact replacements", () => {
    it("creates a replacement with exact source offsets", () => {
        const plan = prepare([
            findResult("result-1", [
                textRange(2, 5),
            ]),
        ]);

        expect(plan.resultCount).toBe(1);

        expect(plan.replacementSelections).toEqual([
            expect.objectContaining({
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start: 2,
                end: 5,
                text: "e c",
            }),
        ]);
    });

    it("merges overlapping Find results into one redaction", () => {
        const plan = prepare([
            findResult("result-1", [textRange(0, 5)]),
            findResult("result-2", [textRange(2, 7)]),
        ]);

        expect(plan.resultCount).toBe(2);

        expect(plan.replacementSelections).toHaveLength(1);

        expect(plan.replacementSelections[0]).toMatchObject({
            kind: "text",
            itemId: "item-1",
            start: 0,
            end: 7,
            text: "the cat",
        });
    });

    it("merges redactions selected on both sides of an existing redaction", () => {
        const existingMiddle: ManualDecision = {
            ...existingText,
            id: "existing-middle",
            start: 2,
            end: 5,
            text: "e c",
            redactionGroupId: "original-group",
        };

        const createId = createIds();

        const plan = prepareFindRedactionReplacements(
            [
                findResult("left", [textRange(0, 2)]),
                findResult("right", [textRange(5, 7)]),
            ],
            pages,
            DOCUMENT_ID,
            createId,
        );

        const updated = applyFindRedactionReplacements(
            [existingMiddle],
            plan,
            createId,
        );

        expect(updated).toHaveLength(1);

        expect(updated[0]).toMatchObject({
            kind: "text",
            itemId: "item-1",
            start: 0,
            end: 7,
            text: "the cat",
        });

        expect(updated[0].id).not.toBe("existing-middle");

        if (updated[0].kind !== "text") {
            throw new Error("Expected a text redaction");
        }

        expect(updated[0].redactionGroupId).toBeTruthy();
        expect(updated[0].redactionGroupId)
            .not.toBe("original-group");
    });

    it("replaces the middle of an existing redaction without linking surviving fragments", () => {
        const createId = createIds();

        const plan =
            prepareFindRedactionReplacements(
                [
                    findResult("result-1", [
                        textRange(2, 5),
                    ]),
                ],
                pages,
                DOCUMENT_ID,
                createId,
            );

        const updated =
            applyFindRedactionReplacements(
                [existingText],
                plan,
                createId,
            );

        expect(updated).toHaveLength(3);

        const left = updated.find(
            (decision) =>
                decision.kind === "text" &&
                decision.text === "th",
        );

        const right = updated.find(
            (decision) =>
                decision.kind === "text" &&
                decision.text === "at",
        );

        const replacement = updated.find(
            (decision) =>
                decision.kind === "text" &&
                decision.text === "e c",
        );

        expect(left).toBeDefined();
        expect(right).toBeDefined();
        expect(replacement).toBeDefined();

        if (
            !left ||
            !right ||
            !replacement ||
            left.kind === "image" ||
            right.kind === "image" ||
            replacement.kind === "image"
        ) {
            throw new Error("Expected text decisions");
        }

        expect(left.redactionGroupId)
            .not.toBe(right.redactionGroupId);

        expect(replacement.redactionGroupId)
            .not.toBe(left.redactionGroupId);

        expect(replacement.redactionGroupId)
            .not.toBe(right.redactionGroupId);
    });

    it("preserves one group across multiple items belonging to the same Find result", () => {
        const plan = prepare([
            findResult("result-1", [
                textRange(0, 7, "item-1"),
                textRange(0, 5, "item-2"),
            ]),
        ]);

        expect(plan.resultCount).toBe(1);
        expect(plan.replacementSelections).toHaveLength(2);

        const [first, second] =
            plan.replacementSelections;

        if (
            first.kind === "image" ||
            second.kind === "image"
        ) {
            throw new Error("Expected text decisions");
        }

        expect(first.redactionGroupId).toBeTruthy();

        expect(first.redactionGroupId)
            .toBe(second.redactionGroupId);
    });

    it("keeps replacement coverage isolated to the selected table cell", () => {
        const existingOtherCell: ManualDecision = {
            id: "other-cell",
            documentId: DOCUMENT_ID,
            kind: "table_cell",
            pageNumber: 1,
            tableId: "table-1",
            cellId: "cell-2",
            start: 0,
            end: 5,
            text: "hello",
            redactionGroupId: "other-cell-group",
        };

        const createId = createIds();

        const plan =
            prepareFindRedactionReplacements(
                [
                    findResult("result-1", [
                        tableRange(2, 5),
                    ]),
                ],
                pages,
                DOCUMENT_ID,
                createId,
            );

        const updated =
            applyFindRedactionReplacements(
                [existingOtherCell],
                plan,
                createId,
            );

        expect(updated[0]).toBe(existingOtherCell);

        expect(updated[1]).toMatchObject({
            kind: "table_cell",
            tableId: "table-1",
            cellId: "cell-1",
            start: 2,
            end: 5,
            text: "e c",
        });
    });

    it("does not change existing decisions when no valid replacements exist", () => {
        const image: ManualDecision = {
            id: "image-1",
            documentId: DOCUMENT_ID,
            kind: "image",
            pageNumber: 1,
            imageId: "image-1",
        };

        const previous = [existingText, image];

        const createId = createIds();

        const plan =
            prepareFindRedactionReplacements(
                [
                    findResult("missing-result", [
                        textRange(0, 5, "missing-item"),
                    ]),
                ],
                pages,
                DOCUMENT_ID,
                createId,
            );

        expect(plan.resultCount).toBe(0);

        const updated =
            applyFindRedactionReplacements(
                previous,
                plan,
                createId,
            );

        expect(updated).toBe(previous);
    });
});

describe("Find replacement gap protection", () => {
    it("does not merge selections separated by unredacted text", () => {
        const createId = createIds();

        const plan = prepareFindRedactionReplacements(
            [
                findResult("left", [textRange(0, 2)]),
                findResult("right", [textRange(5, 7)]),
            ],
            pages,
            DOCUMENT_ID,
            createId,
        );

        expect(plan.resultCount).toBe(2);

        const updated = applyFindRedactionReplacements(
            [],
            plan,
            createId,
        );

        expect(updated).toHaveLength(2);

        expect(updated).toMatchObject([
            {
                kind: "text",
                itemId: "item-1",
                start: 0,
                end: 2,
                text: "th",
            },
            {
                kind: "text",
                itemId: "item-1",
                start: 5,
                end: 7,
                text: "at",
            },
        ]);

        const groupIds = updated.map((decision) =>
            decision.kind === "image"
                ? undefined
                : decision.redactionGroupId,
        );

        expect(groupIds.every(Boolean)).toBe(true);
        expect(new Set(groupIds).size).toBe(2);
    });
});
