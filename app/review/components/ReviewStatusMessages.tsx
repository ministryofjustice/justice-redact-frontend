"use client";

import {
    useEffect,
    useRef,
} from "react";

type ReviewStatusMessagesProps = {
    isLoading: boolean;
    error: string | null;
};

export default function ReviewStatusMessages({
    isLoading,
    error,
}: ReviewStatusMessagesProps) {
    const errorSummaryRef =
        useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!error) {
            return;
        }

        window.requestAnimationFrame(() => {
            errorSummaryRef.current?.focus();
        });
    }, [error]);

    return (
        <>
            {isLoading && (
                <section
                    className="govuk-grid-column-full-width"
                    aria-live="polite"
                >
                    <p className="govuk-body">
                        Loading review data...
                    </p>
                </section>
            )}

            {error && (
                <section
                    className="govuk-grid-column-full-width"
                    aria-labelledby="review-error-title"
                >
                    <div
                        ref={errorSummaryRef}
                        className="govuk-error-summary"
                        data-module="govuk-error-summary"
                        aria-labelledby="review-error-title"
                        role="alert"
                        tabIndex={-1}
                    >
                        <h2
                            className="govuk-error-summary__title"
                            id="review-error-title"
                        >
                            There is a problem
                        </h2>

                        <div className="govuk-error-summary__body">
                            <p className="govuk-body">
                                {error}
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}