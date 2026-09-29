"use client";

import Link from "next/link";
import {
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "../lib/api";

import {
    getVerificationEmail,
    subscribeToVerificationEmail,
} from "../lib/verificationEmail";

export default function ResendEmailPage() {
    const router = useRouter();

    const email = useSyncExternalStore(
        subscribeToVerificationEmail,
        getVerificationEmail,
        () => null,
    );

    const [isSubmitting, setIsSubmitting] =
        useState(false);
    const [hasServiceError, setHasServiceError] =
        useState(false);

    useEffect(() => {
        if (!email) {
            router.replace("/");
        }
    }, [email, router]);

    async function handleResend() {
        if (!email || isSubmitting) {
            return;
        }

        setHasServiceError(false);
        setIsSubmitting(true);

        try {
            await fetchJson(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/request-verification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        email,
                    }),
                    redirectOnUnauthorized: false,
                },
            );

            router.replace("/check-email");
        } catch {
            setHasServiceError(true);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!email) {
        return null;
    }

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                {hasServiceError && (
                    <div
                        className="govuk-error-summary"
                        data-module="govuk-error-summary"
                        role="alert"
                        aria-labelledby="error-summary-title"
                    >
                        <h2
                            className="govuk-error-summary__title"
                            id="error-summary-title"
                        >
                            There is a problem
                        </h2>

                        <div className="govuk-error-summary__body">
                            <p className="govuk-body">
                                There is a problem sending
                                the confirmation email.
                                Try again later.
                            </p>
                        </div>
                    </div>
                )}

                <h1 className="govuk-heading-xl">
                    Check your email account
                </h1>

                <div className="govuk-inset-text">
                    You entered the email address:{" "}
                    <strong>{email}</strong>
                </div>

                <p className="govuk-body">
                    Before you resend the email, you need to:
                </p>

                <ol className="govuk-list govuk-list--number">
                    <li>
                        Check that you entered the email
                        address correctly. If it&apos;s
                        incorrect,{" "}
                        <Link
                            href="/"
                            className="govuk-link"
                        >
                            enter a different email address
                        </Link>
                        .
                    </li>

                    <li>
                        Wait 5 minutes for the email to
                        arrive.
                    </li>

                    <li>
                        Look in your email account&apos;s
                        junk or spam folder.
                    </li>
                </ol>

                <p className="govuk-body">
                    If you have not received a confirmation
                    email after step 3, you can resend it.
                </p>

                <button
                    type="button"
                    className="govuk-button"
                    data-module="govuk-button"
                    disabled={isSubmitting}
                    onClick={handleResend}
                >
                    Resend confirmation email
                </button>

                <p className="govuk-body">
                    If none of this works,{" "}
                    <Link
                        href="/contact"
                        className="govuk-link"
                    >
                        contact the Justice Redact team for help
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
