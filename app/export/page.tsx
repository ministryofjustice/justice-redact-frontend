"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ExportResponse = {
  documentId: string;
  filename: string;
  status: string;
  exportUrl?: string;
  pageCount?: number;
};

export default function ExportPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const [data, setData] = useState<ExportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExport() {
      if (!documentId) {
        setError("Missing document ID.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/export`
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || "Failed to load export details.");
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load export details.");
      } finally {
        setIsLoading(false);
      }
    }

    loadExport();
  }, [documentId]);

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">Redaction complete</h1>

        {isLoading && <p className="govuk-body">Loading export details...</p>}

        {error && (
          <p className="govuk-error-message">
            <span className="govuk-visually-hidden">Error:</span> {error}
          </p>
        )}

        {data && (
          <>
            <p className="govuk-body-l">{data.filename}</p>

            <table className="govuk-table">
              <caption className="govuk-table__caption govuk-table__caption--m">
                Exported documents
              </caption>
              <thead className="govuk-table__head">
                <tr className="govuk-table__row">
                  <th scope="col" className="govuk-table__header">
                    Document
                  </th>
                  <th scope="col" className="govuk-table__header">
                    Description
                  </th>
                  <th
                    scope="col"
                    className="govuk-table__header govuk-table__cell--numeric"
                  >
                    
                  </th>
                </tr>
              </thead>
              <tbody className="govuk-table__body">
                <tr className="govuk-table__row">
                  <th scope="row" className="govuk-table__header">
                    {data.exportUrl ? (
                      <h4>
                        Redacted
                      </h4>
                    ) : (
                      "Redacted"
                    )}
                  </th>
                  <td className="govuk-table__cell">
                    Redactions applied in black and all highlights removed.
                  </td>
                  <td className="govuk-table__cell govuk-table__cell--numeric">
                  <a
                        href={`${process.env.NEXT_PUBLIC_API_BASE_URL}${data.exportUrl}`}
                        className="govuk-link govuk-link--no-visited-state"
                        download
                      >
                        Download
                      </a>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="govuk-button-group">
              {data.exportUrl ? (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL}${data.exportUrl}`}
                  className="govuk-button"
                  data-module="govuk-button"
                  download
                >
                  Download redacted file
                </a>
              ) : (
                <button
                  type="button"
                  className="govuk-button"
                  data-module="govuk-button"
                  disabled
                  aria-disabled="true"
                >
                  Download redacted file
                </button>
              )}

              <a href="/" className="govuk-link govuk-link--no-visited-state">
                Vet another document
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}