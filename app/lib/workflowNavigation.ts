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
  preferredPage: WorkflowPage;
  allowedPages: WorkflowPage[];
};

export function buildWorkflowUrl(
  page: WorkflowPage,
  documentId: string,
): string {
  if (page === "upload") {
    return "/upload";
  }

  return `/${page}?documentId=${encodeURIComponent(documentId)}`;
}

export function isWorkflowPageAllowed(
  currentPage: WorkflowPage,
  allowedPages: readonly WorkflowPage[],
): boolean {
  return allowedPages.includes(currentPage);
}
