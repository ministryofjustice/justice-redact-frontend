import {
    getFindResultContentRanges,
    getManualDecisionContentRange,
    getManualDecisionContentRanges,
    overlapsContentRange,
    type ContentRange,
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

type FragmentRecord = {
    sourceId: string;
    decision: ManualDecision;
};

function buildRemainingFragments(
    selection: ManualDecision,
    rangesToRemove: ContentRange[],
    createId: () => string
): ManualDecision[] {
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
     * Nothing from this decision was disclosed.
     * Preserve its existing id and metadata.
     */
    if (
        remainingRanges.length === 1 &&
        remainingRanges[0].start === sourceRange.start &&
        remainingRanges[0].end === sourceRange.end
    ) {
        return [
            {
                ...selection,
            },
        ];
    }

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

function splitRedactionGroups(
    manualSelections: ManualDecision[],
    rangesToRemove: ContentRange[],
    createId: () => string
): Map<string, ManualDecision[]> {
    const groupedSelections =
        new Map<string, ManualDecision[]>();

    manualSelections.forEach((selection) => {
        if (
            selection.kind === "image" ||
            !selection.redactionGroupId
        ) {
            return;
        }

        const group =
            groupedSelections.get(
                selection.redactionGroupId
            ) ?? [];

        group.push(selection);

        groupedSelections.set(
            selection.redactionGroupId,
            group
        );
    });

    const transformedSelections =
        new Map<string, ManualDecision[]>();

    groupedSelections.forEach(
        (selections, originalGroupId) => {
            const pieces: FragmentRecord[][] = [];

            let currentPiece: FragmentRecord[] | null =
                null;

            let gapBeforeNextSelection = false;

            selections.forEach((selection) => {
                const sourceRange =
                    getManualDecisionContentRange(selection);

                if (!sourceRange) {
                    return;
                }

                const fragments =
                    buildRemainingFragments(
                        selection,
                        rangesToRemove,
                        createId
                    );

                /*
                 * Initialise this source decision in the lookup.
                 * If it has been completely disclosed it will
                 * correctly remain an empty array.
                 */
                transformedSelections.set(
                    selection.id,
                    []
                );

                if (fragments.length === 0) {
                    /*
                     * This entire part of the original logical
                     * redaction has disappeared. Anything surviving
                     * afterwards must belong to a new logical group.
                     */
                    currentPiece = null;
                    gapBeforeNextSelection = true;
                    return;
                }

                const firstFragmentRange =
                    getManualDecisionContentRange(
                        fragments[0]
                    );

                /*
                 * If content was removed from the beginning of this
                 * decision, a previous surviving decision and this
                 * fragment are now separated by disclosed content.
                 */
                if (
                    gapBeforeNextSelection ||
                    (
                        firstFragmentRange !== null &&
                        firstFragmentRange.start >
                        sourceRange.start
                    )
                ) {
                    currentPiece = null;
                }

                fragments.forEach(
                    (fragment, fragmentIndex) => {
                        if (!currentPiece) {
                            currentPiece = [];
                            pieces.push(currentPiece);
                        }

                        currentPiece.push({
                            sourceId: selection.id,
                            decision: fragment,
                        });

                        /*
                         * subtractContentRanges can split one decision
                         * into two fragments. Those fragments are on
                         * opposite sides of disclosed content and must
                         * therefore become different logical redactions.
                         */
                        if (
                            fragmentIndex <
                            fragments.length - 1
                        ) {
                            currentPiece = null;
                        }
                    }
                );

                const lastFragment =
                    fragments[
                    fragments.length - 1
                    ];

                const lastFragmentRange =
                    getManualDecisionContentRange(
                        lastFragment
                    );

                gapBeforeNextSelection =
                    lastFragmentRange !== null &&
                    lastFragmentRange.end <
                    sourceRange.end;

                if (gapBeforeNextSelection) {
                    currentPiece = null;
                }
            });

            /*
             * If the original group still consists of one connected
             * piece, retain its original group id.
             *
             * If disclosure split it into multiple pieces, give each
             * resulting piece its own new group id.
             */
            pieces.forEach((piece) => {
                const redactionGroupId =
                    pieces.length > 1
                        ? createId()
                        : originalGroupId;

                piece.forEach(
                    ({ sourceId, decision }) => {
                        if (decision.kind === "image") {
                            return;
                        }

                        const groupedDecision = {
                            ...decision,
                            redactionGroupId,
                        };

                        const existing =
                            transformedSelections.get(
                                sourceId
                            ) ?? [];

                        existing.push(groupedDecision);

                        transformedSelections.set(
                            sourceId,
                            existing
                        );
                    }
                );
            });
        }
    );

    return transformedSelections;
}

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
     * A result remains valid as long as some part of the
     * searched occurrence is currently redacted.
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
     * Find and disclose removes redaction coverage only from
     * the searched occurrences selected by the user.
     */
    const rangesToRemove =
        buildContentRangesFromFindResults(
            validResults
        );

    /*
     * Transform grouped redactions as complete logical
     * selections so that a disclosure in the middle creates
     * two genuinely independent redaction groups.
     */
    const groupedTransform =
        splitRedactionGroups(
            manualSelections,
            rangesToRemove,
            createId
        );

    const remainingSelections =
        manualSelections.flatMap<ManualDecision>(
            (selection) => {
                if (selection.kind === "image") {
                    return [selection];
                }

                /*
                 * Grouped selections were handled together above so
                 * their new grouping can account for splits across
                 * multiple text items.
                 */
                if (selection.redactionGroupId) {
                    return (
                        groupedTransform.get(
                            selection.id
                        ) ?? []
                    );
                }

                /*
                 * Legacy/ungrouped decisions use their individual ids
                 * for removal. If one is split into two, the resulting
                 * fragments already receive separate ids and therefore
                 * behave as independent redactions.
                 */
                return buildRemainingFragments(
                    selection,
                    rangesToRemove,
                    createId
                );
            }
        );

    return {
        remainingSelections,
        disclosedCount: validResults.length,
    };
}