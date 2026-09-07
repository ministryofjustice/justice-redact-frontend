import {
    isSameContentLocation,
    overlapsContentRange,
    type ContentRange,
} from "./contentRangeUtils";
import { mergeContentRanges } from "./mergeContentRanges";

export function subtractContentRanges(
    sourceRange: ContentRange,
    rangesToRemove: ContentRange[]
): ContentRange[] {
    const relevantRanges = mergeContentRanges(
        rangesToRemove
            .filter(
                (range) =>
                    isSameContentLocation(sourceRange, range) &&
                    overlapsContentRange(sourceRange, range)
            )
            .map((range) => ({
                ...range,
                start: Math.max(sourceRange.start, range.start),
                end: Math.min(sourceRange.end, range.end),
            }))
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