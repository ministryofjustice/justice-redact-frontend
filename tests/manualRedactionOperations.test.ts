import { describe, expect, it } from "vitest";

import { addManualTextSelections } from "../features/documents/review/manualRedactionOperations";
import type {
  ManualDecision,
  ManualSpan,
  ManualTextDecision,
  ReviewPageData,
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
