import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DocumentProcessingProgress, {
    getDisplayedProcessingProgress,
    getProgressMilestone,
    normaliseProcessingProgress,
} from "../app/processing/DocumentProcessingProgress";

describe("normaliseProcessingProgress", () => {
    it("keeps valid integer progress values unchanged", () => {
        expect(normaliseProcessingProgress(57)).toBe(57);
    });

    it("rounds progress down to a whole percentage", () => {
        expect(normaliseProcessingProgress(57.9)).toBe(57);
    });

    it("clamps progress to the 0 to 100 range", () => {
        expect(normaliseProcessingProgress(-10)).toBe(0);
        expect(normaliseProcessingProgress(110)).toBe(100);
    });

    it("returns zero for non-finite values", () => {
        expect(normaliseProcessingProgress(Number.NaN)).toBe(0);
        expect(normaliseProcessingProgress(Number.POSITIVE_INFINITY)).toBe(0);
    });
});

describe("getProgressMilestone", () => {
    it.each([
        [0, 0],
        [24, 0],
        [25, 25],
        [49, 25],
        [50, 50],
        [74, 50],
        [75, 75],
        [99, 75],
        [100, 100],
    ])(
        "maps %i percent to the %i percent announcement milestone",
        (progress, expected) => {
            expect(getProgressMilestone(progress)).toBe(expected);
        },
    );
});

describe("getDisplayedProcessingProgress", () => {
    it("shows exact progress when reduced motion is not preferred", () => {
        expect(
            getDisplayedProcessingProgress(57, false),
        ).toBe(57);
    });

    it("shows milestone progress when reduced motion is preferred", () => {
        expect(
            getDisplayedProcessingProgress(8, true),
        ).toBe(0);

        expect(
            getDisplayedProcessingProgress(27, true),
        ).toBe(25);

        expect(
            getDisplayedProcessingProgress(57, true),
        ).toBe(50);

        expect(
            getDisplayedProcessingProgress(83, true),
        ).toBe(75);

        expect(
            getDisplayedProcessingProgress(100, true),
        ).toBe(100);
    });
});

describe("DocumentProcessingProgress", () => {
    it("renders a determinate accessible progressbar", () => {
        const markup = renderToStaticMarkup(
            <DocumentProcessingProgress progress={57} />,
        );

        expect(markup).toContain('role="progressbar"');
        expect(markup).toContain(
            'aria-label="File processing progress"',
        );
        expect(markup).toContain('aria-valuemin="0"');
        expect(markup).toContain('aria-valuemax="100"');
        expect(markup).toContain('aria-valuenow="57"');
        expect(markup).toContain('width:57%');
        expect(markup).toContain("Progress 57%");
    });

    it("renders the milestone live-region announcement", () => {
        const markup = renderToStaticMarkup(
            <DocumentProcessingProgress progress={57} />,
        );

        expect(markup).toContain('aria-live="polite"');
        expect(markup).toContain('aria-atomic="true"');
        expect(markup).toContain("Progress 50%");
    });
});