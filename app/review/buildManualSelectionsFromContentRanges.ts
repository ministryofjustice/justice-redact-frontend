import type { ContentRange } from "./contentRanges";
import type {
    ManualTableCellDecision,
    ManualTextDecision,
    ReviewPageData,
} from "./types";

type SearchableManualDecision =
    | ManualTextDecision
    | ManualTableCellDecision;

function getSourceText(
    pages: ReviewPageData[],
    range: ContentRange
): string | null {
    const page = pages.find(
        (candidate) =>
            candidate.pageNumber === range.pageNumber
    );

    if (!page) {
        return null;
    }

    if (range.kind === "text") {
        const item = page.textItems.find(
            (candidate) =>
                candidate.itemId === range.itemId
        );

        return item?.text ?? null;
    }

    const table = page.tables.find(
        (candidate) =>
            candidate.tableId === range.tableId
    );

    const cell = table?.rows
        .flatMap((row) => row.cells)
        .find(
            (candidate) =>
                candidate.cellId === range.cellId
        );

    return cell?.text ?? null;
}

export function buildManualSelectionsFromContentRanges(
    ranges: ContentRange[],
    pages: ReviewPageData[],
    documentId: string,
    createId: () => string
): SearchableManualDecision[] {
    return ranges.flatMap<SearchableManualDecision>((range) => {
        const sourceText = getSourceText(pages, range);

        if (!sourceText) {
            return [];
        }

        const start = Math.max(
            0,
            Math.min(range.start, sourceText.length)
        );

        const end = Math.max(
            start,
            Math.min(range.end, sourceText.length)
        );

        if (end <= start) {
            return [];
        }

        const text = sourceText.slice(start, end);

        if (!text.trim()) {
            return [];
        }

        if (range.kind === "text") {
            return [
                {
                    id: createId(),
                    documentId,
                    kind: "text",
                    pageNumber: range.pageNumber,
                    itemId: range.itemId,
                    start,
                    end,
                    text,
                },
            ];
        }

        return [
            {
                id: createId(),
                documentId,
                kind: "table_cell",
                pageNumber: range.pageNumber,
                tableId: range.tableId,
                cellId: range.cellId,
                start,
                end,
                text,
            },
        ];
    });
}