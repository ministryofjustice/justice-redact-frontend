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
    return (
        <div className="end-of-page">
            <h3 className="govuk-heading-m">You&apos;ve reached the end of the document</h3>

            <button
                type="button"
                className="govuk-button"
                data-module="govuk-button"
                onClick={onApplyRedactions}
                disabled={!canApplyRedactions || isApplyingRedactions}
                aria-disabled={!canApplyRedactions || isApplyingRedactions}
            >
                Apply redactions
            </button>

            {error && (
                <p className="govuk-error-message">
                    <span className="govuk-visually-hidden">Error:</span> {error}
                </p>
            )}
        </div>
    );
}