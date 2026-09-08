import type { ReactNode } from "react";

import {
    getFindResultExcerptRedactedDisplayRanges,
} from "../findResultRedactionDisplay";

import type {
    FindInDocumentResult,
} from "../findInDocument";

import type {
    ManualDecision,
    ReviewPageData,
} from "../types";

type FindResultExcerptProps = {
    result: FindInDocumentResult;
    pages: ReviewPageData[];
    manualSelections: ManualDecision[];
};

export default function FindResultExcerpt({
    result,
    pages,
    manualSelections,
}: FindResultExcerptProps) {
    const {
        text,
        matchStart,
        matchEnd,
        hasLeadingEllipsis,
        hasTrailingEllipsis,
    } = result.display;

    const redactedRanges =
        getFindResultExcerptRedactedDisplayRanges(
            result,
            pages,
            manualSelections
        );

    const boundaries = Array.from(
        new Set([
            0,
            text.length,
            matchStart,
            matchEnd,
            ...redactedRanges.flatMap(
                (range) => [
                    range.start,
                    range.end,
                ]
            ),
        ])
    )
        .filter(
            (offset) =>
                offset >= 0 &&
                offset <= text.length
        )
        .sort((left, right) => left - right);

    const nodes: ReactNode[] = [];

    for (
        let index = 0;
        index < boundaries.length - 1;
        index++
    ) {
        const start = boundaries[index];
        const end =
            boundaries[index + 1];

        if (end <= start) {
            continue;
        }

        const value =
            text.slice(start, end);

        const isRedacted =
            redactedRanges.some(
                (range) =>
                    range.start <= start &&
                    range.end >= end
            );

        const isSearchMatch =
            start >= matchStart &&
            end <= matchEnd;

        let node: ReactNode = value;

        if (isRedacted) {
            node = (
                <span
                    className="highlight highlight--redaction jr-find-and-redact-result__match"
                >
                    {node}
                </span>
            );
        }

        if (isSearchMatch) {
            node = <strong>{node}</strong>;
        }

        nodes.push(
            <span
                key={`${start}-${end}`}
            >
                {node}
            </span>
        );
    }

    return (
        <>
            {hasLeadingEllipsis && "…"}
            {nodes}
            {hasTrailingEllipsis && "…"}
        </>
    );
}