"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, fetchJson } from "./lib/api";

import {
    setVerificationEmail,
} from "./lib/verificationEmail";

type CurrentUserResponse = {
    userId: string;
    email: string;
};

const EMAIL_ERROR =
    "Enter an email address in the format name@justice.gov.uk";

function isJusticeEmail(email: string): boolean {
    return /^[^@\s]+@justice\.gov\.uk$/i.test(
        email.trim(),
    );
}

export default function StartPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [emailError, setEmailError] =
        useState<string | null>(null);
    const [serviceError, setServiceError] =
        useState<string | null>(null);
    const [isCheckingSession, setIsCheckingSession] =
        useState(true);
    const [isSubmitting, setIsSubmitting] =
        useState(false);

    useEffect(() => {
        let isActive = true;

        async function checkExistingSession() {
            try {
                await fetchJson<CurrentUserResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`,
                    {
                        cache: "no-store",
                        redirectOnUnauthorized: false,
                    },
                );

                if (isActive) {
                    router.replace("/upload");
                }
            } catch (error) {
                if (!isActive) {
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 401
                ) {
                    setIsCheckingSession(false);
                    return;
                }

                setServiceError(
                    "There is a problem with the service. Try again later.",
                );
                setIsCheckingSession(false);
            }
        }

        void checkExistingSession();

        return () => {
            isActive = false;
        };
    }, [router]);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        const normalisedEmail = email.trim().toLowerCase();

        setEmailError(null);
        setServiceError(null);

        if (!isJusticeEmail(normalisedEmail)) {
            setEmailError(EMAIL_ERROR);
            return;
        }

        setIsSubmitting(true);

        try {
            await fetchJson(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/request-verification`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: normalisedEmail,
                    }),
                    redirectOnUnauthorized: false,
                },
            );

            setVerificationEmail(normalisedEmail);

            router.push("/check-email");
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.status === 400
            ) {
                setEmailError(EMAIL_ERROR);
                return;
            }

            if (
                error instanceof ApiError &&
                error.status === 403
            ) {
                router.push("/access-denied");
                return;
            }

            setServiceError(
                "There is a problem with the service. Try again later.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isCheckingSession) {
        return null;
    }

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                {serviceError && (
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
                            <ul className="govuk-list govuk-error-summary__list">
                                <li>{serviceError}</li>
                            </ul>
                        </div>
                    </div>
                )}

                {emailError && (
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
                            <ul className="govuk-list govuk-error-summary__list">
                                <li>
                                    <a href="#email">
                                        {emailError}
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                )}

                <h1 className="govuk-heading-xl">
                    Start using Justice Redact
                </h1>

                <p className="govuk-body">
                    Enter your email address to confirm you can use Justice Redact.
                    You&apos;ll then receive an email with a link to access the service.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    <div
                        className={`govuk-form-group${emailError
                            ? " govuk-form-group--error"
                            : ""
                            }`}
                    >
                        <label
                            className="govuk-label govuk-label--m"
                            htmlFor="email"
                        >
                            Enter your justice.gov.uk email address
                        </label>

                        {emailError && (
                            <p
                                id="email-error"
                                className="govuk-error-message"
                            >
                                <span className="govuk-visually-hidden">
                                    Error:
                                </span>{" "}
                                {emailError}
                            </p>
                        )}

                        <input
                            className={`govuk-input${emailError
                                ? " govuk-input--error"
                                : ""
                                }`}
                            id="email"
                            name="email"
                            type="email"
                            spellCheck={false}
                            autoComplete="email"
                            value={email}
                            aria-describedby={
                                emailError
                                    ? "email-error"
                                    : undefined
                            }
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                        />
                    </div>

                    <button
                        className="govuk-button"
                        data-module="govuk-button"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        Send email
                    </button>
                </form>
            </div>
        </div>
    );
}
