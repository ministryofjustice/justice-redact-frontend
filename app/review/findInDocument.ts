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

    display: DisplayMatch;

    segments: FindInDocumentMatchSegment[];
};

export type FindInDocumentExcerpt = {
    before: string;
    match: string;
    after: string;
    hasLeadingEllipsis: boolean;
    hasTrailingEllipsis: boolean;
};

type DisplayMatch = {
    text: string;
    matchStart: number;
    matchEnd: number;

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

export function normaliseWhitespaceForSearch(
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

            if (!hasWrittenContent) {
                continue;
            }

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

export function mapOriginalOffsetToNormalisedOffset(
    sourceText: string,
    originalOffset: number
): number {
    const normalised = normaliseWhitespaceForSearch(sourceText);

    const index = normalised.originalOffsets.findIndex(
        (offset) => offset >= originalOffset
    );

    return index === -1
        ? normalised.text.length
        : index;
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

    pages.forEach((page) => {
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

type OverlappingChunk = {
    chunk: SearchableTextChunk;
    overlapStart: number;
    overlapEnd: number;
};

function findOverlappingChunks(
    chunks: SearchableTextChunk[],
    matchStart: number,
    matchEnd: number
): OverlappingChunk[] {
    return chunks.flatMap((chunk) => {
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

        return [
            {
                chunk,
                overlapStart,
                overlapEnd,
            },
        ];
    });
}

function buildTextMatchSegments(
    chunks: SearchableTextChunk[],
    matchStart: number,
    matchEnd: number
): ContentRange[] {
    return findOverlappingChunks(
        chunks,
        matchStart,
        matchEnd
    ).map(({ chunk, overlapStart, overlapEnd }) => {
        const localStart =
            overlapStart - chunk.combinedStart;

        const localEnd =
            overlapEnd - chunk.combinedStart;

        const originalStart =
            chunk.normalisedOffsets[localStart];

        const originalEnd =
            chunk.normalisedOffsets[localEnd - 1] + 1;

        return {
            kind: "text",
            pageNumber: chunk.pageNumber,
            itemId: chunk.itemId,
            tableId: null,
            cellId: null,
            start: originalStart,
            end: originalEnd,
        };
    });
}

function buildPartialContentRangesFromFindResult(
    result: FindInDocumentResult,
    searchableDocument: SearchableDocument,
    selectedRange: {
        start: number;
        end: number;
    }
): ContentRange[] {

    const firstTextSegment = result.segments.find(
        (segment) =>
            segment.kind === "text" &&
            segment.itemId !== null
    );

    if (!firstTextSegment) {
        return [];
    }

    const firstChunk = searchableDocument.chunks.find(
        (chunk) =>
            chunk.pageNumber === firstTextSegment.pageNumber &&
            chunk.itemId === firstTextSegment.itemId
    );

    if (!firstChunk) {
        return [];
    }

    const firstSegmentNormalisedStart =
        firstChunk.normalisedOffsets.findIndex(
            (originalOffset) =>
                originalOffset >= firstTextSegment.start
        );

    if (firstSegmentNormalisedStart === -1) {
        return [];
    }

    const matchCombinedStart =
        firstChunk.combinedStart +
        firstSegmentNormalisedStart;

    return result.segments.flatMap((segment) => {
        if (segment.kind !== "text" || segment.itemId === null) {
            return [];
        }

        const chunk = searchableDocument.chunks.find(
            (chunk) =>
                chunk.pageNumber === segment.pageNumber &&
                chunk.itemId === segment.itemId
        );

        if (!chunk) {
            return [];
        }

        const segmentNormalisedStart =
            chunk.normalisedOffsets.findIndex(
                (originalOffset) =>
                    originalOffset >= segment.start
            );

        if (segmentNormalisedStart === -1) {
            return [];
        }

        const segmentNormalisedEnd =
            chunk.normalisedOffsets.findIndex(
                (originalOffset) =>
                    originalOffset >= segment.end
            );

        const resolvedSegmentNormalisedEnd =
            segmentNormalisedEnd === -1
                ? chunk.normalisedOffsets.length
                : segmentNormalisedEnd;

        const segmentCombinedStart =
            chunk.combinedStart +
            segmentNormalisedStart;

        const segmentCombinedEnd =
            chunk.combinedStart +
            resolvedSegmentNormalisedEnd;

        const selectionCombinedStart =
            matchCombinedStart +
            selectedRange.start;

        const selectionCombinedEnd =
            matchCombinedStart +
            selectedRange.end;

        const overlapStart = Math.max(
            segmentCombinedStart,
            selectionCombinedStart
        );

        const overlapEnd = Math.min(
            segmentCombinedEnd,
            selectionCombinedEnd
        );

        if (overlapEnd <= overlapStart) {
            return [];
        }

        const localOverlapStart =
            overlapStart - chunk.combinedStart;

        const localOverlapEnd =
            overlapEnd - chunk.combinedStart;

        const originalStart =
            chunk.normalisedOffsets[localOverlapStart];

        const originalEnd =
            chunk.normalisedOffsets[localOverlapEnd - 1] + 1;

        return [
            {
                kind: "text",
                pageNumber: segment.pageNumber,
                itemId: segment.itemId,
                tableId: null,
                cellId: null,
                start: originalStart,
                end: originalEnd,
            },
        ];
    });
}

export function buildPartialContentRanges(
    pages: ReviewPageData[],
    result: FindInDocumentResult,
    selectedRange: {
        start: number;
        end: number;
    }
): ContentRange[] {
    const sortedPages = pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber);

    const searchableDocument =
        buildSearchableDocument(sortedPages);

    return buildPartialContentRangesFromFindResult(
        result,
        searchableDocument,
        selectedRange
    );
}

function buildDisplayMatch(
    sourceText: string,
    matchStart: number,
    matchEnd: number,
    contextLength = DEFAULT_CONTEXT_LENGTH
): DisplayMatch {
    const excerptStart = Math.max(
        0,
        matchStart - contextLength
    );

    const excerptEnd = Math.min(
        sourceText.length,
        matchEnd + contextLength
    );

    const excerptSource = sourceText.slice(
        excerptStart,
        excerptEnd
    );

    const relativeMatchStart =
        matchStart - excerptStart;

    const relativeMatchEnd =
        matchEnd - excerptStart;

    const normalisedExcerpt =
        normaliseWhitespaceForSearch(excerptSource);

    const displayMatchStart =
        normalisedExcerpt.originalOffsets.findIndex(
            (originalOffset) =>
                originalOffset >= relativeMatchStart
        );

    const firstOffsetAfterMatch =
        normalisedExcerpt.originalOffsets.findIndex(
            (originalOffset) =>
                originalOffset >= relativeMatchEnd
        );

    const resolvedMatchStart =
        displayMatchStart === -1
            ? normalisedExcerpt.text.length
            : displayMatchStart;

    const resolvedMatchEnd =
        firstOffsetAfterMatch === -1
            ? normalisedExcerpt.text.length
            : firstOffsetAfterMatch;

    return {
        text: normalisedExcerpt.text,
        matchStart: resolvedMatchStart,
        matchEnd: resolvedMatchEnd,

        hasLeadingEllipsis: excerptStart > 0,
        hasTrailingEllipsis:
            excerptEnd < sourceText.length,
    };
}

function buildDisplaySourceText(
    chunks: SearchableTextChunk[],
    matchStart: number,
    matchEnd: number,
    contextLength = DEFAULT_CONTEXT_LENGTH
): {
    text: string;
    matchStart: number;
    matchEnd: number;
} {
    const overlappingChunks = findOverlappingChunks(
        chunks,
        matchStart,
        matchEnd
    );

    const overlapLookup = new Map(
        overlappingChunks.map((overlap) => [
            overlap.chunk,
            overlap,
        ])
    );

    if (overlappingChunks.length === 0) {
        return {
            text: "",
            matchStart: 0,
            matchEnd: 0,
        };
    }

    const firstChunk = overlappingChunks[0].chunk;
    const lastChunk =
        overlappingChunks[overlappingChunks.length - 1].chunk;

    const displayStart = Math.max(
        0,
        firstChunk.combinedStart - contextLength
    );

    const displayEnd = Math.min(
        chunks[chunks.length - 1].combinedEnd,
        lastChunk.combinedEnd + contextLength
    );

    const includedChunks = chunks.filter(
        (chunk) =>
            chunk.combinedEnd > displayStart &&
            chunk.combinedStart < displayEnd
    );

    const textParts: string[] = [];

    let displayOffset = 0;
    let displayMatchStart: number | null = null;
    let displayMatchEnd: number | null = null;

    includedChunks.forEach((chunk, index) => {
        if (index > 0) {
            textParts.push(" ");
            displayOffset += 1;
        }

        const normalised =
            normaliseWhitespaceForSearch(chunk.sourceText).text;

        const chunkDisplayStart = displayOffset;

        textParts.push(normalised);

        displayOffset += normalised.length;

        const overlap = overlapLookup.get(chunk);

        if (!overlap) {
            return;
        }

        const { overlapStart, overlapEnd } = overlap;

        const localMatchStart =
            overlapStart - chunk.combinedStart;

        const localMatchEnd =
            overlapEnd - chunk.combinedStart;

        const candidateStart =
            chunkDisplayStart + localMatchStart;

        const candidateEnd =
            chunkDisplayStart + localMatchEnd;

        if (displayMatchStart === null) {
            displayMatchStart = candidateStart;
        }

        displayMatchEnd = candidateEnd;
    });

    return {
        text: textParts.join(""),
        matchStart: displayMatchStart ?? 0,
        matchEnd: displayMatchEnd ?? 0,
    };
}

export function findInDocument(
    pages: ReviewPageData[],
    searchTerm: string
): FindInDocumentResult[] {
    const trimmedSearchTerm = normaliseWhitespaceForSearch(
        searchTerm
    ).text;

    if (!trimmedSearchTerm) {
        return [];
    }

    const results: FindInDocumentResult[] = [];

    const sortedPages = pages
        .slice()
        .sort((a, b) => a.pageNumber - b.pageNumber);

    const searchableDocument =
        buildSearchableDocument(sortedPages);

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

        const displaySource = buildDisplaySourceText(
            searchableDocument.chunks,
            start,
            end
        );

        const display = buildDisplayMatch(
            displaySource.text,
            displaySource.matchStart,
            displaySource.matchEnd
        );

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

            display,

            segments,
        });
    });

    sortedPages.forEach((page) => {
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

                                display: buildDisplayMatch(
                                    cell.text,
                                    start,
                                    end
                                ),

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

export function buildFindInDocumentExcerpt(
    result: FindInDocumentResult
): FindInDocumentExcerpt {
    return {
        before: result.display.text.slice(
            0,
            result.display.matchStart
        ),

        match: result.display.text.slice(
            result.display.matchStart,
            result.display.matchEnd
        ),

        after: result.display.text.slice(
            result.display.matchEnd
        ),

        hasLeadingEllipsis:
            result.display.hasLeadingEllipsis,

        hasTrailingEllipsis:
            result.display.hasTrailingEllipsis,
    };
}