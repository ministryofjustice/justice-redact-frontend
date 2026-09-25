
type BetaBannerProps = {
    contained?: boolean;
};

export default function BetaBanner({
    contained = true,
}: BetaBannerProps) {
    return (
        <div
            className={
                contained
                    ? "govuk-phase-banner govuk-width-container"
                    : "govuk-phase-banner"
            }
        >
            <p className="govuk-phase-banner__content">
                <strong className="govuk-tag govuk-phase-banner__content__tag">
                    Beta
                </strong>

                <span className="govuk-phase-banner__text">
                    This is a new service – your{" "}
                    <a
                        href="https://www.smartsurvey.co.uk/t/JusticeRedactBeta/"
                        className="govuk-link govuk-link--no-visited-state"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        feedback
                        <span className="govuk-visually-hidden">
                            {" "} (opens in a new tab)
                        </span>
                    </a>{" "}
                    will help us to improve it.
                </span>
            </p>
        </div>
    );
}