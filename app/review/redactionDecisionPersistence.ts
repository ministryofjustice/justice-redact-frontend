import type {
    ManualDecision,
    PageStatus,
    PersistedRedactionDecision,
} from "./types";

export function buildReviewStateFromPersistedDecisions(
    documentId: string,
    decisions: PersistedRedactionDecision[]
): {
    manualSelections: ManualDecision[];
    pageStatuses: Record<number, PageStatus>;
} {
    const manualSelections: ManualDecision[] = [];
    const pageStatuses: Record<number, PageStatus> = {};

    for (const decision of decisions) {
        if (decision.kind === "text") {
            manualSelections.push({
                id: crypto.randomUUID(),
                documentId,
                kind: "text",
                pageNumber: decision.pageNumber,
                itemId: decision.itemId,
                start: decision.start,
                end: decision.end,
                text: decision.text,
                ...(decision.redactionGroupId
                    ? { redactionGroupId: decision.redactionGroupId }
                    : {}),
            });

            continue;
        }

        if (decision.kind === "table_cell") {
            manualSelections.push({
                id: crypto.randomUUID(),
                documentId,
                kind: "table_cell",
                pageNumber: decision.pageNumber,
                tableId: decision.tableId,
                cellId: decision.cellId,
                start: decision.start,
                end: decision.end,
                text: decision.text,
                ...(decision.redactionGroupId
                    ? { redactionGroupId: decision.redactionGroupId }
                    : {}),
            });

            continue;
        }

        if (decision.kind === "image") {
            manualSelections.push({
                id: crypto.randomUUID(),
                documentId,
                kind: "image",
                pageNumber: decision.pageNumber,
                imageId: decision.imageId,
            });

            continue;
        }

        pageStatuses[decision.pageNumber] =
            decision.action === "exempt"
                ? "exempted"
                : "deleted";
    }

    return {
        manualSelections,
        pageStatuses,
    };
}