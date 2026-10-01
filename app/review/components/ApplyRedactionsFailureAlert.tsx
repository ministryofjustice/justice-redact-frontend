export default function ApplyRedactionsFailureAlert() {
    return (
        <div
            role="region"
            className="moj-alert moj-alert--error moj-alert--with-heading jr-review-apply-error-alert"
            aria-label="error: There was a problem applying redactions"
            data-module="moj-alert"
        >
            <div>
                <svg
                    className="moj-alert__icon"
                    role="presentation"
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 30 30"
                    height="30"
                    width="30"
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M20.1777 2.5H9.82233L2.5 9.82233V20.1777L9.82233 27.5H20.1777L27.5 20.1777V9.82233L20.1777 2.5ZM10.9155 8.87769L15.0001 12.9623L19.0847 8.87771L21.1224 10.9154L17.0378 15L21.1224 19.0846L19.0847 21.1222L15.0001 17.0376L10.9155 21.1223L8.87782 19.0846L12.9624 15L8.87783 10.9153L10.9155 8.87769Z"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <div className="moj-alert__content">
                <h2 className="moj-alert__heading">
                    There was a problem applying redactions
                </h2>

                Try again or{" "}
                <a
                    href="/contact"
                    className="govuk-link"
                >
                    contact the Justice Redact team
                </a>{" "}
                if you need help.
            </div>

            <div className="moj-alert__action">
                <button
                    type="button"
                    className="moj-alert__dismiss"
                    hidden
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}