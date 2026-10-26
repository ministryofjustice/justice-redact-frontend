// @vitest-environment jsdom

import {
    cleanup,
    render,
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
    ManualTextDecision,
    ReviewPageData,
} from "../app/review/types";

afterEach(() => {
    cleanup();
});

describe("PageContent accessibility", () => {
    it("renders one coherent accessible copy separately from the visual PDF text", () => {
        const page: ReviewPageData = {
            pageNumber: 1,
            textItems: [
                {
                    itemId: "item-1",
                    text: "The prisoner is\nMARCUS",
                    renderText: "The prisoner is\nMARCUS",
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 100,
                        y1: 20,
                    },
                },
            ],
            tables: [],
            images: [],
        };

        const manualSelections: ManualTextDecision[] = [
            {
                id: "manual-1",
                documentId: "document-1",
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start: 16,
                end: 22,
                text: "MARCUS",
                redactionGroupId: "group-1",
            },
        ];

        const { container } = render(
            <PageContent
                page={page}
                findings={[]}
                manualSelections={manualSelections}
                isPreviewMode={false}
                onToggleImageRedaction={vi.fn()}
            />
        );

        const accessibleText =
            container.querySelector(
                ".jr-review-block p > .govuk-visually-hidden"
            );

        expect(accessibleText?.textContent).toBe(
            "The prisoner is Redaction start MARCUS Redaction end"
        );

        expect(
            accessibleText?.hasAttribute(
                "data-selection-offset-ignore"
            )
        ).toBe(true);

        const visualText =
            container.querySelector(
                '.jr-review-block p > span[aria-hidden="true"]'
            );

        expect(visualText?.textContent).toContain(
            "The prisoner is"
        );

        expect(visualText?.textContent).toContain(
            "MARCUS"
        );
    });

    it("announces one redaction boundary pair when a redaction spans multiple text items", () => {
        const page: ReviewPageData = {
            pageNumber: 1,
            textItems: [
                {
                    itemId: "item-1",
                    text: "MARCUS",
                    renderText: "MARCUS",
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 100,
                        y1: 20,
                    },
                },
                {
                    itemId: "item-2",
                    text: "THOMPSON",
                    renderText: "THOMPSON",
                    bbox: {
                        x0: 0,
                        y0: 30,
                        x1: 100,
                        y1: 50,
                    },
                },
            ],
            tables: [],
            images: [],
        };

        const manualSelections: ManualTextDecision[] = [
            {
                id: "manual-1",
                documentId: "document-1",
                kind: "text",
                pageNumber: 1,
                itemId: "item-1",
                start: 0,
                end: 6,
                text: "MARCUS",
                redactionGroupId: "group-1",
            },
            {
                id: "manual-2",
                documentId: "document-1",
                kind: "text",
                pageNumber: 1,
                itemId: "item-2",
                start: 0,
                end: 8,
                text: "THOMPSON",
                redactionGroupId: "group-1",
            },
        ];

        const { container } = render(
            <PageContent
                page={page}
                findings={[]}
                manualSelections={manualSelections}
                isPreviewMode={false}
                onToggleImageRedaction={vi.fn()}
            />
        );

        const accessibleText = Array.from(
            container.querySelectorAll(
                ".jr-review-block p > .govuk-visually-hidden"
            )
        ).map((element) => element.textContent);

        expect(accessibleText).toEqual([
            "Redaction start MARCUS",
            "THOMPSON Redaction end",
        ]);
    });

    it("announces one redaction boundary pair when a redaction spans multiple table cells", () => {
        const page: ReviewPageData = {
            pageNumber: 1,
            textItems: [],
            tables: [
                {
                    tableId: "table-1",
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 200,
                        y1: 50,
                    },
                    rows: [
                        {
                            rowIndex: 0,
                            cells: [
                                {
                                    cellId: "cell-1",
                                    tableId: "table-1",
                                    rowIndex: 0,
                                    colIndex: 0,
                                    text: "MARCUS",
                                    renderText: "MARCUS",
                                    bbox: {
                                        x0: 0,
                                        y0: 0,
                                        x1: 100,
                                        y1: 20,
                                    },
                                    isHeader: false,
                                    isNumeric: false,
                                },
                                {
                                    cellId: "cell-2",
                                    tableId: "table-1",
                                    rowIndex: 0,
                                    colIndex: 1,
                                    text: "THOMPSON",
                                    renderText: "THOMPSON",
                                    bbox: {
                                        x0: 100,
                                        y0: 0,
                                        x1: 200,
                                        y1: 20,
                                    },
                                    isHeader: false,
                                    isNumeric: false,
                                },
                            ],
                        },
                    ],
                },
            ],
            images: [],
        };

        const manualSelections = [
            {
                id: "manual-1",
                documentId: "document-1",
                kind: "table_cell" as const,
                pageNumber: 1,
                tableId: "table-1",
                cellId: "cell-1",
                start: 0,
                end: 6,
                text: "MARCUS",
                redactionGroupId: "group-1",
            },
            {
                id: "manual-2",
                documentId: "document-1",
                kind: "table_cell" as const,
                pageNumber: 1,
                tableId: "table-1",
                cellId: "cell-2",
                start: 0,
                end: 8,
                text: "THOMPSON",
                redactionGroupId: "group-1",
            },
        ];

        const { container } = render(
            <PageContent
                page={page}
                findings={[]}
                manualSelections={manualSelections}
                isPreviewMode={false}
                onToggleImageRedaction={vi.fn()}
            />
        );

        const accessibleText = Array.from(
            container.querySelectorAll(
                ".jr-table-cell-text > .govuk-visually-hidden"
            )
        ).map((element) => element.textContent);

        expect(accessibleText).toEqual([
            "Redaction start MARCUS",
            "THOMPSON Redaction end",
        ]);
    });

    it("does not announce the end of a grouped redaction when it continues onto a later page", () => {
        const page: ReviewPageData = {
            pageNumber: 1,
            textItems: [
                {
                    itemId: "item-1",
                    text: "MARCUS",
                    renderText: "MARCUS",
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 100,
                        y1: 20,
                    },
                },
            ],
            tables: [],
            images: [],
        };

        const currentPageSelection: ManualTextDecision = {
            id: "manual-1",
            documentId: "document-1",
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 0,
            end: 6,
            text: "MARCUS",
            redactionGroupId: "group-1",
        };

        const laterPageSelection: ManualTextDecision = {
            id: "manual-2",
            documentId: "document-1",
            kind: "text",
            pageNumber: 2,
            itemId: "item-2",
            start: 0,
            end: 8,
            text: "THOMPSON",
            redactionGroupId: "group-1",
        };

        const { container } = render(
            <PageContent
                page={page}
                findings={[]}
                manualSelections={[
                    currentPageSelection,
                ]}
                documentManualSelections={[
                    currentPageSelection,
                    laterPageSelection,
                ]}
                isPreviewMode={false}
                onToggleImageRedaction={vi.fn()}
            />
        );

        expect(
            container.querySelector(
                ".jr-review-block p > .govuk-visually-hidden"
            )?.textContent
        ).toBe(
            "Redaction start MARCUS"
        );
    });

    it("does not announce the start of a grouped redaction when it began on an earlier page", () => {
        const page: ReviewPageData = {
            pageNumber: 2,
            textItems: [
                {
                    itemId: "item-2",
                    text: "THOMPSON",
                    renderText: "THOMPSON",
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 100,
                        y1: 20,
                    },
                },
            ],
            tables: [],
            images: [],
        };

        const earlierPageSelection: ManualTextDecision = {
            id: "manual-1",
            documentId: "document-1",
            kind: "text",
            pageNumber: 1,
            itemId: "item-1",
            start: 0,
            end: 6,
            text: "MARCUS",
            redactionGroupId: "group-1",
        };

        const currentPageSelection: ManualTextDecision = {
            id: "manual-2",
            documentId: "document-1",
            kind: "text",
            pageNumber: 2,
            itemId: "item-2",
            start: 0,
            end: 8,
            text: "THOMPSON",
            redactionGroupId: "group-1",
        };

        const { container } = render(
            <PageContent
                page={page}
                findings={[]}
                manualSelections={[
                    currentPageSelection,
                ]}
                documentManualSelections={[
                    earlierPageSelection,
                    currentPageSelection,
                ]}
                isPreviewMode={false}
                onToggleImageRedaction={vi.fn()}
            />
        );

        expect(
            container.querySelector(
                ".jr-review-block p > .govuk-visually-hidden"
            )?.textContent
        ).toBe(
            "THOMPSON Redaction end"
        );
    });
});