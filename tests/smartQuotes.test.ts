import {
    describe,
    expect,
    it,
} from "vitest";

import {
    toSmartQuotes,
} from "../app/review/smartQuotes";

describe("Smart quotation marks", () => {
    it("converts contractions and double quotation marks", () => {
        expect(
            toSmartQuotes(
                `He said "don't touch John's file".`
            )
        ).toBe(
            "He said “don’t touch John’s file”."
        );
    });

    it("handles single quotes, possessives and abbreviated years", () => {
        expect(
            toSmartQuotes(
                `She replied, 'OK'.`
            )
        ).toBe(
            "She replied, ‘OK’."
        );

        expect(
            toSmartQuotes(
                "James' records from the '90s"
            )
        ).toBe(
            "James’ records from the ’90s"
        );
    });

    it("preserves the original source and character offsets", () => {
        const source = `Start "don't" end`;
    const originalSource = source;

        const displayed = toSmartQuotes(source);

        expect(displayed.length).toBe(source.length);

        const start = source.indexOf("don't");
        const end = start + "don't".length;

        expect(
            displayed.slice(start, end)
        ).toBe("don’t");

        expect(source).toBe(originalSource);
    });

    it("leaves text without straight quotes unchanged", () => {
        const source = "Already “smart” and readable.";

        expect(toSmartQuotes(source)).toBe(source);
    });
});
