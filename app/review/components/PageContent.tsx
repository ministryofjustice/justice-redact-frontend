import ImageRedactionFrame from "./ImageRedactionFrame";
import {
    buildAccessibleReviewText,
    getBoldRangesFromTextSpans,
    getExactLineRanges,
    renderStyledTextSegments,
    renderTextSegments,
} from "../textRendering";
import type {
    ImageAreaRect,
    ManualImageAreaDecision,
    ManualDecision,
    ManualTableCellDecision,
    ManualTextDecision,
    PageContentBlock,
    ReviewFinding,
    ReviewImage,
    ReviewPageData,
    ReviewTable,
    ReviewTableRow,
} from "../types";

type PageContentProps = {
    page: ReviewPageData;
    findings: ReviewFinding[];
    manualSelections: ManualDecision[];
    documentManualSelections?: ManualDecision[];
    isPreviewMode: boolean;
    isRedactMode?: boolean;
    isReadOnly?: boolean;
    onToggleImageRedaction: (pageNumber: number, imageId: string) => void;
    onAddImageArea?: (
        pageNumber: number,
        imageId: string,
        rect: ImageAreaRect,
    ) => void;
    onRemoveImageArea?: (
        pageNumber: number,
        imageId: string,
        areaId: string,
    ) => void;
};

type ImageBounds = NonNullable<ReviewImage["bbox"]>;

type TableRowImageAssociations = {
    imagesByRow: Map<ReviewTableRow, ReviewImage[]>;
    assignedImages: Set<ReviewImage>;
};

function isValidImageBounds(
    bounds: ReviewImage["bbox"],
): bounds is ImageBounds {
    return (
        bounds !== null &&
        Number.isFinite(bounds.x0) &&
        Number.isFinite(bounds.y0) &&
        Number.isFinite(bounds.x1) &&
        Number.isFinite(bounds.y1) &&
        bounds.x1 > bounds.x0 &&
        bounds.y1 > bounds.y0
    );
}

function getTableRowBounds(
    row: ReviewTableRow,
): ImageBounds | null {
    const boxes = row.cells
        .map(cell => cell.bbox)
        .filter(isValidImageBounds);

    if (boxes.length === 0) {
        return null;
    }

    return {
        x0: Math.min(...boxes.map(box => box.x0)),
        y0: Math.min(...boxes.map(box => box.y0)),
        x1: Math.max(...boxes.map(box => box.x1)),
        y1: Math.max(...boxes.map(box => box.y1)),
    };
}

function associateImagesWithTableRows(
    images: ReviewImage[],
    tables: ReviewTable[],
): TableRowImageAssociations {
    const imagesByRow = new Map<
        ReviewTableRow,
        ReviewImage[]
    >();

    const assignedImages = new Set<ReviewImage>();

    const candidates = tables.flatMap(table =>
        table.rows.flatMap(row => {
            const bounds = getTableRowBounds(row);

            return bounds ? [{ row, bounds }] : [];
        }),
    );

    // Preserve extraction order within each row.
    for (const image of images) {
        const imageBox = image.bbox;

        if (!isValidImageBounds(imageBox)) {
            continue;
        }

        let bestRow: ReviewTableRow | null = null;
        let bestOverlap = -1;
        let bestHorizontalGap = Number.POSITIVE_INFINITY;
        let bestCentreDistance = Number.POSITIVE_INFINITY;

        for (const { row, bounds } of candidates) {
            const overlap = Math.max(
                0,
                Math.min(bounds.y1, imageBox.y1) -
                    Math.max(bounds.y0, imageBox.y0),
            );

            const smallerHeight = Math.min(
                bounds.y1 - bounds.y0,
                imageBox.y1 - imageBox.y0,
            );

            // Retain the existing vertical-overlap threshold.
            if (overlap / smallerHeight < 0.5) {
                continue;
            }

            const horizontalGap = Math.max(
                0,
                bounds.x0 - imageBox.x1,
                imageBox.x0 - bounds.x1,
            );

            const centreDistance = Math.abs(
                (bounds.y0 + bounds.y1) / 2 -
                (imageBox.y0 + imageBox.y1) / 2,
            );

            // Prefer the strongest vertical overlap.
            // Resolve ties by horizontal proximity, then
            // vertical centre proximity, then source order.
            const isBetterMatch = (
                overlap > bestOverlap ||
                (
                    overlap === bestOverlap &&
                    horizontalGap < bestHorizontalGap
                ) ||
                (
                    overlap === bestOverlap &&
                    horizontalGap === bestHorizontalGap &&
                    centreDistance < bestCentreDistance
                )
            );

            if (isBetterMatch) {
                bestRow = row;
                bestOverlap = overlap;
                bestHorizontalGap = horizontalGap;
                bestCentreDistance = centreDistance;
            }
        }

        if (bestRow !== null) {
            const rowImages = imagesByRow.get(bestRow) ?? [];

            rowImages.push(image);

            imagesByRow.set(bestRow, rowImages);
            assignedImages.add(image);
        }
    }

    return {
        imagesByRow,
        assignedImages,
    };
}

type TextualManualDecision =
    | ManualTextDecision
    | ManualTableCellDecision;

function getOrderedPageManualSelections(
    page: ReviewPageData,
    pageContentBlocks: PageContentBlock[],
    manualSelections: ManualDecision[]
): TextualManualDecision[] {
    const pageSelections = manualSelections.filter(
        (
            selection
        ): selection is TextualManualDecision =>
            selection.pageNumber === page.pageNumber &&
            (selection.kind !== "image" && selection.kind !== "image_area")
    );

    const orderedSelections: TextualManualDecision[] = [];

    pageContentBlocks.forEach((block) => {
        if (block.kind === "text") {
            orderedSelections.push(
                ...pageSelections
                    .filter(
                        (
                            selection
                        ): selection is ManualTextDecision =>
                            selection.kind === "text" &&
                            selection.itemId ===
                            block.item.itemId
                    )
                    .sort(
                        (left, right) =>
                            left.start - right.start ||
                            left.end - right.end
                    )
            );

            return;
        }

        if (block.kind !== "table") {
            return;
        }

        block.table.rows.forEach((row) => {
            row.cells.forEach((cell) => {
                orderedSelections.push(
                    ...pageSelections
                        .filter(
                            (
                                selection
                            ): selection is ManualTableCellDecision =>
                                selection.kind ===
                                "table_cell" &&
                                selection.tableId ===
                                block.table.tableId &&
                                selection.cellId ===
                                cell.cellId
                        )
                        .sort(
                            (left, right) =>
                                left.start -
                                right.start ||
                                left.end -
                                right.end
                        )
                );
            });
        });
    });

    return orderedSelections;
}

function getRedactionAnnouncementFlags(
    selection: TextualManualDecision,
    orderedPageSelections: TextualManualDecision[],
    documentManualSelections: ManualDecision[]
) {
    if (!selection.redactionGroupId) {
        return {
            announceStart: true,
            announceEnd: true,
        };
    }

    const groupId = selection.redactionGroupId;

    const groupSelectionsOnPage =
        orderedPageSelections.filter(
            (candidate) =>
                candidate.redactionGroupId === groupId
        );

    const firstSelectionOnPage =
        groupSelectionsOnPage[0];

    const lastSelectionOnPage =
        groupSelectionsOnPage[
        groupSelectionsOnPage.length - 1
        ];

    const hasEarlierPageSelection =
        documentManualSelections.some(
            (candidate) =>
                (candidate.kind !== "image" && candidate.kind !== "image_area") &&
                candidate.redactionGroupId === groupId &&
                candidate.pageNumber <
                selection.pageNumber
        );

    const hasLaterPageSelection =
        documentManualSelections.some(
            (candidate) =>
                (candidate.kind !== "image" && candidate.kind !== "image_area") &&
                candidate.redactionGroupId === groupId &&
                candidate.pageNumber >
                selection.pageNumber
        );

    return {
        announceStart:
            selection.id === firstSelectionOnPage?.id &&
            !hasEarlierPageSelection,
        announceEnd:
            selection.id === lastSelectionOnPage?.id &&
            !hasLaterPageSelection,
    };
}

export default function PageContent({
    page,
    findings,
    manualSelections,
    documentManualSelections = manualSelections,
    isPreviewMode,
    isRedactMode = true,
    isReadOnly = false,
    onToggleImageRedaction,
    onAddImageArea,
    onRemoveImageArea,
}: PageContentProps) {
    const textFindings = findings.filter(
        (finding) => finding.kind === "text" && !!finding.itemId
    );

    const tableFindings = findings.filter(
        (finding) => finding.kind === "table_cell" && !!finding.cellId
    );

    const {
        imagesByRow,
        assignedImages,
    } = associateImagesWithTableRows(
        page.images ?? [],
        page.tables ?? [],
    );

    const pageContentBlocks: PageContentBlock[] = [
        ...page.textItems.map((item) => ({
            kind: "text" as const,
            y: item.bbox?.y0 ?? Number.POSITIVE_INFINITY,
            item,
        })),
        ...(page.tables ?? []).map((table) => ({
            kind: "table" as const,
            y: table.bbox?.y0 ?? Number.POSITIVE_INFINITY,
            table,
        })),
        ...(page.images ?? [])
            .filter((image) => !assignedImages.has(image))
            .map((image) => ({
                kind: "image" as const,
                y: image.bbox?.y0 ?? Number.POSITIVE_INFINITY,
                image,
            })),
    ].sort((a, b) => a.y - b.y);

    const orderedPageManualSelections =
        getOrderedPageManualSelections(
            page,
            pageContentBlocks,
            manualSelections
        );

    return (
        <div className="jr-review-page__content">
            {pageContentBlocks.map((block, blockIndex) => {
                if (block.kind === "text") {
                    const item = block.item;

                    const suggestionsForItem = textFindings.filter(
                        (finding) =>
                            finding.itemId === item.itemId &&
                            typeof finding.entityStart === "number" &&
                            typeof finding.entityEnd === "number"
                    );

                    const manualForItem = manualSelections
                        .filter(
                            (selection): selection is ManualTextDecision =>
                                selection.kind === "text" &&
                                selection.itemId === item.itemId
                        )
                        .map((selection) => {
                            const {
                                announceStart,
                                announceEnd,
                            } = getRedactionAnnouncementFlags(
                                selection,
                                orderedPageManualSelections,
                                documentManualSelections
                            );

                            return {
                                id: selection.id,
                                start: selection.start,
                                end: selection.end,
                                redactionGroupId:
                                    selection.redactionGroupId,
                                announceStart,
                                announceEnd,
                            };
                        });

                    const sourceText = item.text;
                    const pdfBoldRanges = getBoldRangesFromTextSpans(sourceText, item.textSpans);
                    const fallbackBoldRanges = getExactLineRanges(sourceText, "Case Note");
                    const boldRanges = [...pdfBoldRanges, ...fallbackBoldRanges];

                    const accessibleText = buildAccessibleReviewText(
                        sourceText,
                        suggestionsForItem,
                        manualForItem,
                        isPreviewMode
                    );

                    return (
                        <div
                            key={`text-${item.itemId}-${blockIndex}`}
                            className="jr-review-block redactable"
                            data-page-number={page.pageNumber}
                            data-item-id={item.itemId}
                        >
                            <p className="govuk-body">
                                <span
                                    className="govuk-visually-hidden"
                                    data-selection-offset-ignore
                                    aria-live="polite"
                                >
                                    {accessibleText}
                                </span>

                                <span aria-hidden="true">
                                    {item.textSpans?.length
                                        ? renderStyledTextSegments(
                                            item.textSpans,
                                            suggestionsForItem,
                                            manualForItem,
                                            isPreviewMode
                                        )
                                        : renderTextSegments(
                                            sourceText,
                                            suggestionsForItem,
                                            manualForItem,
                                            isPreviewMode,
                                            boldRanges
                                        )}
                                </span>
                            </p>
                        </div>
                    );
                }

                if (block.kind === "table") {
                    const table = block.table;

                    const hasImageColumn = table.rows.some(
                        row => imagesByRow.has(row),
                    );

                    return (
                        <div
                            key={`table-${table.tableId}-${blockIndex}`}
                            className="jr-review-table-wrapper"
                        >
                            <table className="govuk-table govuk-table--small-text-until-tablet">
                                <tbody className="govuk-table__body">
                                    {table.rows.map((row) => {
                                        const rowImages = imagesByRow.get(row) ?? [];

                                        return (
                                            <tr
                                                key={`${table.tableId}-${row.rowIndex}`}
                                                className="govuk-table__row"
                                            >
                                                {hasImageColumn && (
                                                    <td className="govuk-table__cell jr-review-table-images">
                                                        {rowImages.map(rowImage => (
                                                            <ImageRedactionFrame
                                                                key={rowImage.imageId}
                                                                image={rowImage}
                                                                pageNumber={page.pageNumber}
                                                                imageNumber={rowImage.imageNumber}
                                                                isPreviewMode={isPreviewMode}
                                                                isRedactMode={isRedactMode && !isReadOnly}
                                                                isManuallyRedacted={manualSelections.some(
                                                                    selection =>
                                                                        selection.kind === "image" &&
                                                                        selection.pageNumber === page.pageNumber &&
                                                                        selection.imageId === rowImage.imageId,
                                                                )}
                                                                areas={manualSelections.filter(
                                                                    (selection): selection is ManualImageAreaDecision =>
                                                                        selection.kind === "image_area" &&
                                                                        selection.pageNumber === page.pageNumber &&
                                                                        selection.imageId === rowImage.imageId,
                                                                )}
                                                                showButton={!isReadOnly}
                                                                onToggle={onToggleImageRedaction}
                                                                onAddArea={onAddImageArea}
                                                                onRemoveArea={onRemoveImageArea}
                                                            />
                                                        ))}
                                                    </td>
                                                )}

                                                {row.cells.map((cell) => {
                                                    const suggestionsForCell = tableFindings.filter(
                                                        (finding) =>
                                                            finding.tableId === table.tableId &&
                                                            finding.cellId === cell.cellId &&
                                                            typeof finding.entityStart === "number" &&
                                                            typeof finding.entityEnd === "number"
                                                    );

                                                    const manualForCell = manualSelections
                                                        .filter(
                                                            (
                                                                selection
                                                            ): selection is ManualTableCellDecision =>
                                                                selection.kind === "table_cell" &&
                                                                selection.tableId === table.tableId &&
                                                                selection.cellId === cell.cellId
                                                        )
                                                        .map((selection) => {
                                                            const {
                                                                announceStart,
                                                                announceEnd,
                                                            } = getRedactionAnnouncementFlags(
                                                                selection,
                                                                orderedPageManualSelections,
                                                                documentManualSelections
                                                            );

                                                            return {
                                                                id: selection.id,
                                                                start: selection.start,
                                                                end: selection.end,
                                                                redactionGroupId:
                                                                    selection.redactionGroupId,
                                                                announceStart,
                                                                announceEnd,
                                                            };
                                                        });

                                                    const isManuallyRedacted = manualForCell.length > 0;
                                                    const hasSuggestion = suggestionsForCell.length > 0;
                                                    const sourceText = cell.text;
                                                    const boldRanges: Array<{ start: number; end: number }> = [];

                                                    const accessibleText = buildAccessibleReviewText(
                                                        sourceText,
                                                        suggestionsForCell,
                                                        manualForCell,
                                                        isPreviewMode
                                                    );

                                                    const cellClassName = [
                                                        cell.isNumeric
                                                            ? "govuk-table__cell govuk-table__cell--numeric"
                                                            : "govuk-table__cell",
                                                        "redactable",
                                                        hasSuggestion ? "jr-table-cell--has-suggestion" : "",
                                                        isManuallyRedacted ? "jr-table-cell--manual-redaction" : "",
                                                    ]
                                                        .join(" ")
                                                        .trim();

                                                    const headerClassName = cellClassName.replace(
                                                        "govuk-table__cell",
                                                        "govuk-table__header"
                                                    );

                                                    const content = (
                                                        <span className="jr-table-cell-text" style={{ whiteSpace: "pre-line" }}>
                                                            <span
                                                                className="govuk-visually-hidden"
                                                                data-selection-offset-ignore
                                                                aria-live="polite"
                                                            >
                                                                {accessibleText}
                                                            </span>

                                                            <span aria-hidden="true">
                                                                {cell.textSpans?.length
                                                                    ? renderStyledTextSegments(
                                                                        cell.textSpans,
                                                                        suggestionsForCell,
                                                                        manualForCell,
                                                                        isPreviewMode
                                                                    )
                                                                    : renderTextSegments(
                                                                        sourceText,
                                                                        suggestionsForCell,
                                                                        manualForCell,
                                                                        isPreviewMode,
                                                                        boldRanges
                                                                    )}
                                                            </span>
                                                        </span>
                                                    );

                                                    if (cell.isHeader) {
                                                        return (
                                                            <th
                                                                key={cell.cellId}
                                                                scope="col"
                                                                className={headerClassName}
                                                                data-page-number={page.pageNumber}
                                                                data-table-id={table.tableId}
                                                                data-cell-id={cell.cellId}
                                                            >
                                                                {content}
                                                            </th>
                                                        );
                                                    }

                                                    return (
                                                        <td
                                                            key={cell.cellId}
                                                            className={cellClassName}
                                                            data-page-number={page.pageNumber}
                                                            data-table-id={table.tableId}
                                                            data-cell-id={cell.cellId}
                                                        >
                                                            {content}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                }

                const image = block.image;
                const manualForImage = manualSelections.some(
                    (selection) =>
                        selection.kind === "image" && selection.imageId === image.imageId
                );

                return (
                    <div
                        key={`image-${image.imageId}-${blockIndex}`}
                        className="jr-review-image-wrapper govuk-!-margin-top-6"
                    >
                        <ImageRedactionFrame
                            image={image}
                            pageNumber={page.pageNumber}
                            imageNumber={image.imageNumber}
                            isPreviewMode={isPreviewMode}
                            isRedactMode={isRedactMode && !isReadOnly}
                            isManuallyRedacted={manualForImage}
                            areas={manualSelections.filter(
                                (selection): selection is ManualImageAreaDecision =>
                                    selection.kind === "image_area" &&
                                    selection.pageNumber === page.pageNumber &&
                                    selection.imageId === image.imageId
                            )}
                            showButton={!isReadOnly}
                            onToggle={onToggleImageRedaction}
                            onAddArea={onAddImageArea}
                            onRemoveArea={onRemoveImageArea}
                        />
                    </div>
                );
            })}
        </div>
    );
}