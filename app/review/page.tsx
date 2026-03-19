"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ReviewBlock = {
  blockId: string;
  text: string;
};

type ReviewPageData = {
  pageNumber: number;
  blocks: ReviewBlock[];
};

type ReviewFinding = {
  id: string;
  pageNumber: number;
  blockId: string;
  entityType: string;
  entityText: string;
  entityStart: number;
  entityEnd: number;
  entityScore: number;
  context: string;
  decision: string;
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
    totalBlocks: number;
    totalFindings: number;
  };
};

type ManualDecision = {
  id: string;
  documentId: string;
  pageNumber: number;
  blockId: string;
  start: number;
  end: number;
  text: string;
  decisionType: "manual_redaction";
};

type RenderRange = {
  start: number;
  end: number;
  className: string;
  key: string;
  manualId?: string;
};

type ManualSpan = {
  pageNumber: number;
  blockId: string;
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

function getTextOffsetWithinBlock(
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
      // Bold only the header text itself (not surrounding whitespace).
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

function renderBlockSegments(
  text: string,
  suggestions: ReviewFinding[],
  manualSelections: ManualDecision[]
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

  // Manual redactions take precedence over AI suggestions. We remove any
  // overlapping portions from the suggestion ranges so rendering stays
  // non-overlapping while still allowing manual to "cover" suggestions.
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

function renderPreviewSegments(text: string, manualSelections: ManualDecision[]) {
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
    const endExclusive = Math.min(
      data.summary.totalPages,
      start + PAGES_PER_BATCH
    );
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

      console.log(
        "Applying redactions for document:",
        documentId,
        manualSelections.filter((item) => item.documentId === documentId)
      );
  
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${data.documentId}/apply-redactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId: data.documentId,
            decisions: currentDocumentSelections.map((item) => ({
              pageNumber: item.pageNumber,
              blockId: item.blockId,
              start: item.start,
              end: item.end,
              text: item.text,
              action: "redact",
              source: "manual",
            })),
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

  function handleTextSelection() {
    if (isPreviewMode) return;
    if (!data) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);

    const startElement =
      range.startContainer.parentElement?.closest("[data-block-id]");
    const endElement = range.endContainer.parentElement?.closest("[data-block-id]");

    if (!startElement || !endElement) {
      selection.removeAllRanges();
      return;
    }

    const startBlockElement = startElement as HTMLElement;
    const endBlockElement = endElement as HTMLElement;
    const startBlockId = startBlockElement.dataset.blockId;
    const endBlockId = endBlockElement.dataset.blockId;
    const startPageNumber = startBlockElement.dataset.pageNumber;
    const endPageNumber = endBlockElement.dataset.pageNumber;

    if (
      !startBlockId ||
      !endBlockId ||
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

    const pageBlockElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        `.jr-review-block.redactable[data-page-number="${pageNumber}"][data-block-id]`
      )
    );
    const startIndex = pageBlockElements.findIndex(
      (el) => el.dataset.blockId === startBlockId
    );
    const endIndex = pageBlockElements.findIndex(
      (el) => el.dataset.blockId === endBlockId
    );

    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      selection.removeAllRanges();
      return;
    }

    const spansToAdd: ManualSpan[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const el = pageBlockElements[i];
      const blockId = el.dataset.blockId;
      if (!blockId) continue;
      const block = page.blocks.find((b) => b.blockId === blockId);
      if (!block) continue;

      const start =
        i === startIndex
          ? getTextOffsetWithinBlock(el, range.startContainer, range.startOffset)
          : 0;
      const end =
        i === endIndex
          ? getTextOffsetWithinBlock(el, range.endContainer, range.endOffset)
          : block.text.length;

      const normalisedStart = Math.max(0, Math.min(block.text.length, start));
      const normalisedEnd = Math.max(0, Math.min(block.text.length, end));
      if (normalisedEnd <= normalisedStart) continue;

      // Avoid creating manual redactions that are purely whitespace.
      if (!block.text.slice(normalisedStart, normalisedEnd).trim()) continue;

      spansToAdd.push({
        pageNumber,
        blockId,
        start: normalisedStart,
        end: normalisedEnd,
      });
    }

    if (spansToAdd.length === 0) {
      selection.removeAllRanges();
      return;
    }

    setManualSelections((prev) => {
      const next = prev.slice();

      const affectedKeys = new Set(
        spansToAdd.map((s) => `${s.pageNumber}::${s.blockId}`)
      );

      // Remove existing decisions for affected blocks (we'll replace with merged ones).
      const remaining = next.filter(
        (m) => !affectedKeys.has(`${m.pageNumber}::${m.blockId}`)
      );

      const replacements: ManualDecision[] = [];

      for (const key of affectedKeys) {
        const [pageStr, blockId] = key.split("::");
        const pn = Number(pageStr);

        const existing = prev.filter((m) => m.pageNumber === pn && m.blockId === blockId);
        const added = spansToAdd.filter((s) => s.pageNumber === pn && s.blockId === blockId);

        const merged = mergeSpans([
          ...existing.map((m) => ({ pageNumber: pn, blockId, start: m.start, end: m.end })),
          ...added,
        ]);

        const blockText = page.blocks.find((b) => b.blockId === blockId)?.text ?? "";

        merged.forEach((span) => {
          replacements.push({
            id: crypto.randomUUID(),
            documentId: documentId ?? "",
            pageNumber: pn,
            blockId,
            start: span.start,
            end: span.end,
            text: blockText.slice(span.start, span.end),
            decisionType: "manual_redaction",
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
        <h1 className="govuk-heading-xl jr-mark-for-redaction__header">Mark for redaction</h1>
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
          <div onMouseUp={handleTextSelection} onClick={handleRedactionClick}>
            {visiblePages.map((page) => {
              const findingsForPage = data.findings.filter(
                (f) => f.pageNumber === page.pageNumber
              );
              const manualSelectionsForPage = manualSelections.filter(
                (m) => m.documentId === documentId && m.pageNumber === page.pageNumber
              );

              return (
                <div key={page.pageNumber} className="jr-review-page">
                  <div className="jr-review-page__header">
                    <h2 className="govuk-heading-m govuk-!-margin-bottom-1">
                      Page {page.pageNumber + 1}
                    </h2>
                  </div>

                  <div className="jr-review-page__content">
                    {page.blocks.map((block) => {
                      const suggestionsForBlock = findingsForPage.filter(
                        (f) => f.blockId === block.blockId
                      );

                      const manualForBlock = manualSelectionsForPage.filter(
                        (m) => m.blockId === block.blockId
                      );

                      return (
                        <div
                          key={block.blockId}
                          className="jr-review-block redactable"
                          data-page-number={page.pageNumber}
                          data-block-id={block.blockId}
                        >
                          <p className="govuk-body">
                            {isPreviewMode
                              ? renderPreviewSegments(block.text, manualForBlock)
                              : renderBlockSegments(
                                block.text,
                                suggestionsForBlock,
                                manualForBlock
                              )}
                          </p>
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
              <h3 className="govuk-heading-m">You've reached the end of the document</h3>

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
                    {isApplyingRedactions ? "Applying redactions..." : "Apply redactions"}
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