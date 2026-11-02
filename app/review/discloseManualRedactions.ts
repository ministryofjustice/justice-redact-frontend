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

                transformedSelections.set(
                    selection.id,
                    []
                );

                if (fragments.length === 0) {
                    currentPiece = null;
                    gapBeforeNextSelection = true;
                    return;
                }

                const firstFragmentRange =
                    getManualDecisionContentRange(
                        fragments[0]
                    );

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

    const seenResultIds = new Set<string>();

    const validResults = selectedResults.filter(
        (result) => {
            if (seenResultIds.has(result.id)) {
                return false;
            }

            seenResultIds.add(result.id);

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

    const rangesToRemove =
        buildContentRangesFromFindResults(
            validResults
        );

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

                if (selection.redactionGroupId) {
                    return (
                        groupedTransform.get(
                            selection.id
                        ) ?? []
                    );
                }

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