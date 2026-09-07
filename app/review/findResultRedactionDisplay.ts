import {
    containsContentRange,
    getFindResultContentRanges,
    getManualDecisionContentRanges,
    overlapsContentRange,
    type ContentRange,
} from "./contentRangeUtils";
import {
    mapOriginalOffsetToNormalisedOffset,
    normaliseWhitespaceForSearch,
    type FindInDocumentResult,
} from "./findInDocument";
import { mergeContentRanges } from "./mergeContentRanges";
import type {
    ManualDecision,
    ReviewPageData,
} from "./types";

export type FindResultDisplayRange = {
    start: number;
    end: number;
};

function getSourceTextForRange(
    pages: ReviewPageData[],
    range: ContentRange
): string | null {
    const page = pages.find(
        (candidate) =>
            candidate.pageNumber === range.pageNumber
    );

    if (!page) {
        return null;
    }

    if (range.kind === "text") {
        return (
            page.textItems.find(
                (item) => item.itemId === range.itemId
            )?.text ?? null
        );
    }

    const table = page.tables.find(
        (candidate) =>
            candidate.tableId === range.tableId
    );

    const cell = table?.rows
        .flatMap((row) => row.cells)
        .find(
            (candidate) =>
                candidate.cellId === range.cellId
        );

    return cell?.text ?? null;
}

function mergeDisplayRanges(
    ranges: FindResultDisplayRange[]
): FindResultDisplayRange[] {
    const sorted = ranges
        .filter((range) => range.end > range.start)
        .slice()
        .sort(
            (left, right) =>
                left.start - right.start ||
                left.end - right.end
        );

    if (sorted.length === 0) {
        return [];
    }

    const merged: FindResultDisplayRange[] = [
        { ...sorted[0] },
    ];

    sorted.slice(1).forEach((range) => {
        const previous = merged[merged.length - 1];

        if (range.start <= previous.end) {
            previous.end = Math.max(
                previous.end,
                range.end
            );
            return;
        }

        merged.push({ ...range });
    });

    return merged;
}

export function isFindResultFullyRedacted(
    result: FindInDocumentResult,
    manualSelections: ManualDecision[]
): boolean {
    const resultRanges =
        getFindResultContentRanges(result);

    if (resultRanges.length === 0) {
        return false;
    }

    const manualRanges = mergeContentRanges(
        getManualDecisionContentRanges(
            manualSelections
        )
    );

    return resultRanges.every((resultRange) =>
        manualRanges.some((manualRange) =>
            containsContentRange(
                manualRange,
                resultRange
            )
        )
    );
}

export function getFindResultRedactedDisplayRanges(
    result: FindInDocumentResult,
    pages: ReviewPageData[],
    manualSelections: ManualDecision[]
): FindResultDisplayRange[] {
    const manualRanges = mergeContentRanges(
        getManualDecisionContentRanges(
            manualSelections
        )
    );

    const displayRanges: FindResultDisplayRange[] = [];

    let displayOffset = 0;

    result.segments.forEach((segment, index) => {
        /*
         * Text searches can span multiple text items.
         * findInDocument joins those items with one normalised
         * space, so reproduce that offset here.
         */
        if (
            index > 0 &&
            result.kind === "text"
        ) {
            displayOffset += 1;
        }

        const sourceText =
            getSourceTextForRange(pages, segment);

        if (!sourceText) {
            return;
        }

        const segmentText = sourceText.slice(
            segment.start,
            segment.end
        );

        const normalisedSegment =
            normaliseWhitespaceForSearch(segmentText);

        const segmentDisplayStart = displayOffset;

        manualRanges.forEach((manualRange) => {
            if (
                !overlapsContentRange(
                    segment,
                    manualRange
                )
            ) {
                return;
            }

            const overlapStart = Math.max(
                segment.start,
                manualRange.start
            );

            const overlapEnd = Math.min(
                segment.end,
                manualRange.end
            );

            if (overlapEnd <= overlapStart) {
                return;
            }

            const localStart =
                overlapStart - segment.start;

            const localEnd =
                overlapEnd - segment.start;

            const normalisedStart =
                mapOriginalOffsetToNormalisedOffset(
                    segmentText,
                    localStart
                );

            const normalisedEnd =
                mapOriginalOffsetToNormalisedOffset(
                    segmentText,
                    localEnd
                );

            if (
                normalisedEnd <= normalisedStart
            ) {
                return;
            }

            displayRanges.push({
                start:
                    segmentDisplayStart +
                    normalisedStart,
                end:
                    segmentDisplayStart +
                    normalisedEnd,
            });
        });

        displayOffset +=
            normalisedSegment.text.length;
    });

    const matchLength =
        result.display.matchEnd -
        result.display.matchStart;

    return mergeDisplayRanges(
        displayRanges.map((range) => ({
            start: Math.max(
                0,
                Math.min(matchLength, range.start)
            ),
            end: Math.max(
                0,
                Math.min(matchLength, range.end)
            ),
        }))
    );
}