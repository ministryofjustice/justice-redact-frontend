"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("No file chosen");
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasValidFile, setHasValidFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function isPdf(file: File) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function setValidFile(file: File) {
    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setError(null);
    setHasValidFile(true);
  }

  function clearFile(message?: string) {
    if (isSubmitting) return;

    setSelectedFile(null);
    setFileName("No file chosen");
    setFileSize(null);
    setError(message ?? null);
    setHasValidFile(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleSelectedFiles(fileList: FileList | null) {
    if (isSubmitting) return;

    if (!fileList || fileList.length === 0) {
      clearFile();
      return;
    }

    if (fileList.length > 1) {
      clearFile("Upload only 1 PDF file.");
      return;
    }

    const file = fileList[0];

    if (!isPdf(file)) {
      clearFile("You must upload a PDF file.");
      return;
    }

    setValidFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsDragging(false);
    handleSelectedFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsDragging(false);
  }

  function openFilePicker() {
    if (isSubmitting) return;
    inputRef.current?.click();
  }

  async function handleContinue() {
    if (!selectedFile || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Upload failed");
      }

      router.push(
        `/subject-details?documentId=${data.documentId}&filename=${encodeURIComponent(selectedFile.name)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">Upload a document</h1>

        <div className="govuk-inset-text guidance-panel">
          <p>Only NOMIS documents can be processed at the moment.</p>
        </div>

        <div className={`govuk-form-group ${error ? "govuk-form-group--error" : ""}`}>
          <label className="govuk-label" htmlFor="file-upload-1">
            Upload a file
          </label>

          <div id="file-upload-1-hint" className="govuk-hint">
            Only pdf documents can be processed at the moment
          </div>

          {error && (
            <p id="file-upload-1-error" className="govuk-error-message">
              <span className="govuk-visually-hidden">Error:</span> {error}
            </p>
          )}

          <div
            className={[
              "govuk-file-upload-button",
              "govuk-file-upload-button--empty",
              isDragging ? "custom-file-upload--dragging" : "",
              error ? "custom-file-upload--error" : "",
              isSubmitting ? "custom-file-upload--disabled" : "",
            ].join(" ")}
            onClick={openFilePicker}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            aria-disabled={isSubmitting}
          >
            <div className="govuk-file-upload-button__status govuk-body custom-file-upload__status">
              {fileName}
              {fileSize && <div className="govuk-hint custom-file-upload__meta">{fileSize}</div>}
            </div>

            <div className="govuk-file-upload-button__pseudo-button-container">
              <button
                type="button"
                className="govuk-button govuk-button--secondary govuk-file-upload-button__pseudo-button"
                onClick={(e) => {
                  e.stopPropagation();
                  openFilePicker();
                }}
                disabled={isSubmitting}
              >
                Choose file
              </button>
              <p className="govuk-body govuk-file-upload-button__instruction">
                {isSubmitting ? "Uploading document..." : "or drag and drop"}
              </p>
            </div>

            <input
              ref={inputRef}
              className="govuk-file-upload custom-file-upload__input"
              id="file-upload-1"
              name="fileUpload1"
              type="file"
              accept=".pdf,application/pdf"
              multiple={false}
              aria-describedby={
                error ? "file-upload-1-hint file-upload-1-error" : "file-upload-1-hint"
              }
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <button
          type="button"
          className="govuk-button"
          disabled={!hasValidFile || isSubmitting}
          aria-disabled={!hasValidFile || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Uploading..." : "Continue"}
        </button>
      </div>
    </div>
  );
}