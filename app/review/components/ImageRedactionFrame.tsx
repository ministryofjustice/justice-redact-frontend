import type { ReviewImage } from "../types";

const PDF_TO_CSS_SCALE = 96 / 72;

function getImageDimensions(image: ReviewImage) {
    return {
        width: image.bbox
            ? `${(image.bbox.x1 - image.bbox.x0) * PDF_TO_CSS_SCALE}px`
            : "200px",
        height: image.bbox
            ? `${(image.bbox.y1 - image.bbox.y0) * PDF_TO_CSS_SCALE}px`
            : "150px",
    };
}

type ImageRedactionFrameProps = {
    image: ReviewImage;
    pageNumber: number;
    isPreviewMode: boolean;
    isManuallyRedacted: boolean;
    onToggle: (pageNumber: number, imageId: string) => void;
    showButton?: boolean;
};

export default function ImageRedactionFrame({
    image,
    pageNumber,
    isPreviewMode,
    isManuallyRedacted,
    onToggle,
    showButton = true,
}: ImageRedactionFrameProps) {
    const { width, height } = getImageDimensions(image);
    const imageSrc = image.imageUrl
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${image.imageUrl}`
        : null;

    return (
        <div className="jr-review-image-panel">
            <div className="jr-review-image-preview">
                <div
                    className="jr-review-image-frame"
                    style={{
                        position: "relative",
                        display: "inline-block",
                        width,
                        height,
                    }}
                >
                    {imageSrc ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={imageSrc}
                                alt={image.alt || "Image extracted from uploaded document"}
                                className="jr-review-image"
                                style={{ width, height, display: "block" }}
                            />
                        </>
                    ) : (
                        <div
                            className="jr-review-image-placeholder"
                            role="img"
                            aria-label="Image extracted from uploaded document"
                            style={{
                                width,
                                height,
                                background: "#f3f2f1",
                                border: "2px dashed #b1b4b6",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#505a5f",
                                boxSizing: "border-box",
                            }}
                        >
                            Image
                        </div>
                    )}

                    {isManuallyRedacted && (
                        <div
                            aria-hidden="true"
                            style={{
                                position: "absolute",
                                inset: 0,
                                background: isPreviewMode ? "#000" : "#f6d7d2",
                                border: isPreviewMode ? "2px solid #000" : "2px solid #d4351c",
                                opacity: isPreviewMode ? 1 : 0.75,
                                pointerEvents: "none",
                                boxSizing: "border-box",
                            }}
                        />
                    )}
                </div>
            </div>

            {showButton && !isPreviewMode && (
                <div className="jr-review-image-meta govuk-!-margin-top-2">
                    <button
                        type="button"
                        className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                        onClick={() => onToggle(pageNumber, image.imageId)}
                    >
                        {isManuallyRedacted ? "Disclose image" : "Redact image"}
                    </button>
                </div>
            )}
        </div>
    );
}