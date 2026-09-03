import {
    containsContentRange,
    getContentRangeKey,
    getManualDecisionContentRange,
    getManualDecisionContentRanges,
} from "./contentRangeUtils";
import { buildContentRangesFromFindResults } from "./buildContentRangesFromFindResults";
import type { FindInManualRedactionResult } from "./findInManualRedactions";
import { mergeContentRanges } from "./mergeContentRanges";
import { subtractContentRanges } from "./subtractContentRanges";
import type { ManualDecision } from "./types";

type DiscloseManualRedactionsResult = {
    remainingSelections: ManualDecision[];
    disclosedCount: number;
};

export function discloseManualRedactions(
    manualSelections: ManualDecision[],
    selectedResults: FindInManualRedactionResult[],
    createId: () => string
): DiscloseManualRedactionsResult {
    const existingRanges = mergeContentRanges(
        getManualDecisionContentRanges(manualSelections)
    );

    const selectedRanges =
        buildContentRangesFromFindResults(selectedResults);

    /*
     * Deduplicate selected results by their exact document position.
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
     * Ignore stale results which are no longer completely redacted.
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
            remainingSelections: manualSelections,
            disclosedCount: 0,
        };
    }

    const remainingSelections =
        manualSelections.flatMap<ManualDecision>(
            (selection) => {
                /*
                 * Find and disclose only operates on text/table content.
                 * Images remain completely untouched.
                 */
                if (selection.kind === "image") {
                    return [selection];
                }

                const sourceRange =
                    getManualDecisionContentRange(selection);

                if (!sourceRange) {
                    return [selection];
                }

                const remainingRanges =
                    subtractContentRanges(
                        sourceRange,
                        validRangesToRemove
                    );

                /*
                 * This decision was not affected at all.
                 * Preserve the exact existing decision, including its
                 * id and redactionGroupId.
                 */
                if (
                    remainingRanges.length === 1 &&
                    remainingRanges[0].start === sourceRange.start &&
                    remainingRanges[0].end === sourceRange.end
                ) {
                    return [selection];
                }

                /*
                 * The searched phrase removed part of this decision.
                 * Any remaining fragments retain the original
                 * redactionGroupId.
                 */
                return remainingRanges.flatMap<ManualDecision>(
                    (range) => {
                        const localStart =
                            range.start - sourceRange.start;

                        const localEnd =
                            range.end - sourceRange.start;

                        const text = selection.text.slice(
                            localStart,
                            localEnd
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
                    }
                );
            }
        );

    return {
        remainingSelections,
        disclosedCount: validRangesToRemove.length,
    };
}