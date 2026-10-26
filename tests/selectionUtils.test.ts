// @vitest-environment jsdom

import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    getSelectionSourceTextLength,
    getTextOffsetWithinItem,
} from "../app/review/selectionUtils";
import { buildApplyRedactionsRequest } from "../app/review/applyRedactions";
import type { ManualDecision } from "../app/review/types";

afterEach(() => {
    document.body.innerHTML = "";
});

function createReviewTextDom(
    statusText: "AI suggestion: " | "Redaction: "
) {
    const container = document.createElement("div");

    container.innerHTML =
        '<span data-part="prefix">The prisoner is </span>' +
        '<span class="highlight">' +
        `<span class="govuk-visually-hidden" data-selection-offset-ignore>${statusText}</span>` +
        '<span data-part="target">MARCUS</span>' +
        "</span>" +
        '<span data-part="suffix"> THOMPSON</span>';

    document.body.appendChild(container);

    const target = container.querySelector(
        '[data-part="target"]'
    )?.firstChild;

    if (!target) {
        throw new Error("Target text node was not created");
    }

    return {
        container,
        target,
    };
}

describe("selection source offsets", () => {
    it("does not count AI suggestion accessibility text", () => {
        const { container, target } =
            createReviewTextDom("AI suggestion: ");

        const start = getTextOffsetWithinItem(
            container,
            target,
            0
        );

        const end = getTextOffsetWithinItem(
            container,
            target,
            "MARCUS".length
        );

        expect(start).toBe(16);
        expect(end).toBe(22);
    });

    it("does not count redaction accessibility text", () => {
        const { container, target } =
            createReviewTextDom("Redaction: ");

        const start = getTextOffsetWithinItem(
            container,
            target,
            0
        );

        const end = getTextOffsetWithinItem(
            container,
            target,
            "MARCUS".length
        );

        expect(start).toBe(16);
        expect(end).toBe(22);
    });

    it("still counts ordinary nested document text", () => {
        const container = document.createElement("div");

        container.innerHTML =
            '<span>The </span>' +
            "<strong>prisoner</strong>" +
            '<span data-part="target"> is MARCUS</span>';

        document.body.appendChild(container);

        const target = container.querySelector(
            '[data-part="target"]'
        )?.firstChild;

        if (!target) {
            throw new Error("Target text node was not created");
        }

        expect(
            getTextOffsetWithinItem(
                container,
                target,
                " is ".length
            )
        ).toBe("The prisoner is ".length);
    });

    it("excludes accessibility metadata from a selected range", () => {
        const { container } =
            createReviewTextDom("AI suggestion: ");

        const range = document.createRange();
        range.selectNodeContents(container);

        expect(
            getSelectionSourceTextLength(range)
        ).toBe(
            "The prisoner is MARCUS THOMPSON".length
        );
    });

    it("sends the original source offsets unchanged in the apply-redactions request", () => {
        const sourceText =
            "The prisoner is MARCUS THOMPSON";

        const { container, target } =
            createReviewTextDom("AI suggestion: ");

        const start = getTextOffsetWithinItem(
            container,
            target,
            0
        );

        const end = getTextOffsetWithinItem(
            container,
            target,
            "MARCUS".length
        );

        const manualSelections: ManualDecision[] = [
            {
                id: "manual-1",
                documentId: "document-1",
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start,
                end,
                text: sourceText.slice(start, end),
            },
        ];

        const request = buildApplyRedactionsRequest(
            "document-1",
            manualSelections,
            {}
        );

        expect(request.decisions[0]).toMatchObject({
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 16,
            end: 22,
            text: "MARCUS",
            action: "redact",
            source: "manual",
        });
    });

    it("ignores the full accessible copy and counts the visual source text exactly once", () => {
        const container = document.createElement("div");

        container.innerHTML =
            '<span class="govuk-visually-hidden" data-selection-offset-ignore>' +
            "The prisoner is Redaction start MARCUS Redaction end THOMPSON" +
            "</span>" +
            '<span aria-hidden="true">' +
            '<span data-part="prefix">The prisoner is </span>' +
            '<span data-part="target">MARCUS</span>' +
            '<span data-part="suffix"> THOMPSON</span>' +
            "</span>";

        document.body.appendChild(container);

        const target = container.querySelector(
            '[data-part="target"]'
        )?.firstChild;

        if (!target) {
            throw new Error("Target text node was not created");
        }

        const start = getTextOffsetWithinItem(
            container,
            target,
            0
        );

        const end = getTextOffsetWithinItem(
            container,
            target,
            "MARCUS".length
        );

        expect(start).toBe(16);
        expect(end).toBe(22);

        const range = document.createRange();
        range.selectNodeContents(container);

        expect(
            getSelectionSourceTextLength(range)
        ).toBe(
            "The prisoner is MARCUS THOMPSON".length
        );
    });
});