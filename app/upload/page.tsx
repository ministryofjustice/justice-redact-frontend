"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FILE_ERROR =
  "The selected file must be a NOMIS or DPS file in PDF format";

const BODY_TEXT_ERROR = "Select a document that contains body text";

const MINIMUM_BODY_CHARACTERS = 50;

type PdfAnalysisResult = {
  hasBodyText: boolean;
  mightBeScannedDocument: boolean;
};

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<string | null>(null);

  function handleFileChange(_: ChangeEvent<HTMLInputElement>) {
    setError(null);
  }

  function isPdf(file: File) {
    return (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    );
  }

  async function analysePdf(file: File): Promise<PdfAnalysisResult> {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const allBodyLines: string[] = [];
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
        .map((item: any) => {
          const text = item.str?.trim();
          const y = item.transform?.[5];

          if (!text || typeof y !== "number") {
            return null;
          }

          return { text, y };
        })
        .filter(Boolean) as Array<{ text: string; y: number }>;

      const bodyLines = pageLines
        .filter(({ y }) => {
          const topBoundary = viewport.height * 0.85;
          const bottomBoundary = viewport.height * 0.15;

          return y < topBoundary && y > bottomBoundary;
        })
        .map(({ text }) => text);

      allBodyLines.push(...bodyLines);
    }

    const normalisedLines = allBodyLines.map((line) =>
      line.replace(/\s+/g, " ").trim()
    );

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

    const bodyTextLength = meaningfulLines.join(" ").length;
    const hasBodyText = bodyTextLength >= MINIMUM_BODY_CHARACTERS;

    const mightBeScannedDocument =
      imageCount >= pdf.numPages && bodyTextLength < 500;

    console.log({
      pages: pdf.numPages,
      imageCount,
      bodyTextLength,
      hasBodyText,
      mightBeScannedDocument,
    });

    return {
      hasBodyText,
      mightBeScannedDocument,
    };
  }

  async function handleUpload() {
    const files = inputRef.current?.files;
    const file = files?.[0];

    if (!file || files.length !== 1 || !isPdf(file)) {
      setError(FILE_ERROR);
      return;
    }

    const analysis = await analysePdf(file);
    console.log("PDF analysis", analysis);

    if (!analysis.hasBodyText) {
      setError(BODY_TEXT_ERROR);
      return;
    }

    if (analysis.mightBeScannedDocument) {
      router.push(`/scanned-document?filename=${encodeURIComponent(file.name)}`);
      return;
    }

    router.push(`/subject-details?filename=${encodeURIComponent(file.name)}`);
  }

  return (
    <div className="govuk-grid-row">

      <div className="govuk-grid-column-two-thirds">
        <a href="/" className="govuk-back-link">
          Back
        </a>
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

        <div className="govuk-inset-text guidance-panel">
          <p className="govuk-body">
            Only NOMIS and DPS documents can be processed at the moment.
          </p>
        </div>

        <div
          className={`govuk-form-group${error ? " govuk-form-group--error" : ""
            }`}
        >
          <label className="govuk-label" htmlFor="file-upload-1">
            Upload a file
          </label>

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
              className={`govuk-file-upload${error ? " govuk-file-upload--error" : ""}`}
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

        <button
          type="button"
          className="govuk-button"
          data-module="govuk-button"
          onClick={handleUpload}
        >
          Continue
        </button>
      </div>
    </div>
  );
}