import { describe, expect, it, vi } from "vitest";

import {
    buildSelectedTableCellRanges,
} from "../app/review/tableSelectionRanges";

import type {
    ReviewTableCell,
} from "../app/review/types";

function makeCell(
    cellId: string,
    text: string,
    rowIndex: number,
    colIndex: number,
): ReviewTableCell {
    return {
        cellId,
        tableId: "table-1",
        rowIndex,
        colIndex,
        text,
        renderText: text,
        bbox: null,
        isHeader: false,
        isNumeric: false,
    };
}

describe("Table selection ranges", () => {
    it("converts a selection inside one cell into exact source offsets", () => {
        const cell = makeCell(
            "cell-1",
            "the cat",
            0,
            0,
        );

        const result = buildSelectedTableCellRanges(
            [cell],
            "cell-1",
            "cell-1",
            () => 2,
            () => 5,
        );

        expect(result).toEqual([
            {
                cell,
                start: 2,
                end: 5,
            },
        ]);
    });

    it("includes intermediate cells and applies offsets only at the boundaries", () => {
        const first = makeCell(
            "first",
            "abcdef",
            0,
            0,
        );

        const middle = makeCell(
            "middle",
            "hello",
            0,
            1,
        );

        const last = makeCell(
            "last",
            "uvwxyz",
            1,
            0,
        );

        const result = buildSelectedTableCellRanges(
            [last, first, middle],
            "first",
            "last",
            () => 2,
            () => 3,
        );

        expect(result).toEqual([
            {
                cell: first,
                start: 2,
                end: 6,
            },
            {
                cell: middle,
                start: 0,
                end: 5,
            },
            {
                cell: last,
                start: 0,
                end: 3,
            },
        ]);
    });

    it("normalises reversed offsets within the same cell", () => {
        const cell = makeCell(
            "cell-1",
            "the cat",
            0,
            0,
        );

        const result = buildSelectedTableCellRanges(
            [cell],
            "cell-1",
            "cell-1",
            () => 5,
            () => 2,
        );

        expect(result).toMatchObject([
            {
                start: 2,
                end: 5,
            },
        ]);
    });

    it("clamps offsets to source text boundaries", () => {
        const cell = makeCell(
            "cell-1",
            "hello",
            0,
            0,
        );

        const result = buildSelectedTableCellRanges(
            [cell],
            "cell-1",
            "cell-1",
            () => -10,
            () => 100,
        );

        expect(result).toMatchObject([
            {
                start: 0,
                end: 5,
            },
        ]);
    });

    it("ignores whitespace-only cells without removing valid neighbouring cells", () => {
        const first = makeCell(
            "first",
            "hello",
            0,
            0,
        );

        const whitespace = makeCell(
            "space",
            "   ",
            0,
            1,
        );

        const last = makeCell(
            "last",
            "world",
            0,
            2,
        );

        const result = buildSelectedTableCellRanges(
            [first, whitespace, last],
            "first",
            "last",
            () => 1,
            () => 3,
        );

        expect(result).toEqual([
            {
                cell: first,
                start: 1,
                end: 5,
            },
            {
                cell: last,
                start: 0,
                end: 3,
            },
        ]);
    });

    it("returns null for unknown boundary cells without accessing DOM offsets", () => {
        const cell = makeCell(
            "existing",
            "hello",
            0,
            0,
        );

        const getStartOffset = vi.fn(() => 1);
        const getEndOffset = vi.fn(() => 3);

        const result = buildSelectedTableCellRanges(
            [cell],
            "missing",
            "existing",
            getStartOffset,
            getEndOffset,
        );

        expect(result).toBeNull();
        expect(getStartOffset).not.toHaveBeenCalled();
        expect(getEndOffset).not.toHaveBeenCalled();
    });

    it("does not mutate the original cell ordering", () => {
        const first = makeCell(
            "first",
            "hello",
            0,
            0,
        );

        const second = makeCell(
            "second",
            "world",
            0,
            1,
        );

        const cells = [second, first];

        buildSelectedTableCellRanges(
            cells,
            "first",
            "second",
            () => 1,
            () => 3,
        );

        expect(cells).toEqual([second, first]);
    });
});
