"use client";

import {
  Suspense,
  useMemo,
  useState,
  useEffect,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";
import { buildApplyRedactionsRequest } from "./applyRedactions";
import { useReviewData } from "./useReviewData";
import { useReviewPages } from "./useReviewPages";
import { useReviewDecisionPersistence } from "../../features/documents/review/useReviewDecisionPersistence";
import { useReviewFindWorkflows } from "../../features/documents/review/useReviewFindWorkflows";
import { useRedactionInteractions } from "../../features/documents/review/useRedactionInteractions";
import {
  addManualTableSelections,
  addManualTextSelections,
} from "../../features/documents/review/manualRedactionOperations";
import {
  addPartialFindRedactions,
  applyFindRedactionReplacements,
  prepareFindRedactionReplacements,
} from "../../features/documents/review/findRedactionOperations";
import { usePageTitle } from "../components/PageTitle";
import EndOfDocumentActions from "./components/EndOfDocumentActions";
import PageContent from "./components/PageContent";
import ReviewControlsHeader from "./components/ReviewControlsHeader";
import ReviewPageHeader from "./components/ReviewPageHeader";
import ReviewPagination from "./components/ReviewPagination";
import ReviewStatusMessages from "./components/ReviewStatusMessages";
import QuickHelpModal from "./components/QuickHelpModal";
import { resolveSelectedTextRanges } from "./textSelectionRanges";
import HighlightKey from "./components/HighlightKey";
import ApplyRedactionsFailureAlert from "./components/ApplyRedactionsFailureAlert";
import {
  getClosestElementWithAttribute,
  getTextOffsetWithinItem,
} from "./selectionUtils";
import type {
  ManualSpan,
  ReviewPageData,
  ReviewTableCell,
  ReviewMode,
} from "./types";
import { buildSelectedTableCellRanges } from "./tableSelectionRanges";
import FindAndRedactModal from "./components/FindAndRedactModal";
import FindAndPartiallyRedactModal from "./components/FindAndPartiallyRedactModal";
import FindAndDiscloseModal from "./components/FindAndDiscloseModal";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";
import {
  consumeApplyRedactionsFailure,
} from "../lib/applyRedactionsFailure";
import BetaBanner from "../components/BetaBanner";
import {
  type FindInDocumentResult,
} from "./findInDocument";
import { discloseManualRedactions } from "./discloseManualRedactions";
import type { FindInManualRedactionResult } from "./findInManualRedactions";

const PAGES_PER_BATCH = 50;

type ApplyRedactionsResponse = {
  documentId: string;
  runId: string;
  status: string;
};

function ReviewContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const {
    isChecking: isCheckingWorkflow,
    errorVariant: workflowErrorVariant,
  } = useWorkflowGuard("review", documentId);

  if (isCheckingWorkflow) {
    return null;
  }

  if (workflowErrorVariant) {
    return (
      <ServiceErrorPage
        variant={workflowErrorVariant}
        documentId={documentId}
      />
    );
  }

  return (
    <ReviewDocument
      key={documentId ?? "missing-document-id"}
      documentId={documentId}
    />
  );
}

function ReviewDocument({ documentId }: { documentId: string | null }) {

  const router = useRouter();

  const [selectedRangeStart, setSelectedRangeStart] = useState(0);
  const { data, isLoading, error } = useReviewData(documentId);

  const {
    manualSelections,
    setManualSelections,
    pageStatuses,
    setPageStatuses,
    hasLoadedPersistedDecisions,
    decisionLoadError,
    decisionSaveError,
    hasDecisionConflict,
    clearDecisionSaveError,
    saveBeforeApply,
  } = useReviewDecisionPersistence(
    documentId,
    Boolean(data),
  );
  const [reviewMode, setReviewMode] = useState<ReviewMode>("redact");
  const [isApplyingRedactions, setIsApplyingRedactions] = useState(false);
  const [applyRedactionsError, setApplyRedactionsError] = useState<string | null>(null);
  const [showApplyRedactionsFailure, setShowApplyRedactionsFailure] =
    useState(() => {
      if (!documentId) {
        return false;
      }

      return consumeApplyRedactionsFailure(documentId);
    });
  const [isQuickHelpOpen, setIsQuickHelpOpen] = useState(false);
  const {
    isFindAndRedactOpen,
    setIsFindAndRedactOpen,
    isFindAndPartiallyRedactOpen,
    setIsFindAndPartiallyRedactOpen,
    isFindAndDiscloseOpen,
    setIsFindAndDiscloseOpen,
    hasFindAndRedactError,
    setHasFindAndRedactError,
    hasFindAndPartiallyRedactError,
    setHasFindAndPartiallyRedactError,
    hasFindAndDiscloseError,
    setHasFindAndDiscloseError,
    searchPages,
    isSearchLoading,
    searchError,
    openFindAndRedact,
    openFindAndPartiallyRedact,
    openFindAndDisclose,
  } = useReviewFindWorkflows(documentId);

  const requestedPageStart =
    selectedRangeStart + 1;

  const requestedPageEnd =
    data && data.summary.totalPages > 0
      ? Math.min(
        data.summary.totalPages,
        selectedRangeStart + PAGES_PER_BATCH
      )
      : null;

  const {
    pages: visiblePages,
    isLoading: isPagesLoading,
    error: pagesError,
  } = useReviewPages(
    documentId,
    requestedPageStart,
    requestedPageEnd,
    Boolean(data)
  );

  usePageTitle(
    "Make redactions",
    Boolean(
      showApplyRedactionsFailure ||
      error ||
      pagesError ||
      searchError ||
      decisionSaveError ||
      applyRedactionsError ||
      hasFindAndRedactError ||
      hasFindAndPartiallyRedactError ||
      hasFindAndDiscloseError
    ),
  );

  const isPreviewMode = reviewMode === "preview";
  const isRedactMode = reviewMode === "redact";

  const {
    redactionRemoveMenu,
    redactionRemoveMenuRef,
    setManualRedactionHover,
    removeManualSelection,
    closeRedactionRemoveMenu,
    handleRedactionMouseOver,
    handleRedactionMouseOut,
    handleRedactionContextMenu,
  } = useRedactionInteractions({
    isRedactMode,
    setManualSelections,
  });

  useEffect(() => {
    if (!showApplyRedactionsFailure) {
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [showApplyRedactionsFailure]);

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

  function showApplyFailureAlert() {
    setApplyRedactionsError(null);
    clearDecisionSaveError();
    setShowApplyRedactionsFailure(true);
    setIsApplyingRedactions(false);

    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }

  async function handleApplyRedactions() {
    if (!data || !documentId) return;

    const currentDocumentSelections = manualSelectionsForCurrentDocument();
    const hasPageDecisions = Object.keys(pageStatuses).length > 0;

    if (currentDocumentSelections.length === 0 && !hasPageDecisions) return;

    if (hasDecisionConflict) {
      setApplyRedactionsError(
        "Refresh the page to load the latest saved decisions before applying redactions."
      );
      return;
    }

    try {
      setIsApplyingRedactions(true);
      setApplyRedactionsError(null);
      setShowApplyRedactionsFailure(false);

      const savedRevision = await saveBeforeApply(
        currentDocumentSelections,
        pageStatuses,
      );

      const applyResponse = await fetchJson<ApplyRedactionsResponse>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${data.documentId}/apply-redactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...buildApplyRedactionsRequest(
              data.documentId,
              currentDocumentSelections,
              pageStatuses
            ),
            expectedRevision: savedRevision,
          }),
        }
      );

      router.push(
        `/applying-redactions?documentId=${data.documentId}&runId=${applyResponse.runId}`
      );
    } catch {
      showApplyFailureAlert();
    }
  }

  function addManualTextSelectionGroup(
    page: ReviewPageData,
    spansToAdd: ManualSpan[],
    redactionGroupId: string
  ) {
    if (!documentId || spansToAdd.length === 0) {
      return;
    }

    setManualSelections((previous) =>
      addManualTextSelections(
        previous,
        page,
        spansToAdd,
        documentId,
        redactionGroupId,
        () => crypto.randomUUID()
      )
    );
  }

  function addManualTableSelectionGroup(
    pageNumber: number,
    tableId: string,
    cellRanges: Array<{
      cell: ReviewTableCell;
      start: number;
      end: number;
    }>,
    redactionGroupId: string
  ) {
    if (!documentId || !data || cellRanges.length === 0) {
      return;
    }

    setManualSelections((previous) =>
      addManualTableSelections(
        previous,
        pageNumber,
        tableId,
        cellRanges,
        visiblePages,
        documentId,
        redactionGroupId,
        () => crypto.randomUUID()
      )
    );
  }

  function handleTableCellSelection() {
    if (!isRedactMode || !data) {
      return false;
    }

    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return false;
    }

    const range = selection.getRangeAt(0);

    const startElement =
      getClosestElementWithAttribute(
        range.startContainer,
        "data-cell-id"
      );

    const endElement =
      getClosestElementWithAttribute(
        range.endContainer,
        "data-cell-id"
      );

    if (!startElement || !endElement) {
      return false;
    }

    const startCellId = startElement.dataset.cellId;
    const endCellId = endElement.dataset.cellId;

    const startTableId = startElement.dataset.tableId;
    const endTableId = endElement.dataset.tableId;

    const startPageNumber =
      startElement.dataset.pageNumber;

    const endPageNumber =
      endElement.dataset.pageNumber;

    if (
      !startCellId ||
      !endCellId ||
      !startTableId ||
      !endTableId ||
      !startPageNumber ||
      !endPageNumber
    ) {
      selection.removeAllRanges();
      return true;
    }

    if (
      startTableId !== endTableId ||
      startPageNumber !== endPageNumber
    ) {
      selection.removeAllRanges();
      return true;
    }

    const pageNumber = Number(startPageNumber);

    const page = visiblePages.find(
      (candidate) =>
        candidate.pageNumber === pageNumber
    );

    const table = page?.tables.find(
      (candidate) =>
        candidate.tableId === startTableId
    );

    if (!page || !table) {
      selection.removeAllRanges();
      return true;
    }

    const cellRanges = buildSelectedTableCellRanges(
      table.rows.flatMap((row) => row.cells),
      startCellId,
      endCellId,
      () =>
        getTextOffsetWithinItem(
          startElement,
          range.startContainer,
          range.startOffset,
        ),
      () =>
        getTextOffsetWithinItem(
          endElement,
          range.endContainer,
          range.endOffset,
        ),
    );

    if (cellRanges === null) {
      selection.removeAllRanges();
      return true;
    }

    if (cellRanges.length > 0) {
      addManualTableSelectionGroup(
        pageNumber,
        startTableId,
        cellRanges,
        crypto.randomUUID()
      );
    }

    selection.removeAllRanges();

    return true;
  }

  function handleTextSelection() {
    if (!isRedactMode || !data) {
      return;
    }

    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed
    ) {
      return;
    }

    const result = resolveSelectedTextRanges(
      selection.getRangeAt(0),
      visiblePages
    );

    if (result.kind === "ignore") {
      return;
    }

    if (result.kind === "apply") {
      addManualTextSelectionGroup(
        result.page,
        result.spans,
        crypto.randomUUID()
      );
    }

    selection.removeAllRanges();
  }

  function handleReviewModeChange(nextMode: ReviewMode) {
    if (nextMode !== "redact") {
      closeRedactionRemoveMenu();
    }

    setReviewMode(nextMode);
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

  function removeRedactionsForPage(pageNumber: number) {
    setManualSelections((previous) =>
      previous.filter(
        (selection) =>
          selection.pageNumber !== pageNumber
      )
    );
  }

  function markPageDeleted(pageNumber: number) {
    removeRedactionsForPage(pageNumber);

    setPageStatuses((prev) => ({
      ...prev,
      [pageNumber]: "deleted",
    }));
  }

  function markPageExempted(pageNumber: number) {
    removeRedactionsForPage(pageNumber);

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

  function handleHighlightSelected(
    selectedResults: FindInDocumentResult[]
  ): number {
    if (
      !documentId ||
      !searchPages ||
      selectedResults.length === 0
    ) {
      return 0;
    }

    const plan = prepareFindRedactionReplacements(
      selectedResults,
      searchPages,
      documentId,
      () => crypto.randomUUID()
    );

    if (plan.resultCount === 0) {
      return 0;
    }

    setManualSelections((previous) =>
      applyFindRedactionReplacements(
        previous,
        plan,
        () => crypto.randomUUID()
      )
    );

    return plan.resultCount;
  }

  function handleFindAndPartiallyRedact(
    results: FindInDocumentResult[],
    selectedResultIds: Set<string>,
    selectedRange: {
      start: number;
      end: number;
    }
  ): number {
    if (!documentId || !searchPages) {
      return 0;
    }

    const selectedResults = results.filter((result) =>
      selectedResultIds.has(result.id)
    );

    if (selectedResults.length === 0) {
      return 0;
    }

    const preview = addPartialFindRedactions(
      manualSelections,
      selectedResults,
      selectedRange,
      searchPages,
      documentId,
      () => "preview-only"
    );

    setManualSelections((previous) =>
      addPartialFindRedactions(
        previous,
        selectedResults,
        selectedRange,
        searchPages,
        documentId,
        () => crypto.randomUUID()
      ).nextSelections
    );

    return preview.addedResultCount;
  }

  function handleUndoSelected(
    selectedResults: FindInManualRedactionResult[]
  ): number {
    if (
      !documentId ||
      !data ||
      selectedResults.length === 0
    ) {
      return 0;
    }

    const preview = discloseManualRedactions(
      manualSelections,
      selectedResults,
      () => "preview-only"
    );

    setManualSelections((previous) =>
      discloseManualRedactions(
        previous,
        selectedResults,
        () => crypto.randomUUID()
      ).remainingSelections
    );

    return preview.disclosedCount;
  }

  useEffect(() => {
    if (!isRedactMode || !data) {
      return;
    }

    function handleDocumentMouseUp(
      event: globalThis.MouseEvent
    ) {
      if (event.button !== 0) {
        return;
      }

      const selection = window.getSelection();

      if (
        !selection ||
        selection.rangeCount === 0 ||
        selection.isCollapsed
      ) {
        return;
      }

      const range = selection.getRangeAt(0);

      const intersectsRedactableContent =
        Array.from(
          document.querySelectorAll<HTMLElement>(
            ".jr-review-block.redactable[data-page-number][data-item-id], [data-cell-id]"
          )
        ).some((element) => {
          try {
            return range.intersectsNode(element);
          } catch {
            return false;
          }
        });

      if (!intersectsRedactableContent) {
        return;
      }

      const handledTable =
        handleTableCellSelection();

      if (!handledTable) {
        handleTextSelection();
      }

      window.requestAnimationFrame(() => {
        window.getSelection()?.removeAllRanges();
      });
    }

    document.addEventListener(
      "mouseup",
      handleDocumentMouseUp
    );

    return () => {
      document.removeEventListener(
        "mouseup",
        handleDocumentMouseUp
      );
    };
  });

  if (decisionLoadError) {
    return (
      <ServiceErrorPage
        variant={500}
        documentId={documentId}
      />
    );
  }

  if (data && !hasLoadedPersistedDecisions) {
    return null;
  }

  return (
    <div className="jr-review-root">
      {redactionRemoveMenu && (
        <button
          ref={redactionRemoveMenuRef}
          type="button"
          className="jr-redaction-remove-menu"
          aria-label="Remove redaction"
          title="Remove redaction"
          style={{
            position: "fixed",
            left: redactionRemoveMenu.x,
            top: redactionRemoveMenu.y,
            zIndex: 20,
          }}
          onMouseEnter={() => {
            setManualRedactionHover(
              redactionRemoveMenu.manualId,
              redactionRemoveMenu.redactionGroupId,
              true
            );
          }}
          onMouseLeave={() => {
            setManualRedactionHover(
              redactionRemoveMenu.manualId,
              redactionRemoveMenu.redactionGroupId,
              false
            );
          }}
          onClick={() => {
            removeManualSelection(
              redactionRemoveMenu.manualId,
              redactionRemoveMenu.redactionGroupId
            );
            closeRedactionRemoveMenu();
          }}
        >
          <span className="jr-redaction-remove-menu__item">
            Remove redaction
          </span>
        </button>
      )}
      <ReviewControlsHeader
        filename={data?.filename || "Document"}
        reviewMode={reviewMode}
        onReviewModeChange={handleReviewModeChange}
        onQuickHelp={() => setIsQuickHelpOpen(true)}
        onFindAndRedact={() => {
          void openFindAndRedact();
        }}
        onFindAndPartiallyRedact={() => {
          void openFindAndPartiallyRedact();
        }}
        onFindAndDisclose={() => {
          void openFindAndDisclose();
        }}
      />

      <BetaBanner contained={false} />

      {showApplyRedactionsFailure && (
        <ApplyRedactionsFailureAlert />
      )}

      <FindAndRedactModal
        isOpen={isFindAndRedactOpen}
        pages={searchPages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndRedactOpen(false)}
        onErrorChange={setHasFindAndRedactError}
        onHighlightSelected={handleHighlightSelected}
      />
      <FindAndPartiallyRedactModal
        isOpen={isFindAndPartiallyRedactOpen}
        pages={searchPages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndPartiallyRedactOpen(false)}
        onErrorChange={setHasFindAndPartiallyRedactError}
        onHighlightSelected={handleFindAndPartiallyRedact}
      />
      <FindAndDiscloseModal
        isOpen={isFindAndDiscloseOpen}
        pages={searchPages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndDiscloseOpen(false)}
        onErrorChange={setHasFindAndDiscloseError}
        onUndoSelected={handleUndoSelected}
      />
      <QuickHelpModal
        isOpen={isQuickHelpOpen}
        onClose={() => setIsQuickHelpOpen(false)}
      />

      <h1
        className={[
          "govuk-heading-xl",
          "jr-review-intro__heading",
          showApplyRedactionsFailure
            ? "jr-review-intro__heading--after-alert"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        Make redactions
      </h1>

      <HighlightKey />

      <ReviewStatusMessages
        isLoading={
          isLoading ||
          isPagesLoading ||
          isSearchLoading
        }
        error={
          error ??
          pagesError ??
          searchError ??
          decisionSaveError
        }
      />

      {data && visiblePages.length > 0 && (
        <>
          <div
            onMouseOver={handleRedactionMouseOver}
            onMouseOut={handleRedactionMouseOut}
            onContextMenu={handleRedactionContextMenu}
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
                          documentManualSelections={manualSelectionsForCurrentDocument()}
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
                      documentManualSelections={manualSelectionsForCurrentDocument()}
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
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}