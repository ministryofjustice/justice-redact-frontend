import {
    getManualDecisionContentRange,
    type ContentRange,
} from "../../../app/review/contentRangeUtils";

import { subtractContentRanges } from "../../../app/review/subtractContentRanges";

import type { ManualDecision } from "../../../app/review/types";

export function removeManualSelectionsWithinRanges(
    selections: ManualDecision[],
    rangesToRemove: ContentRange[],
    createId: () => string,
): ManualDecision[] {
    return selections.flatMap<ManualDecision>((selection) => {
        if (selection.kind === "image") {
            return [selection];
        }

        const sourceRange =
            getManualDecisionContentRange(selection);

        if (!sourceRange) {
            return [selection];
        }

        const remainingRanges = subtractContentRanges(
            sourceRange,
            rangesToRemove,
        );

        // Preserve untouched decisions, including their IDs.
        if (
            remainingRanges.length === 1 &&
            remainingRanges[0].start === sourceRange.start &&
            remainingRanges[0].end === sourceRange.end
        ) {
            return [selection];
        }

        return remainingRanges.flatMap<ManualDecision>(
            (range) => {
                const localStart =
                    range.start - sourceRange.start;

                const localEnd =
                    range.end - sourceRange.start;

                const text = selection.text.slice(
                    localStart,
                    localEnd,
                );

                if (!text.trim()) {
                    return [];
                }

                return [
                    {
                        ...selection,
                        id: createId(),
                        start: range.start,
                        end: range.end,
                        text,
                    },
                ];
            },
        );
    });
}