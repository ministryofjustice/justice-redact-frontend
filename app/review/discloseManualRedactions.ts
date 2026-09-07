import {
    getFindResultContentRanges,
    getManualDecisionContentRange,
    getManualDecisionContentRanges,
    overlapsContentRange,
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
        getManualDecisionContentRanges(
            manualSelections
        )
    );

    /*
     * A selected result is still valid if any part of the
     * searched occurrence is currently redacted.
     *
     * This supports both fully and partially redacted results
     * and also protects against stale modal results.
     */
    const validResults = selectedResults.filter(
        (result) => {
            const resultRanges =
                getFindResultContentRanges(result);

            return resultRanges.some((resultRange) =>
                existingRanges.some(
                    (existingRange) =>
                        overlapsContentRange(
                            existingRange,
                            resultRange
                        )
                )
            );
        }
    );

    if (validResults.length === 0) {
        return {
            remainingSelections: manualSelections,
            disclosedCount: 0,
        };
    }

    /*
     * Remove redaction coverage from the complete searched
     * occurrence. subtractContentRanges only affects existing
     * decisions which actually overlap these ranges, so
     * unrelated redactions remain untouched.
     */
    const rangesToRemove =
        buildContentRangesFromFindResults(
            validResults
        );

    const remainingSelections =
        manualSelections.flatMap<ManualDecision>(
            (selection) => {
                /*
                 * Find and disclose only operates on text/table
                 * content. Images remain completely untouched.
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
                        rangesToRemove
                    );

                /*
                 * This decision was not affected at all.
                 * Preserve the exact existing decision, including
                 * its id and redactionGroupId.
                 */
                if (
                    remainingRanges.length === 1 &&
                    remainingRanges[0].start ===
                    sourceRange.start &&
                    remainingRanges[0].end ===
                    sourceRange.end
                ) {
                    return [selection];
                }

                /*
                 * The searched occurrence removed part of this
                 * decision. Any remaining fragments retain the
                 * original redactionGroupId.
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

    /*
     * Count searched occurrences disclosed, rather than the
     * number of underlying text/table segments.
     */
    return {
        remainingSelections,
        disclosedCount: validResults.length,
    };
}