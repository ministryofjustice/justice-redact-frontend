import type {
    ManualDecision,
    ManualTableCellDecision,
    ManualTextDecision,
} from "./types";
import type { FindInManualRedactionResult } from "./findInManualRedactions";

type SearchableManualDecision =
    | ManualTextDecision
    | ManualTableCellDecision;

type Range = {
    start: number;
    end: number;
};

type DiscloseManualRedactionsResult = {
    manualSelections: ManualDecision[];
    disclosedCount: number;
};

function isSearchableManualDecision(
    decision: ManualDecision
): decision is SearchableManualDecision {
    return (
        decision.kind === "text" ||
        decision.kind === "table_cell"
    );
}

function mergeRanges(ranges: Range[]): Range[] {
    const sorted = ranges
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const merged: Range[] = [];

    sorted.forEach((range) => {
        const previous = merged.at(-1);

        if (!previous || range.start > previous.end) {
            merged.push({ ...range });
            return;
        }

        previous.end = Math.max(previous.end, range.end);
    });

    return merged;
}

function subtractRanges(
    selectionStart: number,
    selectionEnd: number,
    rangesToRemove: Range[]
): Range[] {
    const remaining: Range[] = [];
    let cursor = selectionStart;

    rangesToRemove.forEach((range) => {
        const start = Math.max(selectionStart, range.start);
        const end = Math.min(selectionEnd, range.end);

        if (end <= start) {
            return;
        }

        if (cursor < start) {
            remaining.push({
                start: cursor,
                end: start,
            });
        }

        cursor = Math.max(cursor, end);
    });

    if (cursor < selectionEnd) {
        remaining.push({
            start: cursor,
            end: selectionEnd,
        });
    }

    return remaining;
}

export function discloseManualRedactions(
    manualSelections: ManualDecision[],
    selectedResults: FindInManualRedactionResult[],
    createId: () => string
): DiscloseManualRedactionsResult {
    const selectedResultsByManualId = new Map<
        string,
        FindInManualRedactionResult[]
    >();

    selectedResults.forEach((result) => {
        const existing =
            selectedResultsByManualId.get(result.manualSelectionId) ?? [];

        existing.push(result);
        selectedResultsByManualId.set(
            result.manualSelectionId,
            existing
        );
    });

    let disclosedCount = 0;
    const nextSelections: ManualDecision[] = [];

    manualSelections.forEach((selection) => {
        const selectedForThisRedaction =
            selectedResultsByManualId.get(selection.id);

        if (
            !isSearchableManualDecision(selection) ||
            !selectedForThisRedaction?.length
        ) {
            nextSelections.push(selection);
            return;
        }

        const rangesToRemove = mergeRanges(
            selectedForThisRedaction.map((result) => ({
                start: result.absoluteMatchStart,
                end: result.absoluteMatchEnd,
            }))
        );

        const validRangesToRemove = rangesToRemove.filter(
            (range) =>
                range.start >= selection.start &&
                range.end <= selection.end
        );

        if (validRangesToRemove.length === 0) {
            nextSelections.push(selection);
            return;
        }

        disclosedCount += validRangesToRemove.length;

        const remainingRanges = subtractRanges(
            selection.start,
            selection.end,
            validRangesToRemove
        );

        remainingRanges.forEach((range) => {
            const relativeStart = range.start - selection.start;
            const relativeEnd = range.end - selection.start;

            nextSelections.push({
                ...selection,
                id: createId(),
                start: range.start,
                end: range.end,
                text: selection.text.slice(
                    relativeStart,
                    relativeEnd
                ),
            });
        });
    });

    return {
        manualSelections: nextSelections,
        disclosedCount,
    };
}