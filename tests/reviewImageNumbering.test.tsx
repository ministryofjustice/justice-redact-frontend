// @vitest-environment jsdom

import {
    cleanup,
    render,
    screen,
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
    ReviewImage,
    ReviewPageData,
} from "../app/review/types";

afterEach(cleanup);

function makeImage(
    imageId: string,
    imageNumber?: number,
): ReviewImage {
    return {
        imageId,
        imageNumber,
        imageRecordId: null,
        imageUrl: "/preview.png",
        alt: "Document image",
        bbox: {
            x0: 0,
            y0: 0,
            x1: 300,
            y1: 150,
        },
    };
}

function makePage(
    pageNumber: number,
    images: ReviewImage[],
): ReviewPageData {
    return {
        pageNumber,
        images,
        textItems: [],
        tables: [],
    };
}

function renderPage(page: ReviewPageData) {
    return (
        <PageContent
            page={page}
            findings={[]}
            manualSelections={[]}
            isPreviewMode={false}
            onToggleImageRedaction={vi.fn()}
        />
    );
}

describe("document-wide review image numbering", () => {
    it("uses stored image numbers rather than page-local indexes", () => {
        const firstPage = makePage(
            1,
            [
                makeImage("p1-i1", 1),
                makeImage("p1-i2", 2),
            ],
        );

        const laterPage = makePage(
            101,
            [makeImage("p101-i1", 57)],
        );

        const { rerender } = render(
            renderPage(firstPage),
        );

        expect(
            screen.getByRole("heading", {
                name: "Image 1",
                level: 2,
            }),
        ).toBeTruthy();

        expect(
            screen.getByRole("heading", {
                name: "Image 2",
                level: 2,
            }),
        ).toBeTruthy();

        rerender(renderPage(laterPage));

        expect(
            screen.getByRole("heading", {
                name: "Image 57",
                level: 2,
            }),
        ).toBeTruthy();

        expect(
            screen.queryByRole("heading", {
                name: "Image 1",
                level: 2,
            }),
        ).toBeNull();

        rerender(renderPage(firstPage));

        expect(
            screen.getByRole("heading", {
                name: "Image 2",
                level: 2,
            }),
        ).toBeTruthy();
    });

    it("uses the document-wide image number as the accessible image name", () => {
        const page = makePage(
            200,
            [makeImage("p200-i1", 82)],
        );

        const { container } = render(renderPage(page));

        const heading = screen.getByRole("heading", {
            name: "Image 82",
            level: 2,
        });

        const img = container.querySelector("img");

        expect(
            img?.getAttribute("aria-labelledby"),
        ).toBe(heading.id);
    });

    it("does not invent a sequential number when metadata is missing", () => {
        const page = makePage(
            50,
            [makeImage("p50-i1")],
        );

        render(renderPage(page));

        expect(
            screen.getByRole("heading", {
                name: "Image on page 50",
                level: 2,
            }),
        ).toBeTruthy();

        expect(
            screen.queryByRole("heading", {
                name: "Image 1",
                level: 2,
            }),
        ).toBeNull();
    });
});
