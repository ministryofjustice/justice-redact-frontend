import type { ReviewFinding } from "./types";

/**
 * Hide fully contained AI findings from the rendered presentation.
 *
 * The incoming findings remain unchanged and retain their original
 * IDs, offsets, order and API representation.
 *
 * Only compare findings within the same text item or table cell.
 * Partially overlapping and equal-sized ranges are preserved.
 */
export function filterNestedAiSuggestions<T extends ReviewFinding>(
    findings: readonly T[]
): T[] {
    type Entry = {
        index: number;
        start: number;
        end: number;
    };

    const groups = new Map<string, Entry[]>();
    const retained = new Set<number>();

    findings.forEach((finding, index) => {
        const start = finding.entityStart;
        const end = finding.entityEnd;

        if (
            typeof start !== "number" ||
            typeof end !== "number" ||
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start < 0 ||
            end <= start
        ) {
            retained.add(index);
            return;
        }

        let sourceKey: string;

        if (finding.kind === "text" && finding.itemId) {
            sourceKey = JSON.stringify([
                "text",
                finding.pageNumber,
                finding.itemId,
            ]);
        } else if (
            finding.kind === "table_cell" &&
            finding.tableId &&
            finding.cellId
        ) {
            sourceKey = JSON.stringify([
                "table_cell",
                finding.pageNumber,
                finding.tableId,
                finding.cellId,
            ]);
        } else {
            retained.add(index);
            return;
        }

        const entries = groups.get(sourceKey) ?? [];

        entries.push({ index, start, end });
        groups.set(sourceKey, entries);
    });

    for (const entries of groups.values()) {
        // Larger containing ranges come first.
        entries.sort(
            (a, b) =>
                a.start - b.start ||
                b.end - a.end ||
                a.index - b.index
        );

        let coveringStart = Infinity;
        let coveringEnd = -Infinity;

        for (const entry of entries) {
            const isStrictlyContained =
                coveringStart <= entry.start &&
                coveringEnd >= entry.end &&
                (
                    coveringStart < entry.start ||
                    coveringEnd > entry.end
                );

            if (!isStrictlyContained) {
                retained.add(entry.index);
            }

            if (entry.end > coveringEnd) {
                coveringStart = entry.start;
                coveringEnd = entry.end;
            }
        }
    }

    // Restore original API order, without mutating its objects.
    return findings.filter((_, index) => retained.has(index));
}
