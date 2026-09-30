"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError, fetchJson } from "../lib/api";
import {
    clearVerificationEmail,
} from "../lib/verificationEmail";

type VerifyEmailResponse = {
    userId: string;
    email: string;
    expiresAt: string;
};

type ConfirmationState =
    | "checking"
    | "did-not-work"
    | "not-recognised"
    | "service-error";

export default function ConfirmEmailPage() {
    const router = useRouter();

    const [state, setState] =
        useState<ConfirmationState>("checking");

    useEffect(() => {
        let isActive = true;

        async function confirmEmail() {
            const fragment = window.location.hash.slice(1);

            const params = new URLSearchParams(fragment);
            const token = params.get("token");

            if (!token) {
                setState("did-not-work");
                return;
            }

            try {
                await fetchJson<VerifyEmailResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/verify`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            token,
                        }),
                        redirectOnUnauthorized: false,
                    },
                );

                if (!isActive) {
                    return;
                }

                window.history.replaceState(
                    null,
                    "",
                    "/confirm-email",
                );

                clearVerificationEmail();

                router.replace("/upload");
            } catch (error) {
                if (!isActive) {
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 400
                ) {
                    if (
                        error.message ===
                        "The confirmation link did not work"
                    ) {
                        setState("did-not-work");
                        return;
                    }

                    if (
                        error.message ===
                        "The confirmation link was not recognised"
                    ) {
                        setState("not-recognised");
                        return;
                    }
                }

                if (
                    error instanceof ApiError &&
                    error.status === 403
                ) {
                    window.history.replaceState(
                        null,
                        "",
                        "/confirm-email",
                    );

                    clearVerificationEmail();

                    router.replace("/access-denied");
                    return;
                }

                setState("service-error");
            }
        }

        void confirmEmail();

        return () => {
            isActive = false;
        };
    }, [router]);

    if (state === "did-not-work") {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">
                        Your confirmation link did not work
                    </h1>

                    <p className="govuk-body">
                        Select the link in the email you received to start using Justice Redact.
                        You need to open the link in the same browser you&apos;re on now.
                    </p>

                    <p className="govuk-body">
                        The link will open in a new tab, so you can close this one.
                    </p>

                    <h2 className="govuk-heading-m">
                        Get a new confirmation link
                    </h2>

                    <p className="govuk-body">
                        If that still does not work,{" "}
                        <Link href="/" className="govuk-link">
                            enter your email address
                        </Link>{" "}
                        to get a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (state === "not-recognised") {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">
                        Your confirmation link was not recognised
                    </h1>

                    <p className="govuk-body">
                        Go back to the email and select the link again.
                    </p>

                    <p className="govuk-body">
                        You need to open the link in the same browser you&apos;re on now.
                    </p>

                    <h2 className="govuk-heading-m">
                        Get a new confirmation link
                    </h2>

                    <p className="govuk-body">
                        To get a new link,{" "}
                        <Link href="/" className="govuk-link">
                            enter your email address again
                        </Link>
                        .
                    </p>
                </div>
            </div>
        );
    }

    if (state === "checking") {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">
                        Confirming your email address
                    </h1>

                    <p className="govuk-body">
                        Please wait.
                    </p>
                </div>
            </div>
        );
    }

    if (state === "service-error") {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">
                        Sorry, there is a problem with the service
                    </h1>

                    <p className="govuk-body">
                        Try again later.
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
