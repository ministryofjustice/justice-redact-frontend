import {
    useEffect,
    useId,
    useRef,
    useState,
} from "react";

import type {
    CSSProperties,
    KeyboardEvent,
    PointerEvent,
} from "react";

import type {
    ImageAreaRect,
    ManualImageAreaDecision,
    ReviewImage,
} from "../types";

import {
    clamp01,
    MAX_IMAGE_WIDTH_PX,
    MIN_IMAGE_AREA_PX,
    normalizedImageArea,
} from "../imageAreaGeometry";

import type { ImagePoint } from "../imageAreaGeometry";

const PDF_TO_CSS_SCALE = 96 / 72;
const DRAG_THRESHOLD_PX = 4;

type ImageRedactionFrameProps = {
    image: ReviewImage;
    pageNumber: number;
    imageNumber?: number;
    isPreviewMode: boolean;
    isRedactMode?: boolean;
    isManuallyRedacted: boolean;
    areas?: ManualImageAreaDecision[];
    onToggle: (pageNumber: number, imageId: string) => void;
    onAddArea?: (
        pageNumber: number,
        imageId: string,
        rect: ImageAreaRect,
    ) => void;
    onRemoveArea?: (
        pageNumber: number,
        imageId: string,
        areaId: string,
    ) => void;
    showButton?: boolean;
};

type PointerGesture = {
    pointerId: number;
    start: ImagePoint;
    clientX: number;
    clientY: number;
    areaId?: string;
};

const CENTRE: ImagePoint = { x: 0.5, y: 0.5 };

function imageDimensions(image: ReviewImage) {
    const width = image.bbox
        ? (image.bbox.x1 - image.bbox.x0) * PDF_TO_CSS_SCALE
        : 200;

    const height = image.bbox
        ? (image.bbox.y1 - image.bbox.y0) * PDF_TO_CSS_SCALE
        : 150;

    const valid = (
        image.bbox !== null &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0
    );

    return {
        width: valid ? width : 200,
        height: valid ? height : 150,
        valid,
    };
}

function rectangleStyle(rect: ImageAreaRect): CSSProperties {
    return {
        left: `${rect.x0 * 100}%`,
        top: `${rect.y0 * 100}%`,
        width: `${(rect.x1 - rect.x0) * 100}%`,
        height: `${(rect.y1 - rect.y0) * 100}%`,
    };
}

function SelectionCheckmark() {
    return (
        <svg
            className="jr-image-area-checkmark"
            width="26"
            height="21"
            viewBox="0 0 26 21"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M19.7256 2.80664L10.3506 12.0374L5.97559 7.72972L2.85059 10.8066L10.3506 18.1913L22.8506 5.88356L19.7256 2.80664Z"
                className="jr-image-area-checkmark__path"
                strokeLinejoin="miter"
                paintOrder="stroke fill"
            />
        </svg>
    );
}

function Crosshair({ point }: { point: ImagePoint }) {
    return (
        <svg
            className="jr-image-area-crosshair"
            style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
            }}
            width="30"
            height="30"
            viewBox="0 0 30 30"
            aria-hidden="true"
            focusable="false"
        >
            <rect x="0.5" y="14" width="11" height="2" />
            <rect x="14" y="0.5" width="2" height="11" />
            <circle cx="15" cy="15" r="1.5" />
            <rect x="14" y="18.5" width="2" height="11" />
            <rect x="18.5" y="14" width="11" height="2" />
        </svg>
    );
}

function ImageAreaGuidance({ id }: { id: string }) {
    return (
        <details
            className="govuk-details jr-image-area-guidance"
            id={id}
        >
            <summary className="govuk-details__summary">
                <span className="govuk-details__summary-text">
                    How to redact areas of the image
                </span>
            </summary>

            <div className="govuk-details__text">
                <h3 className="govuk-heading-s">
                    Drawing a redaction area
                </h3>
                <ol className="govuk-list govuk-list--number">
                    <li>
                        Move the cursor to where you want to start the
                        redaction area and select that point. (If you’re
                        using a keyboard, focus on the image to show the
                        cursor.)
                    </li>
                    <li>
                        Move the cursor until you’ve drawn the correct
                        redaction area.
                    </li>
                    <li>
                        Select the opposite corner to complete the
                        redaction area.
                    </li>
                </ol>

                <h3 className="govuk-heading-s">
                    Removing a redaction area
                </h3>
                <ol className="govuk-list govuk-list--number">
                    <li>Focus on a redaction area and select it.</li>
                    <li>
                        Select more redaction areas if you want to
                        redact more than one.
                    </li>
                    <li>Select the ‘Remove redactions’ button.</li>
                </ol>

                <h3 className="govuk-heading-s">Keyboard users</h3>
                <p className="govuk-body">
                    Move the cursor using the arrow keys. Make smaller
                    movements by holding shift while pressing the
                    arrow keys. Start and finish redaction areas with
                    the enter key.
                </p>

                <h3 className="govuk-heading-s">
                    Voice control users
                </h3>
                <p className="govuk-body govuk-!-margin-bottom-0">
                    Use the grid overlay to choose where to start a
                    redan area. Say “single click” to start the
                    area. Move the cursor and say “single click” to
                    finish the redaction area.
                </p>
            </div>
        </details>
    );
}

export default function ImageRedactionFrame({
    image,
    pageNumber,
    imageNumber,
    isPreviewMode,
    isRedactMode = true,
    isManuallyRedacted,
    areas = [],
    onToggle,
    onAddArea,
    onRemoveArea,
    showButton = true,
}: ImageRedactionFrameProps) {
    const labelId = useId();
    const guidanceId = useId();

    const imageSurfaceRef = useRef<HTMLDivElement>(null);
    const removeButtonRef = useRef<HTMLButtonElement>(null);
    const pointerRef = useRef<PointerGesture | null>(null);
    const pendingFocusRef = useRef<"image" | "remove" | null>(null);

    const [anchor, setAnchor] = useState<ImagePoint | null>(null);
    const [draft, setDraft] = useState<ImageAreaRect | null>(null);
    const [cursor, setCursor] = useState<ImagePoint>(CENTRE);
    const [keyboardActive, setKeyboardActive] = useState(false);
    const [pointerPosition, setPointerPosition] =
        useState<ImagePoint | null>(null);

    const pointerFocusRef = useRef(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [announcement, setAnnouncement] = useState({
        text: "",
        revision: 0,
    });

    const dimensions = imageDimensions(image);

    const imageSrc = image.imageUrl
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${image.imageUrl}`
        : null;

    const [loadedImageSrc, setLoadedImageSrc] = useState<string | null>(
        null,
    );

    const editable = (
        showButton &&
        isRedactMode &&
        !isPreviewMode
    );

    // const canDraw = (
    //     editable &&
    //     !isManuallyRedacted &&
    //     dimensions.valid &&
    //     Boolean(imageSrc) &&
    //     loadedImageSrc === imageSrc &&
    //     Boolean(onAddArea)
    // );

    const selectedAreas = areas.filter(
        area => selectedIds.includes(area.areaId),
    );

    // const canRedactWhole = (
    //     editable &&
    //     !isManuallyRedacted &&
    //     areas.length === 0
    // );

    // Temporarily disabled until partial-image redaction is ready.
    const canDraw = false;
    const canRedactWhole = false;

    const canRemove = (
        editable &&
        (
            isManuallyRedacted ||
            (
                selectedAreas.length > 0 &&
                Boolean(onRemoveArea)
            )
        )
    );

    const resolvedImageNumber =
        imageNumber ?? image.imageNumber;

    const label = (
        typeof resolvedImageNumber === "number" &&
        Number.isSafeInteger(resolvedImageNumber) &&
        resolvedImageNumber > 0
    )
        ? `Image ${resolvedImageNumber}`
        : `Image on page ${pageNumber}`;

    const frameStyle: CSSProperties = {
        width: `${Math.min(dimensions.width, MAX_IMAGE_WIDTH_PX)}px`,
        maxWidth: "100%",
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
    };

    function announce(text: string) {
        setAnnouncement(previous => ({
            text,
            revision: previous.revision + 1,
        }));
    }

    useEffect(() => {
        if (!canDraw) {
            pointerRef.current = null;
            setAnchor(null);
            setDraft(null);
            setKeyboardActive(false);
            setPointerPosition(null);
        }
    }, [canDraw]);

    useEffect(() => {
        if (!editable) {
            setSelectedIds([]);
            setAnnouncement(previous => ({
                text: "",
                revision: previous.revision + 1,
            }));
        }
    }, [editable]);

    useEffect(() => {
        if (!editable) {
            pendingFocusRef.current = null;
            return;
        }

        if (
            pendingFocusRef.current === "remove" &&
            isManuallyRedacted
        ) {
            pendingFocusRef.current = null;
            removeButtonRef.current?.focus();
        }

        if (
            pendingFocusRef.current === "image" &&
            !isManuallyRedacted
        ) {
            imageSurfaceRef.current?.focus();
            pendingFocusRef.current = null;
        }
    }, [editable, isManuallyRedacted, areas]);

    function imageBounds() {
        const bounds =
            imageSurfaceRef.current?.getBoundingClientRect();

        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return null;
        }

        return bounds;
    }

    function pointFromPointer(event: PointerEvent<HTMLElement>) {
        const bounds = imageBounds();

        if (!bounds) {
            return null;
        }

        return {
            x: clamp01(
                (event.clientX - bounds.left) / bounds.width,
            ),
            y: clamp01(
                (event.clientY - bounds.top) / bounds.height,
            ),
        };
    }

    function updateDraft(start: ImagePoint, end: ImagePoint) {
        setDraft(normalizedImageArea(start, end, 1, 1, 0));
    }

    function cancelDrawing() {
        pointerRef.current = null;
        setAnchor(null);
        setDraft(null);
    }

    function completeArea(start: ImagePoint, end: ImagePoint) {
        const bounds = imageBounds();

        if (!canDraw || !bounds || !onAddArea) {
            return false;
        }

        const rect = normalizedImageArea(
            start,
            end,
            bounds.width,
            bounds.height,
        );

        if (!rect) {
            announce(
                `Choose an area at least ${MIN_IMAGE_AREA_PX} pixels wide and high.`,
            );
            return false;
        }

        onAddArea(pageNumber, image.imageId, rect);

        cancelDrawing();

        // Display numbering is currently derived from creation order.
        // Persistent display ordinals will be introduced separately.
        announce(`Redaction area ${areas.length + 1} created.`);
        return true;
    }

    function toggleAreaSelection(areaId: string) {
        if (!editable || isManuallyRedacted) {
            return;
        }

        const index = areas.findIndex(area => area.areaId === areaId);

        if (index < 0) {
            return;
        }

        const selected = selectedIds.includes(areaId);

        setSelectedIds(previous =>
            selected
                ? previous.filter(id => id !== areaId)
                : [...previous, areaId],
        );

        announce(
            `Redaction area ${index + 1} ${selected ? "deselected" : "selected"}.`,
        );
    }

    function startPointer(
        event: PointerEvent<HTMLElement>,
        areaId?: string,
    ) {
        if (
            !editable ||
            event.button !== 0 ||
            event.isPrimary === false
        ) {
            return;
        }

        if (!canDraw && !areaId) {
            return;
        }

        const point = pointFromPointer(event);

        if (!point) {
            return;
        }

        event.preventDefault();

        if (!areaId && canDraw) {
            pointerFocusRef.current = true;

            imageSurfaceRef.current?.focus({
                preventScroll: true,
            });

            pointerFocusRef.current = false;
        }

        setKeyboardActive(false);

        setPointerPosition(
            event.pointerType === "touch" || areaId
                ? null
                : point,
        );

        pointerRef.current = {
            pointerId: event.pointerId,
            start: point,
            clientX: event.clientX,
            clientY: event.clientY,
            areaId,
        };

        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function movePointer(event: PointerEvent<HTMLElement>) {
        if (!canDraw) {
            return;
        }

        const point = pointFromPointer(event);

        if (!point) {
            return;
        }

        const gesture = pointerRef.current;

        if (gesture && gesture.pointerId !== event.pointerId) {
            return;
        }

        const isOverArea = event.currentTarget.classList.contains(
            "jr-image-area--interactive",
        );

        const isDragging = Boolean(
            gesture &&
            Math.hypot(
                event.clientX - gesture.clientX,
                event.clientY - gesture.clientY,
            ) >= DRAG_THRESHOLD_PX
        );

        setKeyboardActive(false);

        setPointerPosition(
            event.pointerType !== "touch" &&
                (!isOverArea || anchor || isDragging)
                ? point
                : null,
        );

        if (anchor) {
            updateDraft(anchor, point);
            return;
        }

        if (gesture) {
            const distance = Math.hypot(
                event.clientX - gesture.clientX,
                event.clientY - gesture.clientY,
            );

            if (distance >= DRAG_THRESHOLD_PX) {
                updateDraft(gesture.start, point);
            }
        }
    }

    function finishPointer(event: PointerEvent<HTMLElement>) {
        const gesture = pointerRef.current;

        if (!gesture || gesture.pointerId !== event.pointerId) {
            return;
        }

        pointerRef.current = null;

        if (!editable) {
            cancelDrawing();
            return;
        }

        const point = pointFromPointer(event);

        if (!point) {
            cancelDrawing();
            return;
        }

        const distance = Math.hypot(
            event.clientX - gesture.clientX,
            event.clientY - gesture.clientY,
        );

        if (anchor && canDraw) {
            completeArea(anchor, point);
            return;
        }

        if (
            distance >= DRAG_THRESHOLD_PX &&
            canDraw
        ) {
            if (!completeArea(gesture.start, point)) {
                setDraft(null);
            }
            return;
        }

        if (gesture.areaId) {
            toggleAreaSelection(gesture.areaId);
            return;
        }

        if (canDraw) {
            setAnchor(gesture.start);
            setDraft(null);
            announce(
                "First corner selected. Select the opposite corner.",
            );
        }
    }

    function handleImageKeyboard(
        event: KeyboardEvent<HTMLDivElement>,
    ) {
        if (!canDraw) {
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setPointerPosition(null);
            cancelDrawing();
            announce("Area drawing cancelled.");
            return;
        }

        if (event.key === "Enter" && !event.repeat) {
            event.preventDefault();
            setPointerPosition(null);
            setKeyboardActive(true);

            if (!anchor) {
                setAnchor(cursor);
                announce("First corner selected.");
            } else {
                completeArea(anchor, cursor);
            }

            return;
        }

        const directions: Record<string, {
            x: number;
            y: number;
            direction: string;
            edge: string;
        }> = {
            ArrowLeft: {
                x: -1, y: 0,
                direction: "left", edge: "left",
            },
            ArrowRight: {
                x: 1, y: 0,
                direction: "right", edge: "right",
            },
            ArrowUp: {
                x: 0, y: -1,
                direction: "up", edge: "top",
            },
            ArrowDown: {
                x: 0, y: 1,
                direction: "down", edge: "bottom",
            },
        };

        const direction = directions[event.key];

        if (!direction) {
            return;
        }

        event.preventDefault();

        const bounds = imageBounds();

        if (!bounds) {
            return;
        }

        const step = event.shiftKey ? 20 : 40;

        const next = {
            x: clamp01(cursor.x + direction.x * step / bounds.width),
            y: clamp01(cursor.y + direction.y * step / bounds.height),
        };

        setCursor(next);
        setPointerPosition(null);
        setKeyboardActive(true);

        if (anchor) {
            updateDraft(anchor, next);
        }

        if (next.x === cursor.x && next.y === cursor.y) {
            announce(
                `Cursor cannot move further ${direction.direction}.`,
            );
        } else if (
            (direction.x !== 0 && (next.x === 0 || next.x === 1)) ||
            (direction.y !== 0 && (next.y === 0 || next.y === 1))
        ) {
            announce(`Cursor moved to ${direction.edge} edge.`);
        } else {
            announce(
                `Cursor moved ${direction.direction} ${step} pixels.`,
            );
        }
    }

    function redactWholeImage(keyboard: boolean) {
        if (!canRedactWhole) {
            return;
        }

        cancelDrawing();
        setSelectedIds([]);

        if (keyboard) {
            pendingFocusRef.current = "remove";
        }

        onToggle(pageNumber, image.imageId);
        announce(`${label} redacted.`);
    }

    function removeRedactions(keyboard: boolean) {
        if (!canRemove) {
            return;
        }

        if (keyboard) {
            pendingFocusRef.current = "image";
        }

        cancelDrawing();

        if (isManuallyRedacted) {
            onToggle(pageNumber, image.imageId);
            announce(`${label} redaction removed.`);
        } else {
            const numbers = selectedAreas.map(
                area => areas.findIndex(
                    candidate => candidate.areaId === area.areaId,
                ) + 1,
            );

            selectedAreas.forEach(area => {
                onRemoveArea?.(
                    pageNumber,
                    image.imageId,
                    area.areaId,
                );
            });

            if (numbers.length === 1) {
                announce(`Redaction area ${numbers[0]} removed.`);
            } else {
                const last = numbers[numbers.length - 1];
                const earlier = numbers.slice(0, -1).join(", ");

                announce(
                    `Redaction areas ${earlier} and ${last} removed.`,
                );
            }
        }

        setSelectedIds([]);
    }

    return (
        <section
            className={[
                "jr-review-image-panel",
                isPreviewMode
                    ? "jr-review-image-panel--preview"
                    : "",
            ].filter(Boolean).join(" ")}
            aria-labelledby={labelId}
        >
            <h2
                id={labelId}
                className="govuk-heading-s jr-review-image-title"
            >
                {label}
            </h2>

            <div
                ref={imageSurfaceRef}
                className="jr-review-image-frame"
                style={frameStyle}
                role={showButton && !isPreviewMode ? "button" : undefined}
                aria-label={
                    showButton && !isPreviewMode
                        ? `Draw a redaction area on ${label}`
                        : undefined
                }
                aria-describedby={
                    showButton && !isPreviewMode
                        ? guidanceId
                        : undefined
                }
                aria-disabled={
                    showButton && !isPreviewMode
                        ? !canDraw
                        : undefined
                }
                tabIndex={canDraw ? 0 : -1}
                data-can-draw={canDraw}
                onFocus={() => {
                    if (!canDraw || pointerFocusRef.current) {
                        return;
                    }

                    setPointerPosition(null);
                    setCursor(CENTRE);
                    setKeyboardActive(true);
                    cancelDrawing();

                    if (pendingFocusRef.current !== "image") {
                        announce(
                            `${label} focussed. Cursor at centre of image.`,
                        );
                    }
                }}
                onBlur={() => {
                    cancelDrawing();
                    setKeyboardActive(false);
                }}
                onKeyDown={handleImageKeyboard}
                onPointerEnter={movePointer}
                onPointerLeave={() => setPointerPosition(null)}
                onPointerDown={event => startPointer(event)}
                onPointerMove={movePointer}
                onPointerUp={finishPointer}
                onPointerCancel={() => {
                    cancelDrawing();
                    setPointerPosition(null);
                }}
                onLostPointerCapture={event => {
                    if (
                        pointerRef.current?.pointerId === event.pointerId
                    ) {
                        cancelDrawing();
                        setPointerPosition(null);
                    }
                }}
            >
                {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageSrc}
                        alt={image.alt || label}
                        aria-labelledby={labelId}
                        className="jr-review-image"
                        draggable={false}
                        onLoad={() => setLoadedImageSrc(imageSrc)}
                        onError={() => setLoadedImageSrc(null)}
                    />
                ) : (
                    <div
                        className="jr-review-image-placeholder"
                        role="img"
                        aria-labelledby={labelId}
                    >
                        Image preview unavailable
                    </div>
                )}
            </div>

            {showButton && (
                <>
                    <div
                        className="jr-image-area-guidance-slot"
                        inert={isPreviewMode ? true : undefined}
                    >
                        <ImageAreaGuidance id={guidanceId} />
                    </div>

                    <button
                        type="button"
                        className="govuk-button govuk-button--secondary jr-image-whole-button"
                        disabled={!canRedactWhole}
                        inert={isPreviewMode ? true : undefined}
                        onClick={event => redactWholeImage(event.detail === 0)}
                    >
                        Redact whole image
                    </button>
                </>
            )}

            <div
                className="jr-review-image-area-overlay"
                style={frameStyle}
                data-drawing={Boolean(anchor || draft)}
            >
                {isManuallyRedacted ? (
                    <div
                        aria-hidden="true"
                        className={[
                            "jr-image-area",
                            "jr-image-area--whole",
                            isPreviewMode ? "jr-image-area--preview" : "",
                        ].filter(Boolean).join(" ")}
                        style={{
                            left: 0,
                            top: 0,
                            width: "100%",
                            height: "100%",
                        }}
                    />
                ) : (
                    areas.map((area, index) => {
                        const selected = selectedIds.includes(area.areaId);
                        const areaLabel = `Redaction area ${index + 1}`;

                        if (isPreviewMode || !showButton) {
                            return (
                                <div
                                    key={area.areaId}
                                    aria-hidden="true"
                                    className={[
                                        "jr-image-area",
                                        isPreviewMode
                                            ? "jr-image-area--preview"
                                            : "",
                                    ].filter(Boolean).join(" ")}
                                    style={rectangleStyle(area.rect)}
                                />
                            );
                        }

                        return (
                            <button
                                key={area.areaId}
                                type="button"
                                className="jr-image-area jr-image-area--interactive"
                                style={rectangleStyle(area.rect)}
                                aria-label={areaLabel}
                                aria-pressed={selected}
                                disabled={!editable}
                                onFocus={() => announce(`${areaLabel}.`)}
                                onPointerDown={event => startPointer(
                                    event,
                                    area.areaId,
                                )}
                                onPointerEnter={movePointer}
                                onPointerLeave={() => setPointerPosition(null)}
                                onPointerMove={movePointer}
                                onPointerUp={finishPointer}
                                onPointerCancel={() => {
                                    cancelDrawing();
                                    setPointerPosition(null);
                                }}
                                onLostPointerCapture={event => {
                                    if (
                                        pointerRef.current?.pointerId ===
                                        event.pointerId
                                    ) {
                                        cancelDrawing();
                                        setPointerPosition(null);
                                    }
                                }}
                                onClick={event => {
                                    // Pointer selection is handled on pointer-up.
                                    // Native keyboard activation generates detail 0.
                                    if (event.detail === 0) {
                                        toggleAreaSelection(area.areaId);
                                    }
                                }}
                            >
                                {selected && <SelectionCheckmark />}
                            </button>
                        );
                    })
                )}
            </div>

            {canDraw && (
                <div
                    aria-hidden="true"
                    className="jr-image-area-draft-overlay"
                    style={frameStyle}
                >
                    {draft && (
                        <div
                            className="jr-image-area jr-image-area--draft"
                            style={rectangleStyle(draft)}
                        />
                    )}
                    {keyboardActive ? (
                        <Crosshair point={cursor} />
                    ) : (
                        pointerPosition && (
                            <Crosshair point={pointerPosition} />
                        )
                    )}
                </div>
            )}

            {showButton && (
                <button
                    ref={removeButtonRef}
                    type="button"
                    className="govuk-button govuk-button--warning jr-image-remove-button"
                    disabled={!canRemove}
                    inert={isPreviewMode ? true : undefined}
                    onClick={event => removeRedactions(event.detail === 0)}
                >
                    Remove redactions
                </button>
            )}

            {showButton && !isPreviewMode && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="govuk-visually-hidden"
                >
                    <span key={announcement.revision}>
                        {announcement.text}
                    </span>
                </div>
            )}
        </section>
    );
}
