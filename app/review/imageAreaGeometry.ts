import type { ImageAreaRect } from "./types";

export type ImagePoint = {
    x: number;
    y: number;
};

export const MIN_IMAGE_AREA_WIDTH_PX = 36;
export const MIN_IMAGE_AREA_HEIGHT_PX = 32;
export const MAX_IMAGE_WIDTH_PX = 940;

export function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

export function normalizedImageArea(
    start: ImagePoint,
    end: ImagePoint,
    renderedWidth: number,
    renderedHeight: number,
    minimumSizePx?: number,
): ImageAreaRect | null {
    if (
        !Number.isFinite(renderedWidth) ||
        !Number.isFinite(renderedHeight) ||
        renderedWidth <= 0 ||
        renderedHeight <= 0 ||
        ![start.x, start.y, end.x, end.y].every(Number.isFinite)
    ) {
        return null;
    }

    if (
        minimumSizePx !== undefined &&
        (
            !Number.isFinite(minimumSizePx) ||
            minimumSizePx < 0
        )
    ) {
        return null;
    }

    const x0 = clamp01(Math.min(start.x, end.x));
    const y0 = clamp01(Math.min(start.y, end.y));
    const x1 = clamp01(Math.max(start.x, end.x));
    const y1 = clamp01(Math.max(start.y, end.y));

    if (x1 <= x0 || y1 <= y0) {
        return null;
    }

    const widthPx = (x1 - x0) * renderedWidth;
    const heightPx = (y1 - y0) * renderedHeight;

    const minimumWidthPx =
        minimumSizePx ?? MIN_IMAGE_AREA_WIDTH_PX;

    const minimumHeightPx =
        minimumSizePx ?? MIN_IMAGE_AREA_HEIGHT_PX;

    // Account for negligible floating-point rounding at
    // exact pixel boundaries after coordinate normalization.
    const widthTolerance =
        Number.EPSILON * Math.max(renderedWidth, 1) * 8;

    const heightTolerance =
        Number.EPSILON * Math.max(renderedHeight, 1) * 8;

    if (
        widthPx + widthTolerance < minimumWidthPx ||
        heightPx + heightTolerance < minimumHeightPx
    ) {
        return null;
    }

    return { x0, y0, x1, y1 };
}
