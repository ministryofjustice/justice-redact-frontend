import {
    getManualDecisionContentRange,
    getManualDecisionContentRanges,
    getContentLocationKey,
    overlapsContentRange,
    type ContentRange,
} from "../../../app/review/contentRangeUtils";
import { mergeContentRanges } from "../../../app/review/mergeContentRanges";
import { buildRemainingRedactionFragments } from "../../../app/review/buildRemainingRedactionFragments";
import { buildContentRangesFromFindResults } from "../../../app/review/buildContentRangesFromFindResults";
import { buildManualSelectionsFromContentRanges } from "../../../app/review/buildManualSelectionsFromContentRanges";
import {
    buildPartialContentRanges,
    type FindInDocumentResult,
} from "../../../app/review/findInDocument";
import type { ReviewPageData } from "../../../app/review/types";
import type { ManualDecision } from "../../../app/review/types";
import { subtractContentRanges } from "../../../app/review/subtractContentRanges";

type FragmentLocation = {
    selectionIndex: number;
    fragmentIndex: number;
};

type GroupPiece = FragmentLocation[];

function buildRemainingFragments(
    selection: ManualDecision,
    rangesToRemove: ContentRange[],
    createId: () => string,
): ManualDecision[] {
    return buildRemainingRedactionFragments(
        selection,
        rangesToRemove,
        createId,
        "reuse",
    );
}

export function removeManualSelectionsWithinRanges(
    selections: ManualDecision[],
    rangesToRemove: ContentRange[],
    createId: () => string,
): ManualDecision[] {
    const fragmentsBySelection = selections.map(
        (selection) =>
            buildRemainingFragments(
                selection,
                rangesToRemove,
                createId,
            ),
    );

    const updatedFragments = fragmentsBySelection.map(
        (fragments) => [...fragments],
    );

    const groupIndices = new Map<string, number[]>();

    selections.forEach((selection, selectionIndex) => {
        if (
            selection.kind === "image" ||
            !selection.redactionGroupId
        ) {
            return;
        }

        const indices =
            groupIndices.get(selection.redactionGroupId) ?? [];

        indices.push(selectionIndex);

        groupIndices.set(
            selection.redactionGroupId,
            indices,
        );
    });

    for (const [originalGroupId, indices] of groupIndices) {
        const pieces: GroupPiece[] = [];

        let currentPiece: GroupPiece | null = null;
        let gapBeforeNextSelection = false;

        for (const selectionIndex of indices) {
            const selection = selections[selectionIndex];
            const fragments =
                fragmentsBySelection[selectionIndex] ?? [];

            const sourceRange = selection
                ? getManualDecisionContentRange(selection)
                : null;

            if (!sourceRange) {
                continue;
            }

            if (fragments.length === 0) {
                currentPiece = null;
                gapBeforeNextSelection = true;
                continue;
            }

            const firstFragment = fragments[0];

            const firstRange = firstFragment
                ? getManualDecisionContentRange(firstFragment)
                : null;

            if (
                gapBeforeNextSelection ||
                (
                    firstRange !== null &&
                    firstRange.start > sourceRange.start
                )
            ) {
                currentPiece = null;
            }

            fragments.forEach((fragment, fragmentIndex) => {
                if (!currentPiece) {
                    currentPiece = [];
                    pieces.push(currentPiece);
                }

                currentPiece.push({
                    selectionIndex,
                    fragmentIndex,
                });

                if (fragmentIndex < fragments.length - 1) {
                    currentPiece = null;
                }
            });

            const lastFragment =
                fragments[fragments.length - 1];

            const lastRange = lastFragment
                ? getManualDecisionContentRange(lastFragment)
                : null;

            gapBeforeNextSelection =
                lastRange !== null &&
                lastRange.end < sourceRange.end;

            if (gapBeforeNextSelection) {
                currentPiece = null;
            }
        }

        if (pieces.length <= 1) {
            continue;
        }

        const untouchedPieceIndex = pieces.findIndex(
            (piece) =>
                piece.some(
                    ({ selectionIndex, fragmentIndex }) =>
                        fragmentsBySelection[selectionIndex]?.[
                        fragmentIndex
                        ] === selections[selectionIndex],
                ),
        );

        pieces.forEach((piece, pieceIndex) => {
            const nextGroupId =
                pieceIndex === untouchedPieceIndex
                    ? originalGroupId
                    : createId();

            piece.forEach(
                ({ selectionIndex, fragmentIndex }) => {
                    const selectionFragments =
                        updatedFragments[selectionIndex];

                    if (!selectionFragments) {
                        return;
                    }

                    const fragment =
                        selectionFragments[fragmentIndex];

                    if (!fragment || fragment.kind === "image") {
                        return;
                    }

                    if (
                        fragment.redactionGroupId === nextGroupId
                    ) {
                        return;
                    }

                    selectionFragments[fragmentIndex] = {
                        ...fragment,
                        redactionGroupId: nextGroupId,
                    };
                },
            );
        });
    }

    return updatedFragments.flatMap(
        (fragments) => fragments,
    );
}

function mergeReplacementSelections(
    selections: ManualDecision[],
    pages: ReviewPageData[],
    documentId: string,
    createId: () => string,
): ManualDecision[] {
    const ranges = mergeContentRanges(
        getManualDecisionContentRanges(selections),
    );

    if (ranges.length === 0) {
        return [];
    }

    const parents = ranges.map((_, index) => index);

    function findRoot(index: number): number {
        const parent = parents[index];

        if (parent === index) {
            return index;
        }

        const root = findRoot(parent);
        parents[index] = root;
        return root;
    }

    function unite(first: number, second: number): void {
        const firstRoot = findRoot(first);
        const secondRoot = findRoot(second);

        if (firstRoot !== secondRoot) {
            parents[secondRoot] = firstRoot;
        }
    }

    const firstRangeForGroup = new Map<string, number>();

    for (const selection of selections) {
        const sourceRange =
            getManualDecisionContentRange(selection);

        if (!sourceRange) {
            continue;
        }

        const originalGroup =
            selection.kind === "image"
                ? selection.id
                : selection.redactionGroupId ?? selection.id;

        ranges.forEach((range, index) => {
            if (!overlapsContentRange(range, sourceRange)) {
                return;
            }

            const firstIndex =
                firstRangeForGroup.get(originalGroup);

            if (firstIndex === undefined) {
                firstRangeForGroup.set(originalGroup, index);
            } else {
                unite(firstIndex, index);
            }
        });
    }

    const newGroupIds = new Map<number, string>();

    return ranges.flatMap<ManualDecision>(
        (range, index) => {
            const selectionsForRange =
                buildManualSelectionsFromContentRanges(
                    [range],
                    pages,
                    documentId,
                    createId,
                );

            if (selectionsForRange.length === 0) {
                return [];
            }

            const root = findRoot(index);

            const assignedGroupId: string =
                newGroupIds.get(root) ?? createId();

            newGroupIds.set(root, assignedGroupId);

            return selectionsForRange.map((selection) => ({
                ...selection,
                redactionGroupId: assignedGroupId,
            }));
        },
    );
}

function findExistingRedactionBridges(
    previous: ManualDecision[],
    incomingRanges: ContentRange[],
): ContentRange[] {
    const incomingByLocation =
        new Map<string, ContentRange[]>();

    for (const range of mergeContentRanges(incomingRanges)) {
        const key = getContentLocationKey(range);
        const group = incomingByLocation.get(key) ?? [];

        group.push(range);
        incomingByLocation.set(key, group);
    }

    const existingByGroup =
        new Map<string, ContentRange[]>();

    for (const selection of previous) {
        const range =
            getManualDecisionContentRange(selection);

        if (!range) {
            continue;
        }

        const groupId =
            selection.kind === "image"
                ? selection.id
                : selection.redactionGroupId ?? selection.id;

        const group = existingByGroup.get(groupId) ?? [];

        group.push(range);
        existingByGroup.set(groupId, group);
    }

    const existingGroupRanges = Array.from(
        existingByGroup.values(),
    ).flatMap((ranges) => mergeContentRanges(ranges));

    const bridges: ContentRange[] = [];

    for (const [location, ranges] of incomingByLocation) {
        const ordered = [...ranges].sort(
            (a, b) => a.start - b.start,
        );

        for (let index = 0; index < ordered.length - 1; index++) {
            const left = ordered[index];
            const right = ordered[index + 1];

            if (left.end >= right.start) {
                continue;
            }

            const hasExistingBridge =
                existingGroupRanges.some(
                    (existing) =>
                        getContentLocationKey(existing) === location &&
                        existing.start <= left.end &&
                        existing.end >= right.start &&
                        existing.start >= left.start &&
                        existing.end <= right.end,
                );

            if (!hasExistingBridge) {
                continue;
            }

            bridges.push({
                ...left,
                start: left.end,
                end: right.start,
            });
        }
    }

    return bridges;
}

export type FindRedactionReplacementPlan = {
    resultCount: number;
    rangesToReplace: ContentRange[];
    replacementSelections: ManualDecision[];
    pages: ReviewPageData[];
    documentId: string;
};

export function prepareFindRedactionReplacements(
    selectedResults: FindInDocumentResult[],
    pages: ReviewPageData[],
    documentId: string,
    createId: () => string,
): FindRedactionReplacementPlan {
    const plan: FindRedactionReplacementPlan = {
        resultCount: 0,
        rangesToReplace: [],
        replacementSelections: [],
        pages,
        documentId,
    };

    if (!documentId || selectedResults.length === 0) {
        return plan;
    }

    const occupiedRanges: ContentRange[] = [];

    for (const result of selectedResults) {
        const requestedRanges =
            buildContentRangesFromFindResults([result]);

        if (requestedRanges.length === 0) {
            continue;
        }

        const candidates =
            buildManualSelectionsFromContentRanges(
                requestedRanges,
                pages,
                documentId,
                () => "",
            );

        if (candidates.length === 0) {
            continue;
        }

        const validRanges =
            getManualDecisionContentRanges(candidates);

        plan.resultCount += 1;

        plan.rangesToReplace.push(...validRanges);

        let redactionGroupId: string | null = null;

        for (const range of validRanges) {
            const uncoveredRanges = subtractContentRanges(
                range,
                occupiedRanges,
            );

            if (uncoveredRanges.length === 0) {
                continue;
            }

            const newSelections =
                buildManualSelectionsFromContentRanges(
                    uncoveredRanges,
                    pages,
                    documentId,
                    createId,
                );

            if (newSelections.length === 0) {
                continue;
            }

            const assignedGroupId: string =
                redactionGroupId ?? createId();

            redactionGroupId = assignedGroupId;

            plan.replacementSelections.push(
                ...newSelections.map((selection) => ({
                    ...selection,
                    redactionGroupId: assignedGroupId,
                })),
            );

            occupiedRanges.push(
                ...getManualDecisionContentRanges(newSelections),
            );
        }
    }

    plan.replacementSelections =
        mergeReplacementSelections(
            plan.replacementSelections,
            pages,
            documentId,
            createId,
        );

    plan.rangesToReplace =
        getManualDecisionContentRanges(
            plan.replacementSelections,
        );

    return plan;
}


export function applyFindRedactionReplacements(
    previous: ManualDecision[],
    plan: FindRedactionReplacementPlan,
    createId: () => string,
): ManualDecision[] {
    if (plan.replacementSelections.length === 0) {
        return previous;
    }

    const bridges = findExistingRedactionBridges(
        previous,
        plan.rangesToReplace,
    );

    if (bridges.length === 0) {
        const preserved =
            removeManualSelectionsWithinRanges(
                previous,
                plan.rangesToReplace,
                createId,
            );

        return [
            ...preserved,
            ...plan.replacementSelections,
        ];
    }

    const bridgingSelections =
        buildManualSelectionsFromContentRanges(
            bridges,
            plan.pages,
            plan.documentId,
            createId,
        ).map((selection) => ({
            ...selection,
            redactionGroupId: createId(),
        }));

    const mergedReplacements =
        mergeReplacementSelections(
            [
                ...plan.replacementSelections,
                ...bridgingSelections,
            ],
            plan.pages,
            plan.documentId,
            createId,
        );

    const replacementRanges =
        getManualDecisionContentRanges(
            mergedReplacements,
        );

    const preserved =
        removeManualSelectionsWithinRanges(
            previous,
            replacementRanges,
            createId,
        );

    return [
        ...preserved,
        ...mergedReplacements,
    ];
}


export type PartialFindRedactionResult = {
    nextSelections: ManualDecision[];
    addedResultCount: number;
};


/**
 * Two source ranges overlap only when they share at least
 * one character in the same source item or table cell.
 *
 * Adjacent ranges are deliberately not considered overlapping.
 */
function partialRangesStrictlyOverlap(
    first: ContentRange,
    second: ContentRange,
): boolean {
    return (
        getContentLocationKey(first) ===
        getContentLocationKey(second) &&
        first.start < second.end &&
        second.start < first.end
    );
}

/**
 * Combines strictly overlapping source ranges.
 * Unlike an adjacency-merging operation, [0, 4) and
 * [4, 7) remain separate.
 */
function mergeStrictPartialRanges(
    ranges: ContentRange[],
): ContentRange[] {
    const ordered = [...ranges].sort((first, second) => {
        const locationComparison =
            getContentLocationKey(first).localeCompare(
                getContentLocationKey(second),
            );

        if (locationComparison !== 0) {
            return locationComparison;
        }

        return (
            first.start - second.start ||
            first.end - second.end
        );
    });

    const merged: ContentRange[] = [];

    for (const range of ordered) {
        const previous = merged[merged.length - 1];

        if (
            previous &&
            partialRangesStrictlyOverlap(previous, range)
        ) {
            merged[merged.length - 1] = {
                ...previous,
                end: Math.max(previous.end, range.end),
            };
        } else {
            merged.push(range);
        }
    }

    return merged;
}

export function addPartialFindRedactions(
    previous: ManualDecision[],
    selectedResults: FindInDocumentResult[],
    selectedRange: {
        start: number;
        end: number;
    },
    pages: ReviewPageData[],
    documentId: string,
    createId: () => string,
): PartialFindRedactionResult {
    if (
        !documentId ||
        selectedResults.length === 0 ||
        selectedRange.end <= selectedRange.start
    ) {
        return {
            nextSelections: previous,
            addedResultCount: 0,
        };
    }

    let nextSelections = previous;
    let addedResultCount = 0;

    for (const result of selectedResults) {
        const partialRanges = buildPartialContentRanges(
            pages,
            result,
            selectedRange,
        );

        const validCandidates =
            buildManualSelectionsFromContentRanges(
                partialRanges,
                pages,
                documentId,
                () => "",
            );

        const requestedRanges =
            getManualDecisionContentRanges(
                validCandidates,
            );

        if (requestedRanges.length === 0) {
            continue;
        }

        const occupiedRanges =
            getManualDecisionContentRanges(
                nextSelections,
            );

        const contributesNewCoverage =
            requestedRanges.some(
                (range) =>
                    subtractContentRanges(
                        range,
                        occupiedRanges,
                    ).length > 0,
            );

        let mergedRanges =
            mergeStrictPartialRanges(requestedRanges);

        const absorbedIndices = new Set<number>();

        let foundAdditionalOverlap = true;

        while (foundAdditionalOverlap) {
            foundAdditionalOverlap = false;

            for (
                let index = 0;
                index < nextSelections.length;
                index++
            ) {
                if (absorbedIndices.has(index)) {
                    continue;
                }

                const existingRange =
                    getManualDecisionContentRange(
                        nextSelections[index],
                    );

                if (!existingRange) {
                    continue;
                }

                const overlaps = mergedRanges.some(
                    (range) =>
                        partialRangesStrictlyOverlap(
                            range,
                            existingRange,
                        ),
                );

                if (!overlaps) {
                    continue;
                }

                absorbedIndices.add(index);

                mergedRanges = mergeStrictPartialRanges([
                    ...mergedRanges,
                    existingRange,
                ]);

                foundAdditionalOverlap = true;
            }
        }

        if (
            !contributesNewCoverage &&
            absorbedIndices.size <= 1
        ) {
            continue;
        }

        const replacements =
            buildManualSelectionsFromContentRanges(
                mergedRanges,
                pages,
                documentId,
                createId,
            );

        if (replacements.length === 0) {
            continue;
        }

        const redactionGroupId = createId();

        const groupedReplacements =
            replacements.map((selection) => ({
                ...selection,
                redactionGroupId,
            }));

        const preserved =
            removeManualSelectionsWithinRanges(
                nextSelections,
                mergedRanges,
                createId,
            );

        nextSelections = [
            ...preserved,
            ...groupedReplacements,
        ];

        addedResultCount += 1;
    }

    return {
        nextSelections,
        addedResultCount,
    };
}


