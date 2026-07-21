import type {
    ManualDecision,
    ManualTableCellDecision,
    ManualTextDecision,
} from "./types";
import type { FindInDocumentResult } from "./findInDocument";

export type FindInManualRedactionResult =
    FindInDocumentResult & {
        manualSelectionId: string;
        absoluteMatchStart: number;
        absoluteMatchEnd: number;
    };

type SearchableManualDecision =
    | ManualTextDecision
    | ManualTableCellDecision;

function isSearchableManualDecision(
    decision: ManualDecision
): decision is SearchableManualDecision {
    return (
        decision.kind === "text" ||
        decision.kind === "table_cell"
    );
}

function findOccurrences(
    sourceText: string,
    searchTerm: string
): Array<{ start: number; end: number }> {
    const occurrences: Array<{ start: number; end: number }> = [];

    const normalisedSource = sourceText.toLocaleLowerCase();
    const normalisedSearchTerm = searchTerm.toLocaleLowerCase();

    let searchFrom = 0;

    while (searchFrom < normalisedSource.length) {
        const relativeStart = normalisedSource.indexOf(
            normalisedSearchTerm,
            searchFrom
        );

        if (relativeStart === -1) {
            break;
        }

        const relativeEnd =
            relativeStart + normalisedSearchTerm.length;

        occurrences.push({
            start: relativeStart,
            end: relativeEnd,
        });

        searchFrom = relativeEnd;
    }

    return occurrences;
}

export function findInManualRedactions(
    manualSelections: ManualDecision[],
    searchTerm: string
): FindInManualRedactionResult[] {
    const trimmedSearchTerm = searchTerm.trim();

    if (!trimmedSearchTerm) {
        return [];
    }

    const results: FindInManualRedactionResult[] = [];

    manualSelections
        .filter(isSearchableManualDecision)
        .forEach((selection) => {
            findOccurrences(selection.text, trimmedSearchTerm).forEach(
                ({ start, end }, occurrenceIndex) => {
                    const absoluteStart = selection.start + start;
                    const absoluteEnd = selection.start + end;

                    results.push({
                        id: [
                            "manual-redaction",
                            selection.id,
                            absoluteStart,
                            absoluteEnd,
                            occurrenceIndex,
                        ].join("-"),
                        manualSelectionId: selection.id,
                        absoluteMatchStart: absoluteStart,
                        absoluteMatchEnd: absoluteEnd,
                        kind: selection.kind,
                        pageNumber: selection.pageNumber,
                        itemId:
                            selection.kind === "text"
                                ? selection.itemId
                                : null,
                        tableId:
                            selection.kind === "table_cell"
                                ? selection.tableId
                                : null,
                        cellId:
                            selection.kind === "table_cell"
                                ? selection.cellId
                                : null,
                        sourceText: selection.text,
                        matchStart: start,
                        matchEnd: end,
                    });
                }
            );
        });

    return results.sort(
        (a, b) =>
            a.pageNumber - b.pageNumber ||
            a.matchStart - b.matchStart
    );
}