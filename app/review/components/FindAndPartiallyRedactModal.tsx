"use client";

import {
    type FormEvent,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";

import {
    buildFindInDocumentExcerpt,
    findInDocument,
    type FindInDocumentResult,
} from "../findInDocument";
import type { ReviewPageData } from "../types";
import Modal from "./Modal";

type FindAndPartiallyRedactModalProps = {
    isOpen: boolean;
    pages: ReviewPageData[];
    onClose: () => void;

    onHighlightSelected: (
        results: FindInDocumentResult[],
        selectedResultIds: Set<string>,
        selectedRange: {
            start: number;
            end: number;
        }
    ) => void;
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

    const inputId = useId();
    const resultsHeadingId = useId();
    const errorId = `${inputId}-error`;
    const selectionErrorId = `${inputId}-selection-error`;
    const selectionContainerId = `${inputId}-partial-selection`;

    const inputRef = useRef<HTMLInputElement>(null);
    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const selectablePhraseRef = useRef<HTMLDivElement>(null);

    const isShowingSelectionStep =
        submittedSearchTerm !== null && !isShowingResults;

    function resetState() {
        setSearchTerm("");
        setSubmittedSearchTerm(null);
        setSelectedRange(null);
        setResults([]);
        setSelectedResultIds(new Set());
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
        if (!error && !selectionError) {
            return;
        }

        window.requestAnimationFrame(() => {
            errorSummaryRef.current?.focus();
        });
    }, [error, selectionError]);

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

        setResults(
            findInDocument(
                pages,
                submittedSearchTerm
            )
        );

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

    function handleHighlightSelected() {
        if (selectedResultIds.size === 0) {
            setResultsError("Select at least one result to highlight");
            return;
        }

        setResultsError(null);

        onHighlightSelected(
            results,
            selectedResultIds,
            selectedRange!
        );

        handleClose();
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
                isShowingResults
                    ? "content-dense"
                    : "standard"
            }
        >
            {isShowingResults ? (
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
                                            href={`#${resultsHeadingId}`}
                                            onClick={(event) => {
                                                event.preventDefault();

                                                document
                                                    .getElementById(resultsHeadingId)
                                                    ?.focus();
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
                        Search and highlight part
                    </h2>

                    <h3
                        id={resultsHeadingId}
                        className="govuk-heading-m"
                    >
                        {results.length}{" "}
                        {results.length === 1
                            ? "result "
                            : "results "}
                        found for &lsquo;
                        {submittedSearchTerm}
                        &rsquo;
                    </h3>

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
                            <p className="govuk-error-message">
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

                                                    return (
                                                        <div
                                                            key={
                                                                result.id
                                                            }
                                                            className="jr-find-and-redact-result"
                                                        >
                                                            <div className="govuk-checkboxes__item">
                                                                <input
                                                                    id={checkboxId}
                                                                    name="searchResults"
                                                                    type="checkbox"
                                                                    className="govuk-checkboxes__input"
                                                                    value={result.id}
                                                                    checked={selectedResultIds.has(result.id)}
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

                                                                    <strong>
                                                                        {
                                                                            excerpt.match
                                                                        }
                                                                    </strong>

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
                        <button
                            type="button"
                            className="govuk-button"
                            data-module="govuk-button"
                            onClick={handleHighlightSelected}
                        >
                            Highlight selected
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
                        Search and highlight part
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
                            Specify what to highlight
                        </h3>

                        <p className="govuk-body">
                            Select what to highlight by
                            clicking it in the box below.
                        </p>

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
                            className="jr-partial-redaction-selection"
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
                            onMouseUp={
                                captureSelectedRange
                            }
                            onKeyUp={
                                captureSelectedRange
                            }
                        >
                            {submittedSearchTerm}
                        </div>
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
                        Search and highlight part
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
                            Word or phrase
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