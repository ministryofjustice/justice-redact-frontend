import Link from "next/link";

export default function AccessDeniedPage() {
    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    You cannot use Justice Redact yet
                </h1>

                <p className="govuk-body">
                    Justice Redact is currently available only to
                    people taking part in the Private Beta.
                </p>

                <p className="govuk-body">
                    If you think you should have access, contact the
                    Justice Redact team.
                </p>

                <p className="govuk-body">
                    <Link href="/" className="govuk-link">
                        Try another email address
                    </Link>
                </p>
            </div>
        </div>
    );
}
