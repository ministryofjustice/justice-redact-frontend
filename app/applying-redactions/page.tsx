"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError, fetchJson } from "../lib/api";

type DocumentStatusResponse = {
    documentId: string;
    filename: string;
    status: string;
};

function LinearLoadingBar({ label = "Loading" }: { label?: string }) {
    return (
        <div
            className="jr-linear-loading"
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <div className="jr-linear-loading__track" aria-hidden="true">
                <span className="jr-linear-loading__bar jr-linear-loading__bar--primary" />
            </div>
            <span className="govuk-visually-hidden">{label}</span>
        </div>
    );
}

function ApplyingRedactionsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");

    const [status, setStatus] = useState("applying_redactions");
    const [error, setError] = useState<string | null>(null);

    const displayedError = !documentId ? "Missing document ID." : error;

    useEffect(() => {
        if (!documentId) return;

        let isActive = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let controller: AbortController | null = null;

        const scheduleNextPoll = () => {
            if (!isActive) return;

            timeoutId = setTimeout(() => {
                void pollStatus();
            }, 2000);
        };

        async function pollStatus() {
            if (!isActive) return;

            controller = new AbortController();

            try {
                const data = await fetchJson<DocumentStatusResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/status`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!isActive) return;

                setStatus(data.status);
                setError(null);

                if (data.status === "redaction_complete") {
                    router.push(`/export?documentId=${documentId}`);
                    return;
                }

                if (data.status === "redaction_failed") {
                    setError("Failed to apply redactions.");
                    return;
                }

                scheduleNextPoll();
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                if (err instanceof ApiError && err.retryable) {
                    console.warn("Temporary redaction status polling failure", {
                        status: err.status,
                        message: err.message,
                    });

                    scheduleNextPoll();
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to check the redaction status."
                );
            }
        }

        void pollStatus();

        return () => {
            isActive = false;

            controller?.abort();

            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [documentId, router]);

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                {displayedError ? (
                    <div className="govuk-grid-column-two-thirds">
                        <section aria-labelledby="apply-redactions-error-title">
                            <div
                                className="govuk-error-summary"
                                data-module="govuk-error-summary"
                                aria-labelledby="apply-redactions-error-title"
                                role="alert"
                                tabIndex={-1}
                            >
                                <h2
                                    className="govuk-error-summary__title"
                                    id="apply-redactions-error-title"
                                >
                                    There is a problem
                                </h2>

                                <div className="govuk-error-summary__body">
                                    <p className="govuk-body">{displayedError}</p>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : (
                    <>
                        <div className="govuk-grid-column-full">
                            <LinearLoadingBar
                                label={
                                    status === "applying_redactions"
                                        ? "Applying redactions"
                                        : `Redaction status: ${status}`
                                }
                            />
                        </div>

                        <div className="govuk-grid-column-two-thirds">
                            <section aria-labelledby="applying-redactions-heading">
                                <h1
                                    className="govuk-heading-xl"
                                    id="applying-redactions-heading"
                                >
                                    Applying redactions
                                </h1>

                                <p className="govuk-body">
                                    This might take around 2 minutes for this document.
                                </p>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

export default function ApplyingRedactionsPage() {
    return (
        <Suspense
            fallback={
                <main className="govuk-main-wrapper" id="main-content">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            <LinearLoadingBar label="Loading redaction progress" />
                        </div>
                    </div>
                </main>
            }
        >
            <ApplyingRedactionsContent />
        </Suspense>
    );
}