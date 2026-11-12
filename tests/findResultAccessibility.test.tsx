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

type TestFinding = import("../app/review/types").ReviewFinding;

function makeAiFinding(
    overrides: Partial<TestFinding> = {}
): TestFinding {
    return {
        id: "finding-1",
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        tableId: null,
        cellId: null,
        imageId: null,
        imageRecordId: null,
        entityType: "PERSON",
        entityText: "A729",
        entityStart: 0,
        entityEnd: 4,
        entityScore: 0.95,
        context: "",
        decision: "",
        sectionLabel: null,
        ...overrides,
    };
}

describe("Find result AI suggestion rendering", () => {
    it("displays an AI suggestion with accessible markers", () => {
        const { container } = render(
            <FindResultExcerpt
                result={result}
                pages={pages}
                manualSelections={[]}
                findings={[makeAiFinding()]}
            />
        );

        const suggestion = container.querySelector(
            ".highlight--suggestion"
        );

        expect(suggestion?.textContent).toBe("A729");
        expect(
            suggestion?.classList.contains("highlight--redaction")
        ).toBe(false);

        expect(
            container.querySelector(
                ".govuk-visually-hidden"
            )?.textContent
        ).toBe(
            "AI suggestion start A729 AI suggestion end 3BK"
        );
    });

    it("preserves both styles when AI and manual ranges overlap", () => {
        const { container } = render(
            <FindResultExcerpt
                result={result}
                pages={pages}
                manualSelections={manualSelections}
                findings={[makeAiFinding()]}
            />
        );

        const overlapping = container.querySelector(
            ".highlight--suggestion.highlight--redaction"
        );

        expect(overlapping?.textContent).toBe("A729");

        expect(
            container.querySelector(
                ".govuk-visually-hidden"
            )?.textContent
        ).toBe(
            "Redaction start AI suggestion start A729 " +
            "AI suggestion end 3BK Redaction end"
        );
    });

    it("does not highlight findings from a different text item", () => {
        const { container } = render(
            <FindResultExcerpt
                result={result}
                pages={pages}
                manualSelections={[]}
                findings={[
                    makeAiFinding({
                        itemId: "different-item",
                    }),
                ]}
            />
        );

        expect(
            container.querySelector(".highlight--suggestion")
        ).toBeNull();
    });

    it("maps AI offsets through normalised whitespace", () => {
        const sourceText = "John   Smith";
        const displayText = "John Smith";

        const whitespacePages: ReviewPageData[] = [
            {
                ...pages[0],
                textItems: [
                    {
                        ...pages[0].textItems[0],
                        text: sourceText,
                        renderText: sourceText,
                    },
                ],
            },
        ];

        const whitespaceResult: FindInDocumentResult = {
            ...result,
            display: {
                ...result.display,
                text: displayText,
                matchStart: 5,
                matchEnd: 10,
            },
            segments: [
                {
                    ...result.segments[0],
                    start: 7,
                    end: 12,
                },
            ],
            displaySegments: [
                {
                    ...result.displaySegments[0],
                    start: 0,
                    end: sourceText.length,
                    displayStart: 0,
                    displayEnd: displayText.length,
                    sourceNormalisedStart: 0,
                    sourceNormalisedEnd: displayText.length,
                },
            ],
        };

        const { container } = render(
            <FindResultExcerpt
                result={whitespaceResult}
                pages={whitespacePages}
                manualSelections={[]}
                findings={[
                    makeAiFinding({
                        entityText: "Smith",
                        entityStart: 7,
                        entityEnd: 12,
                    }),
                ]}
            />
        );

        expect(
            container.querySelector(
                ".highlight--suggestion"
            )?.textContent
        ).toBe("Smith");
    });
});
