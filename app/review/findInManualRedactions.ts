import {
    containsContentRange,
    getFindResultContentRange,
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
    FindInDocumentResult & {
        absoluteMatchStart: number;
        absoluteMatchEnd: number;
    };

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
            const resultRange =
                getFindResultContentRange(result);

            if (!resultRange) {
                return [];
            }

            const isCurrentlyRedacted =
                mergedRedactionRanges.some(
                    (redactionRange) =>
                        containsContentRange(
                            redactionRange,
                            resultRange
                        )
                );

            if (!isCurrentlyRedacted) {
                return [];
            }

            const containingSelection =
                searchableManualSelections.find(
                    ({ range }) =>
                        containsContentRange(
                            range,
                            resultRange
                        )
                );

            if (!containingSelection) {
                return [];
            }

            return [
                {
                    ...result,
                    absoluteMatchStart:
                        result.matchStart,
                    absoluteMatchEnd:
                        result.matchEnd,
                },
            ];
        }
    );
}