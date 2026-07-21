import {
    containsContentRange,
    getContentRangeKey,
    getManualDecisionContentRanges,
    isSameContentLocation,
    type ContentRange,
} from "./contentRangeUtils";
import { buildContentRangesFromFindResults } from "./buildContentRangesFromFindResults";
import type { FindInManualRedactionResult } from "./findInManualRedactions";
import { mergeContentRanges } from "./mergeContentRanges";
import type { ManualDecision } from "./types";

type DiscloseManualRedactionsResult = {
    remainingRanges: ContentRange[];
    disclosedCount: number;
};

function subtractRangesFromRange(
    sourceRange: ContentRange,
    rangesToRemove: ContentRange[]
): ContentRange[] {
    const relevantRanges = mergeContentRanges(
        rangesToRemove.filter(
            (range) =>
                isSameContentLocation(sourceRange, range) &&
                containsContentRange(sourceRange, range)
        )
    ).sort(
        (left, right) =>
            left.start - right.start ||
            left.end - right.end
    );

    if (relevantRanges.length === 0) {
        return [sourceRange];
    }

    const remainingRanges: ContentRange[] = [];
    let cursor = sourceRange.start;

    relevantRanges.forEach((range) => {
        if (cursor < range.start) {
            remainingRanges.push({
                ...sourceRange,
                start: cursor,
                end: range.start,
            });
        }

        cursor = Math.max(cursor, range.end);
    });

    if (cursor < sourceRange.end) {
        remainingRanges.push({
            ...sourceRange,
            start: cursor,
            end: sourceRange.end,
        });
    }

    return remainingRanges;
}

export function discloseManualRedactions(
    manualSelections: ManualDecision[],
    selectedResults: FindInManualRedactionResult[]
): DiscloseManualRedactionsResult {
    const existingRanges = mergeContentRanges(
        getManualDecisionContentRanges(manualSelections)
    );

    const selectedRanges =
        buildContentRangesFromFindResults(selectedResults);

    /*
     * Deduplicate selected results by their exact document position.
     * This prevents duplicate UI results or stale state from inflating
     * the disclosed count.
     */
    const uniqueSelectedRanges = Array.from(
        new Map(
            selectedRanges.map((range) => [
                getContentRangeKey(range),
                range,
            ])
        ).values()
    );

    /*
     * Only remove a selected range when it is still fully covered by a
     * current manual redaction. Results that became stale while the modal
     * was open are ignored safely.
     */
    const validRangesToRemove = uniqueSelectedRanges.filter(
        (selectedRange) =>
            existingRanges.some((existingRange) =>
                containsContentRange(
                    existingRange,
                    selectedRange
                )
            )
    );

    if (validRangesToRemove.length === 0) {
        return {
            remainingRanges: existingRanges,
            disclosedCount: 0,
        };
    }

    const remainingRanges = existingRanges.flatMap(
        (existingRange) =>
            subtractRangesFromRange(
                existingRange,
                validRangesToRemove
            )
    );

    return {
        remainingRanges: mergeContentRanges(remainingRanges),
        disclosedCount: validRangesToRemove.length,
    };
}