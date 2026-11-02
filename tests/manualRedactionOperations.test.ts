import { describe, expect, it } from "vitest";

import {
  addManualTableSelections,
  addManualTextSelections,
} from "../features/documents/review/manualRedactionOperations";
import type {
  ManualDecision,
  ManualSpan,
  ManualTextDecision,
  ReviewPageData,
  ReviewTableCell,
} from "../app/review/types";

const DOCUMENT_ID = "test-document";

const page: ReviewPageData = {
  pageNumber: 1,
  textItems: [
    {
      itemId: "item-1",
      text: "the cat",
      renderText: "the cat",
      bbox: null,
    },
    {
      itemId: "item-2",
      text: "hello world",
      renderText: "hello world",
      bbox: null,
    },
  ],
  tables: [],
  images: [],
};

function span(
  start: number,
  end: number,
  itemId = "item-1",
): ManualSpan {
  return {
    pageNumber: 1,
    itemId,
    start,
    end,
  };
}

function createIds() {
  let next = 0;
  return () => `generated-${++next}`;
}

function add(
  previous: ManualDecision[],
  spans: ManualSpan[],
  createId = createIds(),
  groupId = "new-group",
): ManualDecision[] {
  return addManualTextSelections(
    previous,
    page,
    spans,
    DOCUMENT_ID,
    groupId,
    createId,
  );
}

function textDecisions(
  decisions: ManualDecision[],
): ManualTextDecision[] {
  return decisions.filter(
    (decision): decision is ManualTextDecision =>
      decision.kind === "text",
  );
}

const existingDecision: ManualTextDecision = {
  id: "existing-1",
  documentId: DOCUMENT_ID,
  kind: "text",
  pageNumber: 1,
  itemId: "item-1",
  start: 0,
  end: 5,
  text: "the c",
  redactionGroupId: "existing-group",
};

describe("addManualTextSelections", () => {
  it("adds only the uncovered part of an overlapping selection", () => {
    const result = add(
      [existingDecision],
      [span(2, 7)],
    );

    expect(result).toEqual([
      existingDecision,
      {
        id: "generated-1",
        documentId: DOCUMENT_ID,
        kind: "text",
        pageNumber: 1,
        itemId: "item-1",
        start: 5,
        end: 7,
        text: "at",
        redactionGroupId: "new-group",
      },
    ]);
  });

  it("prevents overlap between spans submitted in one action", () => {
    const result = textDecisions(
      add(
        [],
        [
          span(0, 5),
          span(2, 7),
        ],
      ),
    );

    expect(
      result.map(({ id, start, end, text }) => ({
        id,
        start,
        end,
        text,
      })),
    ).toEqual([
      {
        id: "generated-1",
        start: 0,
        end: 5,
        text: "the c",
      },
      {
        id: "generated-2",
        start: 5,
        end: 7,
        text: "at",
      },
    ]);

    expect(
      result.every(
        (decision) =>
          decision.redactionGroupId === "new-group",
      ),
    ).toBe(true);
  });

  it("handles overlapping spans supplied in reverse order", () => {
    const result = textDecisions(
      add(
        [],
        [
          span(2, 7),
          span(0, 5),
        ],
      ),
    );

    expect(
      result.map(({ start, end, text }) => ({
        start,
        end,
        text,
      })),
    ).toEqual([
      {
        start: 2,
        end: 7,
        text: "e cat",
      },
      {
        start: 0,
        end: 2,
        text: "th",
      },
    ]);
  });

  it("does not duplicate identical spans submitted together", () => {
    const result = add(
      [],
      [
        span(0, 5),
        span(0, 5),
      ],
    );

    expect(result).toHaveLength(1);

    expect(textDecisions(result)[0]).toMatchObject({
      start: 0,
      end: 5,
      text: "the c",
    });
  });

  it("keeps adjacent redactions as separate decisions and groups", () => {
    const createId = createIds();

    const first = add(
      [],
      [span(0, 5)],
      createId,
      "group-one",
    );

    const second = add(
      first,
      [span(5, 7)],
      createId,
      "group-two",
    );

    expect(
      textDecisions(second).map(
        ({ id, start, end, redactionGroupId }) => ({
          id,
          start,
          end,
          redactionGroupId,
        }),
      ),
    ).toEqual([
      {
        id: "generated-1",
        start: 0,
        end: 5,
        redactionGroupId: "group-one",
      },
      {
        id: "generated-2",
        start: 5,
        end: 7,
        redactionGroupId: "group-two",
      },
    ]);
  });

  it("keeps different text items independent", () => {
    const result = add(
      [existingDecision],
      [span(0, 5, "item-2")],
    );

    expect(result).toHaveLength(2);

    expect(textDecisions(result)[1]).toMatchObject({
      itemId: "item-2",
      start: 0,
      end: 5,
      text: "hello",
    });
  });

  it("returns the previous array when the selection is fully covered", () => {
    const previous = [existingDecision];

    const result = add(
      previous,
      [span(1, 4)],
    );

    expect(result).toBe(previous);
  });

  it("ignores whitespace-only and missing text items", () => {
    const previous: ManualDecision[] = [];

    const result = add(
      previous,
      [
        span(3, 4),
        span(0, 5, "missing-item"),
      ],
    );

    expect(result).toBe(previous);
  });

  it("clamps selection offsets to the original source text", () => {
    const result = add(
      [],
      [span(-10, 100)],
    );

    expect(textDecisions(result)[0]).toMatchObject({
      start: 0,
      end: 7,
      text: "the cat",
    });
  });

  it("preserves unrelated image decisions", () => {
    const image: ManualDecision = {
      id: "image-1",
      documentId: DOCUMENT_ID,
      kind: "image",
      pageNumber: 1,
      imageId: "page-image",
    };

    const result = add(
      [image],
      [span(0, 5)],
    );

    expect(result[0]).toBe(image);
    expect(result).toHaveLength(2);
  });

  it("does not mutate previously existing decisions", () => {
    const previous = [existingDecision];

    const original = structuredClone(previous);

    const result = add(
      previous,
      [span(2, 7)],
    );

    expect(previous).toEqual(original);
    expect(result).not.toBe(previous);
    expect(result[0]).toBe(existingDecision);
  });
});


const tableCellOne: ReviewTableCell = {
  cellId: "cell-1",
  tableId: "table-1",
  rowIndex: 0,
  colIndex: 0,
  text: "the cat",
  renderText: "the cat",
  bbox: null,
  isHeader: false,
  isNumeric: false,
};

const tableCellTwo: ReviewTableCell = {
  ...tableCellOne,
  cellId: "cell-2",
  colIndex: 1,
  text: "hello world",
  renderText: "hello world",
};

const pageWithTable: ReviewPageData = {
  ...page,
  tables: [
    {
      tableId: "table-1",
      bbox: null,
      rows: [
        {
          rowIndex: 0,
          cells: [tableCellOne, tableCellTwo],
        },
      ],
    },
  ],
};

type RequestedTableRange = {
  cell: ReviewTableCell;
  start: number;
  end: number;
};

function addTable(
  previous: ManualDecision[],
  ranges: RequestedTableRange[],
  createId = createIds(),
  groupId = "new-table-group",
): ManualDecision[] {
  return addManualTableSelections(
    previous,
    1,
    "table-1",
    ranges,
    [pageWithTable],
    DOCUMENT_ID,
    groupId,
    createId,
  );
}

function tableDecisions(decisions: ManualDecision[]) {
  return decisions.filter(
    (
      decision,
    ): decision is Extract<
      ManualDecision,
      { kind: "table_cell" }
    > => decision.kind === "table_cell",
  );
}

describe("addManualTableSelections", () => {
  const existingTableDecision: ManualDecision = {
    id: "existing-table-1",
    documentId: DOCUMENT_ID,
    kind: "table_cell",
    pageNumber: 1,
    tableId: "table-1",
    cellId: "cell-1",
    start: 0,
    end: 5,
    text: "the c",
    redactionGroupId: "existing-group",
  };

  it("adds only uncovered characters in the same table cell", () => {
    const result = addTable(
      [existingTableDecision],
      [{ cell: tableCellOne, start: 2, end: 7 }],
    );

    expect(result).toEqual([
      existingTableDecision,
      {
        id: "generated-1",
        documentId: DOCUMENT_ID,
        kind: "table_cell",
        pageNumber: 1,
        tableId: "table-1",
        cellId: "cell-1",
        start: 5,
        end: 7,
        text: "at",
        redactionGroupId: "new-table-group",
      },
    ]);
  });

  it("prevents overlap between table spans in the same action", () => {
    const result = tableDecisions(
      addTable([], [
        { cell: tableCellOne, start: 0, end: 5 },
        { cell: tableCellOne, start: 2, end: 7 },
      ]),
    );

    expect(
      result.map(
        ({ id, start, end, text, redactionGroupId }) => ({
          id,
          start,
          end,
          text,
          redactionGroupId,
        }),
      ),
    ).toEqual([
      {
        id: "generated-1",
        start: 0,
        end: 5,
        text: "the c",
        redactionGroupId: "new-table-group",
      },
      {
        id: "generated-2",
        start: 5,
        end: 7,
        text: "at",
        redactionGroupId: "new-table-group",
      },
    ]);
  });

  it("does not create duplicate decisions for identical ranges", () => {
    const result = addTable([], [
      { cell: tableCellOne, start: 0, end: 5 },
      { cell: tableCellOne, start: 0, end: 5 },
    ]);

    expect(tableDecisions(result)).toHaveLength(1);
  });

  it("keeps different table cells independent", () => {
    const result = addTable(
      [existingTableDecision],
      [{ cell: tableCellTwo, start: 0, end: 5 }],
    );

    expect(result).toHaveLength(2);

    expect(tableDecisions(result)[1]).toMatchObject({
      cellId: "cell-2",
      start: 0,
      end: 5,
      text: "hello",
    });
  });

  it("keeps adjacent decisions in separate redaction groups", () => {
    const createId = createIds();

    const first = addTable(
      [],
      [{ cell: tableCellOne, start: 0, end: 5 }],
      createId,
      "group-one",
    );

    const second = addTable(
      first,
      [{ cell: tableCellOne, start: 5, end: 7 }],
      createId,
      "group-two",
    );

    expect(
      tableDecisions(second).map(
        ({ id, start, end, redactionGroupId }) => ({
          id,
          start,
          end,
          redactionGroupId,
        }),
      ),
    ).toEqual([
      {
        id: "generated-1",
        start: 0,
        end: 5,
        redactionGroupId: "group-one",
      },
      {
        id: "generated-2",
        start: 5,
        end: 7,
        redactionGroupId: "group-two",
      },
    ]);
  });

  it("does not treat decisions in different tables as overlapping", () => {
    const otherTableDecision: ManualDecision = {
      ...existingTableDecision,
      id: "other-table-decision",
      tableId: "table-2",
    };

    const result = addTable(
      [otherTableDecision],
      [{ cell: tableCellOne, start: 0, end: 5 }],
    );

    expect(result).toHaveLength(2);

    expect(tableDecisions(result)[1]).toMatchObject({
      tableId: "table-1",
      start: 0,
      end: 5,
    });
  });

  it("clamps offsets to the table cell source text", () => {
    const result = addTable(
      [],
      [{ cell: tableCellOne, start: -10, end: 100 }],
    );

    expect(tableDecisions(result)[0]).toMatchObject({
      start: 0,
      end: 7,
      text: "the cat",
    });
  });

  it("ignores whitespace-only ranges and unknown cells", () => {
    const previous: ManualDecision[] = [];

    const result = addTable(previous, [
      { cell: tableCellOne, start: 3, end: 4 },
      {
        cell: {
          ...tableCellOne,
          cellId: "missing-cell",
        },
        start: 0,
        end: 5,
      },
    ]);

    expect(result).toBe(previous);
  });

  it("preserves unrelated image and text decisions", () => {
    const image: ManualDecision = {
      id: "existing-image",
      documentId: DOCUMENT_ID,
      kind: "image",
      pageNumber: 1,
      imageId: "image-1",
    };

    const result = addTable(
      [existingDecision, image],
      [{ cell: tableCellOne, start: 0, end: 5 }],
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(existingDecision);
    expect(result[1]).toBe(image);
  });

  it("preserves the previous array when coverage is unchanged", () => {
    const previous = [existingTableDecision];

    const result = addTable(
      previous,
      [{ cell: tableCellOne, start: 1, end: 4 }],
    );

    expect(result).toBe(previous);
  });

  it("does not mutate previously saved table decisions", () => {
    const previous = [existingTableDecision];
    const snapshot = structuredClone(previous);

    const result = addTable(
      previous,
      [{ cell: tableCellOne, start: 2, end: 7 }],
    );

    expect(previous).toEqual(snapshot);
    expect(result[0]).toBe(existingTableDecision);
  });
});

