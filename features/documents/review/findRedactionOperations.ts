
import {
    getManualDecisionContentRange,
    type ContentRange,
} from "../../../app/review/contentRangeUtils";

import { subtractContentRanges } from "../../../app/review/subtractContentRanges";

import type { ManualDecision } from "../../../app/review/types";

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
