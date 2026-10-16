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

import FindResultExcerpt from "../app/review/components/FindResultExcerpt";
import FindResultMatch from "../app/review/components/FindResultMatch";
import type {
    FindInDocumentResult,
} from "../app/review/findInDocument";
import type {
    ManualDecision,
    ReviewPageData,
} from "../app/review/types";

afterEach(() => {
    cleanup();
});

const text = "A7293BK";

const pages: ReviewPageData[] = [
    {
        pageNumber: 1,
        textItems: [
            {
                itemId: "item-1",
                text,
                renderText: text,
                bbox: null,
            },
        ],
        tables: [],
        images: [],
    },
];

const manualSelections: ManualDecision[] = [
    {
        id: "manual-1",
        documentId: "document-1",
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 0,
        end: text.length,
        text,
    },
];

const result: FindInDocumentResult = {
    id: "result-1",
    kind: "text",
    pageNumber: 1,
    itemId: "item-1",
    tableId: null,
    cellId: null,
    display: {
        text,
        matchStart: 0,
        matchEnd: text.length,
        hasLeadingEllipsis: false,
        hasTrailingEllipsis: false,
    },
    segments: [
        {
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            tableId: null,
            cellId: null,
            start: 0,
            end: text.length,
        },
    ],
    displaySegments: [
        {
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            tableId: null,
            cellId: null,
            start: 0,
            end: text.length,
            displayStart: 0,
            displayEnd: text.length,
            sourceNormalisedStart: 0,
            sourceNormalisedEnd: text.length,
        },
    ],
};

describe("find result redaction accessibility", () => {
    it("identifies a redacted search match for screen reader users", () => {
        const { container } = render(
            <FindResultMatch
                result={result}
                pages={pages}
                manualSelections={manualSelections}
            />,
        );

        expect(
            container.querySelector(
                ".govuk-visually-hidden",
            )?.textContent,
        ).toBe("Redaction: ");

        expect(container.textContent).toContain(
            "Redaction: A7293BK",
        );
    });

    it("identifies a redacted excerpt for screen reader users", () => {
        const { container } = render(
            <FindResultExcerpt
                result={result}
                pages={pages}
                manualSelections={manualSelections}
            />,
        );

        expect(
            container.querySelector(
                ".govuk-visually-hidden",
            )?.textContent,
        ).toBe("Redaction: ");

        expect(container.textContent).toContain(
            "Redaction: A7293BK",
        );
    });
});