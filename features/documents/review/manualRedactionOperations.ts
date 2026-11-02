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