"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PDF_TO_CSS_SCALE = 96 / 72;
const PAGES_PER_BATCH = 50;

type ReviewBBox = { x0: number; y0: number; x1: number; y1: number };

type ReviewTextItem = {
  itemId: string;
  text: string;
  renderText: string;
  bbox: ReviewBBox | null;
};

type ReviewTableCell = {
  cellId: string;
  tableId: string;
  rowIndex: number;
  colIndex: number;
  text: string;
  renderText: string;
  bbox: ReviewBBox | null;
  isHeader: boolean;
  isNumeric: boolean;
};

type ReviewTableRow = { rowIndex: number; cells: ReviewTableCell[] };
type ReviewTable = { tableId: string; bbox: ReviewBBox | null; rows: ReviewTableRow[] };

type ReviewImage = {
  imageId: string;
  imageRecordId: string | null;
  imageUrl: string | null;
  alt: string | null;
  bbox: ReviewBBox | null;
};

type ReviewPageData = {
  pageNumber: number;
  pageId?: string;
  textItems: ReviewTextItem[];
  tables: ReviewTable[];
  images: ReviewImage[];
};

type ReviewFinding = {
  id: string;
  kind: "text" | "table_cell" | "image";
  pageNumber: number;
  itemId: string | null;
  tableId: string | null;
  cellId: string | null;
  imageId: string | null;
  imageRecordId: string | null;
  entityType: string;
  entityText: string;
  entityStart: number | null;
  entityEnd: number | null;
  entityScore: number;
  context: string;
  decision: string;
  sectionLabel: string | null;
};

type ReviewResponse = {
  documentId: string;
  filename: string;
  status: string;
  pages: ReviewPageData[];
  findings: ReviewFinding[];
  subjectDetails: {
    subjectName: string;
    subjectPrisonNumber: string;
    otherPhrases: string[];
  };
  summary: {
    totalPages: number;
    totalTextItems?: number;
    totalFindings: number;
  };
};

type PageContentBlock =
  | { kind: "text"; y: number; item: ReviewTextItem }
  | { kind: "table"; y: number; table: ReviewTable }
  | { kind: "image"; y: number; image: ReviewImage };

type ManualTextDecision = {
  id: string;
  documentId: string;
  kind: "text";
  pageNumber: number;
  itemId: string;
  start: number;
  end: number;
  text: string;
};

type ManualTableCellDecision = {
  id: string;
  documentId: string;
  kind: "table_cell";
  pageNumber: number;
  tableId: string;
  cellId: string;
  start: number;
  end: number;
  text: string;
};

type ManualImageDecision = {
  id: string;
  documentId: string;
  kind: "image";
  pageNumber: number;
  imageId: string;
};

type ManualDecision = ManualTextDecision | ManualTableCellDecision | ManualImageDecision;

type TextSpan = { id?: string; start: number; end: number };
type RenderRange = { start: number; end: number; className: string; key: string; manualId?: string };
type ManualSpan = { pageNumber: number; itemId: string; start: number; end: number };

function clampRangeValue(value: number, max: number) {
  return Math.max(0, Math.min(max, value));
}

function mergeSpans(spans: ManualSpan[]) {
  const sorted = spans
    .filter((s) => s.end > s.start)
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Array<{ start: number; end: number }> = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ start: span.start, end: span.end });
    } else if (span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ start: span.start, end: span.end });
    }
  }
  return merged;
}

function getClosestElementWithAttribute(node: Node | null, attribute: string): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(attribute)) return current;
    current = current.parentNode;
  }
  return null;
}

function getTextOffsetWithinItem(container: HTMLElement, targetNode: Node, targetOffset: number) {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

function getExactLineRanges(fullText: string, label: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let lineStart = 0;

  while (lineStart <= fullText.length) {
    const newlineIndex = fullText.indexOf("\n", lineStart);
    const lineEnd = newlineIndex === -1 ? fullText.length : newlineIndex;
    const line = fullText.slice(lineStart, lineEnd);

    if (line.trim() === label) {
      const leading = line.match(/^\s*/)?.[0]?.length ?? 0;
      const trailing = line.match(/\s*$/)?.[0]?.length ?? 0;
      const start = lineStart + leading;
      const end = Math.max(start, lineEnd - trailing);
      if (end > start) ranges.push({ start, end });
    }

    if (newlineIndex === -1) break;
    lineStart = newlineIndex + 1;
  }

  return ranges;
}

function getStructuredKeyRanges(text: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const line of text.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) ranges.push({ start: cursor, end: cursor + colonIndex + 1 });
    cursor += line.length + 1;
  }

  return ranges;
}

function renderSliceWithBoldRanges(
  fullText: string,
  sliceStart: number,
  sliceEnd: number,
  boldRanges: Array<{ start: number; end: number }>,
  keyPrefix: string
) {
  const start = clampRangeValue(sliceStart, fullText.length);
  const end = clampRangeValue(sliceEnd, fullText.length);
  if (end <= start) return [];

  const overlaps = boldRanges
    .map((range) => ({ start: Math.max(start, range.start), end: Math.min(end, range.end) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const nodes: React.ReactNode[] = [];
  let cursor = start;

  overlaps.forEach((range, index) => {
    if (cursor < range.start) nodes.push(fullText.slice(cursor, range.start));
    nodes.push(<strong key={`${keyPrefix}-bold-${index}`}>{fullText.slice(range.start, range.end)}</strong>);
    cursor = range.end;
  });

  if (cursor < end) nodes.push(fullText.slice(cursor, end));
  return nodes;
}

function buildRenderRanges(
  text: string,
  suggestions: ReviewFinding[],
  manualSelections: Array<{ id: string; start: number; end: number }>,
  isPreviewMode: boolean
) {
  const clamp = (n: number) => clampRangeValue(n, text.length);

  const manualRanges: RenderRange[] = manualSelections
    .map((selection) => ({
      start: clamp(selection.start),
      end: clamp(selection.end),
      className: isPreviewMode ? "applied-redaction" : "highlight highlight--redaction",
      key: `manual-${selection.id}`,
      manualId: selection.id,
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (isPreviewMode) return manualRanges;

  const suggestionFragments: RenderRange[] = [];
  suggestions.forEach((suggestion) => {
    if (typeof suggestion.entityStart !== "number" || typeof suggestion.entityEnd !== "number") return;

    let fragments = [{ start: clamp(suggestion.entityStart), end: clamp(suggestion.entityEnd) }];

    for (const manual of manualRanges) {
      fragments = fragments.flatMap((fragment) => {
        if (manual.end <= fragment.start || manual.start >= fragment.end) return [fragment];
        const next: Array<{ start: number; end: number }> = [];
        if (fragment.start < manual.start) next.push({ start: fragment.start, end: manual.start });
        if (manual.end < fragment.end) next.push({ start: manual.end, end: fragment.end });
        return next;
      });
    }

    fragments.forEach((fragment, index) => {
      if (fragment.end > fragment.start) {
        suggestionFragments.push({
          start: fragment.start,
          end: fragment.end,
          className: "highlight highlight--suggestion",
          key: `suggestion-${suggestion.id}-${index}`,
        });
      }
    });
  });

  return [...suggestionFragments, ...manualRanges]
    .filter((range) => range.end > range.start && range.start >= 0 && range.end <= text.length)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function renderTextSegments(
  text: string,
  suggestions: ReviewFinding[],
  manualSelections: Array<{ id: string; start: number; end: number }>,
  isPreviewMode: boolean,
  boldRanges: Array<{ start: number; end: number }> = []
) {
  const ranges = buildRenderRanges(text, suggestions, manualSelections, isPreviewMode);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start < cursor) return;

    if (cursor < range.start) {
      nodes.push(
        <span key={`plain-${cursor}-${range.start}`}>
          {renderSliceWithBoldRanges(text, cursor, range.start, boldRanges, `plain-${cursor}-${range.start}`)}
        </span>
      );
    }

    nodes.push(
      <span key={range.key} className={range.className} data-manual-id={range.manualId}>
        {renderSliceWithBoldRanges(text, range.start, range.end, boldRanges, `${range.key}-${range.start}-${range.end}`)}
      </span>
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    nodes.push(
      <span key={`plain-${cursor}-end`}>
        {renderSliceWithBoldRanges(text, cursor, text.length, boldRanges, `plain-${cursor}-end`)}
      </span>
    );
  }

  return nodes;
}

function bboxesVerticallyOverlap(a: ReviewBBox | null, b: ReviewBBox | null) {
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
  return tables.some((table) => table.rows.some((row) => bboxesVerticallyOverlap(row.cells.find((cell) => cell.bbox)?.bbox ?? null, image.bbox)));
}

function getImageDimensions(image: ReviewImage) {
  return {
    width: image.bbox ? `${(image.bbox.x1 - image.bbox.x0) * PDF_TO_CSS_SCALE}px` : "200px",
    height: image.bbox ? `${(image.bbox.y1 - image.bbox.y0) * PDF_TO_CSS_SCALE}px` : "150px",
  };
}

function ImageRedactionFrame({
  image,
  pageNumber,
  isPreviewMode,
  isManuallyRedacted,
  onToggle,
  showButton = true,
}: {
  image: ReviewImage;
  pageNumber: number;
  isPreviewMode: boolean;
  isManuallyRedacted: boolean;
  onToggle: (pageNumber: number, imageId: string) => void;
  showButton?: boolean;
}) {
  const { width, height } = getImageDimensions(image);
  const imageSrc = image.imageUrl ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${image.imageUrl}` : null;

  return (
    <div className="jr-review-image-panel">
      <div className="jr-review-image-preview">
        <div className="jr-review-image-frame" style={{ position: "relative", display: "inline-block", width, height }}>
          {imageSrc ? (
            <img src={imageSrc} alt={image.alt || "Document image"} className="jr-review-image" style={{ width, height, display: "block" }} />
          ) : (
            <div
              className="jr-review-image-placeholder"
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
          <button type="button" className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" onClick={() => onToggle(pageNumber, image.imageId)}>
            {isManuallyRedacted ? "Disclose image" : "Redact image"}
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRangeStart, setSelectedRangeStart] = useState(0);
  const [manualSelections, setManualSelections] = useState<ManualDecision[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isApplyingRedactions, setIsApplyingRedactions] = useState(false);
  const [applyRedactionsError, setApplyRedactionsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReview() {
      if (!documentId) {
        setError("Missing document ID.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setData(null);
        setSelectedRangeStart(0);
        setManualSelections([]);
        setIsPreviewMode(false);
        setIsApplyingRedactions(false);
        setApplyRedactionsError(null);

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.detail || "Failed to load review data.");
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadReview();
  }, [documentId]);

  const visiblePages = useMemo(() => {
    if (!data) return [];
    const start = Math.max(0, selectedRangeStart);
    const endExclusive = Math.min(data.summary.totalPages, start + PAGES_PER_BATCH);

    return data.pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .filter((page) => page.pageNumber >= start && page.pageNumber < endExclusive);
  }, [data, selectedRangeStart]);

  const pageRanges = useMemo(() => {
    const totalPages = data?.summary.totalPages ?? 0;
    const count = Math.ceil(totalPages / PAGES_PER_BATCH);
    return Array.from({ length: count }, (_, index) => {
      const start = index * PAGES_PER_BATCH;
      const end = Math.min(totalPages - 1, start + PAGES_PER_BATCH - 1);
      return { start, end };
    });
  }, [data]);

  const isLastBatch = useMemo(() => {
    if (!data) return false;
    return selectedRangeStart + PAGES_PER_BATCH >= data.summary.totalPages;
  }, [data, selectedRangeStart]);

  function manualSelectionsForCurrentDocument() {
    if (!documentId) return [];
    return manualSelections.filter((selection) => selection.documentId === documentId);
  }

  async function handleApplyRedactions() {
    if (!data || !documentId) return;

    const currentDocumentSelections = manualSelectionsForCurrentDocument();
    if (currentDocumentSelections.length === 0) return;

    try {
      setIsApplyingRedactions(true);
      setApplyRedactionsError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${data.documentId}/apply-redactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: data.documentId,
            decisions: currentDocumentSelections.map((selection) => {
              if (selection.kind === "text") {
                return {
                  kind: "text",
                  pageNumber: selection.pageNumber,
                  itemId: selection.itemId,
                  start: selection.start,
                  end: selection.end,
                  text: selection.text,
                  action: "redact",
                  source: "manual",
                };
              }

              if (selection.kind === "table_cell") {
                return {
                  kind: "table_cell",
                  pageNumber: selection.pageNumber,
                  tableId: selection.tableId,
                  cellId: selection.cellId,
                  start: selection.start,
                  end: selection.end,
                  text: selection.text,
                  action: "redact",
                  source: "manual",
                };
              }

              return {
                kind: "image",
                pageNumber: selection.pageNumber,
                imageId: selection.imageId,
                action: "redact",
                source: "manual",
              };
            }),
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Failed to apply redactions.");
      }

      router.push(`/applying-redactions?documentId=${data.documentId}`);
    } catch (err) {
      setApplyRedactionsError(
        err instanceof Error ? err.message : "Failed to apply redactions."
      );
      setIsApplyingRedactions(false); // only reset on error
    }
  }

  function addOrMergeManualTextSelections(page: ReviewPageData, spansToAdd: ManualSpan[]) {
    if (!documentId || spansToAdd.length === 0) return;

    setManualSelections((prev) => {
      const affectedKeys = new Set(spansToAdd.map((span) => `${span.pageNumber}::${span.itemId}`));

      const remaining = prev.filter((selection) => {
        if (selection.kind !== "text") return true;
        return !affectedKeys.has(`${selection.pageNumber}::${selection.itemId}`);
      });

      const replacements: ManualTextDecision[] = [];

      for (const key of affectedKeys) {
        const [pageNumberString, itemId] = key.split("::");
        const pageNumber = Number(pageNumberString);
        const itemText = page.textItems.find((item) => item.itemId === itemId)?.renderText ?? page.textItems.find((item) => item.itemId === itemId)?.text ?? "";

        const existing = prev.filter((selection): selection is ManualTextDecision => selection.kind === "text" && selection.pageNumber === pageNumber && selection.itemId === itemId);
        const added = spansToAdd.filter((span) => span.pageNumber === pageNumber && span.itemId === itemId);

        mergeSpans([...existing.map((selection) => ({ pageNumber, itemId, start: selection.start, end: selection.end })), ...added]).forEach((span) => {
          replacements.push({
            id: crypto.randomUUID(),
            documentId,
            kind: "text",
            pageNumber,
            itemId,
            start: span.start,
            end: span.end,
            text: itemText.slice(span.start, span.end),
          });
        });
      }

      return [...remaining, ...replacements];
    });
  }

  function addOrMergeManualTableSelection(page: ReviewPageData, tableId: string, cell: ReviewTableCell, pageNumber: number, start: number, end: number) {
    if (!documentId) return;

    const sourceText = cell.renderText ?? cell.text;
    const normalisedStart = clampRangeValue(start, sourceText.length);
    const normalisedEnd = clampRangeValue(end, sourceText.length);

    if (normalisedEnd <= normalisedStart) return;
    if (!sourceText.slice(normalisedStart, normalisedEnd).trim()) return;

    setManualSelections((prev) => {
      const remaining = prev.filter(
        (selection) => !(selection.kind === "table_cell" && selection.pageNumber === pageNumber && selection.tableId === tableId && selection.cellId === cell.cellId)
      );

      const existing = prev.filter(
        (selection): selection is ManualTableCellDecision =>
          selection.kind === "table_cell" && selection.pageNumber === pageNumber && selection.tableId === tableId && selection.cellId === cell.cellId
      );

      const merged = mergeSpans([
        ...existing.map((selection) => ({ pageNumber, itemId: cell.cellId, start: selection.start, end: selection.end })),
        { pageNumber, itemId: cell.cellId, start: normalisedStart, end: normalisedEnd },
      ]);

      const replacements: ManualTableCellDecision[] = merged.map((span) => ({
        id: crypto.randomUUID(),
        documentId,
        kind: "table_cell",
        pageNumber,
        tableId,
        cellId: cell.cellId,
        start: span.start,
        end: span.end,
        text: sourceText.slice(span.start, span.end),
      }));

      return [...remaining, ...replacements];
    });
  }

  function handleTableCellSelection() {
    if (isPreviewMode || !data) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

    const range = selection.getRangeAt(0);
    const startElement = getClosestElementWithAttribute(range.startContainer, "data-cell-id");
    const endElement = getClosestElementWithAttribute(range.endContainer, "data-cell-id");

    if (!startElement || !endElement) return false;

    const startCellId = startElement.dataset.cellId;
    const endCellId = endElement.dataset.cellId;
    const startTableId = startElement.dataset.tableId;
    const endTableId = endElement.dataset.tableId;
    const startPageNumber = startElement.dataset.pageNumber;
    const endPageNumber = endElement.dataset.pageNumber;

    if (!startCellId || !endCellId || !startTableId || !endTableId || !startPageNumber || !endPageNumber) return false;
    if (startCellId !== endCellId || startTableId !== endTableId || startPageNumber !== endPageNumber) {
      selection.removeAllRanges();
      return true;
    }

    const pageNumber = Number(startPageNumber);
    const page = data.pages.find((candidate) => candidate.pageNumber === pageNumber);
    const table = page?.tables.find((candidate) => candidate.tableId === startTableId);
    const cell = table?.rows.flatMap((row) => row.cells).find((candidate) => candidate.cellId === startCellId);

    if (!page || !table || !cell) {
      selection.removeAllRanges();
      return true;
    }

    const start = getTextOffsetWithinItem(startElement, range.startContainer, range.startOffset);
    const end = getTextOffsetWithinItem(endElement, range.endContainer, range.endOffset);

    addOrMergeManualTableSelection(page, startTableId, cell, pageNumber, Math.min(start, end), Math.max(start, end));
    selection.removeAllRanges();
    return true;
  }

  function handleTextSelection() {
    if (isPreviewMode || !data) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const startElement = getClosestElementWithAttribute(range.startContainer, "data-item-id");
    const endElement = getClosestElementWithAttribute(range.endContainer, "data-item-id");

    if (!startElement || !endElement) return;

    const startItemId = startElement.dataset.itemId;
    const endItemId = endElement.dataset.itemId;
    const startPageNumber = startElement.dataset.pageNumber;
    const endPageNumber = endElement.dataset.pageNumber;

    if (!startItemId || !endItemId || !startPageNumber || !endPageNumber || startPageNumber !== endPageNumber) {
      selection.removeAllRanges();
      return;
    }

    const pageNumber = Number(startPageNumber);
    const page = data.pages.find((candidate) => candidate.pageNumber === pageNumber);
    if (!page) {
      selection.removeAllRanges();
      return;
    }

    const pageItemElements = Array.from(document.querySelectorAll<HTMLElement>(`.jr-review-block.redactable[data-page-number="${pageNumber}"][data-item-id]`));
    const startIndex = pageItemElements.findIndex((element) => element.dataset.itemId === startItemId);
    const endIndex = pageItemElements.findIndex((element) => element.dataset.itemId === endItemId);

    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      selection.removeAllRanges();
      return;
    }

    const spansToAdd: ManualSpan[] = [];

    for (let index = startIndex; index <= endIndex; index += 1) {
      const element = pageItemElements[index];
      const itemId = element.dataset.itemId;
      if (!itemId) continue;

      const item = page.textItems.find((candidate) => candidate.itemId === itemId);
      if (!item) continue;

      const sourceText = item.text;
      const start = index === startIndex ? getTextOffsetWithinItem(element, range.startContainer, range.startOffset) : 0;
      const end = index === endIndex ? getTextOffsetWithinItem(element, range.endContainer, range.endOffset) : sourceText.length;

      const normalisedStart = clampRangeValue(Math.min(start, end), sourceText.length);
      const normalisedEnd = clampRangeValue(Math.max(start, end), sourceText.length);

      if (normalisedEnd <= normalisedStart) continue;
      if (!sourceText.slice(normalisedStart, normalisedEnd).trim()) continue;

      spansToAdd.push({ pageNumber, itemId, start: normalisedStart, end: normalisedEnd });
    }

    addOrMergeManualTextSelections(page, spansToAdd);
    selection.removeAllRanges();
  }

  function removeManualSelection(id: string) {
    setManualSelections((prev) => prev.filter((selection) => selection.id !== id));
  }

  function handleRedactionClick(event: React.MouseEvent<HTMLElement>) {
    if (isPreviewMode) return;
    const target = event.target as HTMLElement | null;
    const element = target?.closest?.("[data-manual-id]") as HTMLElement | null;
    const manualId = element?.dataset?.manualId;
    if (manualId) removeManualSelection(manualId);
  }

  function toggleImageRedaction(pageNumber: number, imageId: string) {
    if (!documentId || isPreviewMode) return;

    setManualSelections((prev) => {
      const existing = prev.find((selection) => selection.kind === "image" && selection.pageNumber === pageNumber && selection.imageId === imageId);
      if (existing) return prev.filter((selection) => selection.id !== existing.id);
      return [...prev, { id: crypto.randomUUID(), documentId, kind: "image", pageNumber, imageId }];
    });
  }

  return (
    <div className="jr-review-root">
      <div className="sticky-container">
        <div className="filename-bar">
          <p className="filename-bar__text">
            You are reviewing <strong>{data?.filename || "Document"}</strong>
          </p>
        </div>

        <div className="actions-bar">
          <div className="govuk-button-group">
            <p className="govuk-body"><strong>Menu:</strong></p>
            <a href="#" className="govuk-link govuk-link--no-visited-state">Find and redact</a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">Find and unredact</a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">Edit allow list</a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">Quick help</a>

            <p className="govuk-body jr-modes-label"><strong>Modes:</strong></p>
            <button type="button" className="toggle-button-v2" aria-pressed={!isPreviewMode} onClick={() => setIsPreviewMode(false)}>Redact</button>
            <button type="button" className="toggle-button-v2" aria-pressed={isPreviewMode} onClick={() => setIsPreviewMode(true)}>Preview</button>
          </div>
        </div>
      </div>

      <div className="govuk-grid-column-full-width">
        <h1 className="govuk-heading-xl jr-mark-for-redaction__header">Mark for redaction</h1>
      </div>

      {isLoading && <div className="govuk-grid-column-full-width"><p className="govuk-body">Loading review data...</p></div>}

      {error && (
        <div className="govuk-grid-column-full-width">
          <p className="govuk-error-message"><span className="govuk-visually-hidden">Error:</span> {error}</p>
        </div>
      )}

      {data && visiblePages.length > 0 && (
        <>
          <div
            onMouseUp={() => {
              const handledTable = handleTableCellSelection();
              if (!handledTable) handleTextSelection();
            }}
            onClick={handleRedactionClick}
          >
            {visiblePages.map((page) => {
              const findingsForPage = data.findings.filter((finding) => finding.pageNumber === page.pageNumber);
              const manualSelectionsForPage = manualSelections.filter((selection) => selection.documentId === documentId && selection.pageNumber === page.pageNumber);
              const textFindings = findingsForPage.filter((finding) => finding.kind === "text" && !!finding.itemId);
              const tableFindings = findingsForPage.filter((finding) => finding.kind === "table_cell" && !!finding.cellId);

              const pageContentBlocks: PageContentBlock[] = [
                ...page.textItems.map((item) => ({ kind: "text" as const, y: item.bbox?.y0 ?? Number.POSITIVE_INFINITY, item })),
                ...(page.tables ?? []).map((table) => ({ kind: "table" as const, y: table.bbox?.y0 ?? Number.POSITIVE_INFINITY, table })),
                ...(page.images ?? [])
                  .filter((image) => !imageBelongsToAnyTableRow(image, page.tables ?? []))
                  .map((image) => ({ kind: "image" as const, y: image.bbox?.y0 ?? Number.POSITIVE_INFINITY, image })),
              ].sort((a, b) => a.y - b.y);

              return (
                <div key={page.pageNumber} className="jr-review-page">
                  <div className="jr-review-page__header">
                    <h2 className="govuk-heading-m govuk-!-margin-bottom-1">Page {page.pageNumber}</h2>
                  </div>

                  <div className="jr-review-page__content">
                    {pageContentBlocks.map((block, blockIndex) => {
                      if (block.kind === "text") {
                        const item = block.item;
                        const suggestionsForItem = textFindings.filter(
                          (finding) => finding.itemId === item.itemId && typeof finding.entityStart === "number" && typeof finding.entityEnd === "number"
                        );
                        const manualForItem = manualSelectionsForPage
                          .filter((selection): selection is ManualTextDecision => selection.kind === "text" && selection.itemId === item.itemId)
                          .map((selection) => ({ id: selection.id, start: selection.start, end: selection.end }));

                        const sourceText = item.text;
                        const boldRanges = getExactLineRanges(sourceText, "Case Note");

                        return (
                          <div key={`text-${item.itemId}-${blockIndex}`} className="jr-review-block redactable" data-page-number={page.pageNumber} data-item-id={item.itemId}>
                            <p className="govuk-body">{renderTextSegments(sourceText, suggestionsForItem, manualForItem, isPreviewMode, boldRanges)}</p>
                          </div>
                        );
                      }

                      if (block.kind === "table") {
                        const table = block.table;

                        return (
                          <div key={`table-${table.tableId}-${blockIndex}`} className="jr-review-table-wrapper">
                            <table className="govuk-table govuk-table--small-text-until-tablet">
                              <tbody className="govuk-table__body">
                                {table.rows.map((row) => {
                                  const rowImage = getImageForTableRow(row, page.images ?? []);
                                  const rowImageManual = rowImage
                                    ? manualSelectionsForPage.some((selection) => selection.kind === "image" && selection.imageId === rowImage.imageId)
                                    : false;

                                  return (
                                    <tr key={`${table.tableId}-${row.rowIndex}`} className="govuk-table__row">
                                      {rowImage && (
                                        <td className="govuk-table__cell">
                                          <ImageRedactionFrame
                                            image={rowImage}
                                            pageNumber={page.pageNumber}
                                            isPreviewMode={isPreviewMode}
                                            isManuallyRedacted={rowImageManual}
                                            onToggle={toggleImageRedaction}
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

                                        const manualForCell = manualSelectionsForPage
                                          .filter(
                                            (selection): selection is ManualTableCellDecision =>
                                              selection.kind === "table_cell" && selection.tableId === table.tableId && selection.cellId === cell.cellId
                                          )
                                          .map((selection) => ({ id: selection.id, start: selection.start, end: selection.end }));

                                        const isManuallyRedacted = manualForCell.length > 0;
                                        const hasSuggestion = suggestionsForCell.length > 0;
                                        const sourceText = cell.text;
                                        const isStructured = sourceText.includes("\n");
                                        const boldRanges = isStructured ? getStructuredKeyRanges(sourceText) : [];

                                        const commonProps = {
                                          className: [
                                            cell.isNumeric ? "govuk-table__cell govuk-table__cell--numeric" : "govuk-table__cell",
                                            "redactable",
                                            hasSuggestion ? "jr-table-cell--has-suggestion" : "",
                                            isManuallyRedacted ? "jr-table-cell--manual-redaction" : "",
                                          ]
                                            .join(" ")
                                            .trim(),
                                          "data-page-number": page.pageNumber,
                                          "data-table-id": table.tableId,
                                          "data-cell-id": cell.cellId,
                                        };

                                        const content = (
                                          <span className="jr-table-cell-text" style={{ whiteSpace: "pre-line" }}>
                                            {renderTextSegments(sourceText, suggestionsForCell, manualForCell, isPreviewMode, boldRanges)}
                                          </span>
                                        );

                                        const shouldRenderAsHeader = cell.isHeader && !isStructured;
                                        if (shouldRenderAsHeader) {
                                          return (
                                            <th key={cell.cellId} scope="col" {...commonProps} className={commonProps.className.replace("govuk-table__cell", "govuk-table__header")}>
                                              {content}
                                            </th>
                                          );
                                        }

                                        return (
                                          <td key={cell.cellId} {...commonProps}>
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
                      const manualForImage = manualSelectionsForPage.some((selection) => selection.kind === "image" && selection.imageId === image.imageId);

                      return (
                        <div key={`image-${image.imageId}-${blockIndex}`} className="jr-review-image-wrapper govuk-!-margin-top-6">
                          <ImageRedactionFrame
                            image={image}
                            pageNumber={page.pageNumber}
                            isPreviewMode={isPreviewMode}
                            isManuallyRedacted={manualForImage}
                            onToggle={toggleImageRedaction}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <hr className="govuk-section-break govuk-section-break--m govuk-section-break--visible" />

          <nav className="jr-pagination" aria-label="Page navigation">
            {pageRanges.map((range) => {
              const label = `${range.start + 1} - ${range.end + 1}`;
              const isSelected = selectedRangeStart === range.start;

              return (
                <button
                  key={`${range.start}-${range.end}`}
                  type="button"
                  className="govuk-button govuk-button--secondary"
                  aria-current={isSelected ? "page" : undefined}
                  disabled={isSelected}
                  onClick={() => setSelectedRangeStart(range.start)}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {isLastBatch && (
            <div className="end-of-page">
              <h3 className="govuk-heading-m">
                You&apos;ve reached the end of the document
              </h3>

              {manualSelectionsForCurrentDocument().length > 0 ? (
                <>
                  <button
                    type="button"
                    className="govuk-button"
                    data-module="govuk-button"
                    onClick={handleApplyRedactions}
                    disabled={isApplyingRedactions}
                    aria-disabled={isApplyingRedactions}
                  >
                    Apply redactions
                  </button>

                  {applyRedactionsError && (
                    <p className="govuk-error-message">
                      <span className="govuk-visually-hidden">Error:</span>{" "}
                      {applyRedactionsError}
                    </p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="govuk-button"
                  data-module="govuk-button"
                  disabled
                  aria-disabled="true"
                >
                  Apply redactions
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="hods-loading-spinner" role="status" aria-live="polite">
          <div className="hods-loading-spinner__spinner"></div>
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
