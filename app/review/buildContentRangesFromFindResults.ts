import type { ContentRange } from "./contentRangeUtils";
import type { FindInDocumentResult } from "./findInDocument";

export function buildContentRangesFromFindResults(
    results: FindInDocumentResult[]
): ContentRange[] {
    return results.flatMap<ContentRange>((result) => {
        if (
            result.matchEnd <= result.matchStart
        ) {
            return [];
        }

        if (
            result.kind === "text" &&
            result.itemId
        ) {
            return [
                {
                    kind: "text",
                    pageNumber: result.pageNumber,
                    itemId: result.itemId,
                    tableId: null,
                    cellId: null,
                    start: result.matchStart,
                    end: result.matchEnd,
                },
            ];
        }

        if (
            result.kind === "table_cell" &&
            result.tableId &&
            result.cellId
        ) {
            return [
                {
                    kind: "table_cell",
                    pageNumber: result.pageNumber,
                    itemId: null,
                    tableId: result.tableId,
                    cellId: result.cellId,
                    start: result.matchStart,
                    end: result.matchEnd,
                },
            ];
        }

        return [];
    });
}