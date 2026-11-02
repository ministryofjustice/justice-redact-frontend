
import { describe, expect, it } from "vitest";

import { subtractContentRanges } from "../app/review/subtractContentRanges";
import { buildManualSelectionsFromContentRanges } from "../app/review/buildManualSelectionsFromContentRanges";
import {
    getManualDecisionContentRanges,
    type ContentRange,
} from "../app/review/contentRangeUtils";
import type {
    ManualDecision,
    ReviewPageData,
} from "../app/review/types";

const DOCUMENT_ID = "test-document";

function textRange(
    start: number,
    end: number,
    itemId = "item-1",
    pageNumber = 1,
): ContentRange {
    return {
        kind: "text",
        pageNumber,
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
    tableId = "table-1",
    pageNumber = 1,
): ContentRange {
    return {
        kind: "table_cell",
        pageNumber,
        itemId: null,
        tableId,
        cellId,
        start,
        end,
    };
}

// Only the fields read by the tested utilities are
// needed. This is not a complete backend Review fixture.
const reviewPage = {
    pageNumber: 1,
    textItems: [
        {
            itemId: "item-1",
            text: "the cat",
        },
    ],
    tables: [
        {
            tableId: "table-1",
            rows: [
                {
                    cells: [
                        {
                            cellId: "cell-1",
                            text: "the cat",
                        },
                    ],
                },
            ],
        },
    ],
    images: [],
} as unknown as ReviewPageData;

describe("manual redaction range subtraction", () => {
    it("adds only uncovered characters from an overlapping selection", () => {
        // "the cat"
        // Existing selection: "the c" = [0, 5)
        // New selection:      "e cat" = [2, 7)
        // Expected addition:  "at"    = [5, 7)

        const existing = textRange(0, 5);
        const requested = textRange(2, 7);

        expect(
            subtractContentRanges(requested, [existing]),
        ).toEqual([textRange(5, 7)]);
    });

    it("does not duplicate an entirely covered selection", () => {
        expect(
            subtractContentRanges(
                textRange(2, 4),
                [textRange(0, 5)],
            ),
        ).toEqual([]);
    });

    it("does not treat adjacent selections as overlapping", () => {
        expect(
            subtractContentRanges(
                textRange(5, 7),
                [textRange(0, 5)],
            ),
        ).toEqual([textRange(5, 7)]);
    });

    it("preserves separate gaps when existing redactions split a range", () => {
        expect(
            subtractContentRanges(
                textRange(0, 10),
                [
                    textRange(2, 4),
                    textRange(6, 8),
                ],
            ),
        ).toEqual([
            textRange(0, 2),
            textRange(4, 6),
            textRange(8, 10),
        ]);
    });

    it("correctly subtracts overlapping existing coverage", () => {
        expect(
            subtractContentRanges(
                textRange(0, 10),
                [
                    textRange(2, 6),
                    textRange(4, 8),
                ],
            ),
        ).toEqual([
            textRange(0, 2),
            textRange(8, 10),
        ]);
    });

    it("does not subtract a redaction from a different text item", () => {
        const requested = textRange(
            0,
            5,
            "item-2",
        );

        expect(
            subtractContentRanges(
                requested,
                [textRange(0, 5, "item-1")],
            ),
        ).toEqual([requested]);
    });

    it("does not subtract a redaction from a different page", () => {
        const requested = textRange(
            0,
            5,
            "item-1",
            2,
        );

        expect(
            subtractContentRanges(
                requested,
                [textRange(0, 5, "item-1", 1)],
            ),
        ).toEqual([requested]);
    });

    it("does not mix ordinary text and table-cell ranges", () => {
        const requested = textRange(0, 5);

        expect(
            subtractContentRanges(
                requested,
                [tableRange(0, 5)],
            ),
        ).toEqual([requested]);
    });

    it("subtracts overlapping redactions within the same table cell", () => {
        expect(
            subtractContentRanges(
                tableRange(2, 7),
                [tableRange(0, 5)],
            ),
        ).toEqual([tableRange(5, 7)]);
    });

    it("keeps redactions in different table cells independent", () => {
        const requested = tableRange(
            0,
            5,
            "cell-2",
        );

        expect(
            subtractContentRanges(
                requested,
                [tableRange(0, 5, "cell-1")],
            ),
        ).toEqual([requested]);
    });

    it("does not mutate the original ranges", () => {
        const requested = textRange(0, 10);
        const existing = textRange(3, 7);

        const requestedBefore = { ...requested };
        const existingBefore = { ...existing };

        subtractContentRanges(
            requested,
            [existing],
        );

        expect(requested).toEqual(requestedBefore);
        expect(existing).toEqual(existingBefore);
    });
});

describe("building manual redaction decisions", () => {
    it("preserves source offsets and exact uncovered text", () => {
        const ranges = subtractContentRanges(
            textRange(2, 7),
            [textRange(0, 5)],
        );

        const decisions =
            buildManualSelectionsFromContentRanges(
                ranges,
                [reviewPage],
                DOCUMENT_ID,
                () => "decision-1",
            );

        expect(decisions).toEqual([
            {
                id: "decision-1",
                documentId: DOCUMENT_ID,
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start: 5,
                end: 7,
                text: "at",
            },
        ]);
    });

    it("creates two independent decisions for adjacent ranges", () => {
        let nextId = 0;

        const decisions =
            buildManualSelectionsFromContentRanges(
                [
                    textRange(0, 5),
                    textRange(5, 7),
                ],
                [reviewPage],
                DOCUMENT_ID,
                () => `decision-${++nextId}`,
            );

        expect(decisions).toHaveLength(2);

        expect(
            decisions.map(
                ({ id, start, end, text }) => ({
                    id,
                    start,
                    end,
                    text,
                }),
            ),
        ).toEqual([
            {
                id: "decision-1",
                start: 0,
                end: 5,
                text: "the c",
            },
            {
                id: "decision-2",
                start: 5,
                end: 7,
                text: "at",
            },
        ]);
    });

    it("reconstructs table-cell decisions using table source offsets", () => {
        const decisions =
            buildManualSelectionsFromContentRanges(
                [tableRange(5, 7)],
                [reviewPage],
                DOCUMENT_ID,
                () => "table-decision-1",
            );

        expect(decisions).toEqual([
            {
                id: "table-decision-1",
                documentId: DOCUMENT_ID,
                kind: "table_cell",
                pageNumber: 1,
                tableId: "table-1",
                cellId: "cell-1",
                start: 5,
                end: 7,
                text: "at",
            },
        ]);
    });

    it("does not create decisions for whitespace-only ranges", () => {
        const decisions =
            buildManualSelectionsFromContentRanges(
                [textRange(3, 4)],
                [reviewPage],
                DOCUMENT_ID,
                () => "unused-id",
            );

        expect(decisions).toEqual([]);
    });
});

describe("manual decision content locations", () => {
    it("excludes image decisions from text-range overlap calculations", () => {
        const selections: ManualDecision[] = [
            {
                id: "text-decision",
                documentId: DOCUMENT_ID,
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start: 0,
                end: 5,
                text: "the c",
            },
            {
                id: "image-decision",
                documentId: DOCUMENT_ID,
                kind: "image",
                pageNumber: 1,
                imageId: "image-1",
            },
        ];

        expect(
            getManualDecisionContentRanges(selections),
        ).toEqual([textRange(0, 5)]);
    });
});
