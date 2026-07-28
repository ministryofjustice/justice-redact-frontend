import type {
    ManualDecision,
    ManualTableCellDecision,
    ManualTextDecision,
} from "./types";
import type { FindInDocumentResult } from "./findInDocument";

export type TextContentLocation = {
    kind: "text";
    pageNumber: number;
    itemId: string;
    tableId: null;
    cellId: null;
};

export type TableCellContentLocation = {
    kind: "table_cell";
    pageNumber: number;
    itemId: null;
    tableId: string;
    cellId: string;
};

export type ContentLocation =
    | TextContentLocation
    | TableCellContentLocation;

export type ContentRange = ContentLocation & {
    start: number;
    end: number;
};

export function getContentLocationKey(
    location: ContentLocation
): string {
    if (location.kind === "text") {
        return [
            "text",
            location.pageNumber,
            location.itemId,
        ].join(":");
    }

    return [
        "table_cell",
        location.pageNumber,
        location.tableId,
        location.cellId,
    ].join(":");
}

export function getContentRangeKey(
    range: ContentRange
): string {
    return [
        getContentLocationKey(range),
        range.start,
        range.end,
    ].join(":");
}

export function isSameContentLocation(
    left: ContentLocation,
    right: ContentLocation
): boolean {
    return (
        getContentLocationKey(left) ===
        getContentLocationKey(right)
    );
}

export function containsContentRange(
    container: ContentRange,
    candidate: ContentRange
): boolean {
    return (
        isSameContentLocation(container, candidate) &&
        container.start <= candidate.start &&
        container.end >= candidate.end
    );
}

export function overlapsContentRange(
    left: ContentRange,
    right: ContentRange
): boolean {
    return (
        isSameContentLocation(left, right) &&
        left.start < right.end &&
        right.start < left.end
    );
}

function isManualTextDecision(
    decision: ManualDecision
): decision is ManualTextDecision {
    return decision.kind === "text";
}

function isManualTableCellDecision(
    decision: ManualDecision
): decision is ManualTableCellDecision {
    return decision.kind === "table_cell";
}

export function getManualDecisionContentRange(
    decision: ManualDecision
): ContentRange | null {
    if (isManualTextDecision(decision)) {
        return {
            kind: "text",
            pageNumber: decision.pageNumber,
            itemId: decision.itemId,
            tableId: null,
            cellId: null,
            start: decision.start,
            end: decision.end,
        };
    }

    if (isManualTableCellDecision(decision)) {
        return {
            kind: "table_cell",
            pageNumber: decision.pageNumber,
            itemId: null,
            tableId: decision.tableId,
            cellId: decision.cellId,
            start: decision.start,
            end: decision.end,
        };
    }

    return null;
}

export function getFindResultContentRanges(
    result: FindInDocumentResult
): ContentRange[] {
    return result.segments.filter(
        (segment) => segment.end > segment.start
    );
}

export function getManualDecisionContentRanges(
    manualSelections: ManualDecision[]
): ContentRange[] {
    return manualSelections.flatMap((selection) => {
        const range = getManualDecisionContentRange(selection);

        return range ? [range] : [];
    });
}