import {
    buildFindInDocumentExcerpt,
    type FindInDocumentResult,
} from "../findInDocument";
import {
    buildAccessibleFindResultText,
    getFindResultRedactedDisplayRanges,
} from "../findResultRedactionDisplay";
import type {
    ManualDecision,
    ReviewPageData,
} from "../types";

type FindResultMatchProps = {
    result: FindInDocumentResult;
    pages: ReviewPageData[];
    manualSelections: ManualDecision[];
};

export default function FindResultMatch({
    result,
    pages,
    manualSelections,
}: FindResultMatchProps) {
    const match =
        buildFindInDocumentExcerpt(result).match;

    const redactedRanges =
        getFindResultRedactedDisplayRanges(
            result,
            pages,
            manualSelections
        );

    const accessibleMatch =
        buildAccessibleFindResultText(
            match,
            redactedRanges
        );

    if (redactedRanges.length === 0) {
        return <strong>{match}</strong>;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    redactedRanges.forEach((range, index) => {
        if (cursor < range.start) {
            nodes.push(
                <span key={`plain-${cursor}-${range.start}`}>
                    {match.slice(cursor, range.start)}
                </span>
            );
        }

        nodes.push(
            <span
                key={`redacted-${index}-${range.start}-${range.end}`}
                className="highlight highlight--redaction jr-find-and-redact-result__match"
            >
                <span className="govuk-visually-hidden">
                    Redaction:{" "}
                </span>
                {match.slice(range.start, range.end)}
            </span>
        );

        cursor = range.end;
    });

    if (cursor < match.length) {
        nodes.push(
            <span key={`plain-${cursor}-end`}>
                {match.slice(cursor)}
            </span>
        );
    }

    return (
        <strong>
            <span className="govuk-visually-hidden">
                {accessibleMatch}
            </span>

            <span aria-hidden="true">
                {nodes}
            </span>
        </strong>
    );
}