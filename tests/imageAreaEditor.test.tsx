// @vitest-environment jsdom

import { useRef, useState } from "react";

import {
    act,
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

import ImageRedactionFrame from "../app/review/components/ImageRedactionFrame";

import type {
    ImageAreaRect,
    ManualImageAreaDecision,
    ReviewImage,
} from "../app/review/types";

afterEach(cleanup);

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
    id: "area-1",
    documentId: "document-1",
    kind: "image_area",
    pageNumber: 1,
    imageId: "image-1",
    areaId: "area-1",
    rect: {
        x0: 0.1,
        y0: 0.2,
        x1: 0.5,
        y1: 0.6,
    },
};

const secondArea: ManualImageAreaDecision = {
    ...firstArea,
    id: "area-2",
    areaId: "area-2",
    rect: {
        x0: 0.3,
        y0: 0.4,
        x1: 0.8,
        y1: 0.9,
    },
};

function prepareSurface(container: HTMLElement) {
    const surface = container.querySelector(
        ".jr-review-image-frame",
    ) as HTMLDivElement;

    Object.defineProperty(surface, "getBoundingClientRect", {
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
    });

    fireEvent.load(container.querySelector("img")!);

    return surface;
}

function Harness({
    initialAreas = [],
    initialWhole = false,
    preview = false,
    redact = true,
    onAdd = vi.fn(),
    onRemove = vi.fn(),
}: {
    initialAreas?: ManualImageAreaDecision[];
    initialWhole?: boolean;
    preview?: boolean;
    redact?: boolean;
    onAdd?: (
        pageNumber: number,
        imageId: string,
        rect: ImageAreaRect,
    ) => void;
    onRemove?: (
        pageNumber: number,
        imageId: string,
        areaId: string,
    ) => void;
}) {
    const [areas, setAreas] = useState(initialAreas);
    const [whole, setWhole] = useState(initialWhole);
    const nextId = useRef(initialAreas.length + 1);

    return (
        <ImageRedactionFrame
            image={image}
            pageNumber={1}
            imageNumber={1}
            isPreviewMode={preview}
            isRedactMode={redact}
            isManuallyRedacted={whole}
            areas={areas}
            onToggle={() => setWhole(previous => !previous)}
            onAddArea={(pageNumber, imageId, rect) => {
                onAdd(pageNumber, imageId, rect);

                const id = `area-${nextId.current++}`;

                setAreas(previous => [
                    ...previous,
                    {
                        id,
                        areaId: id,
                        documentId: "document-1",
                        kind: "image_area",
                        pageNumber,
                        imageId,
                        rect,
                    },
                ]);
            }}
            onRemoveArea={(pageNumber, imageId, areaId) => {
                onRemove(pageNumber, imageId, areaId);

                setAreas(previous =>
                    previous.filter(area => area.areaId !== areaId),
                );
            }}
        />
    );
}

function wholeButton() {
    return screen.getByRole("button", {
        name: "Redact whole image",
    }) as HTMLButtonElement;
}

function removeButton() {
    return screen.getByRole("button", {
        name: "Remove redactions",
    }) as HTMLButtonElement;
}

function areaButton(number: number) {
    return screen.getByRole("button", {
        name: `Redaction area ${number}`,
    }) as HTMLButtonElement;
}

function pointerClick(
    target: HTMLElement,
    x: number,
    y: number,
) {
    const event = {
        button: 0,
        clientX: x,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
    };

    fireEvent.pointerDown(target, event);
    fireEvent.pointerUp(target, event);
}

describe("Design-aligned image-area editor", () => {
    it("renders the required image heading and controls", () => {
        const { container } = render(<Harness />);

        const heading = screen.getByRole("heading", {
            name: "Image 1",
            level: 2,
        });

        const img = container.querySelector("img");

        expect(img?.getAttribute("aria-labelledby")).toBe(
            heading.id,
        );

        expect(wholeButton().disabled).toBe(false);
        expect(removeButton().disabled).toBe(true);

        expect(
            screen.getByText("How to redact areas of the image"),
        ).toBeTruthy();

        expect(
            container.querySelector("details")?.open,
        ).toBe(false);
    });

    it("does not allow drawing before the image has loaded", () => {
        const { container } = render(<Harness />);

        const surface = container.querySelector(
            ".jr-review-image-frame",
        ) as HTMLDivElement;

        expect(surface.getAttribute("aria-disabled")).toBe("true");

        prepareSurface(container);

        expect(surface.getAttribute("aria-disabled")).toBe("false");
    });

    it("creates an area after exactly two corner clicks", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        pointerClick(surface, 40, 40);

        expect(onAdd).not.toHaveBeenCalled();

        pointerClick(surface, 200, 120);

        expect(onAdd).toHaveBeenCalledTimes(1);

        expect(onAdd).toHaveBeenCalledWith(
            1,
            "image-1",
            {
                x0: 0.1,
                y0: 0.2,
                x1: 0.5,
                y1: 0.6,
            },
        );

        expect(areaButton(1).getAttribute("aria-pressed")).toBe(
            "false",
        );

        expect(wholeButton().disabled).toBe(true);
        expect(removeButton().disabled).toBe(true);
        expect(screen.getByRole("status").textContent).toBe(
            "Redaction area 1 created.",
        );
    });

    it("uses the supplied SVG crosshair for mouse movement", () => {
        const { container } = render(<Harness />);
        const surface = prepareSurface(container);

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            pointerType: "mouse",
            clientX: 100,
            clientY: 80,
            isPrimary: true,
        });

        const crosshair = container.querySelector(
            ".jr-image-area-crosshair",
        ) as SVGElement;

        expect(crosshair).not.toBeNull();
        expect(crosshair.getAttribute("width")).toBe("30");
        expect(crosshair.getAttribute("height")).toBe("30");

        expect(crosshair.style.left).toBe("25%");
        expect(crosshair.style.top).toBe("40%");
    });

    it("does not display the drawing crosshair for touch input", () => {
        const { container } = render(<Harness />);
        const surface = prepareSurface(container);

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            pointerType: "touch",
            clientX: 100,
            clientY: 80,
            isPrimary: true,
        });

        expect(
            container.querySelector(".jr-image-area-crosshair"),
        ).toBeNull();
    });

    it("allows Escape to cancel mouse-based two-click drawing", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        pointerClick(surface, 40, 40);

        expect(document.activeElement).toBe(surface);

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            pointerType: "mouse",
            clientX: 200,
            clientY: 120,
        });

        expect(
            container.querySelector(".jr-image-area--draft"),
        ).not.toBeNull();

        fireEvent.keyDown(surface, { key: "Escape" });

        expect(
            container.querySelector(".jr-image-area--draft"),
        ).toBeNull();

        expect(onAdd).not.toHaveBeenCalled();

        // The next click must start a new rectangle,
        // not complete the cancelled rectangle.
        pointerClick(surface, 200, 120);

        expect(onAdd).not.toHaveBeenCalled();
    });

    it("discards an interrupted pointer gesture", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        fireEvent.pointerDown(surface, {
            button: 0,
            pointerId: 1,
            pointerType: "mouse",
            clientX: 40,
            clientY: 40,
            isPrimary: true,
        });

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            pointerType: "mouse",
            clientX: 200,
            clientY: 120,
        });

        fireEvent.pointerCancel(surface, {
            pointerId: 1,
            pointerType: "mouse",
        });

        expect(
            container.querySelector(".jr-image-area--draft"),
        ).toBeNull();

        expect(
            container.querySelector(".jr-image-area-crosshair"),
        ).toBeNull();

        fireEvent.pointerUp(surface, {
            button: 0,
            pointerId: 1,
            clientX: 200,
            clientY: 120,
        });

        expect(onAdd).not.toHaveBeenCalled();
    });

    it("discards a gesture if pointer capture is unexpectedly lost", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        fireEvent.pointerDown(surface, {
            button: 0,
            pointerId: 1,
            clientX: 40,
            clientY: 40,
            isPrimary: true,
        });

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            clientX: 200,
            clientY: 120,
        });

        fireEvent.lostPointerCapture(surface, {
            pointerId: 1,
        });

        expect(
            container.querySelector(".jr-image-area--draft"),
        ).toBeNull();

        fireEvent.pointerUp(surface, {
            button: 0,
            pointerId: 1,
            clientX: 200,
            clientY: 120,
        });

        expect(onAdd).not.toHaveBeenCalled();
    });

    it("creates an area using one pointer drag", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        fireEvent.pointerDown(surface, {
            button: 0,
            pointerId: 1,
            clientX: 40,
            clientY: 40,
            isPrimary: true,
        });

        fireEvent.pointerMove(surface, {
            pointerId: 1,
            clientX: 200,
            clientY: 120,
            isPrimary: true,
        });

        fireEvent.pointerUp(surface, {
            button: 0,
            pointerId: 1,
            clientX: 200,
            clientY: 120,
            isPrimary: true,
        });

        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(areaButton(1)).toBeTruthy();
    });

    it("centres the crosshair when the image receives keyboard focus", () => {
        const { container } = render(<Harness />);
        const surface = prepareSurface(container);

        act(() => surface.focus());

        const crosshair = container.querySelector(
            ".jr-image-area-crosshair",
        ) as SVGElement;

        expect(crosshair.style.left).toBe("50%");
        expect(crosshair.style.top).toBe("50%");
        expect(screen.getByRole("status").textContent).toBe(
            "Image 1 focussed. Cursor at centre of image.",
        );
    });

    it("uses 40px arrow movements and 20px Shift-arrow movements", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        fireEvent.keyDown(surface, { key: "Enter" });

        fireEvent.keyDown(surface, {
            key: "ArrowRight",
        });

        expect(screen.getByRole("status").textContent).toBe(
            "Cursor moved right 40 pixels.",
        );

        fireEvent.keyDown(surface, {
            key: "ArrowDown",
            shiftKey: true,
        });

        expect(screen.getByRole("status").textContent).toBe(
            "Cursor moved down 20 pixels.",
        );

        fireEvent.keyDown(surface, { key: "Enter" });

        expect(onAdd).toHaveBeenCalledWith(
            1,
            "image-1",
            {
                x0: 0.5,
                y0: 0.5,
                x1: 0.6,
                y1: 0.6,
            },
        );
    });

    it("announces reaching an edge and attempting to move beyond it", () => {
        const { container } = render(<Harness />);
        const surface = prepareSurface(container);

        fireEvent.keyDown(surface, { key: "ArrowUp" });
        fireEvent.keyDown(surface, { key: "ArrowUp" });
        fireEvent.keyDown(surface, { key: "ArrowUp" });

        expect(screen.getByRole("status").textContent).toBe(
            "Cursor moved to top edge.",
        );

        fireEvent.keyDown(surface, { key: "ArrowUp" });

        expect(screen.getByRole("status").textContent).toBe(
            "Cursor cannot move further up.",
        );
    });

    it("cancels an unfinished area with Escape", () => {
        const onAdd = vi.fn();

        const { container } = render(<Harness onAdd={onAdd} />);
        const surface = prepareSurface(container);

        fireEvent.keyDown(surface, { key: "Enter" });
        fireEvent.keyDown(surface, { key: "ArrowRight" });
        fireEvent.keyDown(surface, { key: "ArrowDown" });
        fireEvent.keyDown(surface, { key: "Escape" });

        expect(onAdd).not.toHaveBeenCalled();

        expect(
            container.querySelector(".jr-image-area--draft"),
        ).toBeNull();
    });

    it("selects and deselects an actual area directly on the image", () => {
        const { container } = render(
            <Harness initialAreas={[firstArea]} />,
        );

        prepareSurface(container);

        pointerClick(areaButton(1), 80, 60);

        expect(areaButton(1).getAttribute("aria-pressed")).toBe(
            "true",
        );

        expect(
            areaButton(1).querySelector(".jr-image-area-checkmark"),
        ).not.toBeNull();

        expect(removeButton().disabled).toBe(false);

        expect(screen.getByRole("status").textContent).toBe(
            "Redaction area 1 selected.",
        );

        pointerClick(areaButton(1), 80, 60);

        expect(areaButton(1).getAttribute("aria-pressed")).toBe(
            "false",
        );

        expect(removeButton().disabled).toBe(true);

        expect(screen.getByRole("status").textContent).toBe(
            "Redaction area 1 deselected.",
        );
    });

    it("supports multiple selected areas and bulk removal", () => {
        const onRemove = vi.fn();

        const { container } = render(
            <Harness
                initialAreas={[firstArea, secondArea]}
                onRemove={onRemove}
            />,
        );

        prepareSurface(container);

        fireEvent.click(areaButton(1));
        fireEvent.click(areaButton(2));

        expect(areaButton(1).getAttribute("aria-pressed")).toBe(
            "true",
        );
        expect(areaButton(2).getAttribute("aria-pressed")).toBe(
            "true",
        );

        fireEvent.click(removeButton());

        expect(onRemove.mock.calls).toEqual([
            [1, "image-1", "area-1"],
            [1, "image-1", "area-2"],
        ]);

        expect(
            container.querySelectorAll(".jr-image-area--interactive"),
        ).toHaveLength(0);

        expect(screen.getByRole("status").textContent).toBe(
            "Redaction areas 1 and 2 removed.",
        );

        expect(wholeButton().disabled).toBe(false);
    });

    it("removes only the selected area", () => {
        const onRemove = vi.fn();

        const { container } = render(
            <Harness
                initialAreas={[firstArea, secondArea]}
                onRemove={onRemove}
            />,
        );

        prepareSurface(container);

        fireEvent.click(areaButton(1));
        fireEvent.click(removeButton());

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith(
            1,
            "image-1",
            "area-1",
        );

        expect(
            container.querySelectorAll(".jr-image-area--interactive"),
        ).toHaveLength(1);

        expect(wholeButton().disabled).toBe(true);
    });

    it("renumbers surviving areas after an older area is removed", () => {
        const onRemove = vi.fn();

        const { container } = render(
            <Harness
                initialAreas={[firstArea, secondArea]}
                onRemove={onRemove}
            />,
        );

        prepareSurface(container);

        const originalSecondArea = areaButton(2);

        fireEvent.click(areaButton(1));
        fireEvent.click(removeButton());

        expect(onRemove).toHaveBeenCalledWith(
            1,
            "image-1",
            "area-1",
        );

        expect(areaButton(1)).toBe(originalSecondArea);

        expect(
            screen.queryByRole("button", {
                name: "Redaction area 2",
            }),
        ).toBeNull();

        // The surviving area has a new display number,
        // but removal still uses its original stable identifier.
        fireEvent.click(areaButton(1));
        fireEvent.click(removeButton());

        expect(onRemove).toHaveBeenLastCalledWith(
            1,
            "image-1",
            "area-2",
        );
    });

    it("assigns the next sequential label after removing an area", () => {
        const { container } = render(
            <Harness initialAreas={[firstArea, secondArea]} />,
        );

        const surface = prepareSurface(container);

        fireEvent.click(areaButton(1));
        fireEvent.click(removeButton());

        pointerClick(surface, 20, 20);
        pointerClick(surface, 80, 80);

        expect(areaButton(1)).toBeTruthy();
        expect(areaButton(2)).toBeTruthy();

        expect(
            screen.queryByRole("button", {
                name: "Redaction area 3",
            }),
        ).toBeNull();

        expect(screen.getByRole("status").textContent).toBe(
            "Redaction area 2 created.",
        );
    });

    it("restarts area labels at one after all areas are removed", () => {
        const { container } = render(
            <Harness initialAreas={[firstArea, secondArea]} />,
        );

        const surface = prepareSurface(container);

        fireEvent.click(areaButton(1));
        fireEvent.click(areaButton(2));
        fireEvent.click(removeButton());

        expect(
            container.querySelectorAll(
                ".jr-image-area--interactive",
            ),
        ).toHaveLength(0);

        pointerClick(surface, 20, 20);
        pointerClick(surface, 80, 80);

        expect(areaButton(1)).toBeTruthy();

        expect(screen.getByRole("status").textContent).toBe(
            "Redaction area 1 created.",
        );
    });

    it("uses the shared Remove button for whole-image redaction", () => {
        const { container } = render(<Harness />);
        const surface = prepareSurface(container);

        fireEvent.click(wholeButton(), { detail: 0 });

        expect(
            container.querySelector(".jr-image-area--whole"),
        ).not.toBeNull();

        expect(wholeButton().disabled).toBe(true);
        expect(removeButton().disabled).toBe(false);
        expect(document.activeElement).toBe(removeButton());

        expect(screen.getByRole("status").textContent).toBe(
            "Image 1 redacted.",
        );

        fireEvent.click(removeButton(), { detail: 0 });

        expect(
            container.querySelector(".jr-image-area--whole"),
        ).toBeNull();

        expect(document.activeElement).toBe(surface);
        expect(wholeButton().disabled).toBe(false);

        expect(screen.getByRole("status").textContent).toBe(
            "Image 1 redaction removed.",
        );
    });

    it("preserves DOM focus order independently of visual layout", () => {
        const { container } = render(
            <Harness initialAreas={[firstArea, secondArea]} />,
        );

        prepareSurface(container);

        const elements = Array.from(
            container.querySelectorAll(
                ".jr-review-image-frame, summary, button",
            ),
        );

        expect(elements.map(element =>
            element.getAttribute("aria-label") ||
            element.textContent?.trim(),
        )).toEqual([
            "Draw a redaction area on Image 1",
            "How to redact areas of the image",
            "Redact whole image",
            "Redaction area 1",
            "Redaction area 2",
            "Remove redactions",
        ]);
    });

    it("keeps controls visible but disables editing in Select mode", () => {
        const onAdd = vi.fn();

        const { container } = render(
            <Harness
                initialAreas={[firstArea]}
                redact={false}
                onAdd={onAdd}
            />,
        );

        const surface = prepareSurface(container);

        expect(wholeButton().disabled).toBe(true);
        expect(removeButton().disabled).toBe(true);
        expect(areaButton(1).disabled).toBe(true);

        fireEvent.keyDown(surface, { key: "Enter" });

        expect(onAdd).not.toHaveBeenCalled();
    });

    it("keeps Preview furniture mounted but makes it inert", () => {
        const { container } = render(
            <Harness
                initialAreas={[firstArea]}
                preview={true}
            />,
        );

        expect(
            container.querySelector(
                ".jr-review-image-panel--preview",
            ),
        ).not.toBeNull();

        expect(
            container.querySelector(".jr-image-area--preview"),
        ).not.toBeNull();

        expect(
            container.querySelector(".jr-image-area--interactive"),
        ).toBeNull();

        expect(
            container.querySelector(".jr-image-area-checkmark"),
        ).toBeNull();

        expect(
            container.querySelector(".jr-image-whole-button")
                ?.hasAttribute("inert"),
        ).toBe(true);

        expect(
            container.querySelector(".jr-image-remove-button")
                ?.hasAttribute("inert"),
        ).toBe(true);

        expect(
            container.querySelector(".jr-image-area-guidance-slot")
                ?.hasAttribute("inert"),
        ).toBe(true);

        expect(
            container.querySelector("details"),
        ).not.toBeNull();

        expect(screen.queryByRole("status")).toBeNull();
    });

    it("caps large images without upscaling small images", () => {
        const { container, rerender } = render(
            <ImageRedactionFrame
                image={image}
                pageNumber={1}
                isPreviewMode={false}
                isManuallyRedacted={false}
                onToggle={vi.fn()}
            />,
        );

        const frame = container.querySelector(
            ".jr-review-image-frame",
        ) as HTMLElement;

        expect(frame.style.width).toBe("400px");

        rerender(
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

        expect(frame.style.width).toBe("940px");
        expect(frame.style.maxWidth).toBe("100%");
    });
});
