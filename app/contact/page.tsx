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
                    Get in touch using{" "}
                    <a
                        className="govuk-link"
                        href="https://teams.cloud.microsoft/l/channel/19%3AnSrrtaG6WkBXdq_gtdyfV5Jo-zTIEA1vs7cEN01EaCM1%40thread.tacv2/Justice%20Redact%20Support?groupId=63036662-7757-4a70-a99d-382575f72b11&tenantId=c6874728-71e6-41fe-a9e1-2e8c36776ad8"
                    >
                        Microsoft Teams
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}