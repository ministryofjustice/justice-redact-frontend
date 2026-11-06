
import { describe, expect, it } from "vitest";

import { discloseManualRedactions } from "../app/review/discloseManualRedactions";
import { findInDocument } from "../app/review/findInDocument";
import { findInManualRedactions } from "../app/review/findInManualRedactions";
import { buildApplyRedactionsRequest } from "../app/review/applyRedactions";
import { buildReviewStateFromPersistedDecisions } from "../app/review/redactionDecisionPersistence";

import type {
    ManualDecision,
    ManualTextDecision,
    ReviewPageData,
} from "../app/review/types";

const DOCUMENT_ID = "find-disclose-test";

const pages: ReviewPageData[] = [
    {
        pageNumber: 1,
        textItems: [
            {
                itemId: "item-1",
                text: "the cat the cat",
                renderText: "the cat the cat",
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
                        ],
                    },
                ],
            },
        ],
        images: [],
    },
];

const sourceText = "the cat the cat";

function textDecision(
    id: string,
    start: number,
    end: number,
): ManualTextDecision {
    return {
        id,
        documentId: DOCUMENT_ID,
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start,
        end,
        text: sourceText.slice(start, end),
        redactionGroupId: `group-${id}`,
    };
}

function createIds(): () => string {
    let next = 0;
    return () => `generated-${++next}`;
}

function findTextResults(
    decisions: ManualDecision[],
    searchTerm: string,
) {
    return findInManualRedactions(
        pages,
        decisions,
        searchTerm,
    ).filter(
        (result) =>
            result.kind === "text" &&
            result.itemId === "item-1",
    );
}

describe("Find and Disclose", () => {
    it("removes an entirely disclosed redaction", () => {
        const existing = textDecision("existing", 0, 7);

        const results = findTextResults(
            [existing],
            "the cat",
        );

        expect(results).toHaveLength(1);

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);
        expect(disclosed.remainingSelections).toEqual([]);
    });

    it("splits a middle disclosure into two independent redaction groups", () => {
        const existing = textDecision("existing", 0, 7);

        const results = findTextResults(
            [existing],
            "e c",
        );

        expect(results).toHaveLength(1);

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);
        expect(disclosed.remainingSelections).toHaveLength(2);

        expect(disclosed.remainingSelections).toMatchObject([
            {
                kind: "text",
                start: 0,
                end: 2,
                text: "th",
            },
            {
                kind: "text",
                start: 5,
                end: 7,
                text: "at",
            },
        ]);

        const [left, right] =
            disclosed.remainingSelections;

        if (
            left.kind !== "text" ||
            right.kind !== "text"
        ) {
            throw new Error("Expected text decisions");
        }

        expect(left.redactionGroupId).toBeTruthy();
        expect(right.redactionGroupId).toBeTruthy();

        expect(left.redactionGroupId)
            .not.toBe(right.redactionGroupId);

        expect(left.redactionGroupId)
            .not.toBe(existing.redactionGroupId);

        expect(right.redactionGroupId)
            .not.toBe(existing.redactionGroupId);
    });

    it("discloses a prefix without changing the remaining source offsets", () => {
        const existing = textDecision("existing", 0, 7);

        const results = findTextResults(
            [existing],
            "the",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);

        expect(disclosed.remainingSelections).toMatchObject([
            {
                kind: "text",
                start: 3,
                end: 7,
                text: " cat",
            },
        ]);
    });

    it("discloses a suffix without changing the remaining source offsets", () => {
        const existing = textDecision("existing", 0, 7);

        const results = findTextResults(
            [existing],
            "cat",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);

        expect(disclosed.remainingSelections).toMatchObject([
            {
                kind: "text",
                start: 0,
                end: 4,
                text: "the ",
            },
        ]);
    });

    it("discloses only the selected occurrence and preserves other occurrences", () => {
        const first = textDecision("first", 0, 7);
        const second = textDecision("second", 8, 15);

        const results = findTextResults(
            [first, second],
            "the cat",
        );

        expect(results).toHaveLength(2);

        const disclosed = discloseManualRedactions(
            [first, second],
            [results[0]],
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);
        expect(disclosed.remainingSelections).toHaveLength(1);

        expect(disclosed.remainingSelections[0]).toMatchObject({
            id: second.id,
            kind: "text",
            start: 8,
            end: 15,
            text: "the cat",
            redactionGroupId: second.redactionGroupId,
        });
    });

    it("preserves unrelated table-cell and image redactions", () => {
        const existing = textDecision("existing", 0, 7);

        const tableDecision: ManualDecision = {
            id: "table-existing",
            documentId: DOCUMENT_ID,
            kind: "table_cell",
            pageNumber: 1,
            tableId: "table-1",
            cellId: "cell-1",
            start: 0,
            end: 7,
            text: "the cat",
            redactionGroupId: "table-group",
        };

        const imageDecision: ManualDecision = {
            id: "image-existing",
            documentId: DOCUMENT_ID,
            kind: "image",
            pageNumber: 1,
            imageId: "image-1",
        };

        const decisions = [
            existing,
            tableDecision,
            imageDecision,
        ];

        const results = findTextResults(
            decisions,
            "the cat",
        );

        expect(results).toHaveLength(1);

        const disclosed = discloseManualRedactions(
            decisions,
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);

        expect(disclosed.remainingSelections).toEqual([
            tableDecision,
            imageDecision,
        ]);
    });

    it("leaves decisions unchanged when the search result has no redacted coverage", () => {
        const existing = textDecision("existing", 0, 3);

        const unredactedResults = findInDocument(
            pages,
            "cat",
        ).filter(
            (result) =>
                result.kind === "text" &&
                result.itemId === "item-1",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            [unredactedResults[0]],
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(0);

        expect(disclosed.remainingSelections)
            .toEqual([existing]);
    });

    it("does not mutate the original decisions", () => {
        const existing = textDecision("existing", 0, 7);

        const decisions = [existing];
        const snapshot = structuredClone(decisions);

        const results = findTextResults(
            decisions,
            "e c",
        );

        discloseManualRedactions(
            decisions,
            results,
            createIds(),
        );

        expect(decisions).toEqual(snapshot);
    });

    it("counts a duplicate selected search occurrence only once", () => {
        const existing = textDecision("existing", 0, 7);

        const results = findTextResults(
            [existing],
            "the cat",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            [results[0], results[0]],
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);
        expect(disclosed.remainingSelections).toEqual([]);
    });

    it("does not silently remove whitespace coverage outside the disclosed text", () => {
        const existing = textDecision("existing", 0, 4);

        const results = findTextResults(
            [existing],
            "the",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.disclosedCount).toBe(1);

        expect(disclosed.remainingSelections).toMatchObject([
            {
                kind: "text",
                start: 3,
                end: 4,
                text: " ",
            },
        ]);
    });

    it("serializes a surviving whitespace-only redaction without losing its offsets", () => {
        const existing = textDecision("existing", 0, 4);

        const results = findTextResults(
            [existing],
            "the",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        expect(disclosed.remainingSelections).toHaveLength(1);

        const request = buildApplyRedactionsRequest(
            DOCUMENT_ID,
            disclosed.remainingSelections,
            {},
        );

        expect(request.decisions).toHaveLength(1);

        expect(request.decisions[0]).toMatchObject({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 3,
            end: 4,
            text: " ",
            action: "redact",
            source: "manual",
            redactionGroupId: "group-existing",
        });
    });

    it("restores whitespace-only redactions with the same offsets and group", () => {
        const existing = textDecision("existing", 0, 4);

        const results = findTextResults(
            [existing],
            "the",
        );

        const disclosed = discloseManualRedactions(
            [existing],
            results,
            createIds(),
        );

        const savedRequest = buildApplyRedactionsRequest(
            DOCUMENT_ID,
            disclosed.remainingSelections,
            {},
        );

        const restored = buildReviewStateFromPersistedDecisions(
            DOCUMENT_ID,
            [
                {
                    kind: "text",
                    pageNumber: 1,
                    itemId: "item-1",
                    start: 3,
                    end: 4,
                    text: " ",
                    action: "redact",
                    source: "manual",
                    redactionGroupId: "group-existing",
                },
            ],
        );

        expect(restored.manualSelections).toHaveLength(1);

        expect(restored.manualSelections[0]).toMatchObject({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 3,
            end: 4,
            text: " ",
            redactionGroupId: "group-existing",
        });

        const restoredRequest = buildApplyRedactionsRequest(
            DOCUMENT_ID,
            restored.manualSelections,
            restored.pageStatuses,
        );

        expect(restoredRequest.decisions).toEqual(
            savedRequest.decisions,
        );
    });
});
