import type { ContentRange } from "./contentRangeUtils";
import type { FindInDocumentResult } from "./findInDocument";

export function buildContentRangesFromFindResults(
    results: FindInDocumentResult[]
): ContentRange[] {
    return results.flatMap((result) =>
        result.segments.filter(
            (segment) => segment.end > segment.start
        )
    );
}