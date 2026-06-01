"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DocumentStatusResponse = {
    documentId: string;
    filename: string;
    status: string;
};

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
                    <h1 className="govuk-heading-l">Applying redactions</h1>

                    {error ? (
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
                                    <p className="govuk-body">{error}</p>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section aria-labelledby="applying-redactions-status-heading">
                            <h2
                                className="govuk-heading-m govuk-visually-hidden"
                                id="applying-redactions-status-heading"
                            >
                                Redaction status
                            </h2>

                            <p className="govuk-body">
                                The system is applying your selected redactions and preparing the final
                                document for download.
                            </p>

                            <div className="hods-loading-spinner" role="status" aria-live="polite">
                                <span className="govuk-visually-hidden">
                                    {status === "applying_redactions"
                                        ? "Applying redactions"
                                        : `Status: ${status}`}
                                </span>
                                <div className="hods-loading-spinner__spinner" aria-hidden="true"></div>
                            </div>

                            <div className="govuk-inset-text" aria-live="polite">
                                <p className="govuk-body">
                                    <strong>Status:</strong>{" "}
                                    {status === "applying_redactions"
                                        ? "Applying redactions..."
                                        : status}
                                </p>
                            </div>
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
                            <div className="hods-loading-spinner" role="status" aria-live="polite">
                                <span className="govuk-visually-hidden">
                                    Loading redaction progress
                                </span>
                                <div
                                    className="hods-loading-spinner__spinner"
                                    aria-hidden="true"
                                ></div>
                            </div>
                        </div>
                    </div>
                </main>
            }
        >
            <ApplyingRedactionsContent />
        </Suspense>
    );
}