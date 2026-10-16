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

describe("redaction text accessibility", () => {
    it("identifies an AI suggestion for screen reader users", () => {
        const { container } = render(
            <div>
                {renderTextSegments(
                    text,
                    [suggestion],
                    [],
                    false,
                )}
            </div>,
        );

        const hiddenText =
            container.querySelector(
                ".govuk-visually-hidden",
            );

        expect(hiddenText?.textContent).toBe(
            "AI suggestion: ",
        );

        expect(container.textContent).toContain(
            "AI suggestion: A7293BK",
        );
    });

    it("identifies a manual redaction for screen reader users", () => {
        const { container } = render(
            <div>
                {renderTextSegments(
                    text,
                    [],
                    [
                        {
                            id: "manual-1",
                            start: 0,
                            end: text.length,
                        },
                    ],
                    false,
                )}
            </div>,
        );

        const hiddenText =
            container.querySelector(
                ".govuk-visually-hidden",
            );

        expect(hiddenText?.textContent).toBe(
            "Redaction: ",
        );

        expect(container.textContent).toContain(
            "Redaction: A7293BK",
        );
    });

    it("identifies an overlapping suggestion and manual selection as a redaction", () => {
        const { container } = render(
            <div>
                {renderTextSegments(
                    text,
                    [suggestion],
                    [
                        {
                            id: "manual-1",
                            start: 0,
                            end: text.length,
                        },
                    ],
                    false,
                )}
            </div>,
        );

        const hiddenText =
            container.querySelector(
                ".govuk-visually-hidden",
            );

        expect(hiddenText?.textContent).toBe(
            "Redaction: ",
        );

        expect(
            container.textContent,
        ).not.toContain("AI suggestion:");

        expect(container.textContent).toContain(
            "Redaction: A7293BK",
        );
    });

    it("identifies a bold AI suggestion without relying on strong alone", () => {
        const { container } = render(
            <div>
                {renderStyledTextSegments(
                    [
                        {
                            text,
                            start: 0,
                            end: text.length,
                            bbox: null,
                            fontName: null,
                            fontSize: null,
                            isBold: true,
                        },
                    ],
                    [suggestion],
                    [],
                    false,
                )}
            </div>,
        );

        const hiddenText =
            container.querySelector(
                ".govuk-visually-hidden",
            );

        expect(hiddenText?.textContent).toBe(
            "AI suggestion: ",
        );

        expect(
            container.querySelector("strong")
                ?.textContent,
        ).toBe(text);

        expect(container.textContent).toContain(
            "AI suggestion: A7293BK",
        );
    });
});