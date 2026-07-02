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

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const [status, setStatus] = useState("processing");
  const [error, setError] = useState<string | null>(null);

  const displayedError = !documentId ? "Missing document ID." : error;

  useEffect(() => {
    if (!documentId) return;

    let isActive = true;

    async function pollStatus() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/status`
        );

        const data: DocumentStatusResponse = await response.json();

        if (!response.ok) {
          throw new Error("Failed to fetch document status.");
        }

        if (!isActive) return;

        setStatus(data.status);

        if (data.status === "ready_for_review") {
          router.push(`/review?documentId=${documentId}`);
        }
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }

    void pollStatus();

    const intervalId = setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [documentId, router]);

  return (
    <main className="govuk-main-wrapper" id="main-content">
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          {displayedError ? (
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
                <p className="govuk-body">{displayedError}</p>
              </div>
            </div>
          ) : (
            <section aria-labelledby="processing-heading">
              <LinearLoadingBar
                label={
                  status === "processing"
                    ? "Document processing"
                    : `Document status: ${status}`
                }
              />

              <h1 className="govuk-heading-xl" id="processing-heading">
                Document processing
              </h1>

              <p className="govuk-body">
                This will take around 2 minutes for this document.
              </p>

              <h2 className="govuk-heading-m">What is being processed</h2>

              <p className="govuk-body">
                Justice Redact uses AI to try to highlight people&apos;s personal
                information and other phrases you might want to redact. It also tries
                to identify blank pages.
              </p>

              <div className="govuk-warning-text">
                <span className="govuk-warning-text__icon" aria-hidden="true">
                  !
                </span>
                <strong className="govuk-warning-text__text">
                  <span className="govuk-visually-hidden">Warning</span>
                  Deciding what to redact is your responsibility. Justice Redact
                  doesn&apos;t make any decisions for you.
                </strong>
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
              <LinearLoadingBar label="Loading processing page" />
            </div>
          </div>
        </main>
      }
    >
      <ProcessingContent />
    </Suspense>
  );
}