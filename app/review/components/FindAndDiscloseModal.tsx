"use client";

import {
    type FormEvent,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import {
    findInManualRedactions,
    type FindInManualRedactionResult,
} from "../findInManualRedactions";
import type {
    ManualDecision,
    ReviewPageData,
} from "../types";
import FindResultExcerpt from "./FindResultExcerpt";
import Modal from "./Modal";

type FindAndDiscloseModalProps = {
    isOpen: boolean;
    pages: ReviewPageData[];
    manualSelections: ManualDecision[];
    onClose: () => void;
    onUndoSelected: (
        results: FindInManualRedactionResult[]
    ) => number;
};

const EMPTY_SEARCH_ERROR =
    "Enter a word or phrase to find in the document";

export default function FindAndDiscloseModal({
    isOpen,
    pages,
    manualSelections,
    onClose,
    onUndoSelected,
}: FindAndDiscloseModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [submittedSearchTerm, setSubmittedSearchTerm] =
        useState<string | null>(null);
    const [highlightedCount, setHighlightedCount] = useState<number | null>(
        null
    );
    const [results, setResults] =
        useState<FindInManualRedactionResult[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(
        new Set()
    );
    const [error, setError] = useState<string | null>(null);
    const [resultsError, setResultsError] = useState<string | null>(null);

    const inputId = useId();
    const resultsHeadingId = useId();
    const errorId = `${inputId}-error`;

    const inputRef = useRef<HTMLInputElement>(null);
    const errorSummaryRef = useRef<HTMLDivElement>(null);
    const successBannerRef = useRef<HTMLDivElement>(null);
    const firstResultCheckboxRef = useRef<HTMLInputElement>(null);
    const resultsHeadingRef =
        useRef<HTMLHeadingElement>(null);
    const resultsPaneRef =
        useRef<HTMLDivElement>(null);

    const isShowingResults = submittedSearchTerm !== null;
    const isShowingSuccess = highlightedCount !== null;

    const isShowingContentDenseResults =
        isShowingResults &&
        !isShowingSuccess &&
        results.length > 0;

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm("");
            setSubmittedSearchTerm(null);
            setResults([]);
            setSelectedResultIds(new Set());
            setHighlightedCount(null);
            setError(null);
            setResultsError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!error && !resultsError) return;

        window.requestAnimationFrame(() => {
            errorSummaryRef.current?.focus();
        });
    }, [error, resultsError]);

    useEffect(() => {
        if (!isShowingSuccess) return;

        window.requestAnimationFrame(() => {
            successBannerRef.current?.focus();
        });
    }, [isShowingSuccess]);

    useEffect(() => {
        if (!isShowingResults || isShowingSuccess) {
            return;
        }

        window.requestAnimationFrame(() => {
            resultsHeadingRef.current?.focus();
        });
    }, [isShowingResults, isShowingSuccess]);

    useLayoutEffect(() => {
        if (!isShowingContentDenseResults) {
            return;
        }

        const resultsPaneElement = resultsPaneRef.current;

        if (!resultsPaneElement) {
            return;
        }

        const modalElement =
            resultsPaneElement.closest<HTMLElement>(
                ".jr-modal--content-dense"
            );

        if (!modalElement) {
            return;
        }

        const resultRows = Array.from(
            resultsPaneElement.querySelectorAll<HTMLElement>(
                ".jr-find-and-redact-result"
            )
        ).slice(0, 2);

        if (resultRows.length === 0) {
            modalElement.style.removeProperty(
                "--jr-content-dense-min-height"
            );
            return;
        }

        const updateMinimumHeight = () => {
            const modalHeight =
                modalElement.getBoundingClientRect().height;

            const resultsPaneHeight =
                resultsPaneElement.getBoundingClientRect().height;

            const rowsHeight = resultRows.reduce(
                (height, row) =>
                    height + row.getBoundingClientRect().height,
                0
            );

            const resultsPaneStyles =
                window.getComputedStyle(resultsPaneElement);

            const borderHeight =
                parseFloat(resultsPaneStyles.borderTopWidth) +
                parseFloat(resultsPaneStyles.borderBottomWidth);

            const nonResultsHeight =
                modalHeight - resultsPaneHeight;

            const minimumModalHeight = Math.ceil(
                nonResultsHeight +
                rowsHeight +
                borderHeight
            );

            modalElement.style.setProperty(
                "--jr-content-dense-min-height",
                `${minimumModalHeight}px`
            );
        };

        updateMinimumHeight();

        window.addEventListener(
            "resize",
            updateMinimumHeight
        );

        const resizeObserver =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(updateMinimumHeight)
                : null;

        resultRows.forEach((row) => {
            resizeObserver?.observe(row);
        });

        return () => {
            resizeObserver?.disconnect();

            window.removeEventListener(
                "resize",
                updateMinimumHeight
            );

            modalElement.style.removeProperty(
                "--jr-content-dense-min-height"
            );
        };
    }, [
        isShowingContentDenseResults,
        results.length,
        resultsError,
    ]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const trimmedSearchTerm = searchTerm.trim();

        if (!trimmedSearchTerm) {
            setError(EMPTY_SEARCH_ERROR);
            return;
        }

        setError(null);
        setSubmittedSearchTerm(trimmedSearchTerm);
        setResults(
            findInManualRedactions(
                pages,
                manualSelections,
                trimmedSearchTerm
            )
        );
        setSelectedResultIds(new Set());
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
        setSelectedResultIds(
            new Set(results.map((result) => result.id))
        );
        setResultsError(null);
    }

    function handleClearSelections() {
        setSelectedResultIds(new Set());
        setResultsError(null);
    }

    function handleUndoSelected() {
        if (selectedResultIds.size === 0) {
            setResultsError("Select at least one highlight to undo");
            return;
        }

        setResultsError(null);

        const selectedResults = results.filter((result) =>
            selectedResultIds.has(result.id)
        );

        if (selectedResults.length === 0) {
            return;
        }

        const undone = onUndoSelected(selectedResults);

        if (undone > 0) {
            setHighlightedCount(undone);
        }
    }

    function handleSearchAgain() {
        setSubmittedSearchTerm(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setHighlightedCount(null);
        setError(null);
        setResultsError(null);
    }

    function handleClose() {
        setSearchTerm("");
        setSubmittedSearchTerm(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setHighlightedCount(null);
        setError(null);
        setResultsError(null);
        onClose();
    }

    return (
        <Modal
            isOpen={isOpen}
            title="Search and undo"
            onClose={handleClose}
            initialFocusRef={inputRef}
            renderTitle={false}
            variant={
                isShowingContentDenseResults
                    ? "content-dense"
                    : "standard"
            }
            ariaLabelledBy={
                isShowingResults && !isShowingSuccess
                    ? resultsHeadingId
                    : undefined
            }
        >
            {isShowingSuccess ? (
                <>

                    <h2 className="govuk-heading-l">
                        Find and remove redactions
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
                                    &lsquo;{submittedSearchTerm}&rsquo; is no longer redacted in{" "}
                                    {highlightedCount}{" "}
                                    {highlightedCount === 1 ? "place" : "places"}.
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
            ) : !isShowingResults ? (
                <form noValidate onSubmit={handleSubmit}>
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
                                        <a href={`#${inputId}`}>
                                            {EMPTY_SEARCH_ERROR}
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}



                    <h2 className="govuk-heading-l">
                        Find and remove redactions
                    </h2>

                    <div
                        className={[
                            "govuk-form-group",
                            error ? "govuk-form-group--error" : "",
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
                                Enter a word or phrase
                            </p>
                        )}

                        <input
                            ref={inputRef}
                            id={inputId}
                            name="searchTerm"
                            type="text"
                            className={[
                                "govuk-input",
                                error ? "govuk-input--error" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            value={searchTerm}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            onChange={(event) => {
                                setSearchTerm(event.target.value);
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
            ) : (
                <>

                    {resultsError && (
                        <div
                            ref={errorSummaryRef}
                            className="govuk-error-summary"
                            aria-labelledby={`${resultsHeadingId}-error-summary-title`}
                            role="alert"
                            tabIndex={-1}
                        >
                            <h2
                                id={`${resultsHeadingId}-error-summary-title`}
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

                    <p className="govuk-caption-l jr-find-results-caption">
                        Find and remove redactions
                    </p>

                    <div className="jr-find-results-heading-row">
                        <h2
                            ref={resultsHeadingRef}
                            id={resultsHeadingId}
                            className="govuk-heading-l jr-find-results-heading"
                            tabIndex={-1}
                        >
                            Select what redactions you want to remove
                        </h2>

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
                            resultsError ? "govuk-form-group--error" : "",
                            "jr-find-and-redact-results-group",
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
                            ref={resultsPaneRef}
                            id="find-and-redact-results"
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
                                            Select results to undo
                                        </legend>

                                        <div className="govuk-checkboxes govuk-checkboxes--small">
                                            {results.map((result, index) => {
                                                const checkboxId =
                                                    `${inputId}-result-${index}`;

                                                return (
                                                    <div
                                                        key={result.id}
                                                        className="jr-find-and-redact-result"
                                                    >
                                                        <div className="govuk-checkboxes__item">
                                                            <input
                                                                ref={index === 0 ? firstResultCheckboxRef : undefined}
                                                                id={checkboxId}
                                                                name="searchResults"
                                                                type="checkbox"
                                                                className="govuk-checkboxes__input"
                                                                value={result.id}
                                                                checked={selectedResultIds.has(
                                                                    result.id
                                                                )}
                                                                onChange={(event) => {
                                                                    handleResultSelection(
                                                                        result.id,
                                                                        event.target.checked
                                                                    );
                                                                }}
                                                            />

                                                            <label
                                                                htmlFor={checkboxId}
                                                                className="govuk-label govuk-checkboxes__label jr-find-and-redact-result__label"
                                                            >
                                                                <FindResultExcerpt
                                                                    result={result}
                                                                    pages={pages}
                                                                    manualSelections={manualSelections}
                                                                />

                                                                <span className="govuk-visually-hidden">
                                                                    {" "}
                                                                    on page {result.pageNumber}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                                onClick={handleUndoSelected}
                            >
                                Remove
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
            )}
        </Modal>
    );
}