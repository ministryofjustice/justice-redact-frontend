export type WorkflowPage =
  | "upload"
  | "document-warning"
  | "subject-details"
  | "processing"
  | "review"
  | "applying-redactions"
  | "export";

export type WorkflowResponse = {
  documentId: string;
  status: string;
  currentRedactionRunId: string | null;
  preferredPage: WorkflowPage;
  allowedPages: WorkflowPage[];
};

export function buildWorkflowUrl(
  page: WorkflowPage,
  documentId: string,
  currentRedactionRunId?: string | null,
): string {
  if (page === "upload") {
    return "/upload";
  }

  const encodedDocumentId = encodeURIComponent(documentId);

  if (page === "applying-redactions" || page === "export") {
    if (!currentRedactionRunId) {
      throw new Error(
        `Cannot build ${page} URL without a redaction run ID`,
      );
    }

    return `/${page}?documentId=${encodedDocumentId}&runId=${encodeURIComponent(
      currentRedactionRunId,
    )}`;
  }

  return `/${page}?documentId=${encodedDocumentId}`;
}

export function isWorkflowPageAllowed(
  currentPage: WorkflowPage,
  allowedPages: readonly WorkflowPage[],
): boolean {
  return allowedPages.includes(currentPage);
}
