import { describe, expect, it } from "vitest";

import {
  buildWorkflowUrl,
  isWorkflowPageAllowed,
} from "../app/lib/workflowNavigation";

describe("buildWorkflowUrl", () => {
  it("builds the upload route without a document ID", () => {
    expect(buildWorkflowUrl("upload", "document-123")).toBe("/upload");
  });

  it("builds the warning route for a document", () => {
    expect(
      buildWorkflowUrl("document-warning", "document-123")
    ).toBe("/document-warning?documentId=document-123");
  });

  it("builds the subject details route for a document", () => {
    expect(
      buildWorkflowUrl("subject-details", "document-123")
    ).toBe("/subject-details?documentId=document-123");
  });

  it("builds the processing route for a document", () => {
    expect(
      buildWorkflowUrl("processing", "document-123")
    ).toBe("/processing?documentId=document-123");
  });

  it("builds the review route for a document", () => {
    expect(
      buildWorkflowUrl("review", "document-123")
    ).toBe("/review?documentId=document-123");
  });

  it("builds the applying redactions route with the current run ID", () => {
    expect(
      buildWorkflowUrl(
        "applying-redactions",
        "document-123",
        "run-456",
      )
    ).toBe(
      "/applying-redactions?documentId=document-123&runId=run-456"
    );
  });

  it("throws when building the applying redactions route without a run ID", () => {
    expect(() =>
      buildWorkflowUrl("applying-redactions", "document-123")
    ).toThrow(
      "Cannot build applying-redactions URL without a redaction run ID"
    );
  });

  it("builds the export route with the current run ID", () => {
    expect(
      buildWorkflowUrl(
        "export",
        "document-123",
        "run-456",
      )
    ).toBe(
      "/export?documentId=document-123&runId=run-456"
    );
  });

  it("throws when building the export route without a run ID", () => {
    expect(() =>
      buildWorkflowUrl("export", "document-123")
    ).toThrow(
      "Cannot build export URL without a redaction run ID"
    );
  });

  it("URL encodes the document ID", () => {
    expect(
      buildWorkflowUrl("review", "document/123")
    ).toBe("/review?documentId=document%2F123");
  });
});

describe("isWorkflowPageAllowed", () => {
  it("allows the current page when it is returned by the backend", () => {
    expect(
      isWorkflowPageAllowed("review", ["review"])
    ).toBe(true);
  });

  it("rejects a page that is not returned by the backend", () => {
    expect(
      isWorkflowPageAllowed("export", ["review"])
    ).toBe(false);
  });

  it("supports more than one valid page for a document", () => {
    expect(
      isWorkflowPageAllowed("review", ["review", "export"])
    ).toBe(true);

    expect(
      isWorkflowPageAllowed("export", ["review", "export"])
    ).toBe(true);
  });
});
