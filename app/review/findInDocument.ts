import type { ReviewPageData } from "./types";
import type { ContentRange } from "./contentRangeUtils";

export type FindInDocumentMatchSegment = ContentRange;

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
    segments: FindInDocumentMatchSegment[];
};

export type FindInDocumentExcerpt = {
    before: string;
    match: string;
    after: string;
    hasLeadingEllipsis: boolean;
    hasTrailingEllipsis: boolean;
};

type SearchableTextChunk = {
    pageNumber: number;
    itemId: string;
    sourceText: string;
    normalisedOffsets: number[];
    combinedStart: number;
    combinedEnd: number;
};

type SearchableDocument = {
    text: string;
    chunks: SearchableTextChunk[];
};

type NormalisedSearchText = {
    text: string;
    originalOffsets: number[];
};

const DEFAULT_CONTEXT_LENGTH = 75;

function normaliseWhitespaceForSearch(
    sourceText: string
): NormalisedSearchText {
    const textParts: string[] = [];
    const originalOffsets: number[] = [];

    let index = 0;
    let hasWrittenContent = false;

    while (index < sourceText.length) {
        if (/\s/.test(sourceText[index])) {
            const whitespaceStart = index;

            while (
                index < sourceText.length &&
                /\s/.test(sourceText[index])
            ) {
                index++;
            }

            // Ignore leading whitespace.
            if (!hasWrittenContent) {
                continue;
            }

            // Ignore trailing whitespace.
            if (index >= sourceText.length) {
                break;
            }

            textParts.push(" ");
            originalOffsets.push(whitespaceStart);

            continue;
        }

        textParts.push(sourceText[index]);
        originalOffsets.push(index);

        hasWrittenContent = true;
        index++;
    }

    return {
        text: textParts.join(""),
        originalOffsets,
    };
}

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

        searchFrom = end;
    }

    return occurrences;
}

function buildSearchableDocument(
    pages: ReviewPageData[]
): SearchableDocument {
    const chunks: SearchableTextChunk[] = [];
    const textParts: string[] = [];

    let currentOffset = 0;

    pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .forEach((page) => {
            page.textItems.forEach((item) => {
                if (textParts.length > 0) {
                    textParts.push(" ");
                    currentOffset += 1;
                }

                const combinedStart = currentOffset;

                const normalised = normaliseWhitespaceForSearch(
                    item.text
                );

                textParts.push(normalised.text);

                currentOffset += normalised.text.length;

                chunks.push({
                    pageNumber: page.pageNumber,
                    itemId: item.itemId,
                    sourceText: item.text,
                    normalisedOffsets: normalised.originalOffsets,
                    combinedStart,
                    combinedEnd: currentOffset,
                });
            });
        });

    return {
        text: textParts.join(""),
        chunks,
    };
}

function buildTextMatchSegments(
    chunks: SearchableTextChunk[],
    matchStart: number,
    matchEnd: number
): ContentRange[] {
    return chunks.flatMap<ContentRange>((chunk) => {
        const overlapStart = Math.max(
            matchStart,
            chunk.combinedStart
        );

        const overlapEnd = Math.min(
            matchEnd,
            chunk.combinedEnd
        );

        if (overlapEnd <= overlapStart) {
            return [];
        }

        const localStart =
            overlapStart - chunk.combinedStart;

        const localEnd =
            overlapEnd - chunk.combinedStart;

        const originalStart =
            chunk.normalisedOffsets[localStart];

        const originalEnd =
            chunk.normalisedOffsets[localEnd - 1] + 1;

        return [
            {
                kind: "text",
                pageNumber: chunk.pageNumber,
                itemId: chunk.itemId,
                tableId: null,
                cellId: null,
                start: originalStart,
                end: originalEnd,
            },
        ];
    });
}

export function findInDocument(
    pages: ReviewPageData[],
    searchTerm: string
): FindInDocumentResult[] {
    const trimmedSearchTerm = normaliseWhitespaceForSearch(
        searchTerm
    ).text;

    if (!trimmedSearchTerm) return [];

    const results: FindInDocumentResult[] = [];
    const searchableDocument = buildSearchableDocument(pages);

    pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .forEach((page) => {
            findOccurrences(
                searchableDocument.text,
                trimmedSearchTerm
            ).forEach(({ start, end }, occurrenceIndex) => {
                const segments = buildTextMatchSegments(
                    searchableDocument.chunks,
                    start,
                    end
                );

                if (segments.length === 0) {
                    return;
                }

                const firstSegment = segments[0];

                results.push({
                    id: [
                        "text",
                        occurrenceIndex,
                        start,
                        end,
                    ].join("-"),

                    kind: "text",

                    pageNumber: firstSegment.pageNumber,
                    itemId: firstSegment.itemId,
                    tableId: null,
                    cellId: null,

                    sourceText: searchableDocument.text,

                    matchStart: start,
                    matchEnd: end,

                    segments,
                });
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
                                    segments: [
                                        {
                                            kind: "table_cell",
                                            pageNumber: page.pageNumber,
                                            itemId: null,
                                            tableId: table.tableId,
                                            cellId: cell.cellId,
                                            start,
                                            end,
                                        },
                                    ],
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