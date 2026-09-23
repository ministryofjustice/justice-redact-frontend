"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loadReviewData,
  loadReviewSearchPages,
} from "../review/reviewDataCache";
import DocumentProcessingProgress, {
  normaliseProcessingProgress,
} from "./DocumentProcessingProgress";
import { ApiError, fetchJson } from "../lib/api";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";
import BackLink from "../components/BackLink";

type DocumentStatusResponse = {
  documentId: string;
  filename: string;
  status: string;
  processingProgress: number;
};

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const {
    isChecking: isCheckingWorkflow,
    errorVariant: workflowErrorVariant,
  } = useWorkflowGuard("processing", documentId);

  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAbandoning, setIsAbandoning] = useState(false);

  const displayedError = !documentId ? "Missing document ID." : error;

  async function handleBackToUpload() {
    if (!documentId || isAbandoning) {
      return;
    }

    setIsAbandoning(true);
    setError(null);

    try {
      await fetchJson(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
          documentId,
        )}/abandon`,
        {
          method: "POST",
        },
      );

      router.push("/upload");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to stop processing. Try again.",
      );
      setIsAbandoning(false);
    }
  }

  useEffect(() => {
    if (!documentId || isCheckingWorkflow || workflowErrorVariant) {
      return;
    }

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

        const nextProgress = normaliseProcessingProgress(
          data.processingProgress,
        );

        setProcessingProgress((currentProgress) =>
          Math.max(
            currentProgress,
            nextProgress,
          ),
        );

        setError(null);

        if (data.status === "ready_for_review") {
          setProcessingProgress(100);

          const [
            reviewDataResult,
            reviewSearchResult,
          ] = await Promise.allSettled([
            loadReviewData(currentDocumentId),
            loadReviewSearchPages(currentDocumentId),
          ]);

          if (
            reviewDataResult.status === "rejected"
          ) {
            console.warn(
              "Review data prefetch failed",
              reviewDataResult.reason
            );
          }

          if (
            reviewSearchResult.status === "rejected"
          ) {
            console.warn(
              "Review search data prefetch failed",
              reviewSearchResult.reason
            );
          }

          if (!isActive) return;

          router.replace(
            `/review?documentId=${encodeURIComponent(currentDocumentId)}`
          );

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
  }, [
    documentId,
    isCheckingWorkflow,
    workflowErrorVariant,
    router,
  ]);

  if (isCheckingWorkflow) {
    return null;
  }

  if (workflowErrorVariant) {
    return (
      <ServiceErrorPage
        variant={workflowErrorVariant}
        documentId={documentId}
      />
    );
  }

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
              <BackLink
                href="/upload"
                onBack={handleBackToUpload}
                disabled={isAbandoning}
              >
                {isAbandoning
                  ? "Stopping processing..."
                  : "Back"}
              </BackLink>
            </div>
            <div className="govuk-grid-column-two-thirds">
              <section aria-labelledby="processing-heading">
                <h1 className="govuk-heading-xl" id="processing-heading">
                  Your file is being processed
                </h1>
                <div className="govuk-grid-column-full">
                  <DocumentProcessingProgress
                    progress={processingProgress}
                  />
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
    <Suspense fallback={null}>
      <ProcessingContent />
    </Suspense>
  );
}