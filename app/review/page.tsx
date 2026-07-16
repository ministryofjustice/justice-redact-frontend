"use client";

import { Suspense, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";

import { buildApplyRedactionsRequest } from "./applyRedactions";
import { useReviewData } from "./useReviewData";
import EndOfDocumentActions from "./components/EndOfDocumentActions";
import PageContent from "./components/PageContent";
import ReviewControlsHeader from "./components/ReviewControlsHeader";
import ReviewPageHeader from "./components/ReviewPageHeader";
import ReviewPagination from "./components/ReviewPagination";
import ReviewStatusMessages from "./components/ReviewStatusMessages";
import QuickHelpModal from "./components/QuickHelpModal";
import { clampRangeValue } from "./textRendering";
import {
  getClosestElementWithAttribute,
  getTextOffsetWithinItem,
  mergeSpans,
} from "./selectionUtils";
import type {
  ManualDecision,
  ManualSpan,
  ManualTableCellDecision,
  ManualTextDecision,
  PageStatus,
  ReviewPageData,
  ReviewTableCell,
  ReviewMode
} from "./types";
import FindAndRedactModal from "./components/FindAndRedactModal";

const PAGES_PER_BATCH = 50;

type ApplyRedactionsResponse = {
  documentId: string;
  status: string;
};

function ReviewContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  return <ReviewDocument key={documentId ?? "missing-document-id"} documentId={documentId} />;
}

function ReviewDocument({ documentId }: { documentId: string | null }) {
  const router = useRouter();

  const [selectedRangeStart, setSelectedRangeStart] = useState(0);
  const [manualSelections, setManualSelections] = useState<ManualDecision[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("redact");
  const isPreviewMode = reviewMode === "preview";
  const isRedactMode = reviewMode === "redact";
  const [isApplyingRedactions, setIsApplyingRedactions] = useState(false);
  const [applyRedactionsError, setApplyRedactionsError] = useState<string | null>(null);
  const [pageStatuses, setPageStatuses] = useState<Record<number, PageStatus>>({});
  const [isQuickHelpOpen, setIsQuickHelpOpen] = useState(false);
  const [isFindAndRedactOpen, setIsFindAndRedactOpen] = useState(false);

  const { data, isLoading, error } = useReviewData(documentId);

  const visiblePages = useMemo(() => {
    if (!data) return [];

    const firstPageNumber = selectedRangeStart + 1;
    const lastPageNumber = Math.min(
      data.summary.totalPages,
      selectedRangeStart + PAGES_PER_BATCH
    );

    return data.pages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .filter(
        (page) =>
          page.pageNumber >= firstPageNumber &&
          page.pageNumber <= lastPageNumber
      );
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
    const hasPageDecisions = Object.keys(pageStatuses).length > 0;

    if (currentDocumentSelections.length === 0 && !hasPageDecisions) return;

    try {
      setIsApplyingRedactions(true);
      setApplyRedactionsError(null);

      await fetchJson<ApplyRedactionsResponse>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${data.documentId}/apply-redactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            buildApplyRedactionsRequest(
              data.documentId,
              currentDocumentSelections,
              pageStatuses
            )
          ),
        }
      );

      router.push(`/applying-redactions?documentId=${data.documentId}`);
    } catch (err) {
      setApplyRedactionsError(
        err instanceof Error
          ? err.message
          : "Failed to apply redactions."
      );
      setIsApplyingRedactions(false);
    }
  }

  function addOrMergeManualTextSelections(page: ReviewPageData, spansToAdd: ManualSpan[]) {
    if (!documentId || spansToAdd.length === 0) return;

    setManualSelections((prev) => {
      const affectedKeys = new Set(
        spansToAdd.map((span) => `${span.pageNumber}::${span.itemId}`)
      );

      const remaining = prev.filter((selection) => {
        if (selection.kind !== "text") return true;

        return !affectedKeys.has(`${selection.pageNumber}::${selection.itemId}`);
      });

      const replacements: ManualTextDecision[] = [];

      for (const key of affectedKeys) {
        const [pageNumberString, itemId] = key.split("::");
        const pageNumber = Number(pageNumberString);

        const itemText =
          page.textItems.find((item) => item.itemId === itemId)?.renderText ??
          page.textItems.find((item) => item.itemId === itemId)?.text ??
          "";

        const existing = prev.filter(
          (selection): selection is ManualTextDecision =>
            selection.kind === "text" &&
            selection.pageNumber === pageNumber &&
            selection.itemId === itemId
        );

        const added = spansToAdd.filter(
          (span) => span.pageNumber === pageNumber && span.itemId === itemId
        );

        mergeSpans([
          ...existing.map((selection) => ({
            pageNumber,
            itemId,
            start: selection.start,
            end: selection.end,
          })),
          ...added,
        ]).forEach((span) => {
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

  function addOrMergeManualTableSelection(
    tableId: string,
    cell: ReviewTableCell,
    pageNumber: number,
    start: number,
    end: number
  ) {
    if (!documentId) return;

    const sourceText = cell.renderText ?? cell.text;
    const normalisedStart = clampRangeValue(start, sourceText.length);
    const normalisedEnd = clampRangeValue(end, sourceText.length);

    if (normalisedEnd <= normalisedStart) return;
    if (!sourceText.slice(normalisedStart, normalisedEnd).trim()) return;

    setManualSelections((prev) => {
      const remaining = prev.filter(
        (selection) =>
          !(
            selection.kind === "table_cell" &&
            selection.pageNumber === pageNumber &&
            selection.tableId === tableId &&
            selection.cellId === cell.cellId
          )
      );

      const existing = prev.filter(
        (selection): selection is ManualTableCellDecision =>
          selection.kind === "table_cell" &&
          selection.pageNumber === pageNumber &&
          selection.tableId === tableId &&
          selection.cellId === cell.cellId
      );

      const merged = mergeSpans([
        ...existing.map((selection) => ({
          pageNumber,
          itemId: cell.cellId,
          start: selection.start,
          end: selection.end,
        })),
        {
          pageNumber,
          itemId: cell.cellId,
          start: normalisedStart,
          end: normalisedEnd,
        },
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
    if (!isRedactMode || !data) return false;

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

    if (
      !startCellId ||
      !endCellId ||
      !startTableId ||
      !endTableId ||
      !startPageNumber ||
      !endPageNumber
    ) {
      return false;
    }

    if (
      startCellId !== endCellId ||
      startTableId !== endTableId ||
      startPageNumber !== endPageNumber
    ) {
      selection.removeAllRanges();
      return true;
    }

    const pageNumber = Number(startPageNumber);
    const page = data.pages.find((candidate) => candidate.pageNumber === pageNumber);
    const table = page?.tables.find((candidate) => candidate.tableId === startTableId);
    const cell = table?.rows
      .flatMap((row) => row.cells)
      .find((candidate) => candidate.cellId === startCellId);

    if (!page || !table || !cell) {
      selection.removeAllRanges();
      return true;
    }

    const start = getTextOffsetWithinItem(
      startElement,
      range.startContainer,
      range.startOffset
    );

    const end = getTextOffsetWithinItem(
      endElement,
      range.endContainer,
      range.endOffset
    );

    addOrMergeManualTableSelection(
      startTableId,
      cell,
      pageNumber,
      Math.min(start, end),
      Math.max(start, end)
    );

    selection.removeAllRanges();
    return true;
  }

  function handleTextSelection() {
    if (!isRedactMode || !data) return;

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
    const page = data.pages.find((candidate) => candidate.pageNumber === pageNumber);

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
      (element) => element.dataset.itemId === startItemId
    );

    const endIndex = pageItemElements.findIndex(
      (element) => element.dataset.itemId === endItemId
    );

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
      const start =
        index === startIndex
          ? getTextOffsetWithinItem(element, range.startContainer, range.startOffset)
          : 0;

      const end =
        index === endIndex
          ? getTextOffsetWithinItem(element, range.endContainer, range.endOffset)
          : sourceText.length;

      const normalisedStart = clampRangeValue(Math.min(start, end), sourceText.length);
      const normalisedEnd = clampRangeValue(Math.max(start, end), sourceText.length);

      if (normalisedEnd <= normalisedStart) continue;
      if (!sourceText.slice(normalisedStart, normalisedEnd).trim()) continue;

      spansToAdd.push({
        pageNumber,
        itemId,
        start: normalisedStart,
        end: normalisedEnd,
      });
    }

    addOrMergeManualTextSelections(page, spansToAdd);
    selection.removeAllRanges();
  }

  function removeManualSelection(id: string) {
    setManualSelections((prev) => prev.filter((selection) => selection.id !== id));
  }

  function handleRedactionClick(event: MouseEvent<HTMLElement>) {
    if (!isRedactMode) return;

    const target = event.target as HTMLElement | null;
    const element = target?.closest?.("[data-manual-id]") as HTMLElement | null;
    const manualId = element?.dataset?.manualId;

    if (manualId) {
      removeManualSelection(manualId);
    }
  }

  function toggleImageRedaction(pageNumber: number, imageId: string) {
    if (!documentId || !isRedactMode) return;

    setManualSelections((prev) => {
      const existing = prev.find(
        (selection) =>
          selection.kind === "image" &&
          selection.pageNumber === pageNumber &&
          selection.imageId === imageId
      );

      if (existing) {
        return prev.filter((selection) => selection.id !== existing.id);
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

  function markPageDeleted(pageNumber: number) {
    setPageStatuses((prev) => ({
      ...prev,
      [pageNumber]: "deleted",
    }));
  }

  function markPageExempted(pageNumber: number) {
    setPageStatuses((prev) => ({
      ...prev,
      [pageNumber]: "exempted",
    }));
  }

  function restorePage(pageNumber: number) {
    setPageStatuses((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
  }

  return (
    <div className="jr-review-root">
      <ReviewControlsHeader
        filename={data?.filename || "Document"}
        reviewMode={reviewMode}
        onReviewModeChange={setReviewMode}
        onQuickHelp={() => setIsQuickHelpOpen(true)}
        onFindAndRedact={() => setIsFindAndRedactOpen(true)}
      />
      <FindAndRedactModal
        isOpen={isFindAndRedactOpen}
        pages={data?.pages ?? []}
        onClose={() => setIsFindAndRedactOpen(false)}
      />
      <QuickHelpModal
        isOpen={isQuickHelpOpen}
        onClose={() => setIsQuickHelpOpen(false)}
      />
      <div className="govuk-grid-column-full-width">
        <h1 className="govuk-heading-xl jr-mark-for-redaction__header">
          Mark for redaction
        </h1>
      </div>

      <ReviewStatusMessages isLoading={isLoading} error={error} />

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
              const findingsForPage = data.findings.filter(
                (finding) => finding.pageNumber === page.pageNumber
              );

              const manualSelectionsForPage = manualSelections.filter(
                (selection) =>
                  selection.documentId === documentId &&
                  selection.pageNumber === page.pageNumber
              );

              return (
                <section
                  key={page.pageNumber}
                  className="jr-review-page"
                  aria-labelledby={`review-page-${page.pageNumber}-heading`}
                >
                  <ReviewPageHeader
                    pageNumber={page.pageNumber}
                    pageStatus={pageStatuses[page.pageNumber]}
                    onExempt={markPageExempted}
                    onDelete={markPageDeleted}
                    onRestore={restorePage}
                  />

                  {pageStatuses[page.pageNumber] ? (
                    <details className="govuk-details jr-review-page__details">
                      <summary className="govuk-details__summary">
                        <span className="govuk-details__summary-text">
                          View original page content
                        </span>
                      </summary>

                      <div className="govuk-details__text">
                        <PageContent
                          page={page}
                          findings={findingsForPage}
                          manualSelections={manualSelectionsForPage}
                          isPreviewMode={isPreviewMode}
                          onToggleImageRedaction={toggleImageRedaction}
                        />
                      </div>
                    </details>
                  ) : (
                    <PageContent
                      page={page}
                      findings={findingsForPage}
                      manualSelections={manualSelectionsForPage}
                      isPreviewMode={isPreviewMode}
                      onToggleImageRedaction={toggleImageRedaction}
                    />
                  )}
                </section>
              );
            })}
          </div>

          <hr className="govuk-section-break govuk-section-break--m govuk-section-break--visible" />

          <ReviewPagination
            pageRanges={pageRanges}
            selectedRangeStart={selectedRangeStart}
            totalPages={data.summary.totalPages}
            onSelectRangeStart={setSelectedRangeStart}
          />

          {isLastBatch && (
            <EndOfDocumentActions
              canApplyRedactions={
                manualSelectionsForCurrentDocument().length > 0 ||
                Object.keys(pageStatuses).length > 0
              }
              isApplyingRedactions={isApplyingRedactions}
              error={applyRedactionsError}
              onApplyRedactions={handleApplyRedactions}
            />
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
        <main className="govuk-main-wrapper" id="main-content">
          <div className="hods-loading-spinner" role="status" aria-live="polite">
            <span className="govuk-visually-hidden">Loading review page</span>
            <div className="hods-loading-spinner__spinner" aria-hidden="true" />
          </div>
        </main>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}