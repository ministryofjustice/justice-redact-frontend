import type { ImageAreaRect } from "./types";

export type ImagePoint = {
    x: number;
    y: number;
};

export const MIN_IMAGE_AREA_PX = 8;
export const MAX_IMAGE_WIDTH_PX = 940;

export function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

export function normalizedImageArea(
    start: ImagePoint,
    end: ImagePoint,
    renderedWidth: number,
    renderedHeight: number,
    minimumSizePx = MIN_IMAGE_AREA_PX,
): ImageAreaRect | null {
    if (
        !Number.isFinite(renderedWidth) ||
        !Number.isFinite(renderedHeight) ||
        renderedWidth <= 0 ||
        renderedHeight <= 0 ||
        !Number.isFinite(start.x) ||
        !Number.isFinite(start.y) ||
        !Number.isFinite(end.x) ||
        !Number.isFinite(end.y)
    ) {
        return null;
    }

    const x0 = clamp01(Math.min(start.x, end.x));
    const y0 = clamp01(Math.min(start.y, end.y));
    const x1 = clamp01(Math.max(start.x, end.x));
    const y1 = clamp01(Math.max(start.y, end.y));

    if (
        x1 <= x0 ||
        y1 <= y0 ||
        (x1 - x0) * renderedWidth < minimumSizePx ||
        (y1 - y0) * renderedHeight < minimumSizePx
    ) {
        return null;
    }

    return { x0, y0, x1, y1 };
}
