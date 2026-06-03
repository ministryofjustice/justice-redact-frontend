"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ExportResponse = {
    documentId: string;
    filename: string;
    status: string;
    exportUrl?: string;
    pageCount?: number;
};

function ExportContent() {
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

    const downloadUrl = data?.exportUrl
        ? `${process.env.NEXT_PUBLIC_API_BASE_URL}${data.exportUrl}`
        : null;

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">Redaction complete</h1>

                    {isLoading && (
                        <section aria-live="polite">
                            <p className="govuk-body">Loading export details...</p>
                        </section>
                    )}

                    {error && (
                        <section aria-labelledby="export-error-title">
                            <div
                                className="govuk-error-summary"
                                data-module="govuk-error-summary"
                                aria-labelledby="export-error-title"
                                role="alert"
                                tabIndex={-1}
                            >
                                <h2 className="govuk-error-summary__title" id="export-error-title">
                                    There is a problem
                                </h2>

                                <div className="govuk-error-summary__body">
                                    <p className="govuk-body">{error}</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {data && (
                        <>
                            <section aria-labelledby="page-counts-heading" className="page-counts-section">
                                <h2 className="govuk-heading-m" id="page-counts-heading">
                                    Page counts
                                </h2>

                                <dl className="page-counts">
                                    <div className="page-counts__item">
                                        <dt className="page-counts__number">326</dt>
                                        <dd className="page-counts__label">pages in original document</dd>
                                    </div>

                                    <div className="page-counts__divider" aria-hidden="true" />

                                    <div className="page-counts__item">
                                        <dt className="page-counts__number">12</dt>
                                        <dd className="page-counts__label">exempt pages removed</dd>
                                    </div>

                                    <div className="page-counts__item">
                                        <dt className="page-counts__number">7</dt>
                                        <dd className="page-counts__label">pages deleted</dd>
                                    </div>

                                    <div className="page-counts__item">
                                        <dt className="page-counts__number">307</dt>
                                        <dd className="page-counts__label">pages in redacted document</dd>
                                    </div>
                                </dl>
                            </section>
                            <section aria-labelledby="exported-documents-heading">

                                <table className="govuk-table">
                                    <caption
                                        className="govuk-table__caption govuk-table__caption--m"
                                        id="exported-documents-heading"
                                    >
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
                                            <th scope="col" className="govuk-table__header">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="govuk-table__body">
                                        <tr className="govuk-table__row">
                                            <th scope="row" className="govuk-table__header">
                                                Redacted
                                            </th>
                                            <td className="govuk-table__cell">
                                                Redactions applied in black and all highlights removed.
                                            </td>
                                            <td className="govuk-table__cell">
                                                {downloadUrl ? (
                                                    <a
                                                        href={downloadUrl}
                                                        className="govuk-link govuk-link--no-visited-state"
                                                        download
                                                    >
                                                        Download
                                                    </a>
                                                ) : (
                                                    <span className="govuk-body">Not available</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="govuk-button-group">
                                    {downloadUrl ? (
                                        <a
                                            href={downloadUrl}
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
                            </section>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function ExportPage() {
    return (
        <Suspense
            fallback={
                <main className="govuk-main-wrapper" id="main-content">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            <p className="govuk-body" role="status" aria-live="polite">
                                Loading export page...
                            </p>
                        </div>
                    </div>
                </main>
            }
        >
            <ExportContent />
        </Suspense>
    );
}