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
import { buildAccessibleFindResultText } from "../app/review/findResultRedactionDisplay";

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
        ).toBe(
            "Redaction start A7293BK Redaction end"
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
        ).toBe(
            "Redaction start A7293BK Redaction end"
        );
    });
});

describe("Find result accessible text", () => {
    it("announces redaction start and end", () => {
        expect(
            buildAccessibleFindResultText(
                "A7293BK",
                [
                    {
                        start: 0,
                        end: 7,
                    },
                ]
            )
        ).toBe(
            "Redaction start A7293BK Redaction end"
        );
    });

    it("does not repeat boundaries for adjacent redacted ranges", () => {
        expect(
            buildAccessibleFindResultText(
                "WILLIAMS, JAMIE LEE",
                [
                    {
                        start: 0,
                        end: 10,
                    },
                    {
                        start: 10,
                        end: 19,
                    },
                ]
            )
        ).toBe(
            "Redaction start WILLIAMS, JAMIE LEE Redaction end"
        );
    });
});