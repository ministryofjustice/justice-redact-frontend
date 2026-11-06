import { describe, expect, it } from "vitest";
import {
    getManualDecisionContentRange,
} from "../app/review/contentRangeUtils";
import {
    removeManualSelectionsWithinRanges,
} from "../features/documents/review/findRedactionOperations";
import type {
    ManualTextDecision,
} from "../app/review/types";

describe("Redaction fragment consistency", () => {
    it("preserves whitespace-only coverage outside a Find replacement range", () => {
        const existing: ManualTextDecision = {
            id: "existing-redaction",
            documentId: "test-document",
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 0,
            end: 4,
            text: "the ",
            redactionGroupId: "existing-group",
        };

        const sourceRange =
            getManualDecisionContentRange(existing);

        if (!sourceRange) {
            throw new Error(
                "Expected a valid source content range",
            );
        }

        const remaining = removeManualSelectionsWithinRanges(
            [existing],
            [
                {
                    ...sourceRange,
                    start: 0,
                    end: 3,
                },
            ],
            () => "new-fragment-id",
        );

        expect(remaining).toHaveLength(1);

        expect(remaining[0]).toMatchObject({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 3,
            end: 4,
            text: " ",
            redactionGroupId: "existing-group",
        });
    });

    it("preserves the original group ID for an untouched Find replacement fragment", () => {
        const makeDecision = (
            id: string,
            start: number,
            end: number,
        ): ManualTextDecision => ({
            id,
            documentId: "test-document",
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start,
            end,
            text: "the cat".slice(start, end),
            redactionGroupId: "original-group",
        });

        const left = makeDecision("left", 0, 2);
        const middle = makeDecision("middle", 2, 5);
        const right = makeDecision("right", 5, 7);

        const middleRange =
            getManualDecisionContentRange(middle);

        if (!middleRange) {
            throw new Error("Expected a valid content range");
        }

        let nextId = 0;

        const remaining = removeManualSelectionsWithinRanges(
            [left, middle, right],
            [middleRange],
            () => `generated-${++nextId}`,
        );

        expect(remaining).toHaveLength(2);

        const [first, second] = remaining;

        if (
            first?.kind !== "text" ||
            second?.kind !== "text"
        ) {
            throw new Error("Expected text redaction fragments");
        }

        expect(first).toBe(left);
        expect(first.redactionGroupId).toBe(
            "original-group",
        );

        expect(second).toMatchObject({
            kind: "text",
            start: 5,
            end: 7,
            text: "at",
        });

        expect(second.redactionGroupId)
            .not.toBe("original-group");
    });
});
