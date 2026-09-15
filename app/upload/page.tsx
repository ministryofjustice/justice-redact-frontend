"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../lib/api";
import BackLink from "../components/BackLink";

const FILE_ERROR =
  "The selected file must be a NOMIS or DPS file in PDF format";

const BODY_TEXT_ERROR = "Select a document that contains body text";

const MINIMUM_BODY_CHARACTERS = 50;
const MAX_VALIDATION_PAGES = 20;
const LEADING_VALIDATION_PAGES = 10;

type DocumentType = "nomis" | "dps" | "unidentified";

type PdfAnalysisResult = {
  hasBodyText: boolean;
  mightBeScannedDocument: boolean;
  documentType: DocumentType;
};

type UploadDocumentResponse = {
  documentId: string;
  status: string;
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange() {
    setError(null);
  }

  function resetSubmittingState() {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  }

  function isPdf(file: File) {
    return (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );
  }

  function normaliseText(text: string) {
    return text.replace(/\s+/g, " ").trim();
  }

  function getValidationPageNumbers(
    totalPages: number
  ): number[] {
    if (totalPages <= MAX_VALIDATION_PAGES) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    const pageNumbers = new Set<number>();

    const leadingPageCount = Math.min(
      LEADING_VALIDATION_PAGES,
      totalPages
    );

    for (
      let pageNumber = 1;
      pageNumber <= leadingPageCount;
      pageNumber += 1
    ) {
      pageNumbers.add(pageNumber);
    }

    const remainingSampleCount =
      MAX_VALIDATION_PAGES - leadingPageCount;

    for (
      let index = 1;
      index <= remainingSampleCount;
      index += 1
    ) {
      const pageNumber =
        leadingPageCount +
        Math.round(
          ((totalPages - leadingPageCount) * index) /
          remainingSampleCount
        );

      pageNumbers.add(
        Math.min(totalPages, pageNumber)
      );
    }

    return Array.from(pageNumbers).sort(
      (left, right) => left - right
    );
  }

  async function analysePdf(
    file: File
  ): Promise<PdfAnalysisResult> {
    const pdfjsLib = await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
    });

    try {
      const pdf = await loadingTask.promise;

      const metadata = await pdf
        .getMetadata()
        .catch(() => null);

      const metadataTitle =
        "info" in (metadata ?? {}) &&
          metadata?.info &&
          "Title" in metadata.info &&
          typeof metadata.info.Title === "string"
          ? metadata.info.Title
          : "";

      const firstPageLines: string[] = [];
      const sampledDocumentLines: string[] = [];

      let bodyTextLength = 0;
      let sampledPagesWithImages = 0;

      const validationPageNumbers =
        getValidationPageNumbers(
          pdf.numPages
        );

      for (
        const pageNumber
        of validationPageNumbers
      ) {
        const page =
          await pdf.getPage(pageNumber);

        try {
          const viewport =
            page.getViewport({
              scale: 1,
            });

          const textContent =
            await page.getTextContent();

          const pageLines = textContent.items
            .map((item) => {
              if (
                !("str" in item) ||
                typeof item.str !== "string"
              ) {
                return null;
              }

              const text =
                normaliseText(item.str);

              const y =
                Array.isArray(item.transform)
                  ? item.transform[5]
                  : undefined;

              if (
                !text ||
                typeof y !== "number"
              ) {
                return null;
              }

              return {
                text,
                y,
              };
            })
            .filter(
              (
                item
              ): item is {
                text: string;
                y: number;
              } => item !== null
            );

          const pageTextLines =
            pageLines.map(
              ({ text }) => text
            );

          sampledDocumentLines.push(
            ...pageTextLines
          );

          if (pageNumber === 1) {
            firstPageLines.push(
              ...pageTextLines
            );
          }

          const topBoundary =
            viewport.height * 0.85;

          const bottomBoundary =
            viewport.height * 0.15;

          const meaningfulBodyLines =
            pageLines
              .filter(
                ({ y }) =>
                  y < topBoundary &&
                  y > bottomBoundary
              )
              .map(({ text }) => text)
              .filter((line) => {
                const isTooShort =
                  line.length < 3;

                const isPageNumber =
                  /^\d+$/.test(line);

                const hasWords =
                  /[a-zA-Z]{2,}/.test(
                    line
                  );

                return (
                  !isTooShort &&
                  !isPageNumber &&
                  hasWords
                );
              });

          bodyTextLength +=
            meaningfulBodyLines.join(
              " "
            ).length;

          /*
           * Once there is substantial body text,
           * this cannot meet the scanned-document
           * rule, so avoid the relatively expensive
           * operator-list inspection.
           */
          if (bodyTextLength < 500) {
            const operatorList =
              await page.getOperatorList();

            const pageHasImage =
              operatorList.fnArray.some(
                (fn) =>
                  fn ===
                  pdfjsLib.OPS
                    .paintImageXObject ||
                  fn ===
                  pdfjsLib.OPS
                    .paintInlineImageXObject ||
                  fn ===
                  pdfjsLib.OPS
                    .paintImageXObjectRepeat
              );

            if (pageHasImage) {
              sampledPagesWithImages += 1;
            }
          }
        } finally {
          page.cleanup();
        }
      }

      const firstPageText =
        normaliseText(
          firstPageLines.join(" ")
        ).toLowerCase();

      const sampledDocumentText =
        normaliseText(
          sampledDocumentLines.join(" ")
        ).toLowerCase();

      const title =
        metadataTitle.toLowerCase();

      const isNomisDocument =
        firstPageText.includes("nomis") ||
        firstPageText.includes("noms") ||
        sampledDocumentText.includes(
          "module: sar_"
        );

      const isDpsDocument =
        (
          firstPageText.includes(
            "location"
          ) &&
          firstPageText.includes(
            "category"
          ) &&
          firstPageText.includes(
            "csra"
          ) &&
          firstPageText.includes(
            "incentive level"
          )
        ) ||
        title.includes("dps") ||
        (
          sampledDocumentText.includes(
            "created by:"
          ) &&
          sampledDocumentText.includes(
            "happened:"
          )
        );

      const hasBodyText =
        bodyTextLength >=
        MINIMUM_BODY_CHARACTERS;

      const mightBeScannedDocument =
        bodyTextLength < 500 &&
        validationPageNumbers.length > 0 &&
        sampledPagesWithImages ===
        validationPageNumbers.length;

      const documentType: DocumentType =
        isNomisDocument
          ? "nomis"
          : isDpsDocument
            ? "dps"
            : "unidentified";

      return {
        hasBodyText,
        mightBeScannedDocument,
        documentType,
      };
    } finally {
      try {
        await loadingTask.destroy();
      } catch (cleanupError) {
        console.warn(
          "Failed to clean up PDF.js loading task",
          cleanupError
        );
      }
    }
  }

  async function handleUpload() {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    const files = inputRef.current?.files;
    const file = files?.[0];

    if (!file || files.length !== 1 || !isPdf(file)) {
      setError(FILE_ERROR);
      resetSubmittingState();
      return;
    }

    let analysis: PdfAnalysisResult;

    try {
      analysis = await analysePdf(file);
      console.log("PDF analysis", analysis);
    } catch (err) {
      console.error("PDF analysis failed", err);
      setError("The selected file could not be checked – try again");
      resetSubmittingState();
      return;
    }

    if (!analysis.hasBodyText) {
      setError(BODY_TEXT_ERROR);
      resetSubmittingState();
      return;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("documentType", analysis.documentType);

    if (analysis.mightBeScannedDocument) {
      formData.append("warningReason", "scanned");
    } else if (analysis.documentType === "unidentified") {
      formData.append(
        "warningReason",
        "unsupported-document-type"
      );
    }

    let uploadedDocument: UploadDocumentResponse;

    try {
      uploadedDocument = await fetchJson<UploadDocumentResponse>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
    } catch (err) {
      console.error("Document upload failed", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload document."
      );

      resetSubmittingState();
      return;
    }

    if (analysis.mightBeScannedDocument) {
      router.push(
        `/document-warning?reason=scanned&documentId=${encodeURIComponent(
          uploadedDocument.documentId
        )}&filename=${encodeURIComponent(file.name)}`
      );
      return;
    }

    if (analysis.documentType === "unidentified") {
      router.push(
        `/document-warning?reason=unsupported-document-type&documentId=${encodeURIComponent(
          uploadedDocument.documentId
        )}&filename=${encodeURIComponent(file.name)}`
      );
      return;
    }

    router.push(
      `/subject-details?documentId=${encodeURIComponent(
        uploadedDocument.documentId
      )}&filename=${encodeURIComponent(file.name)}`
    );
  }

  return (
    <main className="govuk-main-wrapper" id="main-content">
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <BackLink href="/" />

          {error && (
            <div
              className="govuk-error-summary"
              data-module="govuk-error-summary"
              aria-labelledby="error-summary-title"
              role="alert"
              tabIndex={-1}
            >
              <h2
                className="govuk-error-summary__title"
                id="error-summary-title"
              >
                There is a problem
              </h2>

              <div className="govuk-error-summary__body">
                <ul className="govuk-list govuk-error-summary__list">
                  <li>
                    <a href="#file-upload-1">{error}</a>
                  </li>
                </ul>
              </div>
            </div>
          )}

          <h1 className="govuk-heading-xl">
            Upload a document
          </h1>

          <aside
            className="govuk-inset-text guidance-panel"
            aria-label="Upload guidance"
          >
            <p className="govuk-body">
              Only NOMIS and DPS documents can be processed at the moment.
            </p>
          </aside>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpload();
            }}
          >
            <section aria-labelledby="upload-file-heading">
              <div
                className={`govuk-form-group${error ? " govuk-form-group--error" : ""
                  }`}
              >
                <h2 className="govuk-label-wrapper">
                  <label
                    className="govuk-label govuk-label--m"
                    htmlFor="file-upload-1"
                    id="upload-file-heading"
                  >
                    Upload a file
                  </label>
                </h2>

                <div
                  id="file-upload-1-hint"
                  className="govuk-hint"
                >
                  Only NOMIS and DPS documents can be processed at the
                  moment
                </div>

                {error && (
                  <p
                    id="file-upload-1-error"
                    className="govuk-error-message"
                  >
                    <span className="govuk-visually-hidden">
                      Error:
                    </span>{" "}
                    {error}
                  </p>
                )}

                <div
                  className="govuk-drop-zone"
                  data-module="govuk-file-upload"
                >
                  <input
                    ref={inputRef}
                    className={`govuk-file-upload${error ? " govuk-file-upload--error" : ""
                      }`}
                    id="file-upload-1"
                    name="fileUpload1"
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={isSubmitting}
                    aria-describedby={
                      error
                        ? "file-upload-1-hint file-upload-1-error"
                        : "file-upload-1-hint"
                    }
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </section>

            <button
              type="submit"
              className="govuk-button"
              data-module="govuk-button"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            >
              {isSubmitting ? "Checking document…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}