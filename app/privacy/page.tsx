import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy notice",
};

export default function PrivacyPage() {
    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">Privacy notice</h1>

                <p className="govuk-body">Placeholder page.</p>
            </div>
        </div>
    );
}