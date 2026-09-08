"use client";

import {
    type FormEvent,
    type MouseEvent,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";

import {
    buildPartialContentRanges,
    buildFindInDocumentExcerpt,
    findInDocument,
    mapOriginalOffsetToNormalisedOffset,
    type FindInDocumentResult,
} from "../findInDocument";

import {
    containsContentRange,
    getManualDecisionContentRanges,
} from "../contentRangeUtils";

import { mergeContentRanges } from "../mergeContentRanges";
import type {
    ManualDecision,
    ReviewPageData,
} from "../types";
import Modal from "./Modal";
import FindResultMatch from "./FindResultMatch";
import { renderTextSegments } from "../textRendering";

type FindAndPartiallyRedactModalProps = {
    isOpen: boolean;
    pages: ReviewPageData[];
    manualSelections: ManualDecision[];
    onClose: () => void;

    onHighlightSelected: (
        results: FindInDocumentResult[],
        selectedResultIds: Set<string>,
        selectedRange: {
            start: number;
            end: number;
        }
    ) => number;
};

type SelectedRange = {
    start: number;
    end: number;
};

const EMPTY_SEARCH_ERROR =
    "Enter a word or phrase to search for in the document";

const EMPTY_PARTIAL_SELECTION_ERROR =
    "Select what to highlight";

export default function FindAndPartiallyRedactModal({
    isOpen,
    pages,
    manualSelections,
    onClose,
    onHighlightSelected,
}: FindAndPartiallyRedactModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [submittedSearchTerm, setSubmittedSearchTerm] =
        useState<string | null>(null);
    const [selectedRange, setSelectedRange] =
        useState<SelectedRange | null>(null);
    const [results, setResults] =
        useState<FindInDocumentResult[]>([]);
    const [selectedResultIds, setSelectedResultIds] =
        useState<Set<string>>(new Set());
    const [isShowingResults, setIsShowingResults] =
        useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectionError, setSelectionError] =
        useState<string | null>(null);
    const [resultsError, setResultsError] =
        useState<string | null>(null);
    const [highlightedCount, setHighlightedCount] =
        useState<number | null>(null);
    const [partialRedactionRemoveMenu, setPartialRedactionRemoveMenu] =
        useState<{
            x: number;
            y: number;
        } | null>(null);

    const inputId = useId();
    const resultsHeadingId = useId();
    const errorId = `${inputId}-error`;
    const selectionErrorId = `${inputId}-selection-error`;
    const selectionContainerId = `${inputId}-partial-selection`;

    const inputRef = useRef<HTMLInputElement>(null);
    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const successBannerRef = useRef<HTMLDivElement>(null);
    const firstResultCheckboxRef =
        useRef<HTMLInputElement>(null);
    const selectablePhraseRef = useRef<HTMLDivElement>(null);
    const partialRedactionRemoveMenuRef =
        useRef<HTMLButtonElement>(null);

    const isShowingSelectionStep =
        submittedSearchTerm !== null && !isShowingResults;
    const isShowingSuccess =
        highlightedCount !== null;

    function resetState() {
        setSearchTerm("");
        setSubmittedSearchTerm(null);
        setSelectedRange(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setHighlightedCount(null);
        setIsShowingResults(false);
        setError(null);
        setSelectionError(null);
        setResultsError(null);
    }

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!error && !selectionError && !resultsError) {
            return;
        }

        window.requestAnimationFrame(() => {
            errorSummaryRef.current?.focus();
        });
    }, [error, selectionError, resultsError]);

    useEffect(() => {
        if (!isShowingSuccess) {
            return;
        }

        window.requestAnimationFrame(() => {
            successBannerRef.current?.focus();
        });
    }, [isShowingSuccess]);

    useEffect(() => {
        if (!partialRedactionRemoveMenu) {
            return;
        }

        function handleMouseDown(
            event: globalThis.MouseEvent
        ) {
            if (!(event.target instanceof Node)) {
                return;
            }

            if (
                partialRedactionRemoveMenuRef.current?.contains(
                    event.target
                )
            ) {
                return;
            }

            closePartialRedactionRemoveMenu();
        }

        function handleKeyDown(
            event: KeyboardEvent
        ) {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            closePartialRedactionRemoveMenu();
        }

        function handleViewportChange() {
            closePartialRedactionRemoveMenu();
        }

        document.addEventListener(
            "mousedown",
            handleMouseDown
        );

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        window.addEventListener(
            "scroll",
            handleViewportChange,
            true
        );

        window.addEventListener(
            "resize",
            handleViewportChange
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleMouseDown
            );

            document.removeEventListener(
                "keydown",
                handleKeyDown
            );

            window.removeEventListener(
                "scroll",
                handleViewportChange,
                true
            );

            window.removeEventListener(
                "resize",
                handleViewportChange
            );
        };
    }, [partialRedactionRemoveMenu]);

    useEffect(() => {
        if (!selectedRange) {
            closePartialRedactionRemoveMenu();
        }
    }, [selectedRange]);

    function isSelectedPartialRangeAlreadyRedacted(
        result: FindInDocumentResult
    ): boolean {
        const effectiveSelectedRange =
            getEffectiveSelectedRange();

        if (
            !effectiveSelectedRange ||
            !submittedSearchTerm
        ) {
            return false;
        }

        const normalisedSelectedRange = {
            start: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                effectiveSelectedRange.start
            ),
            end: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                effectiveSelectedRange.end
            ),
        };

        const partialRanges =
            buildPartialContentRanges(
                pages,
                result,
                normalisedSelectedRange
            );

        if (partialRanges.length === 0) {
            return false;
        }

        const existingRanges = mergeContentRanges(
            getManualDecisionContentRanges(
                manualSelections
            )
        );

        return partialRanges.every((partialRange) =>
            existingRanges.some((existingRange) =>
                containsContentRange(
                    existingRange,
                    partialRange
                )
            )
        );
    }

    function getEffectiveSelectedRange(): SelectedRange | null {
        if (!selectedRange || !submittedSearchTerm) {
            return null;
        }

        const selectedText = submittedSearchTerm.slice(
            selectedRange.start,
            selectedRange.end
        );

        const leadingWhitespaceLength =
            selectedText.length -
            selectedText.trimStart().length;

        const trailingWhitespaceLength =
            selectedText.length -
            selectedText.trimEnd().length;

        const start =
            selectedRange.start +
            leadingWhitespaceLength;

        const end =
            selectedRange.end -
            trailingWhitespaceLength;

        if (end <= start) {
            return null;
        }

        return {
            start,
            end,
        };
    }

    function getPartialRedactionElement(
        target: EventTarget | null
    ): HTMLElement | null {
        if (!(target instanceof Element)) {
            return null;
        }

        const element =
            target.closest<HTMLElement>(
                '[data-manual-id="partial-redaction-selection"]'
            );

        if (
            !element ||
            !selectablePhraseRef.current?.contains(element)
        ) {
            return null;
        }

        return element;
    }

    function setPartialRedactionHover(
        isHovered: boolean
    ) {
        selectablePhraseRef.current
            ?.querySelectorAll<HTMLElement>(
                '[data-manual-id="partial-redaction-selection"]'
            )
            .forEach((element) => {
                element.classList.toggle(
                    "highlight--redaction-hover",
                    isHovered
                );
            });
    }

    function closePartialRedactionRemoveMenu() {
        setPartialRedactionHover(false);
        setPartialRedactionRemoveMenu(null);
    }

    function handlePartialRedactionMouseOver(
        event: MouseEvent<HTMLDivElement>
    ) {
        const target =
            getPartialRedactionElement(event.target);

        if (!target) {
            return;
        }

        const relatedTarget =
            getPartialRedactionElement(
                event.relatedTarget
            );

        if (relatedTarget) {
            return;
        }

        setPartialRedactionHover(true);
    }

    function handlePartialRedactionMouseOut(
        event: MouseEvent<HTMLDivElement>
    ) {
        const target =
            getPartialRedactionElement(event.target);

        if (!target) {
            return;
        }

        const relatedTarget =
            getPartialRedactionElement(
                event.relatedTarget
            );

        if (relatedTarget) {
            return;
        }

        setPartialRedactionHover(false);
    }

    function handlePartialRedactionContextMenu(
        event: MouseEvent<HTMLDivElement>
    ) {
        const target =
            getPartialRedactionElement(event.target);

        if (!target) {
            return;
        }

        event.preventDefault();

        setPartialRedactionHover(true);

        setPartialRedactionRemoveMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }

    function removePartialRedactionSelection() {
        setSelectedRange(null);
        setSelectionError(null);
        closePartialRedactionRemoveMenu();

        window.getSelection()?.removeAllRanges();
    }

    function getEffectiveSelectedText(): string {
        const effectiveSelectedRange =
            getEffectiveSelectedRange();

        if (
            !effectiveSelectedRange ||
            !submittedSearchTerm
        ) {
            return "";
        }

        return submittedSearchTerm.slice(
            effectiveSelectedRange.start,
            effectiveSelectedRange.end
        );
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const trimmedSearchTerm = searchTerm.trim();

        if (!trimmedSearchTerm) {
            setError(EMPTY_SEARCH_ERROR);
            return;
        }

        setError(null);
        setSelectionError(null);
        setResultsError(null);
        setSelectedRange(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setIsShowingResults(false);
        setSubmittedSearchTerm(trimmedSearchTerm);
    }

    function captureSelectedRange() {
        const container = selectablePhraseRef.current;
        const selection = window.getSelection();

        if (
            !container ||
            !submittedSearchTerm ||
            !selection ||
            selection.rangeCount === 0 ||
            selection.isCollapsed
        ) {
            return;
        }

        const range = selection.getRangeAt(0);

        if (
            !container.contains(range.startContainer) ||
            !container.contains(range.endContainer)
        ) {
            return;
        }

        const rangeBeforeSelection = document.createRange();

        rangeBeforeSelection.selectNodeContents(container);
        rangeBeforeSelection.setEnd(
            range.startContainer,
            range.startOffset
        );

        const start =
            rangeBeforeSelection.toString().length;
        const end = start + range.toString().length;

        if (
            start < 0 ||
            end <= start ||
            end > submittedSearchTerm.length
        ) {
            return;
        }

        const selectedText =
            submittedSearchTerm.slice(start, end);

        if (!selectedText.trim()) {
            return;
        }

        setSelectionError(null);
        setSelectedRange({
            start,
            end,
        });
    }

    function handleContinue() {
        if (!selectedRange || !submittedSearchTerm) {
            setSelectionError(
                EMPTY_PARTIAL_SELECTION_ERROR
            );
            return;
        }

        setSelectionError(null);

        const normalisedSelectedRange = {
            start: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                selectedRange.start
            ),
            end: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                selectedRange.end
            ),
        };

        const searchResults = findInDocument(
            pages,
            submittedSearchTerm
        );

        setResults(searchResults);

        setSelectedResultIds(new Set());
        setResultsError(null);
        setIsShowingResults(true);
    }

    function handleResultSelection(
        resultId: string,
        isSelected: boolean
    ) {
        setSelectedResultIds((previous) => {
            const next = new Set(previous);

            if (isSelected) {
                next.add(resultId);
            } else {
                next.delete(resultId);
            }

            return next;
        });

        setResultsError(null);
    }

    function handleSelectAll() {
        const selectableResultIds = results
            .filter(
                (result) =>
                    !isSelectedPartialRangeAlreadyRedacted(
                        result
                    )
            )
            .map((result) => result.id);

        setSelectedResultIds(
            new Set(selectableResultIds)
        );
        setResultsError(null);
    }

    function handleClearSelections() {
        setSelectedResultIds(new Set());
        setResultsError(null);
    }

    function handleHighlightSelected() {
        const effectiveSelectedRange =
            getEffectiveSelectedRange();

        if (
            selectedResultIds.size === 0 ||
            !effectiveSelectedRange ||
            !submittedSearchTerm
        ) {
            setResultsError("Select at least one result to highlight");
            return;
        }

        setResultsError(null);

        const normalisedSelectedRange = {
            start: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                effectiveSelectedRange.start
            ),
            end: mapOriginalOffsetToNormalisedOffset(
                submittedSearchTerm,
                effectiveSelectedRange.end
            ),
        };

        const highlighted = onHighlightSelected(
            results,
            selectedResultIds,
            normalisedSelectedRange
        );

        if (highlighted > 0) {
            setHighlightedCount(highlighted);
        }
    }

    function handleSearchAgain() {
        setSubmittedSearchTerm(null);
        setSelectedRange(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setHighlightedCount(null);
        setIsShowingResults(false);
        setError(null);
        setSelectionError(null);
        setResultsError(null);
    }

    function handleClose() {
        resetState();
        onClose();
    }

    return (
        <Modal
            isOpen={isOpen}
            title="Search and highlight part"
            onClose={handleClose}
            initialFocusRef={inputRef}
            renderTitle={false}
            variant={
                isShowingResults && !isShowingSuccess
                    ? "content-dense"
                    : "standard"
            }
        >
            {isShowingSuccess ? (
                <>
                    <h2 className="govuk-heading-l">
                        Your redactions have been made
                    </h2>

                    <div
                        ref={successBannerRef}
                        className="govuk-notification-banner govuk-notification-banner--success"
                        role="alert"
                        aria-labelledby={`${resultsHeadingId}-success-title`}
                        tabIndex={-1}
                    >
                        <div className="govuk-notification-banner__content">
                            <p
                                id={`${resultsHeadingId}-success-title`}
                                className="govuk-body govuk-!-margin-bottom-0 jr-find-and-redact-success"
                            >
                                <span
                                    className="jr-find-and-redact-success__icon"
                                    aria-hidden="true"
                                >
                                    ✓
                                </span>

                                <span>
                                    &lsquo;{getEffectiveSelectedText()}&rsquo; has been
                                    redacted within &lsquo;{submittedSearchTerm}&rsquo; in{" "}
                                    {highlightedCount}{" "}
                                    {highlightedCount === 1
                                        ? "place"
                                        : "places"}
                                    .
                                </span>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="govuk-button"
                        data-module="govuk-button"
                        onClick={handleClose}
                    >
                        Close window
                    </button>
                </>
            ) : isShowingResults ? (
                <>
                    {resultsError && (
                        <div
                            ref={errorSummaryRef}
                            className="govuk-error-summary"
                            aria-labelledby={`${inputId}-results-error-summary-title`}
                            role="alert"
                            tabIndex={-1}
                        >
                            <h2
                                id={`${inputId}-results-error-summary-title`}
                                className="govuk-error-summary__title"
                            >
                                There is a problem
                            </h2>

                            <div className="govuk-error-summary__body">
                                <ul className="govuk-list govuk-error-summary__list">
                                    <li>
                                        <a
                                            href={`#${inputId}-result-0`}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                firstResultCheckboxRef.current?.focus();
                                            }}
                                        >
                                            {resultsError}
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                    <h2 className="govuk-heading-l">
                        Find and redact part
                    </h2>

                    <div className="jr-find-results-heading-row">
                        <h3
                            id={resultsHeadingId}
                            className="govuk-heading-m jr-find-results-heading"
                        >
                            {/* {results.length}{" "}
                            {results.length === 1
                                ? "result "
                                : "results "}
                            found for ‘{submittedSearchTerm}’ */}
                            {results.length > 0 && "Select what you want to redact"}
                        </h3>

                        {results.length > 0 && (
                            <div className="jr-find-results-selection-actions">
                                <button
                                    type="button"
                                    className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                                    onClick={handleSelectAll}
                                >
                                    Select all
                                </button>

                                <span
                                    className="jr-find-results-selection-actions__separator"
                                    aria-hidden="true"
                                >
                                    |
                                </span>

                                <button
                                    type="button"
                                    className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                                    onClick={handleClearSelections}
                                >
                                    Clear selections
                                </button>
                            </div>
                        )}
                    </div>

                    <div
                        className={[
                            "govuk-form-group",
                            "jr-find-and-redact-results-group",
                            resultsError ? "govuk-form-group--error" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        {resultsError && (
                            <p
                                id={`${resultsHeadingId}-selection-error`}
                                className="govuk-error-message"
                            >
                                <span className="govuk-visually-hidden">
                                    Error:
                                </span>{" "}
                                {resultsError}
                            </p>
                        )}
                        <div
                            className="moj-scrollable-pane jr-find-and-redact-results"
                            role="region"
                            aria-labelledby={resultsHeadingId}
                            aria-describedby={
                                resultsError
                                    ? `${resultsHeadingId}-selection-error`
                                    : undefined
                            }
                            tabIndex={0}
                        >
                            <div className="jr-find-and-redact-results__inner">
                                {results.length > 0 ? (
                                    <fieldset className="govuk-fieldset">
                                        <legend className="govuk-visually-hidden">
                                            Select results to partially highlight
                                        </legend>

                                        <div className="govuk-checkboxes govuk-checkboxes--small">
                                            {results.map(
                                                (
                                                    result,
                                                    index
                                                ) => {
                                                    const checkboxId =
                                                        `${inputId}-result-${index}`;

                                                    const excerpt =
                                                        buildFindInDocumentExcerpt(
                                                            result
                                                        );

                                                    const isAlreadyRedacted =
                                                        isSelectedPartialRangeAlreadyRedacted(
                                                            result
                                                        );

                                                    return (
                                                        <div
                                                            key={
                                                                result.id
                                                            }
                                                            className="jr-find-and-redact-result"
                                                        >
                                                            <div className="govuk-checkboxes__item">
                                                                <input
                                                                    ref={
                                                                        index === 0
                                                                            ? firstResultCheckboxRef
                                                                            : undefined
                                                                    }
                                                                    id={checkboxId}
                                                                    name="searchResults"
                                                                    type="checkbox"
                                                                    className="govuk-checkboxes__input"
                                                                    value={result.id}
                                                                    checked={
                                                                        isAlreadyRedacted ||
                                                                        selectedResultIds.has(result.id)
                                                                    }
                                                                    disabled={isAlreadyRedacted}
                                                                    onChange={(event) => {
                                                                        handleResultSelection(
                                                                            result.id,
                                                                            event.target.checked
                                                                        );
                                                                    }}
                                                                />

                                                                <label
                                                                    htmlFor={
                                                                        checkboxId
                                                                    }
                                                                    className="govuk-label govuk-checkboxes__label jr-find-and-redact-result__label"
                                                                >
                                                                    {excerpt.hasLeadingEllipsis &&
                                                                        "…"}
                                                                    {
                                                                        excerpt.before
                                                                    }

                                                                    {excerpt.before &&
                                                                        excerpt.match &&
                                                                        " "}

                                                                    <FindResultMatch
                                                                        result={result}
                                                                        pages={pages}
                                                                        manualSelections={manualSelections}
                                                                    />

                                                                    {excerpt.match &&
                                                                        excerpt.after &&
                                                                        " "}

                                                                    {
                                                                        excerpt.after
                                                                    }
                                                                    {excerpt.hasTrailingEllipsis &&
                                                                        "…"}

                                                                    <span className="govuk-visually-hidden">
                                                                        {" "}
                                                                        on
                                                                        page{" "}
                                                                        {
                                                                            result.pageNumber
                                                                        }
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    </fieldset>
                                ) : (
                                    <p className="govuk-body govuk-!-margin-bottom-0">
                                        No results found.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="govuk-button-group govuk-!-margin-top-4">
                        {results.length > 0 ? (
                            <button
                                type="button"
                                className="govuk-button"
                                data-module="govuk-button"
                                onClick={handleHighlightSelected}
                            >
                                Redact
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="govuk-button"
                                data-module="govuk-button"
                                onClick={handleSearchAgain}
                            >
                                Search again
                            </button>
                        )}

                        <button
                            type="button"
                            className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                    </div>
                </>
            ) : isShowingSelectionStep ? (
                <>
                    {selectionError && (
                        <div
                            ref={errorSummaryRef}
                            className="govuk-error-summary"
                            aria-labelledby={`${inputId}-selection-error-summary-title`}
                            role="alert"
                            tabIndex={-1}
                        >
                            <h2
                                id={`${inputId}-selection-error-summary-title`}
                                className="govuk-error-summary__title"
                            >
                                There is a problem
                            </h2>

                            <div className="govuk-error-summary__body">
                                <ul className="govuk-list govuk-error-summary__list">
                                    <li>
                                        <a
                                            href={`#${selectionContainerId}`}
                                            onClick={(
                                                event
                                            ) => {
                                                event.preventDefault();
                                                selectablePhraseRef.current?.focus();
                                            }}
                                        >
                                            {
                                                selectionError
                                            }
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <h2 className="govuk-heading-l">
                        Find and redact part
                    </h2>

                    <div
                        className={[
                            "govuk-form-group",
                            selectionError
                                ? "govuk-form-group--error"
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <h3 className="govuk-heading-m">
                            Select which part you want to redact
                        </h3>

                        {/* <p className="govuk-body">
                            Select what to highlight by
                            clicking it in the box below.
                        </p> */}

                        {selectionError && (
                            <p
                                id={selectionErrorId}
                                className="govuk-error-message"
                            >
                                <span className="govuk-visually-hidden">
                                    Error:
                                </span>{" "}
                                {selectionError}
                            </p>
                        )}

                        <div
                            ref={selectablePhraseRef}
                            id={selectionContainerId}
                            className={[
                                "govuk-input",
                                "jr-partial-redaction-selection",
                                selectionError
                                    ? "govuk-input--error"
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            aria-invalid={
                                selectionError
                                    ? true
                                    : undefined
                            }
                            aria-describedby={
                                selectionError
                                    ? selectionErrorId
                                    : undefined
                            }
                            tabIndex={0}
                            onMouseUp={captureSelectedRange}
                            onKeyUp={captureSelectedRange}
                            onMouseOver={handlePartialRedactionMouseOver}
                            onMouseOut={handlePartialRedactionMouseOut}
                            onContextMenu={handlePartialRedactionContextMenu}
                        >
                            {renderTextSegments(
                                submittedSearchTerm,
                                [],
                                selectedRange
                                    ? [
                                        {
                                            id: "partial-redaction-selection",
                                            start: selectedRange.start,
                                            end: selectedRange.end,
                                        },
                                    ]
                                    : [],
                                false
                            )}
                        </div>
                        {partialRedactionRemoveMenu && (
                            <button
                                ref={partialRedactionRemoveMenuRef}
                                type="button"
                                className="jr-redaction-remove-menu"
                                aria-label="Remove redaction"
                                title="Remove redaction"
                                style={{
                                    position: "fixed",
                                    left: partialRedactionRemoveMenu.x,
                                    top: partialRedactionRemoveMenu.y,
                                    zIndex: 20,
                                }}
                                onMouseEnter={() => {
                                    setPartialRedactionHover(true);
                                }}
                                onMouseLeave={() => {
                                    setPartialRedactionHover(false);
                                }}
                                onClick={removePartialRedactionSelection}
                            >
                                <span className="jr-redaction-remove-menu__item">
                                    Remove redaction
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="govuk-button-group govuk-!-margin-top-4">
                        <button
                            type="button"
                            className="govuk-button"
                            data-module="govuk-button"
                            onClick={handleContinue}
                        >
                            Continue
                        </button>

                        <button
                            type="button"
                            className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                    </div>
                </>
            ) : (
                <form
                    noValidate
                    onSubmit={handleSubmit}
                >
                    {error && (
                        <div
                            ref={errorSummaryRef}
                            className="govuk-error-summary"
                            aria-labelledby={`${inputId}-error-summary-title`}
                            role="alert"
                            tabIndex={-1}
                        >
                            <h2
                                id={`${inputId}-error-summary-title`}
                                className="govuk-error-summary__title"
                            >
                                There is a problem
                            </h2>

                            <div className="govuk-error-summary__body">
                                <ul className="govuk-list govuk-error-summary__list">
                                    <li>
                                        <a
                                            href={`#${inputId}`}
                                        >
                                            {
                                                EMPTY_SEARCH_ERROR
                                            }
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <h2 className="govuk-heading-l">
                        Find and redact part
                    </h2>

                    <div
                        className={[
                            "govuk-form-group",
                            error
                                ? "govuk-form-group--error"
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <label
                            className="govuk-label govuk-label--m"
                            htmlFor={inputId}
                        >
                            Enter a word or phrase to search for
                        </label>

                        {error && (
                            <p
                                id={errorId}
                                className="govuk-error-message"
                            >
                                <span className="govuk-visually-hidden">
                                    Error:
                                </span>{" "}
                                {EMPTY_SEARCH_ERROR}
                            </p>
                        )}

                        <input
                            ref={inputRef}
                            id={inputId}
                            name="searchTerm"
                            type="text"
                            className={[
                                "govuk-input",
                                error
                                    ? "govuk-input--error"
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            value={searchTerm}
                            aria-invalid={
                                error
                                    ? true
                                    : undefined
                            }
                            aria-describedby={
                                error
                                    ? errorId
                                    : undefined
                            }
                            onChange={(event) => {
                                setSearchTerm(
                                    event.target.value
                                );
                            }}
                        />
                    </div>

                    <div className="govuk-button-group">
                        <button
                            type="submit"
                            className="govuk-button"
                            data-module="govuk-button"
                        >
                            Search
                        </button>

                        <button
                            type="button"
                            className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}