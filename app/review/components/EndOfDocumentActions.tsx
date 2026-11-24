"use client";

import {
    useEffect,
    useRef,
} from "react";

type EndOfDocumentActionsProps = {
    isApplyingRedactions: boolean;
    error: string | null;
    onApplyRedactions: () => void;
};

export default function EndOfDocumentActions({
    isApplyingRedactions,
    error,
    onApplyRedactions,
}: EndOfDocumentActionsProps) {
    // No-changes validation is handled by the Apply hook.
    // Keep the in-flight guard to prevent duplicate requests.
    const isDisabled = isApplyingRedactions;

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
                You’ve reached the end of the document
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