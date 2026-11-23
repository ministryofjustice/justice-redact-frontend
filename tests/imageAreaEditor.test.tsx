// @vitest-environment jsdom

import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";

import ImageRedactionFrame from "../app/review/components/ImageRedactionFrame";

import type {
    ManualImageAreaDecision,
    ReviewImage,
} from "../app/review/types";

afterEach(() => {
    cleanup();
});

const image: ReviewImage = {
    imageId: "image-1",
    imageRecordId: null,
    imageUrl: "/preview.png",
    alt: "Case image",
    bbox: {
        x0: 0,
        y0: 0,
        x1: 300,
        y1: 150,
    },
};

const firstArea: ManualImageAreaDecision = {
    id: "area-one",
    documentId: "document-1",
    kind: "image_area",
    pageNumber: 1,
    imageId: "image-1",
    areaId: "area-one",
    rect: {
        x0: 0.1,
        y0: 0.2,
        x1: 0.5,
        y1: 0.6,
    },
};

function renderEditor({
    areas = [],
    isPreviewMode = false,
    isRedactMode = true,
    isManuallyRedacted = false,
}: {
    areas?: ManualImageAreaDecision[];
    isPreviewMode?: boolean;
    isRedactMode?: boolean;
    isManuallyRedacted?: boolean;
} = {}) {
    const onAddArea = vi.fn();
    const onRemoveArea = vi.fn();
    const onToggle = vi.fn();

    const view = render(
        <ImageRedactionFrame
            image={image}
            imageNumber={1}
            pageNumber={1}
            isPreviewMode={isPreviewMode}
            isRedactMode={isRedactMode}
            isManuallyRedacted={isManuallyRedacted}
            areas={areas}
            onToggle={onToggle}
            onAddArea={onAddArea}
            onRemoveArea={onRemoveArea}
        />,
    );

    const drawingSurface = screen.queryByRole(
        "button",
        { name: /draw a redaction area/i },
    ) as HTMLDivElement | null;

    if (drawingSurface) {
        Object.defineProperty(
            drawingSurface,
            "getBoundingClientRect",
            {
                configurable: true,
                value: () => ({
                    x: 0,
                    y: 0,
                    left: 0,
                    top: 0,
                    right: 400,
                    bottom: 200,
                    width: 400,
                    height: 200,
                }),
            },
        );
    }

    return {
        ...view,
        drawingSurface,
        onAddArea,
        onRemoveArea,
        onToggle,
    };
}


describe("ImageRedactionFrame", () => {
    it("creates a normalized area using two clicks", () => {
        const { drawingSurface, onAddArea } = renderEditor();

        expect(drawingSurface).not.toBeNull();

        fireEvent.pointerDown(drawingSurface!, {
            button: 0,
            clientX: 40,
            clientY: 40,
            pointerId: 1,
        });

        fireEvent.pointerUp(drawingSurface!, {
            button: 0,
            clientX: 40,
            clientY: 40,
            pointerId: 1,
        });

        expect(onAddArea).not.toHaveBeenCalled();

        fireEvent.pointerDown(drawingSurface!, {
            button: 0,
            clientX: 200,
            clientY: 120,
            pointerId: 1,
        });

        fireEvent.pointerUp(drawingSurface!, {
            button: 0,
            clientX: 200,
            clientY: 120,
            pointerId: 1,
        });

        expect(onAddArea).toHaveBeenCalledWith(
            1,
            "image-1",
            {
                x0: 0.1,
                y0: 0.2,
                x1: 0.5,
                y1: 0.6,
            },
        );
    });

    it("supports keyboard drawing with 40px arrow movement", () => {
        const { drawingSurface, onAddArea } = renderEditor();

        fireEvent.keyDown(drawingSurface!, { key: "Enter" });
        fireEvent.keyDown(drawingSurface!, { key: "ArrowRight" });
        fireEvent.keyDown(drawingSurface!, { key: "ArrowDown" });
        fireEvent.keyDown(drawingSurface!, { key: "Enter" });

        expect(onAddArea).toHaveBeenCalledWith(
            1,
            "image-1",
            {
                x0: 0.5,
                y0: 0.5,
                x1: 0.6,
                y1: 0.7,
            },
        );
    });

    it("retains independent overlapping areas and removes by area ID", () => {
        const secondArea: ManualImageAreaDecision = {
            ...firstArea,
            id: "area-two",
            areaId: "area-two",
            rect: {
                x0: 0.3,
                y0: 0.4,
                x1: 0.8,
                y1: 0.9,
            },
        };

        const { container, onRemoveArea } = renderEditor({
            areas: [firstArea, secondArea],
        });

        expect(
            container.querySelectorAll(
                ".jr-review-image-area-overlay rect",
            ),
        ).toHaveLength(2);

        fireEvent.click(
            screen.getByRole("button", {
                name: "Remove area 1 from Image 1 on page 1",
            }),
        );

        expect(onRemoveArea).toHaveBeenCalledWith(
            1,
            "image-1",
            "area-one",
        );
    });

    it("disables editing controls in Select mode", () => {
        const { drawingSurface, onAddArea } = renderEditor({
            areas: [firstArea],
            isRedactMode: false,
        });

        expect(
            screen.getByRole("button", {
                name: "Redact whole image",
            }),
        ).toHaveProperty("disabled", true);

        expect(drawingSurface?.getAttribute("aria-disabled")).toBe(
            "true",
        );

        fireEvent.keyDown(drawingSurface!, {
            key: "Enter",
        });

        expect(onAddArea).not.toHaveBeenCalled();
    });

    it("renders black areas with editing controls hidden in Preview", () => {
        const { container } = renderEditor({
            areas: [firstArea],
            isPreviewMode: true,
        });

        expect(
            container.querySelector(
                '.jr-review-image-area-overlay rect[fill="#0b0c0c"]',
            ),
        ).not.toBeNull();

        expect(
            screen.queryByRole("button", {
                name: "Redact whole image",
            }),
        ).toBeNull();

        expect(
            screen.queryByRole("button", {
                name: /remove area/i,
            }),
        ).toBeNull();
    });

    it("disables area drawing when whole-image redaction is active", () => {
        const { drawingSurface, onAddArea } = renderEditor({
            isManuallyRedacted: true,
        });

        expect(drawingSurface?.getAttribute("aria-disabled")).toBe(
            "true",
        );

        fireEvent.keyDown(drawingSurface!, {
            key: "Enter",
        });

        expect(onAddArea).not.toHaveBeenCalled();
    });

    it("caps the rendered image width at 940px", () => {
        const { container } = render(
            <ImageRedactionFrame
                image={{
                    ...image,
                    bbox: {
                        x0: 0,
                        y0: 0,
                        x1: 1500,
                        y1: 750,
                    },
                }}
                pageNumber={1}
                isPreviewMode={false}
                isManuallyRedacted={false}
                onToggle={vi.fn()}
            />,
        );

        const frame = container.querySelector(
            ".jr-review-image-frame",
        ) as HTMLElement;

        expect(frame.style.maxWidth).toBe("100%");
        expect(frame.style.width).toBe("940px");
    });
});
