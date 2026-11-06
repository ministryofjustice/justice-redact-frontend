
import { describe, expect, it } from "vitest";

import { addPartialFindRedactions } from "../features/documents/review/findRedactionOperations";

import { findInDocument } from "../app/review/findInDocument";

import type { FindInDocumentResult } from "../app/review/findInDocument";

import type {
    ManualDecision,
    ManualTextDecision,
    ReviewPageData,
} from "../app/review/types";

const DOCUMENT_ID = "partial-redaction-test";

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
        tables: [],
        images: [],
    },
];

const searchResults = findInDocument(
    pages,
    "the cat",
).filter((result) => result.kind === "text");

const selectedRange = {
    start: 4,
    end: 7,
};

function createIds(): () => string {
    let next = 0;
    return () => `generated-${++next}`;
}

function apply(
    previous: ManualDecision[],
    results: FindInDocumentResult[] = searchResults,
    range = selectedRange,
) {
    return addPartialFindRedactions(
        previous,
        results,
        range,
        pages,
        DOCUMENT_ID,
        createIds(),
    );
}

function textDecision(
    id: string,
    start: number,
    end: number,
    text: string,
): ManualTextDecision {
    return {
        id,
        documentId: DOCUMENT_ID,
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start,
        end,
        text,
        redactionGroupId: `group-${id}`,
    };
}

describe("Find and Partially Redact operations", () => {
    it("adds the exact selected source-text offsets", () => {
        expect(searchResults).toHaveLength(2);

        const result = apply([], [searchResults[0]]);

        expect(result.addedResultCount).toBe(1);

        expect(result.nextSelections).toHaveLength(1);

        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 4,
            end: 7,
            text: "cat",
        });
    });

    it("merges a partial selection with overlapping existing coverage", () => {
        const previous = textDecision(
            "existing",
            4,
            6,
            "ca",
        );

        const result = apply(
            [previous],
            [searchResults[0]],
        );

        expect(result.addedResultCount).toBe(1);
        expect(result.nextSelections).toHaveLength(1);

        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            itemId: "item-1",
            start: 4,
            end: 7,
            text: "cat",
        });

        const merged = result.nextSelections[0];

        if (merged.kind !== "text") {
            throw new Error("Expected a text redaction");
        }

        expect(merged.redactionGroupId)
            .not.toBe(previous.redactionGroupId);
    });

    it("does not add overlapping decisions for duplicate Find results", () => {
        const first = searchResults[0];

        const duplicate: FindInDocumentResult = {
            ...first,
            id: "duplicate-find-result",
        };

        const result = apply(
            [],
            [first, duplicate],
        );

        // Both results refer to the same source characters.
        // Only the first contributes new coverage.
        expect(result.addedResultCount).toBe(1);

        expect(result.nextSelections).toHaveLength(1);

        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            start: 4,
            end: 7,
            text: "cat",
        });
    });

    it("evaluates coverage against the supplied latest state", () => {
        const existing = textDecision(
            "already-redacted",
            4,
            7,
            "cat",
        );

        const withoutExisting = apply(
            [],
            [searchResults[0]],
        );

        const withExisting = apply(
            [existing],
            [searchResults[0]],
        );

        expect(withoutExisting.addedResultCount).toBe(1);

        expect(withExisting.addedResultCount).toBe(0);

        expect(withExisting.nextSelections).toEqual([
            existing,
        ]);

        expect(withExisting.nextSelections[0]).toBe(
            existing,
        );
    });

    it("keeps separate Find occurrences independently removable", () => {
        const result = apply([]);

        expect(result.addedResultCount).toBe(2);

        expect(result.nextSelections).toMatchObject([
            {
                kind: "text",
                start: 4,
                end: 7,
                text: "cat",
            },
            {
                kind: "text",
                start: 12,
                end: 15,
                text: "cat",
            },
        ]);

        const groups = result.nextSelections.map(
            (decision) =>
                decision.kind === "image"
                    ? undefined
                    : decision.redactionGroupId,
        );

        expect(groups.every(Boolean)).toBe(true);
        expect(new Set(groups).size).toBe(2);
    });

    it("merges existing decisions bridged by a partial selection", () => {
        const first = textDecision("first", 4, 5, "c");
        const second = textDecision("second", 6, 7, "t");

        const result = apply(
            [first, second],
            [searchResults[0]],
        );

        expect(result.addedResultCount).toBe(1);
        expect(result.nextSelections).toHaveLength(1);

        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            start: 4,
            end: 7,
            text: "cat",
        });
    });

    it("merges a longer manual redaction when the partial selection overlaps it", () => {
        // Existing "the c", then partially redact "e cat".
        const previous = textDecision(
            "existing",
            0,
            5,
            "the c",
        );

        const result = apply(
            [previous],
            [searchResults[0]],
            { start: 2, end: 7 },
        );

        expect(result.addedResultCount).toBe(1);
        expect(result.nextSelections).toHaveLength(1);

        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            start: 0,
            end: 7,
            text: "the cat",
        });
    });

    it("does not merge redactions that only touch at their boundaries", () => {
        const previous = textDecision(
            "existing",
            0,
            4,
            "the ",
        );

        const result = apply(
            [previous],
            [searchResults[0]],
        );

        expect(result.addedResultCount).toBe(1);
        expect(result.nextSelections).toHaveLength(2);

        expect(result.nextSelections[0]).toBe(previous);

        expect(result.nextSelections[1]).toMatchObject({
            kind: "text",
            start: 4,
            end: 7,
            text: "cat",
        });

        const added = result.nextSelections[1];

        if (added.kind !== "text") {
            throw new Error("Expected a text redaction");
        }

        expect(added.redactionGroupId)
            .not.toBe(previous.redactionGroupId);
    });

    it("preserves unrelated decisions and images", () => {
        const unrelated = textDecision(
            "unrelated",
            0,
            3,
            "the",
        );

        const image: ManualDecision = {
            id: "image-1",
            documentId: DOCUMENT_ID,
            kind: "image",
            pageNumber: 1,
            imageId: "image-1",
        };

        const result = apply(
            [unrelated, image],
            [searchResults[0]],
        );

        expect(result.nextSelections[0]).toBe(unrelated);
        expect(result.nextSelections[1]).toBe(image);

        expect(result.nextSelections[2]).toMatchObject({
            kind: "text",
            start: 4,
            end: 7,
            text: "cat",
        });
    });

    it("does not mutate previous decisions", () => {
        const previous = [
            textDecision("existing", 4, 6, "ca"),
        ];

        const snapshot = structuredClone(previous);

        apply(previous, [searchResults[0]]);

        expect(previous).toEqual(snapshot);
    });

    it("merges fully covered decisions when the selected range overlaps both", () => {
        const first = textDecision("first", 0, 4, "the ");
        const second = textDecision("second", 4, 7, "cat");

        const result = apply(
            [first, second],
            [searchResults[0]],
            { start: 3, end: 7 },
        );

        expect(result.addedResultCount).toBe(1);
        expect(result.nextSelections).toHaveLength(1);
        expect(result.nextSelections[0]).toMatchObject({
            kind: "text",
            itemId: "item-1",
            start: 0,
            end: 7,
            text: "the cat",
        });
    });
});
