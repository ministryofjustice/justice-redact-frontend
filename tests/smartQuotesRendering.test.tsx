import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
    renderTextSegments,
    renderStyledTextSegments,
} from "../app/review/textRendering";

describe("Smart quotes in document rendering", () => {
    const source = 'He said "don\'t" today.';
    const expected = "He said “don’t” today.";

    const start = source.indexOf("don't");

    const selections = [{
        id: "manual-1",
        start,
        end: start + "don't".length,
    }];

    it("converts plain text without changing redaction boundaries", () => {
        const html = renderToStaticMarkup(
            createElement(
                "div",
                null,
                renderTextSegments(
                    source,
                    [],
                    selections,
                    false
                )
            )
        );

        expect(html.replace(/<[^>]*>/g, "")).toBe(expected);
        expect(html).toContain('data-manual-id="manual-1"');
        expect(html).toContain("don’t");
    });

    it("handles quotes across formatting boundaries", () => {
        const spans = [
            {
                start: 0,
                end: 9,
                text: 'He said "',
                isBold: false,
            },
            {
                start: 9,
                end: 14,
                text: "don't",
                isBold: true,
            },
            {
                start: 14,
                end: source.length,
                text: '" today.',
                isBold: false,
            },
        ] as Parameters<typeof renderStyledTextSegments>[0];

        const html = renderToStaticMarkup(
            createElement(
                "div",
                null,
                renderStyledTextSegments(
                    spans,
                    [],
                    selections,
                    false
                )
          )
        );

        expect(html.replace(/<[^>]*>/g, "")).toBe(expected);
        expect(html).toContain("<strong>don’t</strong>");
        expect(html).toContain('data-manual-id="manual-1"');
    });
});
