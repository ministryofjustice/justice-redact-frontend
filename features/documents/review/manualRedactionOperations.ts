import { buildManualSelectionsFromContentRanges } from "../../../app/review/buildManualSelectionsFromContentRanges";
import {
  getManualDecisionContentRanges,
  type ContentRange,
} from "../../../app/review/contentRangeUtils";
import { subtractContentRanges } from "../../../app/review/subtractContentRanges";
import { clampRangeValue } from "../../../app/review/textRendering";

import type {
  ManualDecision,
  ManualSpan,
  ReviewPageData,
} from "../../../app/review/types";

export function addManualTextSelections(
  previous: ManualDecision[],
  page: ReviewPageData,
  spansToAdd: ManualSpan[],
  documentId: string,
  redactionGroupId: string,
  createId: () => string,
): ManualDecision[] {
  if (!documentId || spansToAdd.length === 0) {
    return previous;
  }

  let nextSelections: ManualDecision[] = previous;

  const occupiedRanges =
    getManualDecisionContentRanges(previous);

  for (const span of spansToAdd) {
    if (span.pageNumber !== page.pageNumber) {
      continue;
    }

    const item = page.textItems.find(
      (candidate) => candidate.itemId === span.itemId,
    );

    if (!item) {
      continue;
    }

    const sourceText = item.text;

    const start = clampRangeValue(
      span.start,
      sourceText.length,
    );

    const end = clampRangeValue(
      span.end,
      sourceText.length,
    );

    if (end <= start) {
      continue;
    }

    if (!sourceText.slice(start, end).trim()) {
      continue;
    }

    const requestedRange: ContentRange = {
      kind: "text",
      pageNumber: span.pageNumber,
      itemId: span.itemId,
      tableId: null,
      cellId: null,
      start,
      end,
    };

    const uncoveredRanges = subtractContentRanges(
      requestedRange,
      occupiedRanges,
    );

    if (uncoveredRanges.length === 0) {
      continue;
    }

    const newSelections =
      buildManualSelectionsFromContentRanges(
        uncoveredRanges,
        [page],
        documentId,
        createId,
      ).map((selection) => ({
        ...selection,
        redactionGroupId,
      }));

    if (newSelections.length === 0) {
      continue;
    }

    nextSelections = [
      ...nextSelections,
      ...newSelections,
    ];

    occupiedRanges.push(
      ...getManualDecisionContentRanges(newSelections),
    );
  }

  return nextSelections;
}

type RequestedTableRange = {
  cell: ReviewPageData["tables"][number]["rows"][number]["cells"][number];
  start: number;
  end: number;
};

export function addManualTableSelections(
  previous: ManualDecision[],
  pageNumber: number,
  tableId: string,
  cellRanges: RequestedTableRange[],
  pages: ReviewPageData[],
  documentId: string,
  redactionGroupId: string,
  createId: () => string,
): ManualDecision[] {
  if (!documentId || cellRanges.length === 0) {
    return previous;
  }

  const page = pages.find(
    (candidate) => candidate.pageNumber === pageNumber,
  );

  const table = page?.tables.find(
    (candidate) => candidate.tableId === tableId,
  );

  if (!page || !table) {
    return previous;
  }

  const occupiedRanges =
    getManualDecisionContentRanges(previous);

  let nextSelections: ManualDecision[] = previous;

  for (const { cell, start, end } of cellRanges) {
    if (cell.tableId !== tableId) {
      continue;
    }

    const sourceCell = table.rows
      .flatMap((row) => row.cells)
      .find(
        (candidate) =>
          candidate.cellId === cell.cellId &&
          candidate.tableId === tableId,
      );

    if (!sourceCell) {
      continue;
    }

    const sourceText = sourceCell.text;

    const normalisedStart = clampRangeValue(
      start,
      sourceText.length,
    );

    const normalisedEnd = clampRangeValue(
      end,
      sourceText.length,
    );

    if (normalisedEnd <= normalisedStart) {
      continue;
    }

    if (
      !sourceText
        .slice(normalisedStart, normalisedEnd)
        .trim()
    ) {
      continue;
    }

    const requestedRange: ContentRange = {
      kind: "table_cell",
      pageNumber,
      itemId: null,
      tableId,
      cellId: sourceCell.cellId,
      start: normalisedStart,
      end: normalisedEnd,
    };

    const uncoveredRanges = subtractContentRanges(
      requestedRange,
      occupiedRanges,
    );

    if (uncoveredRanges.length === 0) {
      continue;
    }

    const newSelections =
      buildManualSelectionsFromContentRanges(
        uncoveredRanges,
        [page],
        documentId,
        createId,
      ).map((selection) => ({
        ...selection,
        redactionGroupId,
      }));

    if (newSelections.length === 0) {
      continue;
    }

    nextSelections = [
      ...nextSelections,
      ...newSelections,
    ];

    occupiedRanges.push(
      ...getManualDecisionContentRanges(newSelections),
    );
  }

  return nextSelections;
}
