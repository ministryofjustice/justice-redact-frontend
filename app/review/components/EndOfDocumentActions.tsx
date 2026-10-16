"use client";

import {
    useEffect,
    useRef,
} from "react";

type EndOfDocumentActionsProps = {
    canApplyRedactions: boolean;
    isApplyingRedactions: boolean;
    error: string | null;
    onApplyRedactions: () => void;
};

export default function EndOfDocumentActions({
    canApplyRedactions,
    isApplyingRedactions,
    error,
    onApplyRedactions,
}: EndOfDocumentActionsProps) {
    const isDisabled =
        !canApplyRedactions || isApplyingRedactions;

    const errorRef =
        useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (!error) {
            return;
        }

        window.requestAnimationFrame(() => {
            errorRef.current?.focus();
        });
    }, [error]);

    return (
        <section
            className="end-of-page"
            aria-labelledby="end-of-document-heading"
        >
            <h2
                id="end-of-document-heading"
                className="govuk-heading-m"
            >
                You&apos;ve reached the end of the document
            </h2>

            {error && (
                <p
                    ref={errorRef}
                    className="govuk-error-message"
                    role="alert"
                    tabIndex={-1}
                >
                    <span className="govuk-visually-hidden">
                        Error:
                    </span>{" "}
                    {error}
                </p>
            )}

            <button
                type="button"
                className="govuk-button"
                data-module="govuk-button"
                onClick={onApplyRedactions}
                disabled={isDisabled}
                aria-disabled={isDisabled}
            >
                {isApplyingRedactions
                    ? "Applying redactions…"
                    : "Apply redactions"}
            </button>
        </section>
    );
}