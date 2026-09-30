import Link from "next/link";

export type ServiceErrorVariant =
    | 400
    | 403
    | 404
    | 500
    | 503
    | "resume-link-not-recognised"
    | "resume-link-expired";

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

                <p className="govuk-body">
                    <a
                        className="govuk-link"
                        href="mailto:JusticeRedactTeam@justice.gov.uk"
                    >
                        Contact the Justice Redact team
                    </a>{" "}
                    if you need help.
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
        heading: "Sorry, there is a problem",
        body: (
            <>
                <p className="govuk-body">
                    Try reloading the page. You can do this by pressing F5.
                </p>

                <p className="govuk-body">
                    If the page still does not load, try to{" "}
                    <Link
                        href="/upload"
                        className="govuk-link"
                    >
                        upload the file again
                    </Link>
                    .
                </p>

                <p className="govuk-body">
                    <Link
                        href="/contact"
                        className="govuk-link"
                    >
                        Contact the Justice Redact team
                    </Link>{" "}
                    if you need help.
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

    "resume-link-not-recognised": {
        heading: "Your link was not recognised",
        body: (
            <>
                <p className="govuk-body">
                    Go back to the email and select the link again.
                </p>

                <p className="govuk-body">
                    You need to open the link in the same browser you&apos;re on now.
                </p>
            </>
        ),
    },

    "resume-link-expired": {
        heading: "Your link has expired",
        body: (
            <>
                <p className="govuk-body">
                    You cannot edit this file because the link you selected is more than 30 days old.
                </p>

                <p className="govuk-body">
                    Instead, use Adobe Acrobat to make changes to the document - you&apos;ll need to
                    sanitise the document when exporting it.
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
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">{content.heading}</h1>

                {content.body}

                {variant !== 403 &&
                    variant !== 500 &&
                    variant !== 503 &&
                    variant !== "resume-link-not-recognised" &&
                    variant !== "resume-link-expired" && (
                        <p className="govuk-body">
                            Contact the Justice Redact team
                        </p>
                    )}
            </div>
        </div>
    );
}