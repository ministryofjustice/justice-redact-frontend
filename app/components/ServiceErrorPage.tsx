export type ServiceErrorVariant = 400 | 403 | 404 | 500 | 503;

type ServiceErrorPageProps = {
    variant: ServiceErrorVariant;
    documentId?: string | null;
};

const ERROR_CONTENT: Record<
    ServiceErrorVariant,
    {
        heading: string;
        body: React.ReactNode;
    }
> = {
    400: {
        heading: "Sorry, there is a problem",
        body: (
            <>
                <p className="govuk-body">
                    Try again later.
                </p>

                <p className="govuk-body">
                    We saved the work you&apos;ve done so far. You can go back to continue
                    marking redactions.
                </p>
            </>
        ),
    },

    403: {
        heading: "You do not have access to this service",
        body: (
            <>
                <p className="govuk-body">
                    Check that your MOJ VPN is on and try again.
                </p>

                <p className="govuk-body">
                    If that does not work, it means you cannot access Justice Redact.
                </p>
            </>
        ),
    },

    404: {
        heading: "Page not found",
        body: (
            <>
                <p className="govuk-body">
                    If you typed the web address, check it is correct.
                </p>

                <p className="govuk-body">
                    If you pasted the web address, check you copied the entire address.
                </p>

                <p className="govuk-body">
                    Otherwise, if it&apos;s been over 30 days since you uploaded your file,
                    the link will have expired. You&apos;ll need to upload the file to start
                    again.
                </p>
            </>
        ),
    },

    500: {
        heading: "Sorry, there is a problem with the service",
        body: (
            <>
                <p className="govuk-body">
                    Try reloading the page. You can do this by pressing F5 on a PC or
                    cmd + R on a mac.
                </p>

                <p className="govuk-body">
                    If the page still does not load, try again later.
                </p>
            </>
        ),
    },

    503: {
        heading: "Sorry, the service is unavailable",
        body: (
            <>
                <p className="govuk-body">
                    Try again soon.
                </p>
            </>
        ),
    },
};

export default function ServiceErrorPage({
    variant,
}: ServiceErrorPageProps) {
    const content = ERROR_CONTENT[variant];

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">{content.heading}</h1>

                    {content.body}

                    {variant !== 503 && (
                        <p className="govuk-body">
                            Contact the Justice Redact team
                        </p>
                    )}
                </div>
            </div>
        </main>
    );
}