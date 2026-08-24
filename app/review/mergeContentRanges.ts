import {
    getContentLocationKey,
    type ContentRange,
} from "./contentRangeUtils";

export function mergeContentRanges(
    ranges: ContentRange[]
): ContentRange[] {
    const groupedRanges = new Map<string, ContentRange[]>();

    ranges.forEach((range) => {
        if (range.end <= range.start) {
            return;
        }

        const key = getContentLocationKey(range);
        const existing = groupedRanges.get(key) ?? [];

        existing.push(range);
        groupedRanges.set(key, existing);
    });

    return Array.from(groupedRanges.values()).flatMap(
        (locationRanges) => {
            const sortedRanges = locationRanges
                .slice()
                .sort(
                    (left, right) =>
                        left.start - right.start ||
                        left.end - right.end
                );

            if (sortedRanges.length === 0) {
                return [];
            }

            const merged: ContentRange[] = [];
            let current = { ...sortedRanges[0] };

            for (
                let index = 1;
                index < sortedRanges.length;
                index += 1
            ) {
                const next = sortedRanges[index];

                // Merge overlapping or directly adjacent ranges
                // attached to the same canonical content location.
                if (next.start <= current.end) {
                    current.end = Math.max(
                        current.end,
                        next.end
                    );
                    continue;
                }

                merged.push(current);
                current = { ...next };
            }

            merged.push(current);

            return merged;
        }
    );
}