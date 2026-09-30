"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../lib/api";

const NO_FILE_ERROR =
  "Select a PDF file";

const FILE_TYPE_ERROR =
  "The selected file must be a PDF";

const BODY_TEXT_SUMMARY_ERROR =
  "The selected file must contain text";

const BODY_TEXT_INLINE_ERROR =
  "Select a file that contains text";

const UPLOAD_ERROR =
  "There was a problem uploading the file. Try again.";

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

type ValidationError = {
  summary: string;
  inline: string;
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [
    validationError,
    setValidationError,
  ] = useState<ValidationError | null>(null);

  const [
    technicalError,
    setTechnicalError,
  ] = useState<string | null>(null);

  function handleFileChange() {
    setValidationError(null);
    setTechnicalError(null);
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
    setValidationError(null);
    setTechnicalError(null);

    const files = inputRef.current?.files;
    const file = files?.[0];

    if (!file || files.length !== 1) {
      setValidationError({
        summary: NO_FILE_ERROR,
        inline: NO_FILE_ERROR,
      });

      resetSubmittingState();
      return;
    }

    if (!isPdf(file)) {
      setValidationError({
        summary: FILE_TYPE_ERROR,
        inline: FILE_TYPE_ERROR,
      });

      resetSubmittingState();
      return;
    }

    let analysis: PdfAnalysisResult;

    try {
      analysis = await analysePdf(file);
      console.log("PDF analysis", analysis);
    } catch (err) {
      console.error("PDF analysis failed", err);
      setTechnicalError(
        "The selected file could not be checked – try again",
      );
      resetSubmittingState();
      return;
    }

    if (!analysis.hasBodyText) {
      setValidationError({
        summary:
          BODY_TEXT_SUMMARY_ERROR,
        inline:
          BODY_TEXT_INLINE_ERROR,
      });

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

      setTechnicalError(
        UPLOAD_ERROR,
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
    <div className="jr-upload-page">
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">

          {technicalError && (
            <div
              role="alert"
              className="moj-alert moj-alert--error jr-upload-api-alert"
              aria-label={`error: ${technicalError}`}
              data-module="moj-alert"
            >
              <div>
                <svg
                  className="moj-alert__icon"
                  role="presentation"
                  focusable="false"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 30 30"
                  height="30"
                  width="30"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20.1777 2.5H9.82233L2.5 9.82233V20.1777L9.82233 27.5H20.1777L27.5 20.1777V9.82233L20.1777 2.5ZM10.9155 8.87769L15.0001 12.9623L19.0847 8.87771L21.1224 10.9154L17.0378 15L21.1224 19.0846L19.0847 21.1222L15.0001 17.0376L10.9155 21.1223L8.87782 19.0846L12.9624 15L8.87783 10.9153L10.9155 8.87769Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div className="moj-alert__content">
                {technicalError}
              </div>
            </div>
          )}

          {validationError && (
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
                    <a
                      href="#file-upload-1"
                      className="govuk-error-summary__link"
                    >
                      {validationError.summary}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          )}

          <h1 className="govuk-heading-xl">
            {validationError
              ? "Upload a document"
              : "Upload a file"}
          </h1>

          <p className="govuk-body-l">
            Justice Redact uses artificial intelligence (AI) to suggest what to
            pay attention to when you&apos;re redacting a file.
          </p>

          <h2 className="govuk-heading-m">
            Your responsibilities
          </h2>

          <p className="govuk-body">
            The AI only looks for indicators of what might need to be redacted.
            Also, it can miss things and make mistakes. This means you might have
            to redact more or less than the AI suggestions show.
          </p>

          <div className="jr-upload-responsibilities">
            <span
              className="govuk-warning-text__icon"
              aria-hidden="true"
            >
              !
            </span>

            <div>
              <p className="govuk-body govuk-!-margin-bottom-1">
                <strong>
                  You&apos;re responsible for:
                </strong>
              </p>

              <ul className="govuk-list govuk-list--bullet govuk-!-font-weight-bold govuk-!-margin-bottom-0">
                <li>
                  the final decision on what to redact and disclose
                </li>
                <li>
                  applying relevant legislation and policies when redacting, for
                  example the Data Protection Act 2018
                </li>
              </ul>
            </div>
          </div>

          <h2 className="govuk-heading-m govuk-!-margin-top-6">
            What you can upload
          </h2>

          <p className="govuk-body">
            You can only upload unvetted NOMIS files or DPS case notes.
          </p>

          <h2 className="govuk-heading-m">
            If your file is already vetted
          </h2>

          <p className="govuk-body">
            You cannot upload vetted documents. Instead, use Adobe Acrobat to make
            changes to the document - you&apos;ll need to sanitise the document
            when exporting it.
          </p>

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpload();
            }}
          >
            <div
              className={`govuk-form-group${validationError
                ? " govuk-form-group--error"
                : ""
                }`}
            >
              <label
                className="govuk-label"
                htmlFor="file-upload-1"
              >
                Upload a file
              </label>

              {validationError && (
                <p
                  id="file-upload-1-error"
                  className="govuk-error-message"
                >
                  <span className="govuk-visually-hidden">
                    Error:
                  </span>{" "}
                  {validationError.inline}
                </p>
              )}

              <div
                className="govuk-file-upload-wrapper"
                data-module="govuk-file-upload"
              >
                <input
                  ref={inputRef}
                  className={`govuk-file-upload${validationError
                    ? " govuk-file-upload--error"
                    : ""
                    }`}
                  id="file-upload-1"
                  name="fileUpload1"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={isSubmitting}
                  aria-describedby={
                    validationError
                      ? "file-upload-1-error"
                      : undefined
                  }
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <button
              type="submit"
              className="govuk-button"
              data-module="govuk-button"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
            >
              {isSubmitting
                ? "Checking document…"
                : "Upload and continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}