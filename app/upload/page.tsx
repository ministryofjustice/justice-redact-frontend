"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FILE_ERROR =
  "The selected file must be a NOMIS or DPS file in PDF format";

const BODY_TEXT_ERROR = "Select a document that contains body text";

const MINIMUM_BODY_CHARACTERS = 50;

type PdfAnalysisResult = {
  hasBodyText: boolean;
  mightBeScannedDocument: boolean;
  isSupportedDocumentType: boolean;
};

type UploadDocumentResponse = {
  documentId: string;
  status: string;
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<string | null>(null);

  function handleFileChange() {
    setError(null);
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

  async function analysePdf(file: File): Promise<PdfAnalysisResult> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const metadata = await pdf.getMetadata().catch(() => null);

    const metadataTitle =
      "info" in (metadata ?? {}) &&
        metadata?.info &&
        "Title" in metadata.info &&
        typeof metadata.info.Title === "string"
        ? metadata.info.Title
        : "";

    const allBodyLines: string[] = [];
    const allDocumentLines: string[] = [];
    const firstPageLines: string[] = [];

    let imageCount = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      const textContent = await page.getTextContent();
      const operatorList = await page.getOperatorList();

      imageCount += operatorList.fnArray.filter(
        (fn) =>
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject ||
          fn === pdfjsLib.OPS.paintImageXObjectRepeat
      ).length;

      const pageLines = textContent.items
        .map((item) => {
          if (!("str" in item) || typeof item.str !== "string") {
            return null;
          }

          const text = item.str.trim();
          const y = Array.isArray(item.transform)
            ? item.transform[5]
            : undefined;

          if (!text || typeof y !== "number") {
            return null;
          }

          return { text, y };
        })
        .filter(Boolean) as Array<{ text: string; y: number }>;

      const pageTextLines = pageLines.map(({ text }) => text);
      allDocumentLines.push(...pageTextLines);

      if (pageNumber === 1) {
        firstPageLines.push(...pageTextLines);
      }

      const bodyLines = pageLines
        .filter(({ y }) => {
          const topBoundary = viewport.height * 0.85;
          const bottomBoundary = viewport.height * 0.15;

          return y < topBoundary && y > bottomBoundary;
        })
        .map(({ text }) => text);

      allBodyLines.push(...bodyLines);
    }

    const normalisedLines = allBodyLines.map(normaliseText);

    const lineCounts = normalisedLines.reduce<Record<string, number>>(
      (acc, line) => {
        acc[line] = (acc[line] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const meaningfulLines = normalisedLines.filter((line) => {
      const isRepeatedHeaderOrFooter = lineCounts[line] > 1;
      const isTooShort = line.length < 3;
      const isPageNumber = /^\d+$/.test(line);
      const hasWords = /[a-zA-Z]{2,}/.test(line);

      return (
        !isRepeatedHeaderOrFooter &&
        !isTooShort &&
        !isPageNumber &&
        hasWords
      );
    });

    const firstPageText = normaliseText(firstPageLines.join(" ")).toLowerCase();
    const repeatedText = normaliseText(allDocumentLines.join(" ")).toLowerCase();
    const title = metadataTitle.toLowerCase();

    const isNomisDocument =
      firstPageText.includes("nomis") ||
      firstPageText.includes("noms") ||
      repeatedText.includes("module: sar_");

    const isDpsDocument =
      (firstPageText.includes("location") &&
        firstPageText.includes("category") &&
        firstPageText.includes("csra") &&
        firstPageText.includes("incentive level")) ||
      title.includes("dps") ||
      (repeatedText.includes("created by:") &&
        repeatedText.includes("happened:"));

    const bodyTextLength = meaningfulLines.join(" ").length;
    const hasBodyText = bodyTextLength >= MINIMUM_BODY_CHARACTERS;

    const mightBeScannedDocument =
      imageCount >= pdf.numPages && bodyTextLength < 500;

    return {
      hasBodyText,
      mightBeScannedDocument,
      isSupportedDocumentType: isNomisDocument || isDpsDocument,
    };
  }

  async function handleUpload() {
    const files = inputRef.current?.files;
    const file = files?.[0];

    if (!file || files.length !== 1 || !isPdf(file)) {
      setError(FILE_ERROR);
      return;
    }

    let analysis: PdfAnalysisResult;

    try {
      analysis = await analysePdf(file);
      console.log("PDF analysis", analysis);
    } catch (err) {
      console.error("PDF analysis failed", err);
      setError("The selected file could not be checked – try again");
      return;
    }

    if (!analysis.hasBodyText) {
      setError(BODY_TEXT_ERROR);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    let uploadedDocument: UploadDocumentResponse;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to upload document.");
      }

      uploadedDocument = data;
    } catch (err) {
      console.error("Document upload failed", err);
      setError(err instanceof Error ? err.message : "Failed to upload document.");
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

    if (!analysis.isSupportedDocumentType) {
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
          <Link href="/" className="govuk-back-link">
            Back
          </Link>

          {error && (
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
                <ul className="govuk-list govuk-error-summary__list">
                  <li>
                    <a href="#file-upload-1">{error}</a>
                  </li>
                </ul>
              </div>
            </div>
          )}

          <h1 className="govuk-heading-xl">Upload a document</h1>

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
              handleUpload();
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

                <div id="file-upload-1-hint" className="govuk-hint">
                  Only NOMIS and DPS documents can be processed at the moment
                </div>

                {error && (
                  <p id="file-upload-1-error" className="govuk-error-message">
                    <span className="govuk-visually-hidden">Error:</span> {error}
                  </p>
                )}

                <div className="govuk-drop-zone" data-module="govuk-file-upload">
                  <input
                    ref={inputRef}
                    className={`govuk-file-upload${error ? " govuk-file-upload--error" : ""
                      }`}
                    id="file-upload-1"
                    name="fileUpload1"
                    type="file"
                    accept=".pdf,application/pdf"
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
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}