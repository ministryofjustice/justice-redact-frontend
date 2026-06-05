"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DocumentStatusResponse = {
  documentId: string;
  filename: string;
  status: string;
};

function ProcessingContent() {
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
    <main className="govuk-main-wrapper" id="main-content">
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-l">Processing document</h1>

          {error ? (
            <div
              className="govuk-error-summary"
              data-module="govuk-error-summary"
              aria-labelledby="error-summary-title"
              role="alert"
              tabIndex={-1}
            >
              <h2 className="govuk-error-summary__title" id="error-summary-title">
                There is a problem
              </h2>

              <div className="govuk-error-summary__body">
                <p className="govuk-body">{error}</p>
              </div>
            </div>
          ) : (
            <section aria-labelledby="processing-status-heading">
              <h2
                className="govuk-heading-m govuk-visually-hidden"
                id="processing-status-heading"
              >
                Processing status
              </h2>

              <p className="govuk-body">
                The system is analysing the uploaded document and identifying possible sensitive
                information.
              </p>

              <div className="hods-loading-spinner" role="status" aria-live="polite">
                <span className="govuk-visually-hidden">
                  {status === "processing" ? "Processing document" : `Status: ${status}`}
                </span>
                <div className="hods-loading-spinner__spinner" aria-hidden="true"></div>
              </div>

              <div className="govuk-inset-text" aria-live="polite">
                <p className="govuk-body">
                  <strong>Status:</strong>{" "}
                  {status === "processing" ? "Processing document..." : status}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <main className="govuk-main-wrapper" id="main-content">
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
              <div className="hods-loading-spinner" role="status" aria-live="polite">
                <span className="govuk-visually-hidden">Loading processing page</span>
                <div className="hods-loading-spinner__spinner" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <ProcessingContent />
    </Suspense>
  );
}