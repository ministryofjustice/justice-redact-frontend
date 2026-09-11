export default function ContactPage() {
    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    Contact the Justice Redact team
                </h1>

                <h2 className="govuk-heading-m">
                    Email
                </h2>

                <p className="govuk-body">
                    Email us at{" "}
                    <a
                        className="govuk-link"
                        href="mailto:JusticeRedactTeam@justice.gov.uk"
                    >
                        JusticeRedactTeam@justice.gov.uk
                    </a>
                </p>

                <h2 className="govuk-heading-m">
                    Microsoft Teams
                </h2>

                <p className="govuk-body">
                    Get in touch using Microsoft Teams.
                </p>
            </div>
        </div>
    );
}