// @vitest-environment jsdom

import {
    cleanup,
    render,
    screen,
    within,
} from "@testing-library/react";

import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import PageContent from "../app/review/components/PageContent";

import type {
    ManualDecision,
    ReviewBBox,
    ReviewImage,
    ReviewPageData,
    ReviewTable,
} from "../app/review/types";

afterEach(cleanup);

function bbox(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
): ReviewBBox {
    return { x0, y0, x1, y1 };
}

function makeImage(
    number: number,
    bounds: ReviewBBox | null,
): ReviewImage {
    return {
        imageId: `image-${number}`,
        imageNumber: number,
        imageRecordId: null,
        imageUrl: `/image-${number}.png`,
        alt: "Document image",
        bbox: bounds,
    };
}

function makeTable(
    tableId = "table-1",
    xOffset = 0,
): ReviewTable {
    return {
        tableId,
        bbox: bbox(xOffset, 0, xOffset + 200, 60),
        rows: [
            { rowIndex: 0, y0: 0, y1: 30 },
            { rowIndex: 1, y0: 30, y1: 60 },
        ].map(({ rowIndex, y0, y1 }) => ({
            rowIndex,
            cells: [
                {
                    cellId: `${tableId}-cell-${rowIndex}`,
                    tableId,
                    rowIndex,
                    colIndex: 0,
                    text: `Row ${rowIndex + 1}`,
                    renderText: `Row ${rowIndex + 1}`,
                    bbox: bbox(
                        xOffset,
                        y0,
                        xOffset + 200,
                        y1,
                    ),
                    isHeader: false,
                    isNumeric: false,
                },
            ],
        })),
    };
}

function renderPage(
    images: ReviewImage[],
    tables = [makeTable()],
    manualSelections: ManualDecision[] = [],
) {
    const page: ReviewPageData = {
        pageNumber: 1,
        textItems: [],
        tables,
        images,
    };

    return render(
        <PageContent
            page={page}
            findings={[]}
            manualSelections={manualSelections}
            isPreviewMode={false}
            isRedactMode={true}
            onToggleImageRedaction={vi.fn()}
            onAddImageArea={vi.fn()}
            onRemoveImageArea={vi.fn()}
        />,
    );
}

function imageHeading(number: number) {
    return screen.getByRole("heading", {
        name: `Image ${number}`,
        level: 2,
    });
}

describe("Table image rendering completeness", () => {
    it("renders multiple images assigned to the same table row", () => {
        const { container } = renderPage([
            makeImage(4, bbox(10, 2, 70, 25)),
            makeImage(5, bbox(80, 2, 150, 25)),
        ]);

        const firstRow = screen.getAllByRole("row")[0];

        expect(
            within(firstRow).getByRole("heading", {
                name: "Image 4",
            }),
        ).toBeTruthy();

        expect(
            within(firstRow).getByRole("heading", {
                name: "Image 5",
            }),
        ).toBeTruthy();

        expect(
            container.querySelectorAll(
                ".jr-review-image-panel",
            ),
        ).toHaveLength(2);
    });

    it("renders an image overlapping multiple rows only once", () => {
        const { container } = renderPage([
            makeImage(6, bbox(10, 5, 150, 45)),
        ]);

        const rows = screen.getAllByRole("row");

        expect(rows[0].contains(imageHeading(6))).toBe(true);
        expect(rows[1].contains(imageHeading(6))).toBe(false);

        expect(
            container.querySelectorAll(
                ".jr-review-image-panel",
            ),
        ).toHaveLength(1);
    });

    it("renders an image overlapping multiple tables only once", () => {
        const { container } = renderPage(
            [
                makeImage(7, bbox(310, 2, 390, 25)),
            ],
            [
                makeTable("table-left", 0),
                makeTable("table-right", 300),
            ],
        );

        const tables = screen.getAllByRole("table");

        expect(tables[0].contains(imageHeading(7))).toBe(false);
        expect(tables[1].contains(imageHeading(7))).toBe(true);

        expect(
            container.querySelectorAll(
                ".jr-review-image-panel",
            ),
        ).toHaveLength(1);
    });

    it("preserves images that do not overlap any table row", () => {
        const { container } = renderPage([
            makeImage(8, bbox(10, 100, 150, 160)),
            makeImage(9, bbox(10, 2, 150, 25)),
        ]);

        const table = screen.getByRole("table");

        expect(table.contains(imageHeading(8))).toBe(false);
        expect(table.contains(imageHeading(9))).toBe(true);

        expect(
            container.querySelectorAll(
                ".jr-review-image-panel",
            ),
        ).toHaveLength(2);
    });

    it("preserves an image with missing bounding-box metadata", () => {
        renderPage([
            makeImage(10, null),
        ]);

        expect(imageHeading(10)).toBeTruthy();

        expect(
            screen.getByRole("table").contains(
                imageHeading(10),
            ),
        ).toBe(false);
    });

    it("maintains a consistent image column across table rows", () => {
        renderPage([
            makeImage(11, bbox(10, 35, 150, 55)),
        ]);

        const rows = screen.getAllByRole("row");

        expect(rows[0].children.length).toBe(2);
        expect(rows[1].children.length).toBe(2);

        expect(rows[0].contains(imageHeading(11))).toBe(false);
        expect(rows[1].contains(imageHeading(11))).toBe(true);
    });

    it("does not create an additional column for tables without images", () => {
        renderPage([]);

        const rows = screen.getAllByRole("row");

        expect(rows[0].children.length).toBe(1);
        expect(rows[1].children.length).toBe(1);
    });

    it("preserves separate redaction decisions for images in the same row", () => {
        renderPage(
            [
                makeImage(12, bbox(10, 2, 70, 25)),
                makeImage(13, bbox(80, 2, 150, 25)),
            ],
            [makeTable()],
            [
                {
                    id: "area-1",
                    areaId: "area-1",
                    documentId: "document-1",
                    kind: "image_area",
                    pageNumber: 1,
                    imageId: "image-12",
                    rect: {
                        x0: 0.1,
                        y0: 0.1,
                        x1: 0.5,
                        y1: 0.5,
                    },
                },
                {
                    id: "whole-image-13",
                    documentId: "document-1",
                    kind: "image",
                    pageNumber: 1,
                    imageId: "image-13",
                },
            ],
        );

        const firstPanel = imageHeading(12).closest(
            ".jr-review-image-panel",
        ) as HTMLElement;

        const secondPanel = imageHeading(13).closest(
            ".jr-review-image-panel",
        ) as HTMLElement;

        expect(
            within(firstPanel).getByRole("button", {
                name: "Redaction area 1",
            }),
        ).toBeTruthy();

        expect(
            firstPanel.querySelector(".jr-image-area--whole"),
        ).toBeNull();

        expect(
            secondPanel.querySelector(".jr-image-area--whole"),
        ).not.toBeNull();

        expect(
            within(secondPanel).queryByRole("button", {
                name: "Redaction area 1",
            }),
        ).toBeNull();
    });
});
