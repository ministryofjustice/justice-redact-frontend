import { describe, expect, it } from "vitest";

import {
    clamp01,
    normalizedImageArea,
} from "../app/review/imageAreaGeometry";


describe("normalized image-area geometry", () => {
    it("converts image-relative points into normalized coordinates", () => {
        expect(
            normalizedImageArea(
                { x: 0.1, y: 0.2 },
                { x: 0.5, y: 0.6 },
                400,
                200,
            ),
        ).toEqual({
            x0: 0.1,
            y0: 0.2,
            x1: 0.5,
            y1: 0.6,
        });
    });

    it("supports drawing in reverse directions", () => {
        expect(
            normalizedImageArea(
                { x: 0.8, y: 0.9 },
                { x: 0.2, y: 0.1 },
                400,
                200,
            ),
        ).toEqual({
            x0: 0.2,
            y0: 0.1,
            x1: 0.8,
            y1: 0.9,
        });
    });

    it("rejects areas smaller than the minimum pixel size", () => {
        expect(
            normalizedImageArea(
                { x: 0.1, y: 0.1 },
                { x: 0.11, y: 0.12 },
                400,
                200,
            ),
        ).toBeNull();
    });

    it("rejects missing or invalid rendered dimensions", () => {
        expect(
            normalizedImageArea(
                { x: 0.1, y: 0.1 },
                { x: 0.5, y: 0.5 },
                0,
                200,
            ),
        ).toBeNull();

        expect(
            normalizedImageArea(
                { x: Number.NaN, y: 0 },
                { x: 0.5, y: 0.5 },
                400,
                200,
            ),
        ).toBeNull();
    });

    it("clamps points to the image boundaries", () => {
        expect(clamp01(-0.3)).toBe(0);
        expect(clamp01(1.3)).toBe(1);
    });
});
