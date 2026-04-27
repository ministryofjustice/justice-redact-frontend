"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  isHeader: boolean;
  isNumeric: boolean;
};

type ReviewTableRow = {
  rowIndex: number;
  cells: ReviewTableCell[];
};

type ReviewTable = {
  tableId: string;
  bbox: ReviewBBox | null;
  rows: ReviewTableRow[];
};

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

type ReviewBBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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

type ManualDecision =
  | ManualTextDecision
  | ManualTableCellDecision
  | ManualImageDecision;

type RenderRange = {
  start: number;
  end: number;
  className: string;
  key: string;
  manualId?: string;
};

type ManualSpan = {
  pageNumber: number;
  itemId: string;
  start: number;
  end: number;
};

function mergeSpans(spans: ManualSpan[]) {
  const sorted = spans
    .filter((s) => s.end > s.start)
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Array<{ start: number; end: number }> = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ start: s.start, end: s.end });
      continue;
    }
    if (s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ start: s.start, end: s.end });
    }
  }
  return merged;
}

function getClosestElementWithAttribute(
  node: Node | null,
  attribute: string
): HTMLElement | null {
  let current: Node | null = node;

  while (current) {
    if (current instanceof HTMLElement && current.hasAttribute(attribute)) {
      return current;
    }
    current = current.parentNode;
  }

  return null;
}

function getTextOffsetWithinItem(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number
) {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

function getExactHeaderLineRanges(fullText: string, header: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let lineStart = 0;

  while (lineStart <= fullText.length) {
    const newlineIdx = fullText.indexOf("\n", lineStart);
    const lineEnd = newlineIdx === -1 ? fullText.length : newlineIdx;
    const line = fullText.slice(lineStart, lineEnd);

    if (line.trim() === header) {
      const leading = line.match(/^\s*/)?.[0]?.length ?? 0;
      const trailing = line.match(/\s*$/)?.[0]?.length ?? 0;
      const start = lineStart + leading;
      const end = Math.max(start, lineEnd - trailing);
      if (end > start) ranges.push({ start, end });
    }

    if (newlineIdx === -1) break;
    lineStart = newlineIdx + 1;
  }

  return ranges;
}

function renderSliceWithHeaderBold(
  fullText: string,
  sliceStart: number,
  sliceEnd: number,
  headerRanges: Array<{ start: number; end: number }>,
  keyPrefix: string
) {
  const start = Math.max(0, Math.min(fullText.length, sliceStart));
  const end = Math.max(0, Math.min(fullText.length, sliceEnd));
  if (end <= start) return [];

  const overlaps = headerRanges
    .map((r) => ({
      start: Math.max(start, r.start),
      end: Math.min(end, r.end),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const nodes: React.ReactNode[] = [];
  let cursor = start;

  overlaps.forEach((r, idx) => {
    if (cursor < r.start) nodes.push(fullText.slice(cursor, r.start));
    nodes.push(
      <strong key={`${keyPrefix}-h-${idx}`}>{fullText.slice(r.start, r.end)}</strong>
    );
    cursor = r.end;
  });

  if (cursor < end) nodes.push(fullText.slice(cursor, end));
  return nodes;
}

function renderItemSegments(
  text: string,
  suggestions: ReviewFinding[],
  manualSelections: Array<{ id: string; start: number; end: number }>
) {
  const clamp = (n: number) => Math.max(0, Math.min(text.length, n));
  const headerRanges = getExactHeaderLineRanges(text, "Case Note");

  const manualRanges: RenderRange[] = manualSelections
    .map((m) => ({
      start: clamp(m.start),
      end: clamp(m.end),
      className: "highlight highlight--redaction",
      key: `manual-${m.id}`,
      manualId: m.id,
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const suggestionFragments: RenderRange[] = [];

  suggestions.forEach((s) => {
    if (typeof s.entityStart !== "number" || typeof s.entityEnd !== "number") return;

    let fragments: Array<{ start: number; end: number }> = [
      { start: clamp(s.entityStart), end: clamp(s.entityEnd) },
    ];

    for (const m of manualRanges) {
      fragments = fragments.flatMap((frag) => {
        if (m.end <= frag.start || m.start >= frag.end) return [frag];
        const next: Array<{ start: number; end: number }> = [];
        if (frag.start < m.start) next.push({ start: frag.start, end: m.start });
        if (m.end < frag.end) next.push({ start: m.end, end: frag.end });
        return next;
      });
      if (fragments.length === 0) break;
    }

    fragments.forEach((f, idx) => {
      if (f.end <= f.start) return;
      suggestionFragments.push({
        start: f.start,
        end: f.end,
        className: "highlight highlight--suggestion",
        key: `suggestion-${s.id}-${idx}`,
      });
    });
  });

  const filtered: RenderRange[] = [...suggestionFragments, ...manualRanges]
    .filter((r) => r.end > r.start && r.start >= 0 && r.end <= text.length)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  filtered.forEach((range) => {
    if (range.start < cursor) return;

    if (cursor < range.start) {
      nodes.push(
        <span key={`plain-${cursor}-${range.start}`}>
          {renderSliceWithHeaderBold(
            text,
            cursor,
            range.start,
            headerRanges,
            `plain-${cursor}-${range.start}`
          )}
        </span>
      );
    }

    nodes.push(
      <span
        key={range.key}
        className={range.className}
        data-manual-id={range.manualId}
      >
        {renderSliceWithHeaderBold(
          text,
          range.start,
          range.end,
          headerRanges,
          `${range.key}-${range.start}-${range.end}`
        )}
      </span>
    );

    cursor = range.end;
  });

  if (cursor < text.length) {
    nodes.push(
      <span key={`plain-${cursor}-end`}>
        {renderSliceWithHeaderBold(
          text,
          cursor,
          text.length,
          headerRanges,
          `plain-${cursor}-end`
        )}
      </span>
    );
  }

  return nodes;
}

function renderPreviewSegments(
  text: string,
  manualSelections: Array<{ id: string; start: number; end: number }>
) {
  const clamp = (n: number) => Math.max(0, Math.min(text.length, n));
  const headerRanges = getExactHeaderLineRanges(text, "Case Note");

  const manualRanges = manualSelections
    .map((m) => ({ start: clamp(m.start), end: clamp(m.end), id: m.id }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  manualRanges.forEach((r) => {
    if (r.start < cursor) return;

    if (cursor < r.start) {
      nodes.push(
        <span key={`preview-plain-${cursor}-${r.start}`}>
          {renderSliceWithHeaderBold(
            text,
            cursor,
            r.start,
            headerRanges,
            `preview-plain-${cursor}-${r.start}`
          )}
        </span>
      );
    }

    nodes.push(
      <span key={`preview-redaction-${r.id}`} className="applied-redaction">
        {renderSliceWithHeaderBold(
          text,
          r.start,
          r.end,
          headerRanges,
          `preview-redaction-${r.id}`
        )}
      </span>
    );

    cursor = r.end;
  });

  if (cursor < text.length) {
    nodes.push(
      <span key={`preview-plain-${cursor}-end`}>
        {renderSliceWithHeaderBold(
          text,
          cursor,
          text.length,
          headerRanges,
          `preview-plain-${cursor}-end`
        )}
      </span>
    );
  }

  return nodes;
}

export default function ReviewPage() {
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

  const PAGES_PER_BATCH = 50;

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

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || "Failed to load review data.");
        }

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
      .filter((p) => p.pageNumber >= start && p.pageNumber < endExclusive);
  }, [data, selectedRangeStart]);

  const pageRanges = useMemo(() => {
    const totalPages = data?.summary.totalPages ?? 0;
    const count = Math.ceil(totalPages / PAGES_PER_BATCH);
    return Array.from({ length: count }, (_, i) => {
      const start = i * PAGES_PER_BATCH;
      const end = Math.min(totalPages - 1, start + PAGES_PER_BATCH - 1);
      return { start, end };
    });
  }, [data]);

  const isLastBatch = useMemo(() => {
    if (!data) return false;
    return selectedRangeStart + PAGES_PER_BATCH >= data.summary.totalPages;
  }, [data, selectedRangeStart]);

  async function handleApplyRedactions() {
    if (!data || !documentId) return;

    const currentDocumentSelections = manualSelections.filter(
      (item) => item.documentId === documentId
    );

    if (currentDocumentSelections.length === 0) return;

    try {
      setIsApplyingRedactions(true);
      setApplyRedactionsError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${data.documentId}/apply-redactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId: data.documentId,
            decisions: currentDocumentSelections.map((item) => {
              if (item.kind === "text") {
                return {
                  kind: "text",
                  pageNumber: item.pageNumber,
                  itemId: item.itemId,
                  start: item.start,
                  end: item.end,
                  text: item.text,
                  action: "redact",
                  source: "manual",
                };
              }

              if (item.kind === "table_cell") {
                return {
                  kind: "table_cell",
                  pageNumber: item.pageNumber,
                  tableId: item.tableId,
                  cellId: item.cellId,
                  start: item.start,
                  end: item.end,
                  text: item.text,
                  action: "redact",
                  source: "manual",
                };
              }

              return {
                kind: "image",
                pageNumber: item.pageNumber,
                imageId: item.imageId,
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

      window.location.href = `/export?documentId=${data.documentId}`;
    } catch (err) {
      setApplyRedactionsError(
        err instanceof Error ? err.message : "Failed to apply redactions."
      );
    } finally {
      setIsApplyingRedactions(false);
    }
  }

  function handleTableCellSelection() {
    if (isPreviewMode) return;
    if (!data) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);

    const startElement = getClosestElementWithAttribute(
      range.startContainer,
      "data-cell-id"
    );
    const endElement = getClosestElementWithAttribute(
      range.endContainer,
      "data-cell-id"
    );

    if (!startElement || !endElement) {
      return;
    }

    const startCellElement = startElement as HTMLElement;
    const endCellElement = endElement as HTMLElement;

    const startCellId = startCellElement.dataset.cellId;
    const endCellId = endCellElement.dataset.cellId;
    const startTableId = startCellElement.dataset.tableId;
    const endTableId = endCellElement.dataset.tableId;
    const startPageNumber = startCellElement.dataset.pageNumber;
    const endPageNumber = endCellElement.dataset.pageNumber;

    if (
      !startCellId ||
      !endCellId ||
      !startTableId ||
      !endTableId ||
      !startPageNumber ||
      !endPageNumber ||
      startCellId !== endCellId ||
      startTableId !== endTableId ||
      startPageNumber !== endPageNumber
    ) {
      return;
    }

    const pageNumber = Number(startPageNumber);
    const page = data.pages.find((p) => p.pageNumber === pageNumber);

    if (!page) {
      selection.removeAllRanges();
      return;
    }

    const table = (page.tables ?? []).find((t) => t.tableId === startTableId);
    if (!table) {
      selection.removeAllRanges();
      return;
    }

    const cell = table.rows
      .flatMap((row) => row.cells)
      .find((c) => c.cellId === startCellId);

    if (!cell) {
      selection.removeAllRanges();
      return;
    }

    const start = getTextOffsetWithinItem(
      startCellElement,
      range.startContainer,
      range.startOffset
    );
    const end = getTextOffsetWithinItem(
      endCellElement,
      range.endContainer,
      range.endOffset
    );

    const normalisedStart = Math.max(0, Math.min(cell.text.length, start));
    const normalisedEnd = Math.max(0, Math.min(cell.text.length, end));

    if (normalisedEnd <= normalisedStart) {
      selection.removeAllRanges();
      return;
    }

    const selectedText = cell.text.slice(normalisedStart, normalisedEnd);
    if (!selectedText.trim()) {
      selection.removeAllRanges();
      return;
    }

    setManualSelections((prev) => {
      const remaining = prev.filter(
        (m) =>
          !(
            m.kind === "table_cell" &&
            m.pageNumber === pageNumber &&
            m.tableId === startTableId &&
            m.cellId === startCellId
          )
      );

      const existing = prev.filter(
        (m): m is ManualTableCellDecision =>
          m.kind === "table_cell" &&
          m.pageNumber === pageNumber &&
          m.tableId === startTableId &&
          m.cellId === startCellId
      );

      const merged = mergeSpans([
        ...existing.map((m) => ({
          pageNumber,
          itemId: startCellId,
          start: m.start,
          end: m.end,
        })),
        {
          pageNumber,
          itemId: startCellId,
          start: normalisedStart,
          end: normalisedEnd,
        },
      ]);

      const replacements: ManualTableCellDecision[] = merged.map((span) => ({
        id: crypto.randomUUID(),
        documentId: documentId ?? "",
        kind: "table_cell",
        pageNumber,
        tableId: startTableId,
        cellId: startCellId,
        start: span.start,
        end: span.end,
        text: cell.text.slice(span.start, span.end),
      }));

      return [...remaining, ...replacements];
    });

    selection.removeAllRanges();
  }

  function handleTextSelection() {
    if (isPreviewMode) return;
    if (!data) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);

    const startElement =
      range.startContainer.parentElement?.closest("[data-item-id]");
    const endElement = range.endContainer.parentElement?.closest("[data-item-id]");

    if (!startElement || !endElement) {
      return;
    }

    const startItemElement = startElement as HTMLElement;
    const endItemElement = endElement as HTMLElement;
    const startItemId = startItemElement.dataset.itemId;
    const endItemId = endItemElement.dataset.itemId;
    const startPageNumber = startItemElement.dataset.pageNumber;
    const endPageNumber = endItemElement.dataset.pageNumber;

    if (
      !startItemId ||
      !endItemId ||
      !startPageNumber ||
      !endPageNumber ||
      startPageNumber !== endPageNumber
    ) {
      selection.removeAllRanges();
      return;
    }

    const pageNumber = Number(startPageNumber);
    const page = data.pages.find((p) => p.pageNumber === pageNumber);

    if (!page) {
      selection.removeAllRanges();
      return;
    }

    const pageItemElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        `.jr-review-block.redactable[data-page-number="${pageNumber}"][data-item-id]`
      )
    );

    const startIndex = pageItemElements.findIndex(
      (el) => el.dataset.itemId === startItemId
    );
    const endIndex = pageItemElements.findIndex(
      (el) => el.dataset.itemId === endItemId
    );

    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      selection.removeAllRanges();
      return;
    }

    const spansToAdd: ManualSpan[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const el = pageItemElements[i];
      const itemId = el.dataset.itemId;
      if (!itemId) continue;

      const item = page.textItems.find((t) => t.itemId === itemId);
      if (!item) continue;

      const start =
        i === startIndex
          ? getTextOffsetWithinItem(el, range.startContainer, range.startOffset)
          : 0;

      const end =
        i === endIndex
          ? getTextOffsetWithinItem(el, range.endContainer, range.endOffset)
          : item.text.length;

      const normalisedStart = Math.max(0, Math.min(item.text.length, start));
      const normalisedEnd = Math.max(0, Math.min(item.text.length, end));

      if (normalisedEnd <= normalisedStart) continue;
      if (!item.text.slice(normalisedStart, normalisedEnd).trim()) continue;

      spansToAdd.push({
        pageNumber,
        itemId,
        start: normalisedStart,
        end: normalisedEnd,
      });
    }

    if (spansToAdd.length === 0) {
      selection.removeAllRanges();
      return;
    }

    setManualSelections((prev) => {
      const affectedKeys = new Set(
        spansToAdd.map((s) => `${s.pageNumber}::${s.itemId}`)
      );

      const remaining = prev.filter((m) => {
        if (m.kind !== "text") return true;
        return !affectedKeys.has(`${m.pageNumber}::${m.itemId}`);
      });

      const replacements: ManualTextDecision[] = [];

      for (const key of affectedKeys) {
        const [pageStr, itemId] = key.split("::");
        const pn = Number(pageStr);

        const existing = prev.filter(
          (m): m is ManualTextDecision =>
            m.kind === "text" && m.pageNumber === pn && m.itemId === itemId
        );
        const added = spansToAdd.filter(
          (s) => s.pageNumber === pn && s.itemId === itemId
        );

        const merged = mergeSpans([
          ...existing.map((m) => ({
            pageNumber: pn,
            itemId,
            start: m.start,
            end: m.end,
          })),
          ...added,
        ]);

        const itemText =
          page.textItems.find((t) => t.itemId === itemId)?.text ?? "";

        merged.forEach((span) => {
          replacements.push({
            id: crypto.randomUUID(),
            documentId: documentId ?? "",
            kind: "text",
            pageNumber: pn,
            itemId,
            start: span.start,
            end: span.end,
            text: itemText.slice(span.start, span.end),
          });
        });
      }

      return [...remaining, ...replacements];
    });

    selection.removeAllRanges();
  }

  function removeManualSelection(id: string) {
    setManualSelections((prev) => prev.filter((item) => item.id !== id));
  }

  function handleRedactionClick(event: React.MouseEvent<HTMLElement>) {
    if (isPreviewMode) return;
    const target = event.target as HTMLElement | null;
    const el = target?.closest?.("[data-manual-id]") as HTMLElement | null;
    const manualId = el?.dataset?.manualId;
    if (manualId) removeManualSelection(manualId);
  }

  function toggleImageRedaction(pageNumber: number, imageId: string) {
    if (!documentId || isPreviewMode) return;

    setManualSelections((prev) => {
      const existing = prev.find(
        (m) => m.kind === "image" && m.pageNumber === pageNumber && m.imageId === imageId
      );

      if (existing) {
        return prev.filter((m) => m.id !== existing.id);
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          documentId,
          kind: "image",
          pageNumber,
          imageId,
        },
      ];
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
            <p className="govuk-body">
              <strong>Menu:</strong>
            </p>
            <a href="#" className="govuk-link govuk-link--no-visited-state">
              Find and redact
            </a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">
              Find and unredact
            </a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">
              Edit allow list
            </a>
            <a href="#" className="govuk-link govuk-link--no-visited-state">
              Quick help
            </a>

            <p className="govuk-body jr-modes-label">
              <strong>Modes:</strong>
            </p>

            <button
              type="button"
              className="toggle-button-v2"
              aria-pressed={!isPreviewMode}
              onClick={() => setIsPreviewMode(false)}
            >
              Redact
            </button>

            <button
              type="button"
              className="toggle-button-v2"
              aria-pressed={isPreviewMode}
              onClick={() => setIsPreviewMode(true)}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="govuk-grid-column-full-width">
        <h1 className="govuk-heading-xl jr-mark-for-redaction__header">
          Mark for redaction
        </h1>
      </div>

      {isLoading && (
        <div className="govuk-grid-column-full-width">
          <p className="govuk-body">Loading review data...</p>
        </div>
      )}

      {error && (
        <div className="govuk-grid-column-full-width">
          <p className="govuk-error-message">
            <span className="govuk-visually-hidden">Error:</span> {error}
          </p>
        </div>
      )}

      {data && visiblePages.length > 0 && (
        <>
          <div
            onMouseUp={() => {
              handleTableCellSelection();
              handleTextSelection();
            }}
            onClick={handleRedactionClick}
          >
            {visiblePages.map((page) => {

              const findingsForPage = data.findings.filter(
                (f) => f.pageNumber === page.pageNumber
              );

              const manualSelectionsForPage = manualSelections.filter(
                (m) => m.documentId === documentId && m.pageNumber === page.pageNumber
              );

              const textFindings = findingsForPage.filter(
                (f) => f.kind === "text" && !!f.itemId
              );

              const tableFindings = findingsForPage.filter(
                (f) => f.kind === "table_cell" && !!f.cellId
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
                ...(page.images ?? []).map((image) => ({
                  kind: "image" as const,
                  y: image.bbox?.y0 ?? Number.POSITIVE_INFINITY,
                  image,
                })),
              ].sort((a, b) => a.y - b.y);

              return (
                <div key={page.pageNumber} className="jr-review-page">
                  <div className="jr-review-page__header">
                    <h2 className="govuk-heading-m govuk-!-margin-bottom-1">
                      Page {page.pageNumber}
                    </h2>
                  </div>

                  <div className="jr-review-page__content">
                    {pageContentBlocks.map((block, blockIndex) => {
                      if (block.kind === "text") {
                        const item = block.item;

                        const suggestionsForItem = textFindings.filter(
                          (f) =>
                            f.itemId === item.itemId &&
                            typeof f.entityStart === "number" &&
                            typeof f.entityEnd === "number"
                        );

                        const manualForItem = manualSelectionsForPage
                          .filter(
                            (m): m is ManualTextDecision =>
                              m.kind === "text" && m.itemId === item.itemId
                          )
                          .map((m) => ({
                            id: m.id,
                            start: m.start,
                            end: m.end,
                          }));

                        return (
                          <div
                            key={`text-${item.itemId}-${blockIndex}`}
                            className="jr-review-block redactable"
                            data-page-number={page.pageNumber}
                            data-item-id={item.itemId}
                          >
                            <p className="govuk-body">
                              {isPreviewMode
                                ? renderPreviewSegments(item.renderText, manualForItem)
                                : renderItemSegments(
                                  item.renderText,
                                  suggestionsForItem,
                                  manualForItem
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
                                {table.rows.map((row) => (
                                  <tr
                                    key={`${table.tableId}-${row.rowIndex}`}
                                    className="govuk-table__row"
                                  >
                                    {row.cells.map((cell) => {
                                      const suggestionsForCell = tableFindings.filter(
                                        (f) =>
                                          f.tableId === table.tableId &&
                                          f.cellId === cell.cellId &&
                                          typeof f.entityStart === "number" &&
                                          typeof f.entityEnd === "number"
                                      );

                                      const manualForCell = manualSelectionsForPage
                                        .filter(
                                          (m): m is ManualTableCellDecision =>
                                            m.kind === "table_cell" &&
                                            m.tableId === table.tableId &&
                                            m.cellId === cell.cellId
                                        )
                                        .map((m) => ({
                                          id: m.id,
                                          start: m.start,
                                          end: m.end,
                                        }));

                                      const isManuallyRedacted = manualForCell.length > 0;
                                      const hasSuggestion = suggestionsForCell.length > 0;

                                      const commonProps = {
                                        className: [
                                          cell.isNumeric
                                            ? "govuk-table__cell govuk-table__cell--numeric"
                                            : "govuk-table__cell",
                                          "redactable",
                                          hasSuggestion ? "jr-table-cell--has-suggestion" : "",
                                          isManuallyRedacted ? "jr-table-cell--manual-redaction" : "",
                                        ]
                                          .join(" ")
                                          .trim(),
                                      };

                                      const content = (
                                        <span className="jr-table-cell-text">
                                          {isPreviewMode
                                            ? isManuallyRedacted
                                              ? renderPreviewSegments(cell.renderText, manualForCell)
                                              : cell.renderText
                                            : renderItemSegments(
                                              cell.renderText,
                                              suggestionsForCell,
                                              manualForCell
                                            )}
                                        </span>
                                      );

                                      if (cell.isHeader) {
                                        return (
                                          <th
                                            key={cell.cellId}
                                            scope="col"
                                            className={`${commonProps.className.replace(
                                              "govuk-table__cell",
                                              "govuk-table__header"
                                            )} redactable`}
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
                                          {...commonProps}
                                          data-page-number={page.pageNumber}
                                          data-table-id={table.tableId}
                                          data-cell-id={cell.cellId}
                                        >
                                          {content}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      const image = block.image;

                      const manualForImage = manualSelectionsForPage.filter(
                        (m): m is ManualImageDecision =>
                          m.kind === "image" && m.imageId === image.imageId
                      );

                      const isManuallyRedacted = manualForImage.length > 0;

                      const PDF_TO_CSS_SCALE = 96 / 72;

                      const imageWidth = image.bbox
                        ? `${(image.bbox.x1 - image.bbox.x0) * PDF_TO_CSS_SCALE}px`
                        : "200px";

                      const imageHeight = image.bbox
                        ? `${(image.bbox.y1 - image.bbox.y0) * PDF_TO_CSS_SCALE}px`
                        : "150px";

                      return (
                        <div
                          key={`image-${image.imageId}-${blockIndex}`}
                          className="jr-review-image-wrapper govuk-!-margin-top-6"
                        >
                          <div
                            className={[
                              "jr-review-image-panel",
                              isManuallyRedacted ? "jr-review-image-panel--manual-redaction" : "",
                            ]
                              .join(" ")
                              .trim()}
                          >
                            <div className="jr-review-image-preview">
                              {image.imageUrl ? (
                                <div
                                  className="jr-review-image-frame"
                                  style={{
                                    position: "relative",
                                    display: "inline-block",
                                    width: imageWidth,
                                    height: imageHeight,
                                  }}
                                >
                                  <img
                                    src={`${process.env.NEXT_PUBLIC_API_BASE_URL}${image.imageUrl}`}
                                    alt={image.alt || "Document image"}
                                    className="jr-review-image"
                                    style={{
                                      width: imageWidth,
                                      height: imageHeight,
                                      display: "block",
                                    }}
                                  />

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
                              ) : (
                                <div
                                  className="jr-review-image-placeholder"
                                  style={{
                                    position: "relative",
                                    width: imageWidth,
                                    height: imageHeight,
                                    background:
                                      isPreviewMode && isManuallyRedacted
                                        ? "#000"
                                        : isManuallyRedacted
                                          ? "#f6d7d2"
                                          : "#f3f2f1",
                                    border:
                                      isPreviewMode && isManuallyRedacted
                                        ? "2px solid #000"
                                        : isManuallyRedacted
                                          ? "2px solid #d4351c"
                                          : "2px dashed #b1b4b6",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "14px",
                                    color: isPreviewMode && isManuallyRedacted ? "#fff" : "#505a5f",
                                    boxSizing: "border-box",
                                  }}
                                >
                                  <span>Image</span>
                                </div>
                              )}
                            </div>

                            <div className="jr-review-image-meta">


                              {!isPreviewMode && (
                                <button
                                  type="button"
                                  className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                                  onClick={() => toggleImageRedaction(page.pageNumber, image.imageId)}
                                >
                                  {isManuallyRedacted ? "Remove image redaction" : "Redact image"}
                                </button>
                              )}
                            </div>
                          </div>
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

              {manualSelections.some((item) => item.documentId === documentId) ? (
                <>
                  <button
                    type="button"
                    className="govuk-button"
                    data-module="govuk-button"
                    onClick={handleApplyRedactions}
                    disabled={isApplyingRedactions}
                    aria-disabled={isApplyingRedactions}
                  >
                    {isApplyingRedactions
                      ? "Applying redactions..."
                      : "Apply redactions"}
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