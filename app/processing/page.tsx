
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import ProcessingProgress from "../components/ProcessingProgress";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";
import BackLink from "../components/BackLink";
import { useDocumentProcessing } from "../../features/documents/processing/useDocumentProcessing";

function ProcessingContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const {
    isChecking: isCheckingWorkflow,
    errorVariant: workflowErrorVariant,
  } = useWorkflowGuard("processing", documentId);

  const {
    processingProgress,
    error,
    isAbandoning,
    handleBackToUpload,
  } = useDocumentProcessing(
    documentId,
    !isCheckingWorkflow && !workflowErrorVariant,
  );

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

  if (!documentId || error) {
    return (
      <ServiceErrorPage
        variant={500}
        documentId={documentId}
      />
    );
  }

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <section aria-labelledby="processing-heading">
          <BackLink
            href="/upload"
            onBack={handleBackToUpload}
            disabled={isAbandoning}
          >
            {isAbandoning
              ? "Stopping processing..."
              : "Back"}
          </BackLink>

          <h1
            className="govuk-heading-xl"
            id="processing-heading"
          >
            Your file is being processed
          </h1>

          <ProcessingProgress
            progress={processingProgress}
            ariaLabel="File processing progress"
          />
        </section>
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={null}>
      <ProcessingContent />
    </Suspense>
  );
}
