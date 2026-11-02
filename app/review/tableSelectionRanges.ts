import { clampRangeValue } from "./textRendering";

import type { ReviewTableCell } from "./types";

export type SelectedTableCellRange = {
    cell: ReviewTableCell;
    start: number;
    end: number;
};

export function buildSelectedTableCellRanges(
    cells: ReviewTableCell[],
    startCellId: string,
    endCellId: string,
    getStartOffset: () => number,
    getEndOffset: () => number,
): SelectedTableCellRange[] | null {
    const orderedCells = [...cells].sort(
        (left, right) =>
            left.rowIndex - right.rowIndex ||
            left.colIndex - right.colIndex,
    );

    const startCellIndex = orderedCells.findIndex(
        (cell) => cell.cellId === startCellId,
    );

    const endCellIndex = orderedCells.findIndex(
        (cell) => cell.cellId === endCellId,
    );

    if (startCellIndex < 0 || endCellIndex < 0) {
        return null;
    }

    const firstCellIndex = Math.min(
        startCellIndex,
        endCellIndex,
    );

    const lastCellIndex = Math.max(
        startCellIndex,
        endCellIndex,
    );

    const selectedCells = orderedCells.slice(
        firstCellIndex,
        lastCellIndex + 1,
    );

    return selectedCells.flatMap<SelectedTableCellRange>(
        (cell, index) => {
            const sourceText = cell.text;

            if (!sourceText.trim()) {
                return [];
            }

            const isFirstCell = index === 0;
            const isLastCell =
                index === selectedCells.length - 1;

            const start = isFirstCell
                ? getStartOffset()
                : 0;

            const end = isLastCell
                ? getEndOffset()
                : sourceText.length;

            const normalisedStart = clampRangeValue(
                Math.min(start, end),
                sourceText.length,
            );

            const normalisedEnd = clampRangeValue(
                Math.max(start, end),
                sourceText.length,
            );

            if (normalisedEnd <= normalisedStart) {
                return [];
            }

            return [
                {
                    cell,
                    start: normalisedStart,
                    end: normalisedEnd,
                },
            ];
        },
    );
}
