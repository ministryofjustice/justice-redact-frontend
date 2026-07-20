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

type FindAndRedactModalProps = {
    isOpen: boolean;
    pages: ReviewPageData[];
    onClose: () => void;
};

const EMPTY_SEARCH_ERROR =
    "Enter a word or phrase to find in the document";

export default function FindAndRedactModal({
    isOpen,
    pages,
    onClose,
}: FindAndRedactModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [submittedSearchTerm, setSubmittedSearchTerm] =
        useState<string | null>(null);
    const [results, setResults] = useState<FindInDocumentResult[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(
        new Set()
    );
    const [error, setError] = useState<string | null>(null);

    const inputId = useId();
    const resultsHeadingId = useId();
    const errorId = `${inputId}-error`;

    const inputRef = useRef<HTMLInputElement>(null);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const isShowingResults = submittedSearchTerm !== null;

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm("");
            setSubmittedSearchTerm(null);
            setResults([]);
            setSelectedResultIds(new Set());
            setError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!error) return;

        window.requestAnimationFrame(() => {
            errorSummaryRef.current?.focus();
        });
    }, [error]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const trimmedSearchTerm = searchTerm.trim();

        if (!trimmedSearchTerm) {
            setError(EMPTY_SEARCH_ERROR);
            return;
        }

        setError(null);
        setSubmittedSearchTerm(trimmedSearchTerm);
        setResults(findInDocument(pages, trimmedSearchTerm));
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
    }

    function handleClose() {
        setSearchTerm("");
        setSubmittedSearchTerm(null);
        setResults([]);
        setSelectedResultIds(new Set());
        setError(null);
        onClose();
    }

    return (
        <Modal
            isOpen={isOpen}
            title="Search and highlight"
            onClose={handleClose}
            initialFocusRef={inputRef}
            renderTitle={false}
            variant={isShowingResults ? "content-dense" : "standard"}
        >
            {!isShowingResults ? (
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
                        Search and highlight
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
                            aria-describedby={
                                error ? errorId : undefined
                            }
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
                    <h2 className="govuk-heading-l">
                        Search and highlight
                    </h2>

                    <h3
                        id={resultsHeadingId}
                        className="govuk-heading-m"
                    >
                        {results.length}{" "}
                        {results.length === 1 ? "result " : "results "} found
                        for &lsquo;{submittedSearchTerm}&rsquo;
                    </h3>

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
                                        Select results to highlight
                                    </legend>

                                    <div className="govuk-checkboxes govuk-checkboxes--small">
                                        {results.map((result, index) => {
                                            const checkboxId = `${inputId}-result-${index}`;
                                            const excerpt =
                                                buildFindInDocumentExcerpt(result);

                                            return (
                                                <div
                                                    key={result.id}
                                                    className="jr-find-and-redact-result"
                                                >
                                                    <div className="govuk-checkboxes__item">
                                                        <input
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
                                                            {excerpt.hasLeadingEllipsis && "…"}
                                                            {excerpt.before}

                                                            <strong>{excerpt.match}</strong>

                                                            {excerpt.after}
                                                            {excerpt.hasTrailingEllipsis && "…"}

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

                    <div className="govuk-button-group govuk-!-margin-top-4">
                        <button
                            type="button"
                            className="govuk-button"
                            data-module="govuk-button"
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
            )}
        </Modal>
    );
}