type ReviewStatusMessagesProps = {
    isLoading: boolean;
    error: string | null;
};

export default function ReviewStatusMessages({
    isLoading,
    error,
}: ReviewStatusMessagesProps) {
    return (
        <>
            {isLoading && (
                <section className="govuk-grid-column-full-width" aria-live="polite">
                    <p className="govuk-body">Loading review data...</p>
                </section>
            )}

            {error && (
                <section
                    className="govuk-grid-column-full-width"
                    aria-labelledby="review-error-title"
                >
                    <div
                        className="govuk-error-summary"
                        data-module="govuk-error-summary"
                        aria-labelledby="review-error-title"
                        role="alert"
                        tabIndex={-1}
                    >
                        <h2 className="govuk-error-summary__title" id="review-error-title">
                            There is a problem
                        </h2>

                        <div className="govuk-error-summary__body">
                            <p className="govuk-body">{error}</p>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}