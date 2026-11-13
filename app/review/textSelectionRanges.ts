import { clampRangeValue } from "./textRendering";

import {
    getClosestElementWithAttribute,
    getTextOffsetWithinItem,
} from "./selectionUtils";

import type {
    ManualSpan,
    ReviewPageData,
} from "./types";

export type TextSelectionResolution =
    | { kind: "ignore" }
    | { kind: "clear" }
    | {
        kind: "apply";
        page: ReviewPageData;
        spans: ManualSpan[];
    };

export function resolveSelectedTextRanges(
    range: Range,
    visiblePages: ReviewPageData[],
): TextSelectionResolution {
    const intersectedElements = Array.from(
        document.querySelectorAll<HTMLElement>(
            ".jr-review-block.redactable[data-page-number][data-item-id]",
        ),
    ).filter((element) => {
        try {
            return range.intersectsNode(element);
        } catch {
            return false;
        }
    });

    if (intersectedElements.length === 0) {
        return { kind: "ignore" };
    }

    const pageNumbers = new Set(
        intersectedElements
            .map((element) => element.dataset.pageNumber)
            .filter(
                (pageNumber): pageNumber is string =>
                    Boolean(pageNumber),
            ),
    );

    if (pageNumbers.size !== 1) {
        return { kind: "clear" };
    }

    const pageNumberValue =
        Array.from(pageNumbers)[0];

    if (!pageNumberValue) {
        return { kind: "clear" };
    }

    const pageNumber = Number(pageNumberValue);

    const page = visiblePages.find(
        (candidate) =>
            candidate.pageNumber === pageNumber,
    );

    if (!page) {
        return { kind: "clear" };
    }

    const startElement = getClosestElementWithAttribute(
        range.startContainer,
        "data-item-id",
    );

    const endElement = getClosestElementWithAttribute(
        range.endContainer,
        "data-item-id",
    );

    const spans: ManualSpan[] = [];

    intersectedElements.forEach((element) => {
        const itemId = element.dataset.itemId;

        if (!itemId) {
            return;
        }

        const item = page.textItems.find(
            (candidate) => candidate.itemId === itemId,
        );

        if (!item) {
            return;
        }

        const sourceText = item.text;

        let start = 0;
        let end = sourceText.length;

        if (startElement?.dataset.itemId === itemId) {
            start = getTextOffsetWithinItem(
                element,
                range.startContainer,
                range.startOffset,
            );
        }

        if (endElement?.dataset.itemId === itemId) {
            end = getTextOffsetWithinItem(
                element,
                range.endContainer,
                range.endOffset,
            );
        }

        const normalisedStart = clampRangeValue(
            Math.min(start, end),
            sourceText.length,
        );

        const normalisedEnd = clampRangeValue(
            Math.max(start, end),
            sourceText.length,
        );

        if (normalisedEnd <= normalisedStart) {
            return;
        }

        if (
            !sourceText
                .slice(normalisedStart, normalisedEnd)
                .trim()
        ) {
            return;
        }

        spans.push({
            pageNumber,
            itemId,
            start: normalisedStart,
            end: normalisedEnd,
        });
    });

    if (spans.length === 0) {
        return { kind: "ignore" };
    }

    return {
        kind: "apply",
        page,
        spans,
    };
}
