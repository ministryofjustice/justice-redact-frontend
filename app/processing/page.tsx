"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DocumentStatusResponse = {
  documentId: string;
  filename: string;
  status: string;
};

export default function ProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const [status, setStatus] = useState("processing");
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

        if (data.status === "ready_for_review") {
          clearInterval(intervalId);
          router.push(`/review?documentId=${documentId}`);
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
      <h1 className="govuk-heading-l">Processing document</h1>
      
      {error ? (
        <p className="govuk-error-message">
          <span className="govuk-visually-hidden">Error:</span> {error}
        </p>
      ) : (
        <>
          <p className="govuk-body">
            The system is analysing the uploaded document and identifying possible sensitive
            information.
          </p>
          <div className="hods-loading-spinner" role="status" aria-live="polite">
        <div className="hods-loading-spinner__spinner"></div>
      </div>
          <div className="govuk-inset-text">
            <strong>Status:</strong> {status === "processing" ? "Processing document..." : status}
          </div>
        </>
      )}
    </>
  );
}