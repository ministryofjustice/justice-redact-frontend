"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DocumentStatusResponse = {
    documentId: string;
    filename: string;
    status: string;
};

export default function ApplyingRedactionsPage() {
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

        let intervalId: NodeJS.Timeout;

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
        <>
            <h1 className="govuk-heading-l">Applying redactions</h1>

            {error ? (
                <p className="govuk-error-message">
                    <span className="govuk-visually-hidden">Error:</span> {error}
                </p>
            ) : (
                <>
                    <p className="govuk-body">
                        The system is applying your selected redactions and preparing the final
                        document for download.
                    </p>

                    <div className="hods-loading-spinner" role="status" aria-live="polite">
                        <div className="hods-loading-spinner__spinner"></div>
                    </div>

                    <div className="govuk-inset-text">
                        <strong>Status:</strong>{" "}
                        {status === "applying_redactions"
                            ? "Applying redactions..."
                            : status}
                    </div>
                </>
            )}
        </>
    );
}