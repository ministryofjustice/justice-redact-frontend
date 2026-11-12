import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "You cannot use Justice Redact yet",
};

export default function AccessDeniedPage() {
    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    You cannot use Justice Redact yet
                </h1>

                <p className="govuk-body">
                    Justice Redact is currently being tested with a small group of vetters.
                </p>

                <p className="govuk-body">
                    You’ll hear from your operational managers when it’s more widely available.
                </p>
            </div>
        </div>
    );
}