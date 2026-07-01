"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DocumentStatusResponse = {
    documentId: string;
    filename: string;
    status: string;
};

function LinearLoadingBar({ label = "Loading" }: { label?: string }) {
    return (
        <div className="jr-linear-loading" role="status" aria-live="polite" aria-label={label}>
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

    useEffect(() => {
        if (!documentId) {
            setError("Missing document ID.");
            return;
        }

        let intervalId: ReturnType<typeof setInterval>;

        async function pollStatus() {
            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/status`
                );

                const data: DocumentStatusResponse = await response.json();

                if (!response.ok) {
                    throw new Error("Failed to fetch document status.");
                }

                setStatus(data.status);

                if (data.status === "redaction_complete") {
                    clearInterval(intervalId);
                    router.push(`/export?documentId=${documentId}`);
                }

                if (data.status === "redaction_failed") {
                    clearInterval(intervalId);
                    setError("Failed to apply redactions.");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
            }
        }

        pollStatus();
        intervalId = setInterval(pollStatus, 2000);

        return () => clearInterval(intervalId);
    }, [documentId, router]);

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    {error ? (
                        <section aria-labelledby="apply-redactions-error-title">
                            <div
                                className="govuk-error-summary"
                                data-module="govuk-error-summary"
                                aria-labelledby="apply-redactions-error-title"
                                role="alert"
                                tabIndex={-1}
                            >
                                <h2 className="govuk-error-summary__title" id="apply-redactions-error-title">
                                    There is a problem
                                </h2>

                                <div className="govuk-error-summary__body">
                                    <p className="govuk-body">{error}</p>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section aria-labelledby="applying-redactions-heading">
                            <LinearLoadingBar
                                label={
                                    status === "applying_redactions"
                                        ? "Applying redactions"
                                        : `Redaction status: ${status}`
                                }
                            />

                            <h1 className="govuk-heading-xl" id="applying-redactions-heading">
                                Applying redactions
                            </h1>

                            <p className="govuk-body">
                                This might take around 2 minutes for this document.
                            </p>
                        </section>
                    )}
                </div>
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