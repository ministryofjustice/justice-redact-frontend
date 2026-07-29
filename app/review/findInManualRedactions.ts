import {
    containsContentRange,
    getFindResultContentRanges,
    getManualDecisionContentRange,
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

    const searchableManualSelections = manualSelections.flatMap(
        (selection) => {
            const range = getManualDecisionContentRange(selection);

            return range
                ? [{ selection, range }]
                : [];
        }
    );

    if (searchableManualSelections.length === 0) {
        return [];
    }

    const mergedRedactionRanges = mergeContentRanges(
        searchableManualSelections.map(({ range }) => range)
    );

    const documentResults = findInDocument(
        pages,
        trimmedSearchTerm
    );

    return documentResults.flatMap<FindInManualRedactionResult>(
        (result) => {
            const resultRanges =
                getFindResultContentRanges(result);

            if (resultRanges.length === 0) {
                return [];
            }

            const isCurrentlyRedacted =
                resultRanges.every((resultRange) =>
                    mergedRedactionRanges.some(
                        (redactionRange) =>
                            containsContentRange(
                                redactionRange,
                                resultRange
                            )
                    )
                );

            if (!isCurrentlyRedacted) {
                return [];
            }

            return [result];
        }
    );
}