import { describe, expect, it } from "vitest";

import { removeManualSelectionsWithinRanges } from "../features/documents/review/findRedactionOperations";

import type { ContentRange } from "../app/review/contentRangeUtils";
import type {
  ManualDecision,
  ManualTextDecision,
  ManualTableCellDecision,
} from "../app/review/types";

const DOCUMENT_ID = "test-document";

function textRange(
  start: number,
  end: number,
  itemId = "item-1",
  pageNumber = 1,
): ContentRange {
  return {
    kind: "text",
    pageNumber,
    itemId,
    tableId: null,
    cellId: null,
    start,
    end,
  };
}

function tableRange(
  start: number,
  end: number,
  cellId = "cell-1",
  tableId = "table-1",
): ContentRange {
  return {
    kind: "table_cell",
    pageNumber: 1,
    itemId: null,
    tableId,
    cellId,
    start,
    end,
  };
}

function createIds() {
  let next = 0;
  return () => `generated-${++next}`;
}

const originalText: ManualTextDecision = {
  id: "original-text",
  documentId: DOCUMENT_ID,
  kind: "text",
  pageNumber: 1,
  itemId: "item-1",
  start: 0,
  end: 7,
  text: "the cat",
  redactionGroupId: "original-group",
};

const originalTable: ManualTableCellDecision = {
  id: "original-table",
  documentId: DOCUMENT_ID,
  kind: "table_cell",
  pageNumber: 1,
  tableId: "table-1",
  cellId: "cell-1",
  start: 0,
  end: 7,
  text: "the cat",
  redactionGroupId: "table-group",
};

function remove(
  previous: ManualDecision[],
  ranges: ContentRange[],
): ManualDecision[] {
  return removeManualSelectionsWithinRanges(
    previous,
    ranges,
    createIds(),
  );
}

describe("removeManualSelectionsWithinRanges", () => {
  it("preserves an untouched redaction and its original ID", () => {
    const result = remove(
      [originalText],
      [textRange(0, 7, "different-item")],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(originalText);
  });

  it("removes an entirely covered redaction", () => {
    expect(
      remove([originalText], [textRange(0, 7)]),
    ).toEqual([]);
  });

  it("preserves the uncovered end of a redaction", () => {
    const result = remove(
      [originalText],
      [textRange(0, 5)],
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "generated-1",
        kind: "text",
        itemId: "item-1",
        start: 5,
        end: 7,
        text: "at",
      }),
    ]);
  });

  it("preserves the uncovered beginning of a redaction", () => {
    const result = remove(
      [originalText],
      [textRange(5, 7)],
    );

    expect(result).toEqual([
      expect.objectContaining({
        kind: "text",
        start: 0,
        end: 5,
        text: "the c",
      }),
    ]);
  });

  it("splits a redaction into separate non-overlapping fragments", () => {
    const result = remove(
      [originalText],
      [textRange(2, 5)],
    );

    expect(
      result.map((decision) => ({
        id: decision.id,
        start: decision.kind === "image"
          ? null
          : decision.start,
        end: decision.kind === "image"
          ? null
          : decision.end,
        text: decision.kind === "image"
          ? null
          : decision.text,
      })),
    ).toEqual([
      {
        id: "generated-1",
        start: 0,
        end: 2,
        text: "th",
      },
      {
        id: "generated-2",
        start: 5,
        end: 7,
        text: "at",
      },
    ]);
  });

  it("handles overlapping removal ranges without duplicating fragments", () => {
    const selection: ManualTextDecision = {
      ...originalText,
      end: 10,
      text: "abcdefghij",
    };

    const result = remove(
      [selection],
      [
        textRange(2, 6),
        textRange(4, 8),
      ],
    );

    expect(result).toMatchObject([
      { start: 0, end: 2, text: "ab" },
      { start: 8, end: 10, text: "ij" },
    ]);
  });

  it("handles partial replacement inside a table cell", () => {
    const result = remove(
      [originalTable],
      [tableRange(2, 5)],
    );

    expect(result).toMatchObject([
      {
        kind: "table_cell",
        tableId: "table-1",
        cellId: "cell-1",
        start: 0,
        end: 2,
        text: "th",
      },
      {
        kind: "table_cell",
        tableId: "table-1",
        cellId: "cell-1",
        start: 5,
        end: 7,
        text: "at",
      },
    ]);
  });

  it("keeps unrelated table cells independent", () => {
    const result = remove(
      [originalTable],
      [tableRange(0, 7, "cell-2")],
    );

    expect(result[0]).toBe(originalTable);
  });

  it("preserves image redactions", () => {
    const image: ManualDecision = {
      id: "image-1",
      documentId: DOCUMENT_ID,
      kind: "image",
      pageNumber: 1,
      imageId: "image-1",
    };

    const result = remove(
      [originalText, image],
      [textRange(0, 7)],
    );

    expect(result).toEqual([image]);
    expect(result[0]).toBe(image);
  });

  it("does not mutate existing decisions or requested ranges", () => {
    const previous = [originalText];
    const ranges = [textRange(2, 5)];

    const previousSnapshot = structuredClone(previous);
    const rangesSnapshot = structuredClone(ranges);

    remove(previous, ranges);

    expect(previous).toEqual(previousSnapshot);
    expect(ranges).toEqual(rangesSnapshot);
  });
});
