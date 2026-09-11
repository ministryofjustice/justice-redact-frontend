import Link from "next/link";

export default function BetaBanner() {
    return (
        <div className="govuk-phase-banner govuk-width-container">
            <p className="govuk-phase-banner__content">
                <strong className="govuk-tag govuk-phase-banner__content__tag">
                    Beta
                </strong>

                <span className="govuk-phase-banner__text">
                    This is a new service – your{" "}
                    <Link
                        href="/contact"
                        className="govuk-link govuk-link--no-visited-state"
                    >
                        feedback
                    </Link>{" "}
                    will help us to improve it.
                </span>
            </p>
        </div>
    );
}