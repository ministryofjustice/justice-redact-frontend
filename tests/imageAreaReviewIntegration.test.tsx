// @vitest-environment jsdom

import { useState } from "react";
import {
    cleanup,
    fireEvent,
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
    ManualDecision,
    ReviewPageData,
} from "../app/review/types";

afterEach(cleanup);

const page: ReviewPageData = {
    pageNumber: 3,
    textItems: [],
    tables: [],
    images: [
        {
            imageId: "image-3",
            imageRecordId: null,
            imageUrl: "/preview.png",
            alt: "Document image",
            bbox: {
                x0: 0,
                y0: 0,
                x1: 300,
                y1: 150,
            },
        },
    ],
};

function ReviewHarness() {
    const [selections, setSelections] =
        useState<ManualDecision[]>([]);

    return (
        <PageContent
            page={page}
            findings={[]}
            manualSelections={selections}
            isPreviewMode={false}
            isRedactMode={true}
            onToggleImageRedaction={vi.fn()}
            onAddImageArea={(pageNumber, imageId, rect) => {
                setSelections(previous => [
                    ...previous,
                    {
                        id: "area-1",
                        documentId: "document-1",
                        kind: "image_area",
                        pageNumber,
                        imageId,
                        areaId: "area-1",
                        rect,
                    },
                ]);
            }}
            onRemoveImageArea={(pageNumber, imageId, areaId) => {
                setSelections(previous =>
                    previous.filter(
                        selection =>
                            !(
                                selection.kind === "image_area" &&
                                selection.pageNumber === pageNumber &&
                                selection.imageId === imageId &&
                                selection.areaId === areaId
                            ),
                    ),
                );
            }}
        />
    );
}

describe("PageContent image-area integration", () => {
    it("adds and removes an area through the shared review decisions", () => {
        const { container } = render(<ReviewHarness />);

        const surface = screen.getByRole("button", {
            name: /draw a redaction area/i,
        });

        Object.defineProperty(
            surface,
            "getBoundingClientRect",
            {
                configurable: true,
                value: () => ({
                    left: 0,
                    top: 0,
                    width: 400,
                    height: 200,
                    right: 400,
                    bottom: 200,
                }),
            },
        );

        fireEvent.keyDown(surface, { key: "Enter" });
        fireEvent.keyDown(surface, { key: "ArrowRight" });
        fireEvent.keyDown(surface, { key: "ArrowDown" });
        fireEvent.keyDown(surface, { key: "Enter" });

        expect(
            container.querySelectorAll(
                ".jr-review-image-area-overlay rect",
            ),
        ).toHaveLength(1);

        fireEvent.click(
            screen.getByRole("button", {
                name: /remove area 1 from image 1 on page 3/i,
            }),
        );

        expect(
            container.querySelectorAll(
                ".jr-review-image-area-overlay rect",
            ),
        ).toHaveLength(0);
    });
});
