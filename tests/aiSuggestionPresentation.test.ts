import { describe, expect, it } from "vitest";
import { filterNestedAiSuggestions } from "../app/review/aiSuggestionPresentation";
import {
    buildAccessibleReviewText,
    buildRenderRanges,
} from "../app/review/textRendering";
import type { ReviewFinding } from "../app/review/types";

const sourceText = "0116 4546084";

const outer: ReviewFinding = {
    id: "outer",
    kind: "text",
    pageNumber: 1,
    itemId: "item-1",
    tableId: null,
    cellId: null,
    imageId: null,
    imageRecordId: null,
    entityType: "PHONE_NUMBER",
    entityText: sourceText,
    entityStart: 0,
    entityEnd: sourceText.length,
    entityScore: 0.99,
    context: sourceText,
    decision: "redact",
    sectionLabel: null,
};

const inner: ReviewFinding = {
    ...outer,
    id: "inner",
    entityText: "4546084",
    entityStart: 5,
    entityEnd: 12,
};

describe("AI suggestion presentation filtering", () => {
    it("removes fully nested ranges only from presentation", () => {
        const findings = [outer, inner];

        expect(filterNestedAiSuggestions(findings)).toEqual([
            outer,
        ]);

        expect(findings).toEqual([outer, inner]);
    });

    it("handles nested findings regardless of incoming order", () => {
        expect(
            filterNestedAiSuggestions([inner, outer])
        ).toEqual([outer]);
    });

    it("keeps distinct and partially overlapping ranges", () => {
        const left = {
            ...outer,
            id: "left",
            entityEnd: 7,
        };

        const right = {
            ...outer,
            id: "right",
            entityStart: 5,
        };

        expect(
            filterNestedAiSuggestions([left, right])
        ).toEqual([left, right]);
    });

    it("preserves findings from separate text items or pages", () => {
        const otherItem = {
            ...inner,
            id: "other-item",
            itemId: "item-2",
        };

        const otherPage = {
            ...inner,
            id: "other-page",
            pageNumber: 2,
        };

        expect(
            filterNestedAiSuggestions([
                outer,
                inner,
                otherItem,
                otherPage,
            ])
        ).toEqual([
            outer,
            otherItem,
            otherPage,
        ]);
    });

    it("filters within a table cell but not across cells", () => {
        const tableOuter: ReviewFinding = {
            ...outer,
            kind: "table_cell",
            itemId: null,
            tableId: "table-1",
            cellId: "cell-1",
        };

        const tableInner: ReviewFinding = {
            ...inner,
            kind: "table_cell",
            itemId: null,
            tableId: "table-1",
            cellId: "cell-1",
        };

        const otherCell: ReviewFinding = {
            ...tableInner,
            id: "other-cell",
            cellId: "cell-2",
        };

        expect(
            filterNestedAiSuggestions([
                tableOuter,
                tableInner,
                otherCell,
            ])
        ).toEqual([
            tableOuter,
            otherCell,
        ]);
    });

    it("preserves equal ranges and invalid offsets", () => {
        const duplicate = {
            ...outer,
            id: "duplicate",
        };

        const invalid = {
            ...inner,
            id: "invalid",
            entityStart: null,
        };

        expect(
            filterNestedAiSuggestions([
                outer,
                duplicate,
                invalid,
            ])
        ).toEqual([
            outer,
            duplicate,
            invalid,
        ]);
    });

    it("does not mutate frozen incoming API findings", () => {
        const findings = Object.freeze([
            Object.freeze({ ...outer }),
            Object.freeze({ ...inner }),
        ]);

        const rendered = filterNestedAiSuggestions(findings);

        expect(rendered).toHaveLength(1);
        expect(rendered[0]).toBe(findings[0]);
        expect(findings).toHaveLength(2);
        expect(findings[1].id).toBe("inner");
    });

    it("announces the outer suggestion exactly once", () => {
        const result = buildAccessibleReviewText(
            sourceText,
            [outer, inner],
            [],
            false
        );

        expect(result).toBe(
            "AI suggestion start 0116 4546084 AI suggestion end"
        );

        expect(
            result.match(/AI suggestion start/g)
        ).toHaveLength(1);

        expect(
            result.match(/AI suggestion end/g)
        ).toHaveLength(1);
    });

    it("does not split the visible highlight at the nested range", () => {
        const ranges = buildRenderRanges(
            sourceText,
            [outer, inner],
            [],
            false
        );

        expect(ranges).toHaveLength(1);
        expect(ranges[0].start).toBe(0);
        expect(ranges[0].end).toBe(sourceText.length);
        expect(ranges[0].className).toContain(
            "highlight--suggestion"
        );
    });

    it("preserves manual redactions and preview behaviour", () => {
        const manual = [{
            id: "manual-1",
            start: 0,
            end: sourceText.length,
        }];

        expect(
            buildAccessibleReviewText(
                sourceText,
                [outer, inner],
                manual,
                false
            )
        ).toBe(
            "Redaction start AI suggestion start " +
            "0116 4546084 AI suggestion end Redaction end"
        );

        expect(
            buildAccessibleReviewText(
                sourceText,
                [outer, inner],
                manual,
                true
            )
        ).toBe(
            "Redaction start 0116 4546084 Redaction end"
        );
    });
});
