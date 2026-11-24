import type { ReactNode } from "react";
import { toSmartQuotes } from "../smartQuotes";
import {
    buildAccessibleFindResultTextWithSuggestions,
    getFindResultExcerptRedactedDisplayRanges,
    getFindResultExcerptSuggestionDisplayRanges,
} from "../findResultRedactionDisplay";
import type {
    FindInDocumentResult,
} from "../findInDocument";
import type {
    ManualDecision,
    ReviewFinding,
    ReviewPageData,
} from "../types";

type FindResultExcerptProps = {
    result: FindInDocumentResult;
    pages: ReviewPageData[];
    manualSelections: ManualDecision[];
    findings?: ReviewFinding[];
};

export default function FindResultExcerpt({
    result,
    pages,
    manualSelections,
    findings = [],
}: FindResultExcerptProps) {
    const {
        text,
        matchStart,
        matchEnd,
        hasLeadingEllipsis,
        hasTrailingEllipsis,
    } = result.display;

    const displayText = toSmartQuotes(text);

    const redactedRanges =
        getFindResultExcerptRedactedDisplayRanges(
            result,
            pages,
            manualSelections
        );

    const suggestionRanges =
        getFindResultExcerptSuggestionDisplayRanges(
            result,
            pages,
            findings
        );

    const accessibleExcerpt =
        buildAccessibleFindResultTextWithSuggestions(
            text,
            redactedRanges,
            suggestionRanges
        );

    const boundaries = Array.from(
        new Set([
            0,
            text.length,
            matchStart,
            matchEnd,
            ...suggestionRanges.flatMap((range) => [
                range.start,
                range.end,
            ]),
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
            displayText.slice(start, end);

        const isRedacted =
            redactedRanges.some(
                (range) =>
                    range.start <= start &&
                    range.end >= end
            );

        const isSuggested =
            suggestionRanges.some(
                (range) =>
                    range.start <= start &&
                    range.end >= end
            );

        const isSearchMatch =
            start >= matchStart &&
            end <= matchEnd;

        let node: ReactNode = value;

        if (isRedacted || isSuggested) {
            const classes = [
                "highlight",
                isSuggested && "highlight--suggestion",
                isRedacted && "highlight--redaction",
                isRedacted &&
                    "jr-find-and-redact-result__match",
            ]
                .filter(Boolean)
                .join(" ");

            node = (
                <span className={classes}>
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
            <span className="govuk-visually-hidden">
                {hasLeadingEllipsis && "…"}
                {toSmartQuotes(accessibleExcerpt)}
                {hasTrailingEllipsis && "…"}
            </span>

            <span aria-hidden="true">
                {hasLeadingEllipsis && "…"}
                {nodes}
                {hasTrailingEllipsis && "…"}
            </span>
        </>
    );
}