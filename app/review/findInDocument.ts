import type { ReviewPageData } from "./types";

export type FindInDocumentResult = {
    id: string;
    kind: "text" | "table_cell";
    pageNumber: number;
    itemId: string | null;
    tableId: string | null;
    cellId: string | null;
    sourceText: string;
    matchStart: number;
    matchEnd: number;
};

export type FindInDocumentExcerpt = {
    before: string;
    match: string;
    after: string;
    hasLeadingEllipsis: boolean;
    hasTrailingEllipsis: boolean;
};

const DEFAULT_CONTEXT_LENGTH = 75;

function findOccurrences(sourceText: string, searchTerm: string) {
    const occurrences: Array<{ start: number; end: number }> = [];

    const normalisedSource = sourceText.toLocaleLowerCase();
    const normalisedSearchTerm = searchTerm.toLocaleLowerCase();

    let searchFrom = 0;

    while (searchFrom < normalisedSource.length) {
        const start = normalisedSource.indexOf(
            normalisedSearchTerm,
            searchFrom
        );

        if (start === -1) break;

        const end = start + normalisedSearchTerm.length;

        occurrences.push({ start, end });

        // Matches do not overlap. This also guarantees the loop progresses.
        searchFrom = end;
    }

    return occurrences;
}

export function findInDocument(
    pages: ReviewPageData[],
    searchTerm: string
): FindInDocumentResult[] {
    const trimmedSearchTerm = searchTerm.trim();

    if (!trimmedSearchTerm) return [];

    const results: FindInDocumentResult[] = [];

    pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .forEach((page) => {
            page.textItems.forEach((item) => {
                findOccurrences(item.text, trimmedSearchTerm).forEach(
                    ({ start, end }, occurrenceIndex) => {
                        results.push({
                            id: [
                                "text",
                                page.pageNumber,
                                item.itemId,
                                start,
                                end,
                                occurrenceIndex,
                            ].join("-"),
                            kind: "text",
                            pageNumber: page.pageNumber,
                            itemId: item.itemId,
                            tableId: null,
                            cellId: null,
                            sourceText: item.text,
                            matchStart: start,
                            matchEnd: end,
                        });
                    }
                );
            });

            page.tables.forEach((table) => {
                table.rows.forEach((row) => {
                    row.cells.forEach((cell) => {
                        findOccurrences(
                            cell.text,
                            trimmedSearchTerm
                        ).forEach(
                            ({ start, end }, occurrenceIndex) => {
                                results.push({
                                    id: [
                                        "table-cell",
                                        page.pageNumber,
                                        table.tableId,
                                        cell.cellId,
                                        start,
                                        end,
                                        occurrenceIndex,
                                    ].join("-"),
                                    kind: "table_cell",
                                    pageNumber: page.pageNumber,
                                    itemId: null,
                                    tableId: table.tableId,
                                    cellId: cell.cellId,
                                    sourceText: cell.text,
                                    matchStart: start,
                                    matchEnd: end,
                                });
                            }
                        );
                    });
                });
            });
        });

    return results;
}

function normalizeExcerptWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

export function buildFindInDocumentExcerpt(
    result: FindInDocumentResult,
    contextLength = DEFAULT_CONTEXT_LENGTH
): FindInDocumentExcerpt {
    const { sourceText, matchStart, matchEnd } = result;

    const excerptStart = Math.max(0, matchStart - contextLength);
    const excerptEnd = Math.min(
        sourceText.length,
        matchEnd + contextLength
    );

    const before = normalizeExcerptWhitespace(
        sourceText.slice(excerptStart, matchStart)
    );

    const match = normalizeExcerptWhitespace(
        sourceText.slice(matchStart, matchEnd)
    );

    const after = normalizeExcerptWhitespace(
        sourceText.slice(matchEnd, excerptEnd)
    );

    return {
        before,
        match,
        after,
        hasLeadingEllipsis: excerptStart > 0,
        hasTrailingEllipsis: excerptEnd < sourceText.length,
    };
}