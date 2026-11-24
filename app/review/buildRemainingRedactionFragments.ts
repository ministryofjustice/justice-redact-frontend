import {
    getManualDecisionContentRange,
    type ContentRange,
} from "./contentRangeUtils";
import { subtractContentRanges } from "./subtractContentRanges";
import type { ManualDecision } from "./types";

export type UnchangedFragmentStrategy = "reuse" | "copy";

export function buildRemainingRedactionFragments(
    selection: ManualDecision,
    rangesToRemove: ContentRange[],
    createId: () => string,
    unchangedStrategy: UnchangedFragmentStrategy,
): ManualDecision[] {
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

    if (
        remainingRanges.length === 1 &&
        remainingRanges[0].start === sourceRange.start &&
        remainingRanges[0].end === sourceRange.end
    ) {
        return unchangedStrategy === "reuse"
            ? [selection]
            : [{ ...selection }];
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

            if (text.length === 0) {
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
}
