import React from "react";
import type { RenderRange, ReviewFinding } from "./types";

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
    manualSelections: Array<{ id: string; start: number; end: number }>,
    isPreviewMode: boolean
) {
    const clamp = (n: number) => clampRangeValue(n, text.length);

    const manualRanges: RenderRange[] = manualSelections
        .map((selection) => ({
            start: clamp(selection.start),
            end: clamp(selection.end),
            className: isPreviewMode
                ? "applied-redaction"
                : "highlight highlight--redaction",
            key: `manual-${selection.id}`,
            manualId: selection.id,
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    if (isPreviewMode) return manualRanges;

    const suggestionFragments: RenderRange[] = [];

    suggestions.forEach((suggestion) => {
        if (
            typeof suggestion.entityStart !== "number" ||
            typeof suggestion.entityEnd !== "number"
        ) {
            return;
        }

        let fragments = [
            {
                start: clamp(suggestion.entityStart),
                end: clamp(suggestion.entityEnd),
            },
        ];

        for (const manual of manualRanges) {
            fragments = fragments.flatMap((fragment) => {
                if (manual.end <= fragment.start || manual.start >= fragment.end) {
                    return [fragment];
                }

                const next: Array<{ start: number; end: number }> = [];

                if (fragment.start < manual.start) {
                    next.push({ start: fragment.start, end: manual.start });
                }

                if (manual.end < fragment.end) {
                    next.push({ start: manual.end, end: fragment.end });
                }

                return next;
            });
        }

        fragments.forEach((fragment, index) => {
            if (fragment.end > fragment.start) {
                suggestionFragments.push({
                    start: fragment.start,
                    end: fragment.end,
                    className: "highlight highlight--suggestion",
                    key: `suggestion-${suggestion.id}-${index}`,
                });
            }
        });
    });

    return [...suggestionFragments, ...manualRanges]
        .filter(
            (range) =>
                range.end > range.start && range.start >= 0 && range.end <= text.length
        )
        .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function renderTextSegments(
    text: string,
    suggestions: ReviewFinding[],
    manualSelections: Array<{ id: string; start: number; end: number }>,
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