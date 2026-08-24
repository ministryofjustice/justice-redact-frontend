import ImageRedactionFrame from "./ImageRedactionFrame";
import {
    getBoldRangesFromTextSpans,
    getExactLineRanges,
    renderStyledTextSegments,
    renderTextSegments,
} from "../textRendering";
import type {
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
    isPreviewMode: boolean;
    onToggleImageRedaction: (pageNumber: number, imageId: string) => void;
};

function bboxesVerticallyOverlap(
    a: { y0: number; y1: number } | null,
    b: { y0: number; y1: number } | null
) {
    if (!a || !b) return false;

    const overlap = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const smallerHeight = Math.min(a.y1 - a.y0, b.y1 - b.y0);

    return smallerHeight > 0 && overlap / smallerHeight >= 0.5;
}

function getImageForTableRow(row: ReviewTableRow, images: ReviewImage[]) {
    const rowBox = row.cells.find((cell) => cell.bbox)?.bbox ?? null;
    return images.find((image) => bboxesVerticallyOverlap(rowBox, image.bbox));
}

function imageBelongsToAnyTableRow(image: ReviewImage, tables: ReviewTable[]) {
    if (!image.bbox || !tables.length) return false;

    return tables.some((table) =>
        table.rows.some((row) =>
            bboxesVerticallyOverlap(
                row.cells.find((cell) => cell.bbox)?.bbox ?? null,
                image.bbox
            )
        )
    );
}

export default function PageContent({
    page,
    findings,
    manualSelections,
    isPreviewMode,
    onToggleImageRedaction,
}: PageContentProps) {
    const textFindings = findings.filter(
        (finding) => finding.kind === "text" && !!finding.itemId
    );

    const tableFindings = findings.filter(
        (finding) => finding.kind === "table_cell" && !!finding.cellId
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
            .filter((image) => !imageBelongsToAnyTableRow(image, page.tables ?? []))
            .map((image) => ({
                kind: "image" as const,
                y: image.bbox?.y0 ?? Number.POSITIVE_INFINITY,
                image,
            })),
    ].sort((a, b) => a.y - b.y);

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
                                selection.kind === "text" && selection.itemId === item.itemId
                        )
                        .map((selection) => ({
                            id: selection.id,
                            start: selection.start,
                            end: selection.end,
                        }));

                    const sourceText = item.text;
                    const pdfBoldRanges = getBoldRangesFromTextSpans(sourceText, item.textSpans);
                    const fallbackBoldRanges = getExactLineRanges(sourceText, "Case Note");
                    const boldRanges = [...pdfBoldRanges, ...fallbackBoldRanges];

                    return (
                        <div
                            key={`text-${item.itemId}-${blockIndex}`}
                            className="jr-review-block redactable"
                            data-page-number={page.pageNumber}
                            data-item-id={item.itemId}
                        >
                            <p className="govuk-body">
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
                            </p>
                        </div>
                    );
                }

                if (block.kind === "table") {
                    const table = block.table;

                    return (
                        <div
                            key={`table-${table.tableId}-${blockIndex}`}
                            className="jr-review-table-wrapper"
                        >
                            <table className="govuk-table govuk-table--small-text-until-tablet">
                                <tbody className="govuk-table__body">
                                    {table.rows.map((row) => {
                                        const rowImage = getImageForTableRow(row, page.images ?? []);
                                        const rowImageManual = rowImage
                                            ? manualSelections.some(
                                                (selection) =>
                                                    selection.kind === "image" &&
                                                    selection.imageId === rowImage.imageId
                                            )
                                            : false;

                                        return (
                                            <tr
                                                key={`${table.tableId}-${row.rowIndex}`}
                                                className="govuk-table__row"
                                            >
                                                {rowImage && (
                                                    <td className="govuk-table__cell">
                                                        <ImageRedactionFrame
                                                            image={rowImage}
                                                            pageNumber={page.pageNumber}
                                                            isPreviewMode={isPreviewMode}
                                                            isManuallyRedacted={rowImageManual}
                                                            onToggle={onToggleImageRedaction}
                                                        />
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
                                                        .map((selection) => ({
                                                            id: selection.id,
                                                            start: selection.start,
                                                            end: selection.end,
                                                        }));

                                                    const isManuallyRedacted = manualForCell.length > 0;
                                                    const hasSuggestion = suggestionsForCell.length > 0;
                                                    const sourceText = cell.text;
                                                    const boldRanges: Array<{ start: number; end: number }> = [];

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
                            isPreviewMode={isPreviewMode}
                            isManuallyRedacted={manualForImage}
                            onToggle={onToggleImageRedaction}
                        />
                    </div>
                );
            })}
        </div>
    );
}