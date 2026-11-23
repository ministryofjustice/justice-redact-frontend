import {
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import type {
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
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

function dimensionsForImage(image: ReviewImage) {
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

function svgRectangle(rect: ImageAreaRect) {
    return {
        x: `${rect.x0 * 100}%`,
        y: `${rect.y0 * 100}%`,
        width: `${(rect.x1 - rect.x0) * 100}%`,
        height: `${(rect.y1 - rect.y0) * 100}%`,
    };
}

export default function ImageRedactionFrame({
    image,
    pageNumber,
    imageNumber = 1,
    isPreviewMode,
    isRedactMode = true,
    isManuallyRedacted,
    areas = [],
    onToggle,
    onAddArea,
    onRemoveArea,
    showButton = true,
}: ImageRedactionFrameProps) {
    const guidanceId = useId();
    const drawingSurfaceRef = useRef<HTMLDivElement>(null);
    const pointerStartRef = useRef<ImagePoint | null>(null);

    const [anchor, setAnchor] = useState<ImagePoint | null>(null);
    const [draftEnd, setDraftEnd] = useState<ImagePoint | null>(null);
    const [cursor, setCursor] = useState<ImagePoint>({
        x: 0.5,
        y: 0.5,
    });
    const [keyboardActive, setKeyboardActive] = useState(false);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const dimensions = dimensionsForImage(image);
    const imageSrc = image.imageUrl
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${image.imageUrl}`
        : null;

    const canDraw = (
        showButton &&
        isRedactMode &&
        !isPreviewMode &&
        !isManuallyRedacted &&
        dimensions.valid &&
        Boolean(imageSrc) &&
        Boolean(onAddArea)
    );

    const canEditAreas = (
        showButton &&
        isRedactMode &&
        !isPreviewMode
    );

    useEffect(() => {
        if (!canDraw) {
            pointerStartRef.current = null;
            setAnchor(null);
            setDraftEnd(null);
            setKeyboardActive(false);
        }
    }, [canDraw]);

    function renderedSize(element: HTMLDivElement) {
        const bounds = element.getBoundingClientRect();

        if (bounds.width <= 0 || bounds.height <= 0) {
            return null;
        }

        return bounds;
    }

    function pointerPoint(event: ReactPointerEvent<HTMLDivElement>) {
        const bounds = renderedSize(event.currentTarget);

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

    function finishArea(start: ImagePoint, end: ImagePoint) {
        const element = drawingSurfaceRef.current;
        const bounds = element && renderedSize(element);

        if (!bounds || !onAddArea) {
            setAnnouncement("Unable to measure the image area.");
            return false;
        }

        const rect = normalizedImageArea(
            start,
            end,
            bounds.width,
            bounds.height,
        );

        if (!rect) {
            setAnnouncement(
                `The area must be at least ${MIN_IMAGE_AREA_PX} pixels wide and high. Choose a larger area.`,
            );
            return false;
        }

        onAddArea(pageNumber, image.imageId, rect);

        setAnchor(null);
        setDraftEnd(null);
        setSelectedAreaId(null);
        setAnnouncement("Image redaction area added.");
        return true;
    }

    function handlePointerDown(
        event: ReactPointerEvent<HTMLDivElement>,
    ) {
        if (!canDraw || event.button !== 0) {
            return;
        }

        const point = pointerPoint(event);

        if (!point) {
            return;
        }

        event.preventDefault();
        event.currentTarget.focus();

        pointerStartRef.current = point;
        setDraftEnd(point);
        setKeyboardActive(false);

        event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(
        event: ReactPointerEvent<HTMLDivElement>,
    ) {
        if (!canDraw) {
            return;
        }

        const point = pointerPoint(event);

        if (!point) {
            return;
        }

        if (anchor || pointerStartRef.current) {
            setDraftEnd(point);
        }
    }

    function handlePointerUp(
        event: ReactPointerEvent<HTMLDivElement>,
    ) {
        if (!canDraw || !pointerStartRef.current) {
            return;
        }

        const start = pointerStartRef.current;
        pointerStartRef.current = null;

        const point = pointerPoint(event);

        if (!point) {
            setDraftEnd(null);
            return;
        }

        if (anchor) {
            finishArea(anchor, point);
            return;
        }

        if (finishArea(start, point)) {
            return;
        }

        // A click without a sufficiently large drag selects
        // the first corner. The next click selects the opposite.
        setAnchor(start);
        setDraftEnd(point);
        setAnnouncement(
            "First corner selected. Click the opposite corner, or press Escape to cancel.",
        );
    }

    function handleKeyboard(
        event: ReactKeyboardEvent<HTMLDivElement>,
    ) {
        if (!canDraw) {
            return;
        }

        const directions: Record<string, ImagePoint> = {
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
        };

        const direction = directions[event.key];

        if (direction) {
            event.preventDefault();

            const bounds = renderedSize(event.currentTarget);

            if (!bounds) {
                return;
            }

            const step = event.shiftKey ? 20 : 40;

            const next = {
                x: clamp01(
                    cursor.x + direction.x * step / bounds.width,
                ),
                y: clamp01(
                    cursor.y + direction.y * step / bounds.height,
                ),
            };

            setCursor(next);
            setKeyboardActive(true);

            if (anchor) {
                setDraftEnd(next);
            }

            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            setAnchor(null);
            setDraftEnd(null);
            setAnnouncement("Area drawing cancelled.");
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            setKeyboardActive(true);

            if (!anchor) {
                setAnchor(cursor);
                setDraftEnd(cursor);
                setAnnouncement(
                    "First corner selected. Use arrow keys and press Enter to finish.",
                );
            } else {
                finishArea(anchor, cursor);
            }
        }
    }

    const previewStart = anchor ?? pointerStartRef.current;

    const draftRect = (
        previewStart &&
        draftEnd &&
        normalizedImageArea(
            previewStart,
            draftEnd,
            1,
            1,
            0,
        )
    );

    const label = `Image ${imageNumber} on page ${pageNumber}`;

    return (
        <div className="jr-review-image-panel">
            <p className="govuk-body-s jr-review-image-title">
                {label}
            </p>

            <div className="jr-review-image-preview">
                <div
                    className="jr-review-image-frame"
                    style={{
                        position: "relative",
                        width: `${Math.min(dimensions.width, MAX_IMAGE_WIDTH_PX)}px`,
                        maxWidth: "100%",
                        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
                    }}
                >
                    {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={imageSrc}
                            alt={image.alt || label}
                            className="jr-review-image"
                        />
                    ) : (
                        <div
                            className="jr-review-image-placeholder"
                            role="img"
                            aria-label={label}
                        >
                            Image preview unavailable
                        </div>
                    )}

                    <svg
                        className="jr-review-image-area-overlay"
                        aria-hidden="true"
                    >
                        {areas.map((area) => (
                            <rect
                                key={area.areaId}
                                {...svgRectangle(area.rect)}
                                fill={
                                    isPreviewMode
                                        ? "#0b0c0c"
                                        : "rgba(244, 119, 56, 0.55)"
                                }
                                stroke={
                                    isPreviewMode
                                        ? "#0b0c0c"
                                        : "#f47738"
                                }
                                strokeWidth={
                                    selectedAreaId === area.areaId
                                        ? 4
                                        : 2
                                }
                            />
                        ))}

                        {canDraw && draftRect && (
                            <rect
                                {...svgRectangle(draftRect)}
                                fill="rgba(244, 119, 56, 0.25)"
                                stroke="#f47738"
                                strokeWidth={2}
                                strokeDasharray="6 4"
                            />
                        )}

                        {canDraw && keyboardActive && (
                            <circle
                                cx={`${cursor.x * 100}%`}
                                cy={`${cursor.y * 100}%`}
                                r={6}
                                fill="#ffffff"
                                stroke="#0b0c0c"
                                strokeWidth={2}
                            />
                        )}
                    </svg>

                    {isManuallyRedacted && (
                        <div
                            aria-hidden="true"
                            className={[
                                "jr-review-image-redaction",
                                isPreviewMode
                                    ? "jr-review-image-redaction--preview"
                                    : "",
                            ].filter(Boolean).join(" ")}
                        />
                    )}

                    {!isPreviewMode && showButton && (
                        <div
                            ref={drawingSurfaceRef}
                            className="jr-review-image-drawing-surface"
                            role="button"
                            tabIndex={canDraw ? 0 : -1}
                            aria-disabled={!canDraw}
                            aria-label={`Draw a redaction area on ${label}`}
                            aria-describedby={guidanceId}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={() => {
                                pointerStartRef.current = null;
                                setDraftEnd(anchor);
                            }}
                            onKeyDown={handleKeyboard}
                        />
                    )}
                </div>
            </div>

            {!isPreviewMode && showButton && (
                <>
                    <p
                        id={guidanceId}
                        className="govuk-hint govuk-!-margin-top-2"
                        tabIndex={0}
                    >
                        Draw an area by dragging or clicking two corners.
                        Keyboard: arrow keys move the cursor 40 pixels;
                        Shift and arrow keys move it 20 pixels.
                        Press Enter to select each corner, or Escape to cancel.
                    </p>

                    <div className="jr-review-image-meta">
                        <button
                            type="button"
                            className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                            disabled={!isRedactMode}
                            onClick={() => onToggle(pageNumber, image.imageId)}
                        >
                            {isManuallyRedacted
                                ? "Disclose image"
                                : "Redact whole image"}
                        </button>
                    </div>

                    {areas.length > 0 && (
                        <div className="jr-review-image-area-list">
                            <p className="govuk-body-s govuk-!-margin-bottom-2">
                                Redaction areas
                            </p>

                            <ol>
                                {areas.map((area, index) => (
                                    <li key={area.areaId}>
                                        <button
                                            type="button"
                                            className="govuk-link jr-review-image-area-select"
                                            disabled={!canEditAreas}
                                            aria-pressed={
                                                selectedAreaId === area.areaId
                                            }
                                            onClick={() => {
                                                setSelectedAreaId(area.areaId);
                                                setAnnouncement(
                                                    `Area ${index + 1} selected.`,
                                                );
                                            }}
                                        >
                                            Area {index + 1}
                                        </button>

                                        <button
                                            type="button"
                                            className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                                            disabled={!canEditAreas}
                                            aria-label={`Remove area ${index + 1} from ${label}`}
                                            onClick={() => {
                                                onRemoveArea?.(
                                                    pageNumber,
                                                    image.imageId,
                                                    area.areaId,
                                                );
                                                setSelectedAreaId(null);
                                                setAnnouncement(
                                                    `Area ${index + 1} removed.`,
                                                );
                                                drawingSurfaceRef.current?.focus();
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </>
            )}

            <span
                className="govuk-visually-hidden"
                role="status"
                aria-live="polite"
            >
                {announcement}
            </span>
        </div>
    );
}
