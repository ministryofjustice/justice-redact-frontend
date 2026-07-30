"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadReviewData } from "../review/reviewDataCache";
import { ApiError, fetchJson } from "../lib/api";

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
    const currentDocumentId = documentId;

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
          },
        );

        if (!isActive) return;

        setStatus(data.status);
        setError(null);

        if (data.status === "ready_for_review") {
          try {
            await loadReviewData(currentDocumentId);

            if (!isActive) return;

            router.replace(
              `/review?documentId=${encodeURIComponent(currentDocumentId)}`
            );
          } catch (err) {
            if (!isActive) return;

            if (err instanceof ApiError && err.retryable) {
              console.warn("Temporary review data loading failure", {
                status: err.status,
                message: err.message,
              });

              scheduleNextPoll();
              return;
            }

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load the document for review."
            );
          }

          return;
        }

        if (data.status === "failed") {
          setError("The document could not be processed.");
          return;
        }

        scheduleNextPoll();
      } catch (err) {
        if (!isActive) return;

        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        if (err instanceof ApiError && err.retryable) {
          console.warn("Temporary status polling failure", {
            status: err.status,
            message: err.message,
          });

          scheduleNextPoll();
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to check the document status.",
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
          </div>
        ) : (
          <>
            <div className="govuk-grid-column-full">
              <LinearLoadingBar
                label={
                  status === "processing"
                    ? "Document processing"
                    : `Document status: ${status}`
                }
              />
            </div>

            <div className="govuk-grid-column-two-thirds">
              <section aria-labelledby="processing-heading">
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
            </div>
          </>
        )}
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
            <div className="govuk-grid-column-full">
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