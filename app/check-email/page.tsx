"use client";

import Link from "next/link";
import {
    useEffect,
    useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import {
    getVerificationEmail,
    subscribeToVerificationEmail,
} from "../lib/verificationEmail";

export default function CheckEmailPage() {
    const router = useRouter();

    const email = useSyncExternalStore(
        subscribeToVerificationEmail,
        getVerificationEmail,
        () => null,
    );

    useEffect(() => {
        if (!email) {
            router.replace("/");
        }
    }, [email, router]);

    if (!email) {
        return null;
    }

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    Check your email account
                </h1>

                <p className="govuk-body">
                    We&apos;ve sent an email to{" "}
                    <strong>{email}</strong>.
                </p>

                <p className="govuk-body">
                    Select the link in the verification
                    email to start using Justice Redact.
                    The link will open in a new tab, so
                    you can close this one.
                </p>

                <p className="govuk-body">
                    You will not have to enter your email
                    address again for another 7 days.
                </p>

                <details
                    className="govuk-details"
                    data-module="govuk-details"
                >
                    <summary className="govuk-details__summary">
                        <span className="govuk-details__summary-text">
                            If you have not received an email
                        </span>
                    </summary>

                    <div className="govuk-details__text">
                        <p className="govuk-body">
                            <Link
                                href="/resend-email"
                                className="govuk-link"
                            >
                                Resend the confirmation email
                            </Link>{" "}
                            if the address is correct.
                            <br />
                            <Link
                                href="/"
                                className="govuk-link"
                            >
                                Enter a different email address
                            </Link>{" "}
                            if the address is incorrect.
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
}
