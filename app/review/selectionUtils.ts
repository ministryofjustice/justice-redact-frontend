import type { ManualSpan } from "./types";

export function mergeSpans(spans: ManualSpan[]) {
    const sorted = spans
        .filter((span) => span.end > span.start)
        .slice()
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const merged: Array<{ start: number; end: number }> = [];

    for (const span of sorted) {
        const last = merged[merged.length - 1];

        if (!last) {
            merged.push({ start: span.start, end: span.end });
            continue;
        }

        if (span.start <= last.end) {
            last.end = Math.max(last.end, span.end);
            continue;
        }

        merged.push({ start: span.start, end: span.end });
    }

    return merged;
}

export function getClosestElementWithAttribute(
    node: Node | null,
    attribute: string
): HTMLElement | null {
    let current: Node | null = node;

    while (current) {
        if (current instanceof HTMLElement && current.hasAttribute(attribute)) {
            return current;
        }

        current = current.parentNode;
    }

    return null;
}

export function getTextOffsetWithinItem(
    container: HTMLElement,
    targetNode: Node,
    targetOffset: number
) {
    const range = document.createRange();

    range.setStart(container, 0);
    range.setEnd(targetNode, targetOffset);

    return range.toString().length;
}