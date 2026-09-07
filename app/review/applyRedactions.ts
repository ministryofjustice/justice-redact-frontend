import type { ManualDecision, PageStatus } from "./types";

export function buildApplyRedactionsRequest(
    documentId: string,
    manualSelections: ManualDecision[],
    pageStatuses: Record<number, PageStatus>
) {
    const pageDecisions = Object.entries(pageStatuses).map(
        ([pageNumber, status]) => ({
            kind: "page",
            pageNumber: Number(pageNumber),
            action: status === "exempted" ? "exempt" : "delete",
            source: "manual",
        })
    );

    return {
        documentId,
        decisions: [
            ...manualSelections.map((selection) => {
                if (selection.kind === "text") {
                    return {
                        kind: "text",
                        pageNumber: selection.pageNumber,
                        itemId: selection.itemId,
                        start: selection.start,
                        end: selection.end,
                        text: selection.text,
                        action: "redact",
                        source: "manual",
                        ...(selection.redactionGroupId
                            ? { redactionGroupId: selection.redactionGroupId }
                            : {}),
                    };
                }

                if (selection.kind === "table_cell") {
                    return {
                        kind: "table_cell",
                        pageNumber: selection.pageNumber,
                        tableId: selection.tableId,
                        cellId: selection.cellId,
                        start: selection.start,
                        end: selection.end,
                        text: selection.text,
                        action: "redact",
                        source: "manual",
                        ...(selection.redactionGroupId
                            ? { redactionGroupId: selection.redactionGroupId }
                            : {}),
                    };
                }

                return {
                    kind: "image",
                    pageNumber: selection.pageNumber,
                    imageId: selection.imageId,
                    action: "redact",
                    source: "manual",
                };
            }),
            ...pageDecisions,
        ],
    };
}