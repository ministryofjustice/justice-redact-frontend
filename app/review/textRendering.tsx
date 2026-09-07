import React from "react";
import type { RenderRange, ReviewFinding, ReviewTextSpan } from "./types";

export function clampRangeValue(value: number, max: number) {
    return Math.max(0, Math.min(max, value));
}

export function getExactLineRanges(fullText: string, label: string) {
    const ranges: Array<{ start: number; end: number }> = [];
    let lineStart = 0;

    while (lineStart <= fullText.length) {
        const newlineIndex = fullText.indexOf("\n", lineStart);
        const lineEnd = newlineIndex === -1 ? fullText.length : newlineIndex;
        const line = fullText.slice(lineStart, lineEnd);

        if (line.trim() === label) {
            const leading = line.match(/^\s*/)?.[0]?.length ?? 0;
            const trailing = line.match(/\s*$/)?.[0]?.length ?? 0;
            const start = lineStart + leading;
            const end = Math.max(start, lineEnd - trailing);

            if (end > start) {
                ranges.push({ start, end });
            }
        }

        if (newlineIndex === -1) break;
        lineStart = newlineIndex + 1;
    }

    return ranges;
}

export function getBoldRangesFromTextSpans(
    text: string,
    textSpans?: ReviewTextSpan[]
) {
    if (!textSpans?.length) return [];

    const ranges: Array<{ start: number; end: number }> = [];
    let searchFrom = 0;

    textSpans.forEach((span) => {
        const spanText = span.text.replace(/\s+/g, " ").trim();

        if (!spanText) return;

        const index = text.indexOf(spanText, searchFrom);

        if (index === -1) return;

        if (span.isBold) {
            ranges.push({
                start: index,
                end: index + spanText.length,
            });
        }

        searchFrom = index + spanText.length;
    });

    return ranges;
}

export function getStructuredKeyRanges(text: string) {
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = 0;

    for (const line of text.split("\n")) {
        const colonIndex = line.indexOf(":");

        if (colonIndex > 0) {
            ranges.push({ start: cursor, end: cursor + colonIndex + 1 });
        }

        cursor += line.length + 1;
    }

    return ranges;
}

function renderSliceWithBoldRanges(
    fullText: string,
    sliceStart: number,
    sliceEnd: number,
    boldRanges: Array<{ start: number; end: number }>,
    keyPrefix: string
) {
    const start = clampRangeValue(sliceStart, fullText.length);
    const end = clampRangeValue(sliceEnd, fullText.length);

    if (end <= start) return [];

    const overlaps = boldRanges
        .map((range) => ({
            start: Math.max(start, range.start),
            end: Math.min(end, range.end),
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const nodes: React.ReactNode[] = [];
    let cursor = start;

    overlaps.forEach((range, index) => {
        if (cursor < range.start) {
            nodes.push(fullText.slice(cursor, range.start));
        }

        nodes.push(
            <strong key={`${keyPrefix}-bold-${index}`}>
                {fullText.slice(range.start, range.end)}
            </strong>
        );

        cursor = range.end;
    });

    if (cursor < end) {
        nodes.push(fullText.slice(cursor, end));
    }

    return nodes;
}

export function buildRenderRanges(
    text: string,
    suggestions: ReviewFinding[],
    manualSelections: Array<{
        id: string;
        start: number;
        end: number;
        redactionGroupId?: string;
    }>,
    isPreviewMode: boolean
) {
    const clamp = (value: number) => clampRangeValue(value, text.length);

    const manualRanges = manualSelections
        .map((selection) => ({
            id: selection.id,
            start: clamp(selection.start),
            end: clamp(selection.end),
            redactionGroupId: selection.redactionGroupId,
        }))
        .filter((range) => range.end > range.start);

    if (isPreviewMode) {
        return manualRanges
            .map<RenderRange>((range) => ({
                start: range.start,
                end: range.end,
                className: "applied-redaction",
                key: `manual-${range.id}`,
                manualId: range.id,
                redactionGroupId: range.redactionGroupId,
            }))
            .sort((a, b) => a.start - b.start || a.end - b.end);
    }

    const suggestionRanges = suggestions
        .filter(
            (suggestion) =>
                typeof suggestion.entityStart === "number" &&
                typeof suggestion.entityEnd === "number"
        )
        .map((suggestion) => ({
            id: suggestion.id,
            start: clamp(suggestion.entityStart as number),
            end: clamp(suggestion.entityEnd as number),
        }))
        .filter((range) => range.end > range.start);

    const boundaries = Array.from(
        new Set([
            ...manualRanges.flatMap((range) => [range.start, range.end]),
            ...suggestionRanges.flatMap((range) => [range.start, range.end]),
        ])
    ).sort((a, b) => a - b);

    const ranges: RenderRange[] = [];

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];

        if (end <= start) continue;

        const manualRange = manualRanges.find(
            (range) => range.start < end && range.end > start
        );

        const hasSuggestion = suggestionRanges.some(
            (range) => range.start < end && range.end > start
        );

        if (!manualRange && !hasSuggestion) continue;

        const classNames = ["highlight"];

        if (hasSuggestion) {
            classNames.push("highlight--suggestion");
        }

        if (manualRange) {
            classNames.push("highlight--redaction");
        }

        ranges.push({
            start,
            end,
            className: classNames.join(" "),
            key: [
                manualRange ? `manual-${manualRange.id}` : "no-manual",
                hasSuggestion ? "suggestion" : "no-suggestion",
                start,
                end,
            ].join("-"),
            manualId: manualRange?.id,
            redactionGroupId: manualRange?.redactionGroupId,
        });
    }

    return ranges;
}

export function renderTextSegments(
    text: string,
    suggestions: ReviewFinding[],
    manualSelections: Array<{
        id: string;
        start: number;
        end: number;
        redactionGroupId?: string;
    }>,
    isPreviewMode: boolean,
    boldRanges: Array<{ start: number; end: number }> = []
) {
    const ranges = buildRenderRanges(
        text,
        suggestions,
        manualSelections,
        isPreviewMode
    );

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    ranges.forEach((range) => {
        if (range.start < cursor) return;

        if (cursor < range.start) {
            nodes.push(
                <span key={`plain-${cursor}-${range.start}`}>
                    {renderSliceWithBoldRanges(
                        text,
                        cursor,
                        range.start,
                        boldRanges,
                        `plain-${cursor}-${range.start}`
                    )}
                </span>
            );
        }

        nodes.push(
            <span
                key={range.key}
                className={range.className}
                data-manual-id={range.manualId}
                data-redaction-group-id={range.redactionGroupId}
            >
                {renderSliceWithBoldRanges(
                    text,
                    range.start,
                    range.end,
                    boldRanges,
                    `${range.key}-${range.start}-${range.end}`
                )}
            </span>
        );

        cursor = range.end;
    });

    if (cursor < text.length) {
        nodes.push(
            <span key={`plain-${cursor}-end`}>
                {renderSliceWithBoldRanges(
                    text,
                    cursor,
                    text.length,
                    boldRanges,
                    "plain-end"
                )}
            </span>
        );
    }

    return nodes;
}

export function renderStyledTextSegments(
    textSpans: ReviewTextSpan[],
    suggestions: ReviewFinding[],
    manualSelections: Array<{
        id: string;
        start: number;
        end: number;
        redactionGroupId?: string;
    }>,
    isPreviewMode: boolean
) {
    const sourceText = textSpans.map((span) => span.text).join("");

    const ranges = buildRenderRanges(
        sourceText,
        suggestions,
        manualSelections,
        isPreviewMode
    );

    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    function renderStyledSlice(sliceStart: number, sliceEnd: number, keyPrefix: string) {
        const sliceNodes: React.ReactNode[] = [];

        textSpans.forEach((span, index) => {
            const overlapStart = Math.max(sliceStart, span.start);
            const overlapEnd = Math.min(sliceEnd, span.end);

            if (overlapEnd <= overlapStart) return;

            const localStart = overlapStart - span.start;
            const localEnd = overlapEnd - span.start;
            const content = span.text.slice(localStart, localEnd);

            if (!content) return;

            if (span.isBold) {
                sliceNodes.push(
                    <strong key={`${keyPrefix}-styled-${index}`}>
                        {content}
                    </strong>
                );
                return;
            }

            sliceNodes.push(
                <React.Fragment key={`${keyPrefix}-styled-${index}`}>
                    {content}
                </React.Fragment>
            );
        });

        return sliceNodes;
    }

    ranges.forEach((range) => {
        if (range.start < cursor) return;

        if (cursor < range.start) {
            nodes.push(
                <span key={`plain-${cursor}-${range.start}`}>
                    {renderStyledSlice(cursor, range.start, `plain-${cursor}-${range.start}`)}
                </span>
            );
        }

        nodes.push(
            <span
                key={range.key}
                className={range.className}
                data-manual-id={range.manualId}
                data-redaction-group-id={range.redactionGroupId}
            >
                {renderStyledSlice(
                    range.start,
                    range.end,
                    `${range.key}-${range.start}-${range.end}`
                )}
            </span>
        );

        cursor = range.end;
    });

    if (cursor < sourceText.length) {
        nodes.push(
            <span key={`plain-${cursor}-end`}>
                {renderStyledSlice(cursor, sourceText.length, "plain-end")}
            </span>
        );
    }

    return nodes;
}