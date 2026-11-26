import { describe, expect, it } from "vitest";

import {
    MIN_IMAGE_AREA_WIDTH_PX,
    MIN_IMAGE_AREA_HEIGHT_PX,
    normalizedImageArea,
} from "../app/review/imageAreaGeometry";

describe("Minimum image redaction dimensions", () => {
    const renderedWidth = 400;
    const renderedHeight = 200;

    function createArea(width: number, height: number) {
        return normalizedImageArea(
            { x: 0, y: 0 },
            {
                x: width / renderedWidth,
                y: height / renderedHeight,
            },
            renderedWidth,
            renderedHeight,
        );
    }

    it("uses the agreed 36x32px minimum dimensions", () => {
        expect(MIN_IMAGE_AREA_WIDTH_PX).toBe(36);
        expect(MIN_IMAGE_AREA_HEIGHT_PX).toBe(32);
    });

    it.each([
        [36, 32],
        [37, 32],
        [36, 33],
        [40, 40],
        [100, 32],
        [36, 100],
        [400, 200],
    ])(
        "accepts a rectangle measuring %spx by %spx",
        (width, height) => {
            expect(createArea(width, height)).not.toBeNull();
        },
    );

    it.each([
        [35, 32],
        [36, 31],
        [35, 31],
        [24, 24],
        [8, 8],
        [100, 20],
        [20, 100],
        [0, 100],
        [100, 0],
        [35.99, 32],
        [36, 31.99],
    ])(
        "rejects a rectangle measuring %spx by %spx",
        (width, height) => {
            expect(createArea(width, height)).toBeNull();
        },
    );

    it("accepts the exact minimum away from the image origin", () => {
        const result = normalizedImageArea(
            { x: 0.25, y: 0.25 },
            {
                x: 0.25 + 36 / renderedWidth,
                y: 0.25 + 32 / renderedHeight,
            },
            renderedWidth,
            renderedHeight,
        );

        expect(result).not.toBeNull();
    });

    it("accepts drawing in reverse directions", () => {
        const result = normalizedImageArea(
            { x: 0.5, y: 0.5 },
            {
                x: 0.5 - 36 / renderedWidth,
                y: 0.5 - 32 / renderedHeight,
            },
            renderedWidth,
            renderedHeight,
        );

        expect(result).not.toBeNull();
        expect(result!.x0).toBeLessThan(result!.x1);
        expect(result!.y0).toBeLessThan(result!.y1);
    });

    it("allows smaller draft rectangles before completion", () => {
        const result = normalizedImageArea(
            { x: 0, y: 0 },
            { x: 0.01, y: 0.01 },
            1,
            1,
            0,
        );

        expect(result).not.toBeNull();
    });

    it("still rejects zero-sized draft rectangles", () => {
        expect(
            normalizedImageArea(
                { x: 0.5, y: 0.5 },
                { x: 0.5, y: 0.5 },
                1,
                1,
                0,
            ),
        ).toBeNull();
    });

    it("validates minimum dimensions against rendered CSS pixels", () => {
        const start = { x: 0, y: 0 };
        const end = { x: 0.1, y: 0.16 };

        expect(
            normalizedImageArea(start, end, 400, 200),
        ).not.toBeNull();

        expect(
            normalizedImageArea(start, end, 200, 100),
        ).toBeNull();
    });

    it("preserves normalized coordinates without enlarging the area", () => {
        const start = { x: 0.1, y: 0.2 };
        const end = { x: 0.5, y: 0.6 };

        expect(
            normalizedImageArea(start, end, 400, 200),
        ).toEqual({
            x0: 0.1,
            y0: 0.2,
            x1: 0.5,
            y1: 0.6,
        });
    });
});
