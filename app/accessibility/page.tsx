import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Accessibility statement for Justice Redact",
};

export default function AccessibilityPage() {
    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    Accessibility statement for Justice Redact
                </h1>

                <p className="govuk-body">Placeholder page.</p>
            </div>
        </div>
    );
}