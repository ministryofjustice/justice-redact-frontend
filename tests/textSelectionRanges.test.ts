// @vitest-environment jsdom

import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    resolveSelectedTextRanges,
} from "../app/review/textSelectionRanges";

import type {
    ReviewPageData,
} from "../app/review/types";

function makePage(
    pageNumber: number,
    items: Array<{
        itemId: string;
        text: string;
    }>,
): ReviewPageData {
    return {
        pageNumber,
        textItems: items.map((item) => ({
            ...item,
            renderText: item.text,
            bbox: null,
        })),
        tables: [],
        images: [],
    };
}

function mountTextItem(
    pageNumber: number,
    itemId: string,
    text: string,
) {
    const element = document.createElement("div");

    element.className =
        "jr-review-block redactable";

    element.dataset.pageNumber = String(pageNumber);
    element.dataset.itemId = itemId;

    const textNode = document.createTextNode(text);

    element.appendChild(textNode);
    document.body.appendChild(element);

    return {
        element,
        textNode,
    };
}

function makeRange(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
): Range {
    const range = document.createRange();

    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    return range;
}

afterEach(() => {
    document.body.replaceChildren();
});

describe("Text selection ranges", () => {
    it("converts a single-item selection into exact source offsets", () => {
        const { textNode } = mountTextItem(
            1,
            "item-1",
            "the cat",
        );

        const page = makePage(1, [
            {
                itemId: "item-1",
                text: "the cat",
            },
        ]);

        const range = makeRange(
            textNode,
            2,
            textNode,
            5,
        );

        expect(
            resolveSelectedTextRanges(range, [page]),
        ).toEqual({
            kind: "apply",
            page,
            spans: [
                {
                    pageNumber: 1,
                    itemId: "item-1",
                    start: 2,
                    end: 5,
                },
            ],
        });
    });

    it("maps a selection spanning multiple text items on one page", () => {
        const first = mountTextItem(
            1,
            "first",
            "hello",
        );

        const second = mountTextItem(
            1,
            "second",
            "world",
        );

        const page = makePage(1, [
            { itemId: "first", text: "hello" },
            { itemId: "second", text: "world" },
        ]);

        const range = makeRange(
            first.textNode,
            2,
            second.textNode,
            3,
        );

        expect(
            resolveSelectedTextRanges(range, [page]),
        ).toEqual({
            kind: "apply",
            page,
            spans: [
                {
                    pageNumber: 1,
                    itemId: "first",
                    start: 2,
                    end: 5,
                },
                {
                    pageNumber: 1,
                    itemId: "second",
                    start: 0,
                    end: 3,
                },
            ],
        });
    });

    it("rejects text selections spanning multiple pages", () => {
        const first = mountTextItem(
            1,
            "first",
            "hello",
        );

        const second = mountTextItem(
            2,
            "second",
            "world",
        );

        const range = makeRange(
            first.textNode,
            1,
            second.textNode,
            3,
        );

        const result = resolveSelectedTextRanges(
            range,
            [
                makePage(1, [
                    { itemId: "first", text: "hello" },
                ]),
                makePage(2, [
                    { itemId: "second", text: "world" },
                ]),
            ],
        );

        expect(result).toEqual({ kind: "clear" });
    });

    it("rejects a selection whose page is not loaded", () => {
        const { textNode } = mountTextItem(
            3,
            "item-3",
            "hello",
        );

        const range = makeRange(
            textNode,
            0,
            textNode,
            3,
        );

        expect(
            resolveSelectedTextRanges(range, [
                makePage(1, [
                    { itemId: "item-1", text: "hello" },
                ]),
            ]),
        ).toEqual({ kind: "clear" });
    });

    it("ignores whitespace-only new text selections", () => {
        const { textNode } = mountTextItem(
            1,
            "item-1",
            "   ",
        );

        const page = makePage(1, [
            { itemId: "item-1", text: "   " },
        ]);

        const range = makeRange(
            textNode,
            0,
            textNode,
            3,
        );

        expect(
            resolveSelectedTextRanges(range, [page]),
        ).toEqual({ kind: "ignore" });
    });

    it("ignores selections outside redactable text", () => {
        mountTextItem(1, "item-1", "hello");

        const outside = document.createElement("p");
        const outsideText =
            document.createTextNode("other text");

        outside.appendChild(outsideText);
        document.body.appendChild(outside);

        const range = makeRange(
            outsideText,
            0,
            outsideText,
            5,
        );

        expect(
            resolveSelectedTextRanges(range, [
                makePage(1, [
                    { itemId: "item-1", text: "hello" },
                ]),
            ]),
        ).toEqual({ kind: "ignore" });
    });

    it("ignores rendered items absent from the page source data", () => {
        const { textNode } = mountTextItem(
            1,
            "missing-item",
            "hello",
        );

        const range = makeRange(
            textNode,
            0,
            textNode,
            3,
        );

        expect(
            resolveSelectedTextRanges(range, [
                makePage(1, [
                    { itemId: "known-item", text: "hello" },
                ]),
            ]),
        ).toEqual({ kind: "ignore" });
    });

    it("excludes ignored UI decoration from source-text offsets", () => {
        const element = document.createElement("div");

        element.className =
            "jr-review-block redactable";

        element.dataset.pageNumber = "1";
        element.dataset.itemId = "item-1";

        const firstText =
            document.createTextNode("hello");

        const ignored = document.createElement("span");
        ignored.dataset.selectionOffsetIgnore = "true";
        ignored.textContent = "COPY";

        const lastText =
            document.createTextNode("world");

        element.append(
            firstText,
            ignored,
            lastText,
        );

        document.body.appendChild(element);

        const page = makePage(1, [
            {
                itemId: "item-1",
                text: "helloworld",
            },
        ]);

        const range = makeRange(
            firstText,
            2,
            lastText,
            3,
        );

        expect(
            resolveSelectedTextRanges(range, [page]),
        ).toEqual({
            kind: "apply",
            page,
            spans: [
                {
                    pageNumber: 1,
                    itemId: "item-1",
                    start: 2,
                    end: 8,
                },
            ],
        });
    });
});
