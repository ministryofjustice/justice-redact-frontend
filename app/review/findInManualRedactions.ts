import {
    getFindResultContentRanges,
    getManualDecisionContentRange,
    overlapsContentRange,
} from "./contentRangeUtils";
import {
    findInDocument,
    type FindInDocumentResult,
} from "./findInDocument";
import { mergeContentRanges } from "./mergeContentRanges";
import type {
    ManualDecision,
    ReviewPageData,
} from "./types";

export type FindInManualRedactionResult =
    FindInDocumentResult;

export function findInManualRedactions(
    pages: ReviewPageData[],
    manualSelections: ManualDecision[],
    searchTerm: string
): FindInManualRedactionResult[] {
    const trimmedSearchTerm = searchTerm.trim();

    if (!trimmedSearchTerm) {
        return [];
    }

    const searchableManualSelections =
        manualSelections.flatMap((selection) => {
            const range =
                getManualDecisionContentRange(selection);

            return range
                ? [{ selection, range }]
                : [];
        });

    if (searchableManualSelections.length === 0) {
        return [];
    }

    const mergedRedactionRanges =
        mergeContentRanges(
            searchableManualSelections.map(
                ({ range }) => range
            )
        );

    const documentResults = findInDocument(
        pages,
        trimmedSearchTerm
    );

    return documentResults.filter((result) => {
        const resultRanges =
            getFindResultContentRanges(result);

        if (resultRanges.length === 0) {
            return false;
        }

        /*
         * Include the searched occurrence if any part of it
         * currently overlaps a manual redaction.
         *
         * This allows both fully and partially redacted
         * occurrences to be disclosed.
         */
        return resultRanges.some((resultRange) =>
            mergedRedactionRanges.some(
                (redactionRange) =>
                    overlapsContentRange(
                        redactionRange,
                        resultRange
                    )
            )
        );
    });
}