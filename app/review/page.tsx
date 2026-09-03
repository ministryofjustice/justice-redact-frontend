"use client";

import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import type { MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, fetchJson } from "../lib/api";

import { buildApplyRedactionsRequest } from "./applyRedactions";
import { useReviewData } from "./useReviewData";
import { buildReviewStateFromPersistedDecisions } from "./redactionDecisionPersistence";
import EndOfDocumentActions from "./components/EndOfDocumentActions";
import PageContent from "./components/PageContent";
import ReviewControlsHeader from "./components/ReviewControlsHeader";
import ReviewPageHeader from "./components/ReviewPageHeader";
import ReviewPagination from "./components/ReviewPagination";
import ReviewStatusMessages from "./components/ReviewStatusMessages";
import QuickHelpModal from "./components/QuickHelpModal";
import { clampRangeValue } from "./textRendering";
import HighlightKey from "./components/HighlightKey";
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
  ReviewMode,
  RedactionDecisionSet,
} from "./types";
import FindAndRedactModal from "./components/FindAndRedactModal";
import FindAndPartiallyRedactModal from "./components/FindAndPartiallyRedactModal";
import FindAndDiscloseModal from "./components/FindAndDiscloseModal";
import { buildContentRangesFromFindResults } from "./buildContentRangesFromFindResults";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";

import {
  buildPartialContentRanges,
  type FindInDocumentResult,
} from "./findInDocument";
import { discloseManualRedactions } from "./discloseManualRedactions";
import type { FindInManualRedactionResult } from "./findInManualRedactions";
import {
  getManualDecisionContentRanges,
} from "./contentRangeUtils";
import { buildManualSelectionsFromContentRanges } from "./buildManualSelectionsFromContentRanges";
import { subtractContentRanges } from "./subtractContentRanges";

const PAGES_PER_BATCH = 50;

type ApplyRedactionsResponse = {
  documentId: string;
  runId: string;
  status: string;
};

type SaveRedactionDecisionsResponse = {
  documentId: string;
  status: string;
  revision: number;
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
  const [manualSelections, setManualSelections] = useState<ManualDecision[]>([]);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("redact");
  const [isApplyingRedactions, setIsApplyingRedactions] = useState(false);
  const [applyRedactionsError, setApplyRedactionsError] = useState<string | null>(null);
  const [pageStatuses, setPageStatuses] = useState<Record<number, PageStatus>>({});
  const [isQuickHelpOpen, setIsQuickHelpOpen] = useState(false);
  const [isFindAndRedactOpen, setIsFindAndRedactOpen] = useState(false);
  const [isFindAndDiscloseOpen, setIsFindAndDiscloseOpen] = useState(false);
  const [isFindAndPartiallyRedactOpen, setIsFindAndPartiallyRedactOpen] = useState(false);
  const [hasLoadedPersistedDecisions, setHasLoadedPersistedDecisions] =
    useState(false);
  const [decisionSaveError, setDecisionSaveError] = useState<string | null>(null);
  const [hasDecisionConflict, setHasDecisionConflict] = useState(false);
  const [redactionRemoveMenu, setRedactionRemoveMenu] = useState<{
    manualId: string;
    redactionGroupId: string | null;
    x: number;
    y: number;
  } | null>(null);

  const decisionRevisionRef = useRef(0);
  const redactionRemoveTriggerRef = useRef<HTMLElement | null>(null);
  const redactionRemoveMenuRef = useRef<HTMLButtonElement | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDecisionSaveRef =
    useRef<Promise<SaveRedactionDecisionsResponse> | null>(null);

  const { data, isLoading, error } = useReviewData(documentId);

  const isPreviewMode = reviewMode === "preview";
  const isRedactMode = reviewMode === "redact";

  useEffect(() => {
    if (!isRedactMode && redactionRemoveMenu) {
      setManualRedactionHover(
        redactionRemoveMenu.manualId,
        redactionRemoveMenu.redactionGroupId,
        false
      );

      setRedactionRemoveMenu(null);
      redactionRemoveTriggerRef.current = null;
    }
  }, [isRedactMode, redactionRemoveMenu]);

  useEffect(() => {
    if (!redactionRemoveMenu) {
      return;
    }

    const {
      manualId,
      redactionGroupId,
    } = redactionRemoveMenu;

    function clearRedactionHover() {
      document
        .querySelectorAll<HTMLElement>("[data-manual-id]")
        .forEach((element) => {
          const matches =
            redactionGroupId !== null
              ? element.dataset.redactionGroupId ===
              redactionGroupId
              : element.dataset.manualId === manualId;

          if (matches) {
            element.classList.remove(
              "highlight--redaction-hover"
            );
          }
        });
    }

    function dismissMenu(restoreFocus = false) {
      clearRedactionHover();
      setRedactionRemoveMenu(null);

      if (restoreFocus) {
        requestAnimationFrame(() => {
          redactionRemoveTriggerRef.current?.focus();
        });
      }
    }

    function handleMouseDown(event: globalThis.MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (redactionRemoveMenuRef.current?.contains(event.target)) {
        return;
      }

      dismissMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      dismissMenu(true);
    }

    function handleViewportChange() {
      dismissMenu();
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);

      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [redactionRemoveMenu]);

  useEffect(() => {
    if (!documentId || !data) {
      return;
    }

    const currentDocumentId = documentId;
    let isActive = true;

    async function loadPersistedDecisions() {
      try {
        const persisted = await fetchJson<RedactionDecisionSet>(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${currentDocumentId}/redaction-decisions`
        );

        if (!isActive) {
          return;
        }

        const restored = buildReviewStateFromPersistedDecisions(
          currentDocumentId,
          persisted.decisions
        );

        setManualSelections(restored.manualSelections);
        setPageStatuses(restored.pageStatuses);
        decisionRevisionRef.current = persisted.revision;
        setHasLoadedPersistedDecisions(true);
      } catch (error) {
        console.error(
          "Failed to load persisted redaction decisions",
          error
        );
      }
    }

    void loadPersistedDecisions();

    return () => {
      isActive = false;
    };
  }, [documentId, data]);

  const saveCurrentDecisions = useCallback(
    async (
      selections: ManualDecision[],
      statuses: Record<number, PageStatus>,
    ): Promise<SaveRedactionDecisionsResponse> => {
      if (!documentId) {
        throw new Error("Missing document ID.");
      }

      const request = buildApplyRedactionsRequest(
        documentId,
        selections,
        statuses,
      );

      try {
        const response = await fetchJson<SaveRedactionDecisionsResponse>(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/redaction-decisions`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...request,
              expectedRevision: decisionRevisionRef.current,
            }),
          },
        );

        decisionRevisionRef.current = response.revision;
        setDecisionSaveError(null);

        return response;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setHasDecisionConflict(true);
          setDecisionSaveError(
            "This document has been changed in another tab. Refresh the page to load the latest saved decisions.",
          );

          throw error;
        }

        console.error(
          "Failed to save redaction decisions",
          error,
        );

        setDecisionSaveError(
          "Your latest redaction changes could not be saved. Try making the change again.",
        );

        throw error;
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (
      !documentId ||
      !hasLoadedPersistedDecisions ||
      hasDecisionConflict
    ) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      const previousSave = activeDecisionSaveRef.current;

      const savePromise = (async () => {
        if (previousSave) {
          try {
            await previousSave;
          } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
              throw error;
            }

            // A transient failure in the previous save should not prevent
            // the latest state from being retried.
          }
        }

        return saveCurrentDecisions(
          manualSelections,
          pageStatuses,
        );
      })();

      activeDecisionSaveRef.current = savePromise;

      void savePromise
        .catch(() => {
          // Error has already been handled by saveCurrentDecisions.
        })
        .finally(() => {
          if (activeDecisionSaveRef.current === savePromise) {
            activeDecisionSaveRef.current = null;
          }
        });
    }, 500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    documentId,
    manualSelections,
    pageStatuses,
    hasLoadedPersistedDecisions,
    hasDecisionConflict,
    saveCurrentDecisions,
  ]);

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

    if (hasDecisionConflict) {
      setApplyRedactionsError(
        "Refresh the page to load the latest saved decisions before applying redactions."
      );
      return;
    }

    try {
      setIsApplyingRedactions(true);
      setApplyRedactionsError(null);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }

      if (activeDecisionSaveRef.current) {
        try {
          await activeDecisionSaveRef.current;
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            throw error;
          }

          // A transient autosave failure should not prevent Apply from
          // making one final attempt to save the latest decisions.
        }
      }

      await saveCurrentDecisions(
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
            expectedRevision: decisionRevisionRef.current,
          }),
        }
      );

      router.push(
        `/applying-redactions?documentId=${data.documentId}&runId=${applyResponse.runId}`
      );
    } catch (err) {
      setApplyRedactionsError(
        err instanceof Error
          ? err.message
          : "Failed to apply redactions."
      );
      setIsApplyingRedactions(false);
    }
  }

  function addManualTextSelectionGroup(
    page: ReviewPageData,
    spansToAdd: ManualSpan[],
    redactionGroupId: string
  ) {
    if (!documentId || spansToAdd.length === 0) return;

    const newSelections: ManualTextDecision[] = spansToAdd.flatMap(
      (span) => {
        const item = page.textItems.find(
          (candidate) => candidate.itemId === span.itemId
        );

        if (!item) {
          return [];
        }

        const sourceText = item.renderText ?? item.text;

        const start = clampRangeValue(
          span.start,
          sourceText.length
        );

        const end = clampRangeValue(
          span.end,
          sourceText.length
        );

        if (end <= start) {
          return [];
        }

        const text = sourceText.slice(start, end);

        if (!text.trim()) {
          return [];
        }

        return [
          {
            id: crypto.randomUUID(),
            documentId,
            kind: "text" as const,
            pageNumber: span.pageNumber,
            itemId: span.itemId,
            start,
            end,
            text,
            redactionGroupId,
          },
        ];
      }
    );

    if (newSelections.length === 0) {
      return;
    }

    setManualSelections((prev) => [
      ...prev,
      ...newSelections,
    ]);
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

    const redactionGroupId = crypto.randomUUID();

    addManualTextSelectionGroup(
      page,
      spansToAdd,
      redactionGroupId
    );

    selection.removeAllRanges();
  }

  function removeManualSelection(
    manualId: string,
    redactionGroupId: string | null
  ) {
    setManualSelections((prev) =>
      prev.filter((selection) => {
        if (redactionGroupId) {
          if (selection.kind === "image") {
            return true;
          }

          return (
            selection.redactionGroupId !==
            redactionGroupId
          );
        }

        return selection.id !== manualId;
      })
    );
  }

  function getRedactionTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) {
      return null;
    }

    const element =
      target.closest<HTMLElement>("[data-manual-id]");

    const manualId = element?.dataset.manualId;

    if (!element || !manualId) {
      return null;
    }

    return {
      manualId,
      redactionGroupId:
        element.dataset.redactionGroupId ?? null,
    };
  }

  function isSameRedactionTarget(
    left: {
      manualId: string;
      redactionGroupId: string | null;
    } | null,
    right: {
      manualId: string;
      redactionGroupId: string | null;
    } | null
  ) {
    if (!left || !right) {
      return false;
    }

    if (
      left.redactionGroupId &&
      right.redactionGroupId
    ) {
      return (
        left.redactionGroupId ===
        right.redactionGroupId
      );
    }

    return left.manualId === right.manualId;
  }

  function setManualRedactionHover(
    manualId: string,
    redactionGroupId: string | null,
    isHovered: boolean
  ) {
    document
      .querySelectorAll<HTMLElement>("[data-manual-id]")
      .forEach((element) => {
        const matches =
          redactionGroupId !== null
            ? element.dataset.redactionGroupId ===
            redactionGroupId
            : element.dataset.manualId === manualId;

        if (matches) {
          element.classList.toggle(
            "highlight--redaction-hover",
            isHovered
          );
        }
      });
  }

  function closeRedactionRemoveMenu(
    restoreFocus = false
  ) {
    if (redactionRemoveMenu) {
      setManualRedactionHover(
        redactionRemoveMenu.manualId,
        redactionRemoveMenu.redactionGroupId,
        false
      );
    }

    setRedactionRemoveMenu(null);

    if (restoreFocus) {
      requestAnimationFrame(() => {
        redactionRemoveTriggerRef.current?.focus();
      });
    }
  }

  function handleRedactionMouseOver(event: MouseEvent<HTMLElement>) {
    if (!isRedactMode) {
      return;
    }

    const redactionTarget =
      getRedactionTarget(event.target);

    if (!redactionTarget) {
      return;
    }

    const relatedTarget =
      getRedactionTarget(event.relatedTarget);

    if (
      isSameRedactionTarget(
        redactionTarget,
        relatedTarget
      )
    ) {
      return;
    }

    setManualRedactionHover(
      redactionTarget.manualId,
      redactionTarget.redactionGroupId,
      true
    );
  }

  function handleRedactionMouseOut(
    event: MouseEvent<HTMLElement>
  ) {
    if (!isRedactMode) {
      return;
    }

    const redactionTarget =
      getRedactionTarget(event.target);

    if (!redactionTarget) {
      return;
    }

    const relatedTarget =
      getRedactionTarget(event.relatedTarget);

    if (
      isSameRedactionTarget(
        redactionTarget,
        relatedTarget
      )
    ) {
      return;
    }

    setManualRedactionHover(
      redactionTarget.manualId,
      redactionTarget.redactionGroupId,
      false
    );
  }

  function handleRedactionContextMenu(event: MouseEvent<HTMLElement>) {
    if (!isRedactMode) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const element =
      target.closest<HTMLElement>("[data-manual-id]");

    const redactionTarget =
      getRedactionTarget(target);

    if (!element || !redactionTarget) {
      return;
    }

    event.preventDefault();

    redactionRemoveTriggerRef.current = element;

    setRedactionRemoveMenu({
      manualId: redactionTarget.manualId,
      redactionGroupId:
        redactionTarget.redactionGroupId,
      x: event.clientX,
      y: event.clientY,
    });
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

  function handleHighlightSelected(
    selectedResults: FindInDocumentResult[]
  ): number {
    if (
      !documentId ||
      !data ||
      selectedResults.length === 0
    ) {
      return 0;
    }

    const existingRanges =
      getManualDecisionContentRanges(manualSelections);

    const newSelections =
      selectedResults.flatMap((result) => {
        const resultRanges =
          buildContentRangesFromFindResults([result]);

        /*
         * Only add portions of this searched occurrence which
         * are not already covered by an existing redaction.
         */
        const uncoveredRanges = resultRanges.flatMap(
          (range) =>
            subtractContentRanges(
              range,
              existingRanges
            )
        );

        if (uncoveredRanges.length === 0) {
          return [];
        }

        /*
         * One selected search occurrence is one logical
         * redaction, even if that occurrence spans multiple
         * text blocks.
         */
        const redactionGroupId =
          crypto.randomUUID();

        return buildManualSelectionsFromContentRanges(
          uncoveredRanges,
          data.pages,
          documentId,
          () => crypto.randomUUID()
        ).map((selection) => ({
          ...selection,
          redactionGroupId,
        }));
      });

    if (newSelections.length === 0) {
      return 0;
    }

    /*
     * Crucially: append only the searched redactions.
     * Existing manual decisions are left untouched.
     */
    setManualSelections((previous) => [
      ...previous,
      ...newSelections,
    ]);

    return newSelections.length;
  }

  function handleFindAndPartiallyRedact(
    results: FindInDocumentResult[],
    selectedResultIds: Set<string>,
    selectedRange: {
      start: number;
      end: number;
    }
  ): number {
    if (!documentId || !data) {
      return 0;
    }

    const selectedResults = results.filter(
      (result) =>
        selectedResultIds.has(result.id)
    );

    if (selectedResults.length === 0) {
      return 0;
    }

    const existingRanges =
      getManualDecisionContentRanges(manualSelections);

    const newSelections =
      selectedResults.flatMap((result) => {
        const resultRanges =
          buildPartialContentRanges(
            data.pages,
            result,
            selectedRange
          );

        /*
         * Only add the uncovered portion of the specific
         * partial phrase selected by the user.
         */
        const uncoveredRanges = resultRanges.flatMap(
          (range) =>
            subtractContentRanges(
              range,
              existingRanges
            )
        );

        if (uncoveredRanges.length === 0) {
          return [];
        }

        const redactionGroupId =
          crypto.randomUUID();

        return buildManualSelectionsFromContentRanges(
          uncoveredRanges,
          data.pages,
          documentId,
          () => crypto.randomUUID()
        ).map((selection) => ({
          ...selection,
          redactionGroupId,
        }));
      });

    if (newSelections.length === 0) {
      return 0;
    }

    setManualSelections((previous) => [
      ...previous,
      ...newSelections,
    ]);

    return newSelections.length;
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

    const result = discloseManualRedactions(
      manualSelections,
      selectedResults,
      () => crypto.randomUUID()
    );

    if (result.disclosedCount === 0) {
      return 0;
    }

    /*
     * discloseManualRedactions now preserves every unrelated
     * existing decision and only modifies decisions which
     * contain the searched phrase.
     */
    setManualSelections(
      result.remainingSelections
    );

    return result.disclosedCount;
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
        onReviewModeChange={setReviewMode}
        onQuickHelp={() => setIsQuickHelpOpen(true)}
        onFindAndRedact={() => setIsFindAndRedactOpen(true)}
        onFindAndPartiallyRedact={() => setIsFindAndPartiallyRedactOpen(true)}
        onFindAndDisclose={() => setIsFindAndDiscloseOpen(true)}
      />
      <FindAndRedactModal
        isOpen={isFindAndRedactOpen}
        pages={data?.pages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndRedactOpen(false)}
        onHighlightSelected={handleHighlightSelected}
      />
      <FindAndPartiallyRedactModal
        isOpen={isFindAndPartiallyRedactOpen}
        pages={data?.pages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndPartiallyRedactOpen(false)}
        onHighlightSelected={handleFindAndPartiallyRedact}
      />
      <FindAndDiscloseModal
        isOpen={isFindAndDiscloseOpen}
        pages={data?.pages ?? []}
        manualSelections={manualSelections}
        onClose={() => setIsFindAndDiscloseOpen(false)}
        onUndoSelected={handleUndoSelected}
      />
      <QuickHelpModal
        isOpen={isQuickHelpOpen}
        onClose={() => setIsQuickHelpOpen(false)}
      />
      {selectedRangeStart === 0 && (
        <div className="govuk-grid-column-full-width">
          <button
            type="button"
            className="govuk-back-link govuk-back-link-button"
            onClick={() => router.push("/upload")}
          >
            Back
          </button>
        </div>
      )}
      <div className="govuk-grid-column-full-width">
        <h1 className="govuk-heading-xl jr-mark-for-redaction__header">
          Mark for redaction
        </h1>
      </div>

      <HighlightKey />

      <ReviewStatusMessages
        isLoading={isLoading}
        error={error ?? decisionSaveError}
      />

      {data && visiblePages.length > 0 && (
        <>
          <div
            onMouseUp={() => {
              const handledTable = handleTableCellSelection();
              if (!handledTable) handleTextSelection();
            }}
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
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}