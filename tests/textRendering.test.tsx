// @vitest-environment jsdom

import {
    cleanup,
    render,
} from "@testing-library/react";
import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";
import {
    buildAccessibleReviewText,
    renderStyledTextSegments,
    renderTextSegments,
} from "../app/review/textRendering";
import type {
    ReviewFinding,
} from "../app/review/types";

afterEach(() => {
    cleanup();
});

const text = "A7293BK";

const suggestion: ReviewFinding = {
    id: "finding-1",
    kind: "text",
    pageNumber: 1,
    itemId: "item-1",
    tableId: null,
    cellId: null,
    imageId: null,
    imageRecordId: null,
    entityType: "PRISONER_NUMBER",
    entityText: text,
    entityStart: 0,
    entityEnd: text.length,
    entityScore: 0.99,
    context: text,
    decision: "redact",
    sectionLabel: null,
};

describe("accessible Review text", () => {
    it("reads PDF line wrapping as one continuous paragraph", () => {
        expect(
            buildAccessibleReviewText(
                "The prisoner remains positive and has been working hard on\nanger management techniques we discussed.",
                [],
                [],
                false
            )
        ).toBe(
            "The prisoner remains positive and has been working hard on anger management techniques we discussed."
        );
    });

    it("announces the start and end of a manual redaction", () => {
        const sourceText =
            "The prisoner is MARCUS THOMPSON";

        expect(
            buildAccessibleReviewText(
                sourceText,
                [],
                [
                    {
                        id: "manual-1",
                        start: 16,
                        end: 22,
                    },
                ],
                false
            )
        ).toBe(
            "The prisoner is Redaction start MARCUS Redaction end THOMPSON"
        );
    });

    it("announces an AI suggestion inside a manual redaction", () => {
        expect(
            buildAccessibleReviewText(
                "A7293BK",
                [suggestion],
                [
                    {
                        id: "manual-1",
                        start: 0,
                        end: text.length,
                    },
                ],
                false
            )
        ).toBe(
            "Redaction start AI suggestion start A7293BK AI suggestion end Redaction end"
        );
    });

    it("does not repeat redaction boundaries when an AI suggestion splits a redaction", () => {
        const sourceText =
            "WILLIAMS, JAMIE LEE";

        const nestedSuggestion: ReviewFinding = {
            ...suggestion,
            id: "finding-jamie",
            entityText: "JAMIE",
            entityStart:
                "WILLIAMS, ".length,
            entityEnd:
                "WILLIAMS, JAMIE".length,
        };

        expect(
            buildAccessibleReviewText(
                sourceText,
                [nestedSuggestion],
                [
                    {
                        id: "manual-1",
                        start: 0,
                        end: sourceText.length,
                    },
                ],
                false
            )
        ).toBe(
            "Redaction start WILLIAMS, AI suggestion start JAMIE AI suggestion end LEE Redaction end"
        );
    });

    it("does not announce AI suggestions in preview mode", () => {
        expect(
            buildAccessibleReviewText(
                "A7293BK",
                [suggestion],
                [
                    {
                        id: "manual-1",
                        start: 0,
                        end: text.length,
                    },
                ],
                true
            )
        ).toBe(
            "Redaction start A7293BK Redaction end"
        );
    });

    it("can omit the end announcement when a redaction continues into the next text item", () => {
        expect(
            buildAccessibleReviewText(
                "MARCUS",
                [],
                [
                    {
                        id: "manual-1",
                        start: 0,
                        end: 6,
                        announceEnd: false,
                    },
                ],
                false
            )
        ).toBe(
            "Redaction start MARCUS"
        );
    });

    it("can omit the start announcement when a redaction continues from the previous text item", () => {
        expect(
            buildAccessibleReviewText(
                "THOMPSON",
                [],
                [
                    {
                        id: "manual-2",
                        start: 0,
                        end: 8,
                        announceStart: false,
                    },
                ],
                false
            )
        ).toBe(
            "THOMPSON Redaction end"
        );
    });
});